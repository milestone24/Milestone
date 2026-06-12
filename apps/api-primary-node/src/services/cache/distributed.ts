import { CacheProvider, CacheOptions, CacheStats } from "./types";

/**
 * Redis client interface (subset of ioredis)
 * Defined here to avoid requiring ioredis types at compile time
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: (string | number)[]): Promise<string>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  scan(cursor: string, ...args: (string | number)[]): Promise<[string, string[]]>;
  ping(): Promise<string>;
  quit(): Promise<string>;
  on(event: string, callback: (err: Error) => void): void;
}

export interface DistributedCacheConfig {
  /** Redis connection URL (e.g., redis://localhost:6379) */
  connectionString?: string;
  /** Redis connection options (alternative to connectionString) */
  redisOptions?: Record<string, unknown>;
  /** Default TTL in milliseconds */
  defaultTtl?: number;
  /** Key prefix for all cache entries */
  keyPrefix?: string;
}

/**
 * Redis-based distributed cache implementation.
 * Implements the CacheProvider interface for use with the cache factory.
 *
 * Requires ioredis package: `npm install ioredis`
 */
export class DistributedCacheProvider implements CacheProvider {
  private client: RedisClient;
  private defaultTtl: number | undefined;
  private keyPrefix: string;

  // Statistics tracking (local counters, not distributed)
  private hits = 0;
  private misses = 0;

  constructor(config?: DistributedCacheConfig) {
    this.defaultTtl = config?.defaultTtl;
    this.keyPrefix = config?.keyPrefix ?? "cache:";

    // Dynamically import ioredis to avoid bundling issues if not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis").default;

    if (config?.connectionString) {
      this.client = new IORedis(config.connectionString) as RedisClient;
    } else if (config?.redisOptions) {
      this.client = new IORedis(config.redisOptions) as RedisClient;
    } else {
      // Default to localhost
      this.client = new IORedis({
        host: process.env.REDIS_HOST ?? "localhost",
        port: parseInt(process.env.REDIS_PORT ?? "6379"),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB ?? "0"),
      }) as RedisClient;
    }

    // Handle connection errors gracefully
    this.client.on("error", (err: Error) => {
      console.error("[DistributedCache] Redis connection error:", err.message);
    });
  }

  private prefixKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const prefixedKey = this.prefixKey(key);
      const data = await this.client.get(prefixedKey);

      if (data === null) {
        this.misses++;
        return undefined;
      }

      this.hits++;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error("[DistributedCache] Error getting key:", key, error);
      this.misses++;
      return undefined;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const prefixedKey = this.prefixKey(key);
      const serialized = JSON.stringify(value);

      // ttl: 0 = no expiration (Memcached convention)
      // ttl: undefined = use default
      // ttl: positive number = expire after N ms
      const ttl = options?.ttl !== undefined ? options.ttl : this.defaultTtl;

      if (ttl && ttl > 0) {
        // Set with expiration (PX = milliseconds)
        await this.client.set(prefixedKey, serialized, "PX", ttl);
      } else {
        // Set without expiration
        await this.client.set(prefixedKey, serialized);
      }
    } catch (error) {
      console.error("[DistributedCache] Error setting key:", key, error);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.prefixKey(key);
      const result = await this.client.del(prefixedKey);
      return result > 0;
    } catch (error) {
      console.error("[DistributedCache] Error deleting key:", key, error);
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.prefixKey(key);
      const result = await this.client.exists(prefixedKey);
      return result > 0;
    } catch (error) {
      console.error("[DistributedCache] Error checking key:", key, error);
      return false;
    }
  }

  async clear(namespace?: string): Promise<void> {
    try {
      if (!namespace) {
        // Clear all keys with our prefix
        const pattern = `${this.keyPrefix}*`;
        await this.deleteByPattern(pattern);
      } else {
        // Clear keys matching namespace
        const pattern = `${this.keyPrefix}${namespace}:*`;
        await this.deleteByPattern(pattern);
      }
    } catch (error) {
      console.error("[DistributedCache] Error clearing cache:", error);
    }
  }

  /**
   * Delete keys matching a pattern using SCAN (non-blocking)
   */
  private async deleteByPattern(pattern: string): Promise<void> {
    let cursor = "0";

    do {
      const [newCursor, keys] = await this.client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = newCursor;

      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== "0");
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      // Size is not tracked locally - would require DBSIZE or SCAN
      size: -1,
      evictions: 0, // Redis handles eviction internally
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
    };
  }

  /**
   * Get approximate cache size from Redis
   * Note: This counts ALL keys in the database, not just cache keys
   */
  async getSize(): Promise<number> {
    try {
      // Count keys matching our prefix
      let count = 0;
      let cursor = "0";

      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          "MATCH",
          `${this.keyPrefix}*`,
          "COUNT",
          1000
        );
        cursor = newCursor;
        count += keys.length;
      } while (cursor !== "0");

      return count;
    } catch (error) {
      console.error("[DistributedCache] Error getting size:", error);
      return -1;
    }
  }

  /**
   * Close the Redis connection
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Check if Redis is connected and responsive
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }
}
