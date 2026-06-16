"use client";
import React from "react";
import { getModuleIconBg } from "@/lib/moduleTheme";

// ═══════════════════════════════════════════════════════════
// BADGE — estado inteligente con dot semántico
// ═══════════════════════════════════════════════════════════
type BadgeVariant = "success" | "warning" | "error" | "info" | "default" | "muted";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

export function Badge({ label, variant = "default", dot = true }: BadgeProps) {
  return (
    <span className={`ds-badge ds-badge-${variant}`}>
      {dot && <span className="ds-badge-dot" style={{ background: "currentColor" }} />}
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
// STAT — métrica sin caja, solo tipografía jerarquizada
// ═══════════════════════════════════════════════════════════
interface StatProps {
  value: string | number;
  label: string;
  trend?: string;
  trendUp?: boolean;
  size?: "sm" | "md" | "lg";
  color?: string;
  onClick?: () => void;
}

export function Stat({ value, label, trend, trendUp, size = "md", color, onClick }: StatProps) {
  const sizeClass = size === "lg" ? "lg" : size === "sm" ? "sm" : "";
  return (
    <div
      className="ds-stat"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", borderLeft: color ? `3px solid ${color}` : undefined }}
    >
      <div
        className={`ds-stat-value ${sizeClass}`}
        style={{ color: color ?? "var(--text)" }}
      >
        {value}
      </div>
      <div className="ds-stat-label">{label}</div>
      {trend && (
        <div
          className="ds-stat-trend"
          style={{ color: trendUp === undefined ? "var(--muted)" : trendUp ? "var(--success)" : "var(--error)" }}
        >
          {trendUp !== undefined && (trendUp ? "↑" : "↓")} {trend}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EMPTY STATE — estado vacío expresivo
// ═══════════════════════════════════════════════════════════
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="ds-empty animate-fade-in">
      <div className="ds-empty-icon">{icon}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && (
        <button className="ds-btn ds-btn-secondary ds-btn-sm" onClick={action.onClick} style={{ marginTop: 4 }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SKELETON — loaders que imitan el contenido real
// ═══════════════════════════════════════════════════════════
export function SkeletonLine({ width = "100%", height = 14 }: { width?: string | number; height?: number }) {
  return <div className="skeleton" style={{ width, height, borderRadius: 4 }} />;
}

export function SkeletonStat() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 4 }} />
    </div>
  );
}

export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  const widths = ["60px", "200px", "140px", "80px", "80px", "100px"];
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "0 12px", height: 48 }}>
          <div className="skeleton" style={{ width: widths[i] ?? "80px", height: 13, borderRadius: 4 }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <table className="ds-table" style={{ width: "100%" }}>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} cols={cols} />)}
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION HEADER — separador de sección con título + acción
// ═══════════════════════════════════════════════════════════
export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="ds-section-header">
      <span className="ds-section-title">{title}</span>
      {action}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TIMELINE ITEM — elemento de actividad reciente
// ═══════════════════════════════════════════════════════════
type TimelineDot = "default" | "active" | "success" | "warning" | "error";

interface TimelineItemProps {
  title: string;
  meta?: string;
  time?: string;
  dot?: TimelineDot;
  module?: string;
  moduleColor?: string;
}

export function TimelineItem({ title, meta, time, dot = "default", module, moduleColor }: TimelineItemProps) {
  return (
    <div className="ds-timeline-item">
      <div className={`ds-timeline-dot ${dot}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4, fontWeight: 500 }}>{title}</span>
          {time && <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", marginTop: 2, fontFamily: "var(--mono)" }}>{time}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          {module && (
            <span style={{ fontSize: 11, fontWeight: 600, color: moduleColor ?? "var(--muted)", background: moduleColor ? getModuleIconBg(moduleColor) : "var(--surface2)", padding: "1px 7px", borderRadius: 20 }}>
              {module}
            </span>
          )}
          {meta && <span style={{ fontSize: 11, color: "var(--muted)" }}>{meta}</span>}
        </div>
      </div>
    </div>
  );
}
