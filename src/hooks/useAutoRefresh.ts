"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoRefreshOptions {
  enabled?: boolean;
  intervalMs?: number;
  pause?: boolean;
  onRefresh: () => void | Promise<void>;
}

export function useAutoRefresh({
  enabled = true,
  intervalMs = 60_000,
  pause = false,
  onRefresh,
}: UseAutoRefreshOptions) {
  const callbackRef = useRef(onRefresh);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  const refreshNow = useCallback(async () => {
    if (!enabled || pause || document.visibilityState === "hidden") return;
    setRefreshing(true);
    try {
      await callbackRef.current();
      setLastUpdatedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [enabled, pause]);

  useEffect(() => {
    if (!enabled || pause) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void refreshNow();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, pause, refreshNow]);

  return { refreshing, lastUpdatedAt, refreshNow };
}

export function formatLastUpdated(date: Date | null) {
  if (!date) return "Esperando actualizacion";
  return `Actualizado ${date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
}
