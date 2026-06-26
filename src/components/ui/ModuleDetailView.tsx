"use client";

import type { CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";

/**
 * Marco compartido de "vista de detalle a ancho completo" que reemplaza al
 * listado dentro de un módulo (en vez de un overlay/SlidePanel lateral).
 *
 * Patrón aprobado originalmente en Cargue Gourmet (G3C-QA-FIX3) y generalizado
 * aquí para todos los módulos. NO usa `position: fixed` ni altura calculada: es
 * scroll de página normal, por lo que nunca se "ve cortado" y funciona igual en
 * desktop y en mobile (la barra de acciones del header hace `flex-wrap`).
 *
 * No depende de `SlidePanel`; convive con sus helpers (`DetailSection`,
 * `DetailGrid`, `MiniHistory`) que se siguen usando dentro de `children`.
 */
export function ModuleDetailView({
  onBack,
  backLabel = "Volver al listado",
  title,
  subtitle,
  badge,
  actions,
  children,
  testId = "module-detail-view",
  moduleColor,
}: {
  onBack: () => void;
  backLabel?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
  moduleColor?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="animate-fade-in"
      style={{ display: "flex", flexDirection: "column", gap: 16, "--panel-color": moduleColor } as CSSProperties}
    >
      <button
        type="button"
        onClick={onBack}
        data-testid="volver-listado-btn"
        className="g-btn g-btn-secondary g-btn-sm"
        style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <ArrowLeft size={14} /> {backLabel}
      </button>

      <div className="g-panel" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            gap: 16, flexWrap: "wrap",
            padding: "20px 24px 16px", borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, letterSpacing: "-0.01em" }}>
                {subtitle}
              </p>
            )}
          </div>

          {actions && (
            <div
              data-testid="detail-view-actions"
              style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0 }}
            >
              {actions}
            </div>
          )}
        </div>

        <div style={{ padding: "20px 24px" }}>{children}</div>
      </div>
    </div>
  );
}
