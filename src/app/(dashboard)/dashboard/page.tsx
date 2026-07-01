"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { SectionHeader, SkeletonStat as SK } from "@/components/ui";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { useIsMobile } from "@/lib/useIsMobile";
import type { ControlLogisticoResumen } from "@/lib/controlLogistico/types";
import {
  ControlHero,
  ModuleSignalGrid,
  PriorityPanel,
  RecommendedActions,
  controlStatusColor,
} from "@/components/control-logistico";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

function OperationFlow({ stages, isMobile }: {
  isMobile: boolean;
  stages: Array<{ key: string; label: string; value: number | string; href: string; color: string; sub?: string; alert?: boolean }>;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${Math.max(stages.length, 1)}, minmax(0, 1fr))`, gap: 10 }}>
      {stages.map((stage, i) => (
        <Link key={stage.key} href={stage.href} style={{ textDecoration: "none", minWidth: 0 }}>
          <div style={{
            minHeight: 104, padding: "14px 14px 12px", border: "1px solid var(--border)",
            borderRadius: 8, background: "var(--surface)", position: "relative", overflow: "hidden",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              {stage.alert ? <AlertTriangle size={14} color="var(--warning)" /> : <CheckCircle2 size={14} color={stage.color} />}
            </div>
            <div>
              <div style={{ fontSize: 24, lineHeight: 1, fontWeight: 800, color: stage.color, letterSpacing: "-0.03em", marginBottom: 5 }}>
                {stage.value}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflowWrap: "anywhere" }}>{stage.label}</div>
              {stage.sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{stage.sub}</div>}
            </div>
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: stage.color }} />
          </div>
        </Link>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// CONSOLA UNIFICADA — página raíz del dashboard para todos los roles
// (el resumen por rol, incl. TRANSPORTISTA, lo calcula el servidor en
// /api/control-logistico/resumen vía buildControlLogisticoResumen)
// ════════════════════════════════════════════════════════════
function ControlLogisticoDashboard({ nombre }: { nombre: string }) {
  const isMobile = useIsMobile();
  const [data, setData] = useState<ControlLogisticoResumen | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const json = await fetch("/api/control-logistico/resumen")
      .then((res) => res.json())
      .catch(() => null);
    if (json?.success) setData(json);
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const autoRefresh = useAutoRefresh({
    onRefresh: () => load(true),
  });

  if (loading || !data) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: 1180 }}>
        <div className="skeleton" style={{ height: 176, borderRadius: 14, marginBottom: 18 }} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr .8fr", gap: 16 }}>
          <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
          <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in control-dashboard" style={{ maxWidth: 1180 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <AutoRefreshIndicator
          lastUpdatedAt={autoRefresh.lastUpdatedAt}
          refreshing={autoRefresh.refreshing}
          onRefresh={autoRefresh.refreshNow}
        />
      </div>
      <ControlHero nombre={nombre} resumen={data} isMobile={isMobile} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.15fr .85fr", gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section className="ds-card" style={{ padding: isMobile ? 16 : 18 }}>
            <SectionHeader title="Flujo logistico CEDI" />
            <OperationFlow stages={data.flow.map((stage) => ({ ...stage, color: controlStatusColor(stage.status) }))} isMobile={isMobile} />
          </section>

          <ModuleSignalGrid modules={data.modules} isMobile={isMobile} />
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <PriorityPanel priorities={data.priorities} isMobile={isMobile} />
          <RecommendedActions actions={data.actions} isMobile={isMobile} />
        </aside>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const nombre = (session?.user?.name || "").split(" ")[0] || "";
  useEffect(() => {
    if (role === "ETIQUETADO") router.replace("/dashboard/exportaciones");
  }, [role, router]);
  if (role === "ETIQUETADO") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 14 : 28, maxWidth: 900, padding: "0 2px" }}>
        <SK /><SK /><SK /><SK />
      </div>
    );
  }
  if (session) return <ControlLogisticoDashboard nombre={nombre} />;

  // Mientras carga la sesión
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 14 : 28, maxWidth: 900, padding: "0 2px" }}>
      <SK /><SK /><SK /><SK />
    </div>
  );
}
