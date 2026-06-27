"use client";

import type { CSSProperties } from "react";
import type { IntelInsight } from "@/lib/inteligencia";

// ── IntelAlert: alerta de inteligencia operacional ────────
interface IntelAlertProps {
  insight: IntelInsight;
  onClick?: () => void;
}

const LEVEL_CONFIG = {
  critical: { color: "var(--error)", bg: "var(--error-tint)", icon: "⚠" },
  warning:  { color: "var(--warning)", bg: "var(--warning-tint)", icon: "⚠" },
  info:     { color: "var(--info)", bg: "var(--info-tint)", icon: "ℹ" },
};

export function IntelAlert({ insight, onClick }: IntelAlertProps) {
  const cfg = LEVEL_CONFIG[insight.level];
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "10px 14px",
        background: cfg.bg,
        borderRadius: 8,
        cursor: onClick ? "pointer" : "default",
        transition: "opacity .1s",
      }}
      onMouseEnter={(e) => { if (onClick) (e.currentTarget as HTMLElement).style.opacity = ".85"; }}
      onMouseLeave={(e) => { if (onClick) (e.currentTarget as HTMLElement).style.opacity = "1"; }}
    >
      <span style={{ color: cfg.color, fontSize: 13, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4, fontWeight: 500 }}>
          {insight.message}
        </div>
        {insight.context && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontFamily: "var(--mono)" }}>
            {insight.context}
          </div>
        )}
      </div>
    </div>
  );
}

// ── IntelBanner: grupo de alertas en el dashboard/módulo ──
interface IntelBannerProps {
  insights: IntelInsight[];
  maxVisible?: number;
  title?: string;
}

export function IntelBanner({ insights, maxVisible = 3, title = "Inteligencia operacional" }: IntelBannerProps) {
  if (insights.length === 0) return null;
  const visible = insights.slice(0, maxVisible);
  const resto = insights.length - maxVisible;
  return (
    <div style={{ marginBottom: 24 }}>
      {title && (
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
          {title}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {visible.map((ins) => <IntelAlert key={ins.id} insight={ins} />)}
        {resto > 0 && (
          <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px 14px" }}>
            +{resto} alerta{resto !== 1 ? "s" : ""} adicional{resto !== 1 ? "es" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DetailSection: sección de detalle con título ──────────
export function DetailSection({
  title,
  children,
  color,
}: {
  title: string;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="detail-section" style={{ marginBottom: 14, "--section-color": color } as CSSProperties}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── DetailGrid: grid de campos clave:valor ────────────────
export function DetailGrid({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
      {items.map(({ label, value }) => (
        <div key={label}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3, letterSpacing: "-0.01em" }}>{label}</div>
          <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{value ?? <span style={{ color: "var(--faint)" }}>—</span>}</div>
        </div>
      ))}
    </div>
  );
}

// ── MiniHistory: historial compacto ───────────────────────
interface HistoryItem { label: string; meta?: string; time?: string; color?: string; }
export function MiniHistory({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) return <div style={{ fontSize: 13, color: "var(--muted)", padding: "4px 0" }}>Sin historial</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 10, paddingBottom: 10, position: "relative" }}>
          {i < items.length - 1 && (
            <span style={{ position: "absolute", left: 6, top: 16, bottom: 0, width: 1, background: "var(--border)" }} />
          )}
          <span style={{ width: 13, height: 13, borderRadius: "50%", background: item.color ?? "var(--surface3)", border: "2px solid var(--border-strong)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{item.label}</div>
            {item.meta && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{item.meta}</div>}
          </div>
          {item.time && <div style={{ fontSize: 11, color: "var(--faint)", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{item.time}</div>}
        </div>
      ))}
    </div>
  );
}
