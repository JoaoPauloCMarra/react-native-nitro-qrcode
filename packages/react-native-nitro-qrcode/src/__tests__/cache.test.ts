import { createBoundedCache } from "../cache";

describe("bounded cache", () => {
  it("misses, hits, and reorders entries by recency", () => {
    const cache = createBoundedCache<string>(3, 1024, (key, request, value) =>
      key.length + request.length + value.length,
    );
    cache.set("a", "request-a", "value-a");
    cache.set("b", "request-b", "value-b");
    cache.set("c", "request-c", "value-c");

    expect(cache.get("a", "request-a")).toBe("value-a");
    expect(cache.get("missing", "missing")).toBeUndefined();
    expect(cache.get("a", "stale-request")).toBeUndefined();

    cache.set("d", "request-d", "value-d");
    expect(cache.get("b", "request-b")).toBeUndefined();
    expect(cache.get("a", "request-a")).toBe("value-a");
    expect(cache.get("c", "request-c")).toBe("value-c");
    expect(cache.get("d", "request-d")).toBe("value-d");
  });

  it("replaces existing keys and updates the byte count", () => {
    const cache = createBoundedCache<number>(10, 1024, () => 10);
    cache.set("key", "request-1", 1);
    cache.set("key", "request-2", 2);
    expect(cache.get("key", "request-1")).toBeUndefined();
    expect(cache.get("key", "request-2")).toBe(2);
    expect(cache.bytes()).toBe(10);
    expect(cache.size()).toBe(1);
  });

  it("rejects entries larger than the byte budget", () => {
    const cache = createBoundedCache<string>(10, 8, (_key, _request, value) =>
      value.length,
    );
    cache.set("key", "request", "too-large-value");
    expect(cache.get("key", "request")).toBeUndefined();
    expect(cache.size()).toBe(0);
  });

  it("evicts by byte budget and entry count", () => {
    const byBytes = createBoundedCache<string>(100, 20, (_k, _r, value) =>
      value.length,
    );
    for (let index = 0; index < 6; index++) {
      byBytes.set(`key-${index}`, `request-${index}`, "123456");
    }
    expect(byBytes.size()).toBeLessThanOrEqual(3);

    const byCount = createBoundedCache<string>(3, 1024, () => 1);
    for (let index = 0; index < 10; index++) {
      byCount.set(`key-${index}`, `request-${index}`, "value");
    }
    expect(byCount.size()).toBe(3);
    expect(byCount.get("key-0", "request-0")).toBeUndefined();
    expect(byCount.get("key-9", "request-9")).toBe("value");
  });

  it("clears all entries and bytes", () => {
    const cache = createBoundedCache<string>(10, 1024, () => 5);
    cache.set("key", "request", "value");
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.bytes()).toBe(0);
    expect(cache.get("key", "request")).toBeUndefined();
  });
});
