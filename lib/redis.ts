/* eslint-disable @typescript-eslint/no-explicit-any */

// In-memory fallback store for development without Redis
class MemoryStore {
    private store: Map<string, string> = new Map();

    async get(key: string): Promise<string | null> {
        return this.store.get(key) || null;
    }

    async set(key: string, value: string, ...args: unknown[]): Promise<'OK'> {
        this.store.set(key, value);
        if (args[0] === 'EX' && typeof args[1] === 'number') {
            setTimeout(() => this.store.delete(key), (args[1] as number) * 1000);
        }
        return 'OK';
    }

    async del(...keys: string[]): Promise<number> {
        let count = 0;
        for (const key of keys) {
            if (this.store.delete(key)) count++;
        }
        return count;
    }

    async keys(pattern: string): Promise<string[]> {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(this.store.keys()).filter(k => regex.test(k));
    }

    async hset(key: string, field: string, value: string): Promise<number> {
        const existing = this.store.get(key);
        const hash = existing ? JSON.parse(existing) : {};
        hash[field] = value;
        this.store.set(key, JSON.stringify(hash));
        return 1;
    }

    async hget(key: string, field: string): Promise<string | null> {
        const existing = this.store.get(key);
        if (!existing) return null;
        const hash = JSON.parse(existing);
        return hash[field] || null;
    }

    async hgetall(key: string): Promise<Record<string, string>> {
        const existing = this.store.get(key);
        if (!existing) return {};
        return JSON.parse(existing);
    }

    async hdel(key: string, ...fields: string[]): Promise<number> {
        const existing = this.store.get(key);
        if (!existing) return 0;
        const hash = JSON.parse(existing);
        let count = 0;
        for (const field of fields) {
            if (field in hash) { delete hash[field]; count++; }
        }
        this.store.set(key, JSON.stringify(hash));
        return count;
    }

    async expire(key: string, seconds: number): Promise<number> {
        if (this.store.has(key)) {
            setTimeout(() => this.store.delete(key), seconds * 1000);
            return 1;
        }
        return 0;
    }

    async publish(): Promise<number> { return 0; }
    async subscribe(): Promise<void> { }
}

function createRedisClient(): any {
    const url = process.env.REDIS_URL;

    // No Redis URL configured — use memory store
    if (!url) {
        console.log('[Redis] No REDIS_URL set, using in-memory store');
        return new MemoryStore();
    }

    try {
        // Dynamic import to avoid issues when ioredis is not needed
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Redis = require('ioredis');
        const client = new Redis(url, {
            maxRetriesPerRequest: 3,
            retryStrategy(times: number) {
                if (times > 3) return null; // Stop retrying
                return Math.min(times * 50, 2000);
            },
            lazyConnect: true,
            connectTimeout: 5000,
            enableOfflineQueue: false,
        });

        let connected = false;

        client.on('connect', () => {
            connected = true;
            console.log('[Redis] Connected successfully');
        });

        client.on('error', () => {
            if (!connected) {
                // Silently ignore — we'll fall back
            }
        });

        // Try to connect, fall back to memory if it fails
        client.connect().catch(() => {
            console.log('[Redis] Connection failed, using in-memory store');
        });

        return client;
    } catch {
        console.log('[Redis] ioredis not available, using in-memory store');
        return new MemoryStore();
    }
}

// Singleton
const globalForRedis = globalThis as unknown as { redis: any };
export const redis: any = globalForRedis.redis ?? createRedisClient();
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export default redis;
