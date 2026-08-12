export type BoundedCacheEntry<V> = {
  request: string;
  value: V;
  bytes: number;
};

export type BoundedCache<V> = {
  get: (key: string, request: string) => V | undefined;
  set: (key: string, request: string, value: V) => void;
  clear: () => void;
  size: () => number;
  bytes: () => number;
};

export function createBoundedCache<V>(
  maxEntries: number,
  maxBytes: number,
  measure: (key: string, request: string, value: V) => number,
): BoundedCache<V> {
  const entries = new Map<string, BoundedCacheEntry<V>>();
  let totalBytes = 0;

  function touch(key: string): void {
    const entry = entries.get(key) as BoundedCacheEntry<V>;
    entries.delete(key);
    entries.set(key, entry);
  }

  function evictIfNeeded(): void {
    while (entries.size > maxEntries || totalBytes > maxBytes) {
      const oldestKey = entries.keys().next().value as string;
      const removed = entries.get(oldestKey);
      if (removed !== undefined) {
        totalBytes -= removed.bytes;
      }
      entries.delete(oldestKey);
    }
  }

  return {
    get: (key, request) => {
      const entry = entries.get(key);
      if (entry === undefined || entry.request !== request) {
        return undefined;
      }
      touch(key);
      return entry.value;
    },
    set: (key, request, value) => {
      const entryBytes = measure(key, request, value);
      if (entryBytes > maxBytes) {
        return;
      }
      const existing = entries.get(key);
      if (existing !== undefined) {
        totalBytes -= existing.bytes;
        entries.delete(key);
      }
      entries.set(key, { request, value, bytes: entryBytes });
      totalBytes += entryBytes;
      evictIfNeeded();
    },
    clear: () => {
      entries.clear();
      totalBytes = 0;
    },
    size: () => entries.size,
    bytes: () => totalBytes,
  };
}
