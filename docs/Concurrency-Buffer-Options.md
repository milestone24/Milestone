# Concurrency Buffer/Bus Options

This document describes options for implementing application-level concurrency control (limiting how many concurrent operations run at once).

## Use Case

We need to limit concurrent operations (e.g. external API calls to EODHD/Alpha Vantage for securities cache updates) to avoid overwhelming external services, rate limits, or resource exhaustion.

The concurrency limit should apply to **all** calls to the sources of securities cache—regardless of caller (job handlers, scripts, API endpoints, etc.). It should be **decoupled from the job queue**: the queue delivers work; concurrency is enforced at the API provider boundary.

---

## Approach: Application-Level Concurrency Bus

Rather than relying on a queue's built-in concurrency settings (which vary by library and may have edge cases), we enforce concurrency in our own layer using a semaphore/bus pattern:

1. Queue delivers a job.
2. Handler acquires a slot from the concurrency bus (waits if at limit).
3. Handler runs the operation (e.g. fetch from external API, write to DB).
4. Handler releases the slot.

**Pros:**
- **Queue-agnostic:** Works with any queue (EventEmitter, SQS, pg-boss, Graphile Worker, etc.).
- **Single place for the limit:** One bus, one number. Easy to tune and reason about.
- **No queue-specific configuration:** Avoids edge cases in queue concurrency settings.

**Scope:**
- **In-process (per-process limit):** Simple semaphore. With N processes each having limit 5, total is N×5.
- **Distributed (global limit):** Uses a shared backend (Redis, Postgres advisory locks, etc.) for a global limit across all instances.

---

## Implementation Placement

Apply p-limit at **each API service** (EODHD and Alpha Vantage), **not** at the gateway.

| Layer | Role | Concurrency control? |
|-------|------|----------------------|
| **Gateway** (`server/services/securities/gateway/`) | Routes to EODHD or Alpha Vantage; selects provider | **No** — gateway stays a pure orchestrator |
| **EODHD** (`server/services/securities/eodhd/history.ts`) | Makes HTTP calls to EODHD API | **Yes** — wrap `getSecurityHistoryForDateRange`, `getSecurityHistoryLiveForDateRange`, `getSecurityHistoryForDate`, `getIntradaySecurityHistoryForDate` |
| **Alpha Vantage** (`server/services/securities/alpha-vantage/history.ts`) | Makes HTTP calls to Alpha Vantage API | **Yes** — wrap `getSecurityHistoryForDateRange`, `getSecurityHistoryForDate`, `getIntradaySecurityHistoryForDate` |

**Rationale:**
- Each provider has its own API with its own rate limits; they may differ (e.g. EODHD allows 5 concurrent, Alpha Vantage allows 2).
- Concurrency applies to **all** callers—job handlers, scripts, future API endpoints—because the limit is at the source (the provider module that makes the HTTP call).
- The gateway does not need to know about rate limiting; it just routes to the provider.

---

## Library Options

Rather than building a custom implementation, we can use an existing, battle-tested library.

### 1. p-limit (Recommended)

**Summary:** Lightweight function-based concurrency limiter.

| Metric | Value |
|--------|-------|
| Weekly downloads | 173 million |
| Package size | 11.7 kB |
| API style | Function wrapper |
| Maintainer | Sindre Sorhus |

**API:**

```typescript
import pLimit from 'p-limit';

// Create a limit of 5 concurrent operations
const limit = pLimit(5);

// Wrap each operation
const results = await Promise.all([
  limit(() => fetchSecurityHistory('AAPL')),
  limit(() => fetchSecurityHistory('GOOGL')),
  limit(() => fetchSecurityHistory('MSFT')),
  // ... more operations
]);

// Monitoring
console.log(limit.activeCount);   // Number currently running
console.log(limit.pendingCount);  // Number waiting in queue

// Clear pending operations
limit.clearQueue();
```

**Features:**
- Concurrency control with configurable limit
- `activeCount` and `pendingCount` for monitoring
- `clearQueue()` to discard pending operations
- `limitFunction()` named export for decorating functions
- Works in Node.js and browsers
- ESM-only package

**Pros:**
- Extremely popular and battle-tested (173M downloads/week)
- Smallest package size (11.7 kB)
- Simplest API—just wrap operations with `limit(() => ...)`
- No configuration files or setup

**Cons:**
- No explicit acquire/release (function-wrapper style only)
- No built-in rate limiting (requests per second)

**Best for:** Simple "run max N things at once" use cases.

---

### 2. async-sema (Alternative)

**Summary:** Semaphore implementation with explicit acquire/release API.

| Metric | Value |
|--------|-------|
| Weekly downloads | 2.1 million |
| Package size | Small |
| API style | Semaphore (acquire/release) |
| Maintainer | Vercel |

**API:**

```typescript
import { Sema } from 'async-sema';

// Create a semaphore with 5 permits
const semaphore = new Sema(5);

async function fetchWithLimit(securityId: string) {
  await semaphore.acquire();
  try {
    return await fetchSecurityHistory(securityId);
  } finally {
    semaphore.release();
  }
}

// Or use drain/release pattern for batches
const items = ['AAPL', 'GOOGL', 'MSFT', ...];
await Promise.all(items.map(async (item) => {
  await semaphore.acquire();
  try {
    await processItem(item);
  } finally {
    semaphore.release();
  }
}));
```

**Rate limiting:**

```typescript
import { RateLimit } from 'async-sema';

// 10 requests per second
const rateLimiter = RateLimit(10);

async function fetchWithRateLimit(url: string) {
  await rateLimiter();
  return fetch(url);
}
```

**Features:**
- Token-based semaphore management
- Built-in `RateLimit` for requests-per-second limiting
- Pause/resume callbacks
- Capacity preallocation for high-performance scenarios
- TypeScript declarations included

**Pros:**
- Explicit acquire/release gives more control
- Built-in rate limiting (RPS)
- Maintained by Vercel
- Classic semaphore pattern familiar to many developers

**Cons:**
- More verbose than p-limit (must remember `try/finally` for release)
- Smaller community than p-limit

**Best for:** When you want explicit acquire/release control or need built-in rate limiting (RPS).

---

### 3. p-queue (Full-featured)

**Summary:** Full queue implementation with concurrency, priorities, and advanced features.

| Metric | Value |
|--------|-------|
| Weekly downloads | 13 million |
| Package size | 72.4 kB |
| API style | Queue-based |
| Maintainer | Sindre Sorhus |

**API:**

```typescript
import PQueue from 'p-queue';

// Create a queue with concurrency limit
const queue = new PQueue({ concurrency: 5 });

// Add tasks
queue.add(() => fetchSecurityHistory('AAPL'));
queue.add(() => fetchSecurityHistory('GOOGL'), { priority: 1 }); // Higher priority

// Wait for all to complete
await queue.onIdle();

// Or add and wait for result
const result = await queue.add(() => fetchSecurityHistory('MSFT'));

// Monitoring
console.log(queue.size);     // Pending tasks
console.log(queue.pending);  // Running tasks

// Control
queue.pause();
queue.start();
queue.clear();
```

**Features:**
- Concurrency limit
- Task prioritization
- Per-operation timeout
- Interval-based rate limiting (`intervalCap` and `interval`)
- Auto-start capability
- Pause/resume/clear
- EventEmitter for events (active, idle, add, next, completed, error)
- Custom queue class support

**Pros:**
- Most feature-rich option
- Task prioritization
- Built-in timeout support
- Event-driven (can listen for completion, errors, etc.)
- Pause/resume control

**Cons:**
- Largest package size (72.4 kB)
- More complex API than needed for simple use cases
- Overkill if you just need concurrency limiting

**Best for:** When you need prioritization, ordering, timeouts, or advanced queue management.

---

## Comparison Summary

| Feature | p-limit | async-sema | p-queue |
|---------|---------|------------|---------|
| **API style** | Function wrapper | Semaphore | Queue |
| **Concurrency limit** | Yes | Yes | Yes |
| **Rate limiting (RPS)** | No | Yes | Yes (interval-based) |
| **Prioritization** | No | No | Yes |
| **Timeout support** | No | No | Yes |
| **Pause/resume** | No | Yes (callbacks) | Yes |
| **Monitoring** | activeCount, pendingCount | nrWaiting() | size, pending, events |
| **Package size** | 11.7 kB | Small | 72.4 kB |
| **Downloads/week** | 173M | 2.1M | 13M |

---

## Recommendation

For our use case (limiting concurrent securities cache updates to avoid overwhelming external APIs):

**Primary recommendation: p-limit**

- Simplest API: `const limit = pLimit(5); await limit(() => work());`
- Most popular and battle-tested (173M downloads/week)
- Smallest footprint (11.7 kB)
- No setup or configuration files
- Sufficient for "run max N concurrent operations"

**Alternative: async-sema**

Use if you prefer explicit acquire/release semantics or need built-in rate limiting (requests per second). Maintained by Vercel, well-documented.

**Not recommended for this use case: p-queue**

Overkill unless we need task prioritization, timeouts, or advanced queue management. Larger package and more complex API than necessary.

---

## Implementation Notes

### Per-process vs Global Limit

All three libraries provide **per-process** concurrency limits. If you run 2 Node.js processes, each with limit 5, you get up to 10 concurrent operations total.

For a **global limit** across all instances, you would need:
- A distributed semaphore (e.g. Redis-based, Postgres advisory locks)
- Or coordinate via a shared queue that enforces global concurrency (e.g. BullMQ with concurrency setting)

For MVP, per-process limits are likely sufficient since we typically run a single Node.js process.

### Error Handling

When using any of these libraries, ensure the concurrency slot is released even on error:

**p-limit:** Handled automatically (function wrapper catches errors and still counts as "done").

**async-sema:** Must use `try/finally`:

```typescript
await semaphore.acquire();
try {
  await doWork();
} finally {
  semaphore.release();
}
```

**p-queue:** Errors are caught by the queue; the slot is released automatically.

---

## References

- [p-limit on npm](https://www.npmjs.com/package/p-limit)
- [p-limit on GitHub](https://github.com/sindresorhus/p-limit)
- [async-sema on npm](https://www.npmjs.com/package/async-sema)
- [async-sema on GitHub](https://github.com/vercel/async-sema)
- [p-queue on npm](https://www.npmjs.com/package/p-queue)
- [p-queue on GitHub](https://github.com/sindresorhus/p-queue)
