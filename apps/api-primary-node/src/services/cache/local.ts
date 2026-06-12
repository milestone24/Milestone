import { CacheProvider, CacheEntry, CacheOptions, CacheStats } from "./types";

/**
 * In-memory LRU cache implementation with TTL support
 */
export class LocalCacheProvider implements CacheProvider {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;
  private defaultTtl: number | undefined;

  // Statistics tracking
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options?: { maxSize?: number; defaultTtl?: number }) {
    this.maxSize = options?.maxSize ?? 1000;
    this.defaultTtl = options?.defaultTtl;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check expiration
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.misses++;
      return undefined;
    }

    // Update LRU access order
    this.updateAccessOrder(key);
    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    // Evict if at capacity and this is a new key
    if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // ttl: 0 = no expiration (Memcached convention)
    // ttl: undefined = use default
    // ttl: positive number = expire after N ms
    const ttl = options?.ttl !== undefined ? options.ttl : this.defaultTtl;
    const entry: CacheEntry<T> = {
      value,
      expiresAt: ttl && ttl > 0 ? Date.now() + ttl : null,
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration without affecting stats
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return false;
    }

    return true;
  }

  async clear(namespace?: string): Promise<void> {
    if (!namespace) {
      this.cache.clear();
      this.accessOrder = [];
      return;
    }

    const prefix = `${namespace}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
      }
    }
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      evictions: this.evictions,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
    };
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private evictLRU(): void {
    const oldest = this.accessOrder.shift();
    if (oldest) {
      this.cache.delete(oldest);
      this.evictions++;
    }
  }
}
