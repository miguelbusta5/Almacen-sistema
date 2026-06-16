"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Gauge, RadioTower } from "lucide-react";
import { Badge, SectionHeader } from "@/components/ui";
import { PRODUCT } from "@/config/product";
import { getModuleColor } from "@/lib/moduleTheme";
import type {
  ControlAction,
  ControlLogisticoResumen,
  ControlModuleSignal,
  ControlPriority,
  ControlStatus,
} from "@/lib/controlLogistico/types";

export function controlStatusColor(status: ControlStatus | string) {
  if (status === "critical") return "var(--error)";
  if (status === "warning") return "var(--warning)";
  if (status === "ok") return "var(--success)";
  return "var(--muted)";
}

function levelLabel(level: ControlPriority["level"]) {
  if (level === "critical") return "Crítico";
  if (level === "warning") return "Alerta";
  return "Info";
}

export function ControlHero({ nombre, resumen, isMobile }: {
  nombre: string;
  resumen: ControlLogisticoResumen;
  isMobile: boolean;
}) {
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
  const accent = controlStatusColor(resumen.headline.status);

  return (
    <section className="op-module-header" style={{ "--module-color": accent, padding: isMobile ? 18 : 26, marginBottom: 18 } as React.CSSProperties}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 720 }}>
          <div className="op-module-kicker" style={{ color: accent }}>
            {PRODUCT.displayName}
          </div>
          <h1 className="op-module-title">
            {saludo}{nombre ? `, ${nombre}` : ""}.
          </h1>
          <p className="op-module-copy">
            Consola operativa por rol: prioridades, flujo CEDI, señales críticas y acciones recomendadas.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(76px, 1fr))", gap: 10, minWidth: isMobile ? "100%" : 330 }}>
          {[
            { label: "Críticos", value: resumen.headline.critical, color: accent },
            { label: "Pendientes", value: resumen.headline.pending, color: "#fff" },
            { label: "Cerrados", value: resumen.headline.completedToday, color: "var(--success)" },
          ].map((kpi) => (
            <div key={kpi.label} style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.065)", borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: kpi.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", fontWeight: 800, marginTop: 4 }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ModuleSignalGrid({ modules, isMobile }: { modules: ControlModuleSignal[]; isMobile: boolean }) {
  return (
    <section className="op-workbench" style={{ padding: isMobile ? 16 : 18 }}>
      <SectionHeader title="Módulos bajo control" />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {modules.map((m) => {
          const color = getModuleColor(m.key);
          return (
            <Link key={m.key} href={m.href} style={{ textDecoration: "none" }}>
              <div className="op-record-card" style={{ "--module-color": color, padding: 14, minHeight: 112, display: "flex", flexDirection: "column", justifyContent: "space-between" } as React.CSSProperties}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 850, color: "var(--text)" }}>{m.label}</div>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: controlStatusColor(m.status), boxShadow: `0 0 0 3px ${controlStatusColor(m.status)}22` }} />
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{m.count ?? "Activo"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>{m.description}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function PriorityPanel({ priorities, isMobile }: { priorities: ControlPriority[]; isMobile: boolean }) {
  return (
    <section className="op-panel" style={{ padding: isMobile ? 16 : 18 }}>
      <SectionHeader title="Prioridad operativa" />
      {priorities.length === 0 ? (
        <div className="op-status-band" style={{ "--module-color": "var(--success)", color: "var(--muted2)", fontSize: 13 } as React.CSSProperties}>
          <CheckCircle2 size={15} color="var(--success)" /> Sin bloqueos visibles para tu rol.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {priorities.map((p) => {
            const color = p.level === "critical" ? "var(--error)" : p.level === "warning" ? "var(--warning)" : getModuleColor(p.moduleKey);
            return (
              <Link key={p.id} href={p.href} style={{ textDecoration: "none" }}>
                <div className="op-record-card" style={{ "--module-color": color, padding: "11px 12px", display: "flex", alignItems: "flex-start", gap: 10 } as React.CSSProperties}>
                  <Gauge size={16} color={color} style={{ marginTop: 3, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <Badge label={levelLabel(p.level)} variant={p.level === "critical" ? "error" : p.level === "warning" ? "warning" : "info"} dot={false} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 850, color: "var(--text)" }}>{p.title}</div>
                    {p.context && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{p.context}</div>}
                  </div>
                  <ArrowRight size={13} color="var(--faint)" style={{ marginTop: 4 }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function RecommendedActions({ actions, isMobile }: { actions: ControlAction[]; isMobile: boolean }) {
  return (
    <section className="op-panel" style={{ padding: isMobile ? 16 : 18 }}>
      <SectionHeader title="Acciones recomendadas" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {actions.map((action) => {
          const color = getModuleColor(action.moduleKey);
          return (
            <Link key={action.id} href={action.href} style={{ textDecoration: "none" }}>
              <div className="op-record-card" style={{ "--module-color": color, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" } as React.CSSProperties}>
                <span style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}18`, color }}>
                  <RadioTower size={14} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{action.label}</span>
                <ArrowRight size={13} color="var(--faint)" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
