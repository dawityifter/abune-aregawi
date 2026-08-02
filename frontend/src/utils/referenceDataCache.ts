/**
 * In-memory cache for reference data that rarely changes (expense categories,
 * employees, vendors). Lives for the life of the page — reloading clears it.
 *
 * Callers that mutate the underlying data MUST call invalidateCached() for the
 * matching key, otherwise dropdowns keep serving a stale list.
 */

const cache = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}

/** Clears one key, or the whole cache when called with no argument. */
export function invalidateCached(key?: string): void {
  if (key === undefined) {
    cache.clear();
    return;
  }
  cache.delete(key);
}

export const CACHE_KEYS = {
  expenseCategories: 'expenseCategories',
  employees: 'employees',
  vendors: 'vendors'
} as const;
