import { Redis } from '@upstash/redis';

// Initialize Redis client
// For local development, we'll use a fallback to in-memory storage if env vars are not set
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// In-memory fallback for local development
const memoryStorage: Record<string, string> = {};

export async function getFromStorage(key: string): Promise<string | null> {
  if (redis) {
    const value = await redis.get(key);
    // Upstash may return object directly if stored as JSON
    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value as string | null;
  }
  return memoryStorage[key] || null;
}

export async function setToStorage(key: string, value: string): Promise<void> {
  if (redis) {
    await redis.set(key, value);
  } else {
    memoryStorage[key] = value;
  }
}

export async function deleteFromStorage(key: string): Promise<void> {
  if (redis) {
    await redis.del(key);
  } else {
    delete memoryStorage[key];
  }
}

export { redis };
