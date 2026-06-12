"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
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
  if (level === "critical") return "Critico";
  if (level === "warning") return "Alerta";
  return "Info";
}

export function ControlHero({ nombre, resumen, isMobile }: {
  nombre: string;
  resumen: ControlLogisticoResumen;
  isMobile: boolean;
}) {
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos dias" : hora < 18 ? "Buenas tardes" : "Buenas noches";
  const accent = controlStatusColor(resumen.headline.status);

  return (
    <section style={{
      border: "1px solid var(--border)", borderRadius: 14,
      background: "linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)",
      padding: isMobile ? 18 : 24, marginBottom: 18, position: "relative", overflow: "hidden",
    }}>
      <span style={{ position: "absolute", inset: "0 auto 0 0", width: 5, background: accent }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: accent, marginBottom: 8 }}>
            {PRODUCT.displayName}
          </div>
          <h1 style={{ fontSize: isMobile ? 26 : 34, fontWeight: 850, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1.05, margin: 0 }}>
            {saludo}{nombre ? `, ${nombre}` : ""}.
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8, maxWidth: 640 }}>
            Consola operativa por rol: prioridades, flujo CEDI y acciones visibles segun permisos.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(76px, 1fr))", gap: 10, minWidth: isMobile ? "100%" : 300 }}>
          {[
            { label: "Criticos", value: resumen.headline.critical, color: accent },
            { label: "Pendientes", value: resumen.headline.pending, color: "var(--text)" },
            { label: "Cerrados", value: resumen.headline.completedToday, color: "var(--success)" },
          ].map((kpi) => (
            <div key={kpi.label} className="ds-card" style={{ padding: 12, borderRadius: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 850, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ModuleSignalGrid({ modules, isMobile }: { modules: ControlModuleSignal[]; isMobile: boolean }) {
  return (
    <section className="ds-card" style={{ padding: isMobile ? 16 : 18 }}>
      <SectionHeader title="Modulos bajo control" />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {modules.map((m) => (
          <Link key={m.key} href={m.href} style={{ textDecoration: "none" }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 13, minHeight: 104, background: "var(--surface)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{m.label}</div>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: controlStatusColor(m.status), boxShadow: `0 0 0 3px ${controlStatusColor(m.status)}22` }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 850, color: getModuleColor(m.key), lineHeight: 1 }}>{m.count ?? "Activo"}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>{m.description}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function PriorityPanel({ priorities, isMobile }: { priorities: ControlPriority[]; isMobile: boolean }) {
  return (
    <section className="ds-card" style={{ padding: isMobile ? 16 : 18 }}>
      <SectionHeader title="Prioridad operativa" />
      {priorities.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13, padding: "12px 0" }}>
          <CheckCircle2 size={15} color="var(--success)" /> Sin bloqueos visibles para tu rol.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {priorities.map((p) => (
            <Link key={p.id} href={p.href} style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: p.level === "critical" ? "var(--error)" : p.level === "warning" ? "var(--warning)" : getModuleColor(p.moduleKey), marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <Badge label={levelLabel(p.level)} variant={p.level === "critical" ? "error" : p.level === "warning" ? "warning" : "info"} dot={false} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{p.title}</div>
                  {p.context && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{p.context}</div>}
                </div>
                <ArrowRight size={13} color="var(--faint)" style={{ marginTop: 4 }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function RecommendedActions({ actions, isMobile }: { actions: ControlAction[]; isMobile: boolean }) {
  return (
    <section className="ds-card" style={{ padding: isMobile ? 16 : 18 }}>
      <SectionHeader title="Acciones recomendadas" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {actions.map((action) => (
          <Link key={action.id} href={action.href} style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)" }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: getModuleColor(action.moduleKey) + "16", color: getModuleColor(action.moduleKey) }}>
                <ArrowRight size={14} />
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 750, color: "var(--text)" }}>{action.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

