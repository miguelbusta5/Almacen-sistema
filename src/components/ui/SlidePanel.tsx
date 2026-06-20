"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { X } from "lucide-react";
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

// ── SlidePanel: panel lateral de detalle ─────────────────
interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  insights?: IntelInsight[];
  moduleColor?: string;
}

export function SlidePanel({
  open, onClose, title, subtitle, badge,
  primaryAction, secondaryActions,
  children, width = 420, insights = [], moduleColor,
}: SlidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // No unmount — solo transform para mantener la animación fluida
  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 450,
            background: "rgba(0,0,0,0.25)",
            backdropFilter: "blur(2px)",
            display: "none", // oculto en desktop, visible en mobile via media query
          }}
          className="slide-panel-overlay"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className="slide-panel"
        inert={open ? undefined : true}
        style={{
          position: "fixed",
          top: 0, right: 0,
          width, height: "100vh",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          "--panel-color": moduleColor,
          boxShadow: open ? "var(--shadow-xl)" : "none",
          zIndex: 500,
          display: "flex", flexDirection: "column",
          transform: open ? "translateX(0)" : `translateX(${width + 20}px)`,
          transition: "transform .28s cubic-bezier(.16,1,.3,1), box-shadow .28s ease",
          willChange: "transform",
          pointerEvents: open ? "auto" : "none",
        } as CSSProperties}
      >
        {/* ── Header del panel ── */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
                  {title}
                </h2>
                {badge}
              </div>
              {subtitle && (
                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 3, letterSpacing: "-0.01em" }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "var(--surface2)", border: "none", borderRadius: 7,
                padding: 7, cursor: "pointer", color: "var(--muted)",
                display: "flex", flexShrink: 0,
                transition: "background .1s, color .1s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface3)"; (e.currentTarget as HTMLElement).style.color = "var(--text)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLElement).style.color = "var(--muted)"; }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Inteligencia operacional (si hay insights) ── */}
        {insights.length > 0 && (
          <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {insights.map((ins) => <IntelAlert key={ins.id} insight={ins} />)}
            </div>
          </div>
        )}

        {/* ── Contenido scrollable ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {children}
        </div>

        {/* ── Acciones fijas al fondo ── */}
        {(primaryAction || secondaryActions) && (
          <div style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
            display: "flex", gap: 8,
            background: "var(--surface)",
          }}>
            {secondaryActions}
            {primaryAction && <div style={{ flex: 1 }}>{primaryAction}</div>}
          </div>
        )}
      </div>

      {/* CSS para mobile bottom sheet */}
      <style>{`
        @media (max-width: 640px) {
          .slide-panel {
            top: auto !important;
            bottom: 0 !important;
            right: 0 !important;
            width: 100% !important;
            height: 92vh !important;
            border-left: none !important;
            border-top: 1px solid var(--border) !important;
            border-radius: 20px 20px 0 0 !important;
            transform: ${open ? "translateY(0)" : "translateY(100%)"} !important;
          }
          .slide-panel-overlay { display: block !important; }
        }
      `}</style>
    </>
  );
}

// ── DetailSection: sección del panel con título ───────────
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
