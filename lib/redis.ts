/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from './prisma';

// L1 cache to keep the app snappy
const L1_CACHE = new Map<string, { value: string; expiresAt: Date | null }>();
const SYNC_QUEUES = new Map<string, NodeJS.Timeout>();

// L1 memory cache with L2 database synchronization
class HybridDatabaseStore {
    // Helper to sync to DB in background (debounced)
    private async syncToDb(key: string, value: string, expiresAt: Date | null) {
        // Clear any existing pending sync for this key
        if (SYNC_QUEUES.has(key)) {
            clearTimeout(SYNC_QUEUES.get(key)!);
        }

        // Debounce: wait 500ms before actually hitting the DB
        // This is crucial for high-frequency updates like match state
        const timer = setTimeout(async () => {
            try {
                await prisma.keyValue.upsert({
                    where: { key },
                    update: { value, expiresAt, updatedAt: new Date() },
                    create: { key, value, expiresAt }
                });
                SYNC_QUEUES.delete(key);
            } catch (error) {
                console.error(`[HybridStore] Sync failed for ${key}:`, error);
            }
        }, 500);

        SYNC_QUEUES.set(key, timer);
    }

    async get(key: string): Promise<string | null> {
        // 1. Check L1 Cache
        const cached = L1_CACHE.get(key);
        if (cached) {
            if (cached.expiresAt && cached.expiresAt < new Date()) {
                L1_CACHE.delete(key);
                return null;
            }
            return cached.value;
        }

        // 2. Check Database if not in L1
        try {
            const entry = await prisma.keyValue.findUnique({ where: { key } });
            if (!entry) return null;

            if (entry.expiresAt && entry.expiresAt < new Date()) {
                await prisma.keyValue.delete({ where: { key } });
                return null;
            }

            // Populate L1 cache for next time
            L1_CACHE.set(key, { value: entry.value, expiresAt: entry.expiresAt });
            return entry.value;
        } catch (error) {
            console.error(`[HybridStore] GET failed for ${key}:`, error);
            return null;
        }
    }

    async set(key: string, value: string, ...args: (string | number)[]): Promise<'OK'> {
        let expiresAt: Date | null = null;
        if (args[0] === 'EX' && typeof args[1] === 'number') {
            expiresAt = new Date(Date.now() + (args[1] as number) * 1000);
        }

        // 1. Update L1 (INSTANT)
        L1_CACHE.set(key, { value, expiresAt });

        // 2. Sync to L2 (BACKGROUND)
        this.syncToDb(key, value, expiresAt);

        return 'OK';
    }

    async del(...keys: string[]): Promise<number> {
        let count = 0;
        for (const key of keys) {
            L1_CACHE.delete(key);
            if (SYNC_QUEUES.has(key)) {
                clearTimeout(SYNC_QUEUES.get(key)!);
                SYNC_QUEUES.delete(key);
            }
        }

        try {
            const result = await prisma.keyValue.deleteMany({
                where: { key: { in: keys } }
            });
            count = result.count;
        } catch (error) {
            console.error(`[HybridStore] DEL failed:`, error);
        }
        return count;
    }

    async keys(pattern: string): Promise<string[]> {
        // For keys, we hit the DB to ensure we get everything (including not-in-cache)
        try {
            const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
            const entries = await prisma.keyValue.findMany({
                where: {
                    key: { startsWith: prefix },
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } }
                    ]
                },
                select: { key: true }
            });
            return entries.map(e => e.key);
        } catch (error) {
            console.error(`[HybridStore] KEYS failed:`, error);
            return [];
        }
    }

    async hset(key: string, field: string, value: string): Promise<number> {
        try {
            const existing = await this.get(key);
            const hash = existing ? JSON.parse(existing) : {};
            hash[field] = value;
            await this.set(key, JSON.stringify(hash));
            return 1;
        } catch (error) {
            console.error(`[HybridStore] HSET failed for ${key}:${field}:`, error);
            return 0;
        }
    }

    async hget(key: string, field: string): Promise<string | null> {
        try {
            const existing = await this.get(key);
            if (!existing) return null;
            const hash = JSON.parse(existing);
            return hash[field] || null;
        } catch (error) {
            console.error(`[HybridStore] HGET failed for ${key}:${field}:`, error);
            return null;
        }
    }

    async hgetall(key: string): Promise<Record<string, string>> {
        try {
            const existing = await this.get(key);
            if (!existing) return {};
            return JSON.parse(existing);
        } catch (error) {
            console.error(`[HybridStore] HGETALL failed for ${key}:`, error);
            return {};
        }
    }

    async hdel(key: string, ...fields: string[]): Promise<number> {
        try {
            const existing = await this.get(key);
            if (!existing) return 0;
            const hash = JSON.parse(existing);
            let count = 0;
            for (const field of fields) {
                if (field in hash) { delete hash[field]; count++; }
            }
            await this.set(key, JSON.stringify(hash));
            return count;
        } catch (error) {
            console.error(`[HybridStore] HDEL failed for ${key}:`, error);
            return 0;
        }
    }

    async expire(key: string, seconds: number): Promise<number> {
        const expiresAt = new Date(Date.now() + seconds * 1000);
        
        // Update L1
        const cached = L1_CACHE.get(key);
        if (cached) {
            cached.expiresAt = expiresAt;
        }

        // Update DB
        try {
            await prisma.keyValue.update({
                where: { key },
                data: { expiresAt }
            });
            return 1;
        } catch {
            return 0;
        }
    }

    async publish(): Promise<number> { return 0; }
    async subscribe(): Promise<void> { }
}

function createRedisClient(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    const url = process.env.REDIS_URL;

    if (!url) {
        console.log('[Redis] No REDIS_URL set, using hybrid database store');
        return new HybridDatabaseStore();
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Redis = require('ioredis');
        const client = new Redis(url, {
            maxRetriesPerRequest: 3,
            retryStrategy(times: number) {
                if (times > 3) return null;
                return Math.min(times * 50, 2000);
            },
            lazyConnect: true,
            connectTimeout: 5000,
            enableOfflineQueue: false,
        });

        let connected = false;
        client.on('connect', () => { connected = true; console.log('[Redis] Connected successfully'); });
        client.on('error', () => { if (!connected) { /* silent fallback */ } });

        client.connect().catch(() => {
            console.log('[Redis] Connection failed, using hybrid database store');
        });

        return client;
    } catch {
        console.log('[Redis] ioredis not available, using hybrid database store');
        return new HybridDatabaseStore();
    }
}

const globalForRedis = globalThis as unknown as { redis: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
export const redis: any = globalForRedis.redis ?? createRedisClient(); // eslint-disable-line @typescript-eslint/no-explicit-any
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export default redis;
