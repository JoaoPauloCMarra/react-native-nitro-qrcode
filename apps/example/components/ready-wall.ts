import { useCallback, useEffect, useRef, useState } from "react";

export type ReadyWall = {
  ready: number;
  failed: number;
  elapsedMs: number | undefined;
  extra: number | undefined;
  markReady: (id: string, failed?: boolean) => void;
  reset: () => void;
};

const now = () => globalThis.performance?.now?.() ?? Date.now();

export function useReadyWall(
  total: number,
  measure?: () => number,
): ReadyWall {
  const idsRef = useRef(new Set<string>());
  const failedIdsRef = useRef(new Set<string>());
  const startedAtRef = useRef(0);
  useEffect(() => {
    startedAtRef.current = now();
  }, []);
  const [state, setState] = useState<
    Pick<ReadyWall, "ready" | "failed" | "elapsedMs" | "extra">
  >({ ready: 0, failed: 0, elapsedMs: undefined, extra: undefined });

  const markReady = useCallback(
    (id: string, failed = false) => {
      if (idsRef.current.has(id)) {
        return;
      }
      idsRef.current.add(id);
      if (failed) {
        failedIdsRef.current.add(id);
      }
      const ready = idsRef.current.size;
      const complete = ready === total;
      setState({
        ready,
        failed: failedIdsRef.current.size,
        elapsedMs: complete ? now() - startedAtRef.current : undefined,
        extra: complete ? measure?.() : undefined,
      });
    },
    [measure, total],
  );

  const reset = useCallback(() => {
    idsRef.current.clear();
    failedIdsRef.current.clear();
    startedAtRef.current = now();
    setState({ ready: 0, failed: 0, elapsedMs: undefined, extra: undefined });
  }, []);

  return { ...state, markReady, reset };
}

export function formatReadyWall(
  wall: ReadyWall,
  total: number,
  detail: (wall: ReadyWall) => string = () => "",
): string {
  const count = `ready=${wall.ready}/${total}`;
  if (wall.ready !== total) {
    return count;
  }
  return wall.failed > 0
    ? `fail:${count}:errors=${wall.failed}`
    : `ok:${count}${detail(wall)}`;
}
