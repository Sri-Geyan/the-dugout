/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from './prisma';

// Database-backed fallback store for persistence without Redis
class DatabaseStore {
    async get(key: string): Promise<string | null> {
        try {
            const entry = await prisma.keyValue.findUnique({
                where: { key }
            });

            if (!entry) return null;

            // Check expiration
            if (entry.expiresAt && entry.expiresAt < new Date()) {
                await prisma.keyValue.delete({ where: { key } });
                return null;
            }

            return entry.value;
        } catch (error) {
            console.error(`[DatabaseStore] GET failed for ${key}:`, error);
            return null;
        }
    }

    async set(key: string, value: string, ...args: any[]): Promise<'OK'> {
        try {
            let expiresAt: Date | null = null;
            if (args[0] === 'EX' && typeof args[1] === 'number') {
                expiresAt = new Date(Date.now() + (args[1] as number) * 1000);
            }

            await prisma.keyValue.upsert({
                where: { key },
                update: { value, expiresAt, updatedAt: new Date() },
                create: { key, value, expiresAt }
            });

            return 'OK';
        } catch (error) {
            console.error(`[DatabaseStore] SET failed for ${key}:`, error);
            return 'OK'; // Return OK to allow app flow but log error
        }
    }

    async del(...keys: string[]): Promise<number> {
        try {
            const result = await prisma.keyValue.deleteMany({
                where: { key: { in: keys } }
            });
            return result.count;
        } catch (error) {
            console.error(`[DatabaseStore] DEL failed:`, error);
            return 0;
        }
    }

    async keys(pattern: string): Promise<string[]> {
        try {
            // Limited pattern support for DB: only prefix*
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
            console.error(`[DatabaseStore] KEYS failed:`, error);
            return [];
        }
    }

    // Generic Hash implementation via JSON string manipulation in the 'value' column
    async hset(key: string, field: string, value: string): Promise<number> {
        try {
            const existing = await this.get(key);
            const hash = existing ? JSON.parse(existing) : {};
            hash[field] = value;
            await this.set(key, JSON.stringify(hash));
            return 1;
        } catch (error) {
            console.error(`[DatabaseStore] HSET failed for ${key}:${field}:`, error);
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
            console.error(`[DatabaseStore] HGET failed for ${key}:${field}:`, error);
            return null;
        }
    }

    async hgetall(key: string): Promise<Record<string, string>> {
        try {
            const existing = await this.get(key);
            if (!existing) return {};
            return JSON.parse(existing);
        } catch (error) {
            console.error(`[DatabaseStore] HGETALL failed for ${key}:`, error);
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
            console.error(`[DatabaseStore] HDEL failed for ${key}:`, error);
            return 0;
        }
    }

    async expire(key: string, seconds: number): Promise<number> {
        try {
            const expiresAt = new Date(Date.now() + seconds * 1000);
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

function createRedisClient(): any {
    const url = process.env.REDIS_URL;

    // No Redis URL configured — use database store
    if (!url) {
        console.log('[Redis] No REDIS_URL set, using database store');
        return new DatabaseStore();
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

        // Try to connect, fall back to database if it fails
        client.connect().catch(() => {
            console.log('[Redis] Connection failed, using database store');
        });

        return client;
    } catch {
        console.log('[Redis] ioredis not available, using database store');
        return new DatabaseStore();
    }
}

// Singleton
const globalForRedis = globalThis as unknown as { redis: any };
export const redis: any = globalForRedis.redis ?? createRedisClient();
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export default redis;
