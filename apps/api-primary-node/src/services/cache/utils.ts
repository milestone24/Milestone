import type { DataRangeQuery } from "@shared/schema";
import type { QueryParams } from "@/utils/resource-query-builder";

/**
 * Rounds a date string or Date to the start of the day (UTC)
 */
function roundToDay(dateValue: unknown): string | unknown {
  if (typeof dateValue === "string") {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    return dateValue.toISOString().split("T")[0];
  }
  return dateValue;
}

/**
 * Generates a stable, day-rounded cache key segment from a DataRangeQuery.
 * Rounds start/end to ISO date (YYYY-MM-DD) to prevent cache misses from
 * millisecond differences in timestamps.
 */
export function dataRangeQueryToKey(query?: DataRangeQuery): string {
  if (!query) return "";
  const parts: string[] = [];
  if (query.start) parts.push(`start:${roundToDay(query.start)}`);
  if (query.end) parts.push(`end:${roundToDay(query.end)}`);
  return parts.join("|");
}

/**
 * Generates a deterministic cache key from QueryParams
 * Ensures consistent key generation regardless of property order
 */
export function queryParamsToKey(query?: QueryParams): string {
  if (!query) return "";

  const parts: string[] = [];

  if (query.filter) {
    // Sort filter keys for deterministic ordering
    const sortedFilters = Object.entries(query.filter)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("&");
    if (sortedFilters) parts.push(`f:${sortedFilters}`);
  }

  if (query.sort?.length) {
    const sortKey = query.sort
      .map((s) => `${s.field}:${s.direction}`)
      .join(",");
    parts.push(`s:${sortKey}`);
  }

  if (query.offset !== undefined) parts.push(`o:${query.offset}`);
  if (query.limit !== undefined) parts.push(`l:${query.limit}`);
  if (query.q) parts.push(`q:${query.q}`);

  return parts.join("|");
}

/**
 * Builds a namespaced cache key from parts
 * @param namespace - Cache namespace prefix
 * @param parts - Key components to join
 */
export function buildCacheKey<N extends string>(
  namespace: N,
  ...parts: (string | number | undefined | null)[]
): `${N}:${string}` {
  const filteredParts = parts.filter(
    (p): p is string | number => p !== undefined && p !== null && p !== ""
  );
  return `${namespace}:${filteredParts.join(":")}` as `${N}:${string}`;
}

/**
 * Rounds date filter values (start, end) to day precision for cache key stability.
 * This prevents cache misses due to millisecond differences in timestamps.
 */
export function queryParamsToKeyRoundedDates(query?: QueryParams): string {
  if (!query) return "";

  const parts: string[] = [];

  if (query.filter) {
    // Sort filter keys for deterministic ordering
    const sortedFilters = Object.entries(query.filter)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        // Round date fields to day
        if (
          (key === "start" || key === "end") &&
          typeof value === "object" &&
          value !== null
        ) {
          const roundedValue: Record<string, unknown> = {};
          for (const [op, opValue] of Object.entries(
            value as Record<string, unknown>
          )) {
            roundedValue[op] = roundToDay(opValue);
          }
          return `${key}=${JSON.stringify(roundedValue)}`;
        }
        return `${key}=${JSON.stringify(value)}`;
      })
      .join("&");
    if (sortedFilters) parts.push(`f:${sortedFilters}`);
  }

  if (query.sort?.length) {
    const sortKey = query.sort
      .map((s) => `${s.field}:${s.direction}`)
      .join(",");
    parts.push(`s:${sortKey}`);
  }

  if (query.offset !== undefined) parts.push(`o:${query.offset}`);
  if (query.limit !== undefined) parts.push(`l:${query.limit}`);
  if (query.q) parts.push(`q:${query.q}`);

  return parts.join("|");
}
