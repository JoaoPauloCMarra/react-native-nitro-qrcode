export type QRCodeMetricsSnapshot = {
  enabled: boolean;
  requests: number;
  asyncRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheBytes: number;
  totalGenerationMs: number;
  lastGenerationMs: number | undefined;
};

type MetricsState = {
  requests: number;
  asyncRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  totalGenerationMs: number;
  lastGenerationMs: number | undefined;
};

const ZERO_STATE: MetricsState = {
  requests: 0,
  asyncRequests: 0,
  failedRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  totalGenerationMs: 0,
  lastGenerationMs: undefined,
};

let metricsEnabled =
  typeof __DEV__ === "boolean" ? __DEV__ : false;
const state: MetricsState = { ...ZERO_STATE };

export function isQRCodeMetricsEnabled(): boolean {
  return metricsEnabled;
}

export function setQRCodeMetricsEnabled(enabled: boolean): void {
  metricsEnabled = enabled;
}

export function resetQRCodeMetrics(): void {
  Object.assign(state, ZERO_STATE);
}

export function getQRCodeMetrics(): QRCodeMetricsSnapshot {
  if (!metricsEnabled) {
    return { ...ZERO_STATE, enabled: false, cacheBytes: 0 };
  }
  return {
    enabled: true,
    ...state,
    cacheBytes: 0,
  };
}

export function recordGenerationRequest(parameters: {
  async: boolean;
  durationMs: number;
  failed: boolean;
}): void {
  if (!metricsEnabled) {
    return;
  }
  state.requests++;
  if (parameters.async) {
    state.asyncRequests++;
  }
  if (parameters.failed) {
    state.failedRequests++;
  }
  state.totalGenerationMs += parameters.durationMs;
  state.lastGenerationMs = parameters.durationMs;
}

export function recordCacheLookup(hit: boolean): void {
  if (!metricsEnabled) {
    return;
  }
  if (hit) {
    state.cacheHits++;
  } else {
    state.cacheMisses++;
  }
}

export function nowMilliseconds(): number {
  if (typeof globalThis.performance?.now === "function") {
    return globalThis.performance.now();
  }
  return Date.now();
}
