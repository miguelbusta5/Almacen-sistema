"use client";

import { RefreshCw } from "lucide-react";
import { formatLastUpdated } from "@/hooks/useAutoRefresh";

export function AutoRefreshIndicator({
  lastUpdatedAt,
  refreshing,
  onRefresh,
}: {
  lastUpdatedAt: Date | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <button
      type="button"
      className="op-action"
      onClick={onRefresh}
      disabled={refreshing}
      title="Actualizar datos"
      style={{
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "0 10px",
        color: "var(--muted2)",
        fontSize: 11,
        fontWeight: 750,
        cursor: refreshing ? "default" : "pointer",
        opacity: refreshing ? 0.72 : 1,
      }}
    >
      <RefreshCw size={13} style={{ animation: refreshing ? "spin .8s linear infinite" : "none" }} />
      {formatLastUpdated(lastUpdatedAt)}
    </button>
  );
}
