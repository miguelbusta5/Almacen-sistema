"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Package, Truck, Route, AlertTriangle, TrendingUp, TrendingDown,
  CheckCircle2, Clock, BarChart3, Users,
} from "lucide-react";
import { Stat, SkeletonStat, SectionHeader } from "@/components/ui";
import { IntelBanner } from "@/components/ui/SlidePanel";
import { consolidarInsights } from "@/lib/inteligencia";
import { calcAlmacenaje } from "@/lib/almacenaje";
import { scoreGuardado, urgencia } from "@/lib/transporte";
import type { Novedad } from "@/lib/muebles";
import type { Guardado } from "@/lib/transporte";

function KpiBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="ds-card" style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function MiniKpi({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", color: color ?? "var(--text)", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: color ?? "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function RankRow({ rank, nombre, main, sub, color, badge }: {
  rank: number; nombre: string; main: string; sub?: string; color?: string; badge?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 11, color: "var(--faint)", fontFamily: "var(--mono)", width: 16, textAlign: "right", flexShrink: 0 }}>{rank}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombre}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>}
      </div>
      {badge && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: (color ?? "#6b7280") + "18", color: color ?? "var(--muted)" }}>{badge}</span>}
      <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: 15, color: color ?? "var(--text)", flexShrink: 0 }}>{main}</span>
    </div>
  );
}

export default function CentroControlPage() {
  const { data: session } = useSession();
  const userName = (session?.user as { name?: string } | undefined)?.name ?? "";

  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [guardados, setGuardados] = useState<Guardado[]>([]);
  const [kpis, setKpis] = useState<{ conductores: any[]; stats: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [nR, gR, cR, sR] = await Promise.all([
          fetch("/api/novedades?pageSize=500"),
          fetch("/api/transporte?pageSize=500"),
          fetch("/api/logistica/conductores/kpis?dias=30"),
          fetch("/api/novedades/stats?dias=30"),
        ]);
        const [nJ, gJ, cJ, sJ] = await Promise.all([nR.json(), gR.json(), cR.json(), sR.json()]);
        if (nJ.success) setNovedades(nJ.data ?? []);
        if (gJ.success) setGuardados(gJ.data ?? []);
        setKpis({
          conductores: cJ.success ? cJ.data ?? [] : [],
          stats: sJ.success ? sJ : null,
        });
      } catch { /* noop */ }
      finally { setLoading(false); }
    })();
  }, []);

  const insights = useMemo(() => consolidarInsights(novedades, guardados, []), [novedades, guardados]);

  // ── KPIs Inventario ──────────────────────────────────────
  const invKpis = useMemo(() => {
    const pend = novedades.filter((n) => n.estado === "PENDIENTE").length;
    const criticas = novedades.filter((n) => n.estado === "PENDIENTE" && (Date.now() - new Date(n.fecha + "T00:00:00").getTime()) > 30 * 86_400_000).length;
    const impacto = novedades.reduce((s, n) => s + Math.abs(n.costoIncidencia ?? 0), 0);
    return { total: novedades.length, pend, criticas, impacto };
  }, [novedades]);

  // ── KPIs Guardados ───────────────────────────────────────
  const grdKpis = useMemo(() => {
    const activos = guardados.filter((g) => g.estado === "PENDIENTE DESPACHO");
    const costoTotal = activos.reduce((s, g) => s + calcAlmacenaje(g.fecha, null).costo, 0);
    const proyeccion = activos.reduce((s, g) => { const alm = calcAlmacenaje(g.fecha, null); return s + (alm.fase === "cobro" ? (alm as any).costoProximo ?? alm.costo : 0); }, 0);
    const criticos = activos.filter((g) => scoreGuardado(g) >= 70).length;
    const vencidos = activos.filter((g) => urgencia(g)?.tipo === "vencida").length;
    return { activos: activos.length, costoTotal, proyeccion, criticos, vencidos };
  }, [guardados]);

  // ── KPIs Conductores ─────────────────────────────────────
  const condKpis = useMemo(() => {
    const conds = kpis?.conductores ?? [];
    const activos = conds.length;
    const incidencias = conds.reduce((s: number, c: any) => s + (c.incidencias ?? 0), 0);
    const tasaProm = conds.length > 0
      ? Math.round(conds.reduce((s: number, c: any) => s + (c.tasaEntrega ?? 0), 0) / conds.length)
      : null;
    const enAlerta = conds.filter((c: any) => (c.tasaEntrega ?? 100) < 70).length;
    return { activos, incidencias, tasaProm, enAlerta };
  }, [kpis]);

  // ── Ranking Inventario por responsable ───────────────────
  const rankingInventario = useMemo(() => {
    const byResp: Record<string, { total: number; resueltas: number; abiertas: number }> = {};
    for (const n of novedades) {
      const r = (n as any).asignadoA as string | null;
      if (!r) continue;
      if (!byResp[r]) byResp[r] = { total: 0, resueltas: 0, abiertas: 0 };
      byResp[r].total++;
      if (n.estado === "SOLUCIONADO") byResp[r].resueltas++;
      else byResp[r].abiertas++;
    }
    return Object.entries(byResp)
      .map(([nombre, d]) => ({ nombre, ...d, tasa: d.total > 0 ? Math.round(d.resueltas / d.total * 100) : 0 }))
      .sort((a, b) => b.resueltas - a.resueltas)
      .slice(0, 7);
  }, [novedades]);

  const fmtCOP = (n: number) => "$" + Math.round(n / 1000) + "k";

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton" style={{ height: 28, width: 320, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: 200, borderRadius: 4 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--brand-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BarChart3 size={17} color="var(--brand)" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", margin: 0 }}>
            Centro de Control Operacional
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          {new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
          {userName && ` · ${userName}`}
        </p>
      </div>

      {/* Inteligencia crítica */}
      {insights.filter((i) => i.level === "critical").length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <IntelBanner
            insights={insights.filter((i) => i.level === "critical")}
            maxVisible={5}
            title="Alertas críticas"
          />
        </div>
      )}

      {/* Grid de módulos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {/* Inventario */}
        <KpiBlock title="Inventario" icon={<Package size={15} color="#2563EB" />}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <MiniKpi label="Novedades abiertas" value={invKpis.pend} color={invKpis.pend > 0 ? "var(--error)" : "var(--success)"} />
            <MiniKpi label="Críticas >30d" value={invKpis.criticas} color={invKpis.criticas > 0 ? "var(--error)" : "var(--muted)"} />
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <MiniKpi label="Impacto económico total" value={"$" + Math.round(invKpis.impacto / 1_000_000 * 10) / 10 + "M"} color="var(--brand)" />
          </div>
          {kpis?.stats && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", display: "flex", gap: 12 }}>
              <span>Clasificadas: <strong style={{ color: "var(--text)" }}>{kpis.stats.tasaClasificacion}%</strong></span>
              <span>Sin asignar: <strong style={{ color: (kpis.stats.resumen?.sinAsignar > 0) ? "var(--warning)" : "var(--success)" }}>{kpis.stats.resumen?.sinAsignar ?? 0}</strong></span>
            </div>
          )}
        </KpiBlock>

        {/* Guardados */}
        <KpiBlock title="Guardados" icon={<Truck size={15} color="#0E7490" />}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <MiniKpi label="Costo acumulado" value={"$" + Math.round(grdKpis.costoTotal / 1_000_000 * 10) / 10 + "M"} color="#0E7490" />
            <MiniKpi label="Proyectado próx. mes" value={"$" + Math.round(grdKpis.proyeccion / 1_000_000 * 10) / 10 + "M"} color="var(--muted)" />
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 16 }}>
            <MiniKpi label="Score crítico ≥70" value={grdKpis.criticos} color={grdKpis.criticos > 0 ? "var(--error)" : "var(--success)"} />
            <MiniKpi label="Entregas vencidas" value={grdKpis.vencidos} color={grdKpis.vencidos > 0 ? "var(--error)" : "var(--success)"} />
          </div>
        </KpiBlock>

        {/* Conductores */}
        <KpiBlock title="Conductores" icon={<Route size={15} color="#7C3AED" />}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <MiniKpi label="Activos (30d)" value={condKpis.activos} color="var(--text)" />
            <MiniKpi label="Tasa promedio" value={condKpis.tasaProm != null ? `${condKpis.tasaProm}%` : "—"} color={condKpis.tasaProm != null && condKpis.tasaProm >= 85 ? "var(--success)" : "var(--warning)"} />
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 16 }}>
            <MiniKpi label="Incidencias abiertas" value={condKpis.incidencias} color={condKpis.incidencias > 5 ? "var(--warning)" : "var(--muted)"} />
            <MiniKpi label="En alerta (<70%)" value={condKpis.enAlerta} color={condKpis.enAlerta > 0 ? "var(--error)" : "var(--success)"} />
          </div>
        </KpiBlock>
      </div>

      {/* Rankings + Top warnings */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {/* Ranking Inventario */}
        <div className="ds-card" style={{ padding: "20px 22px" }}>
          <SectionHeader title="Rendimiento Inventario — Top responsables" />
          {rankingInventario.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "var(--muted)" }}>
              Asigna novedades a responsables para ver el ranking
            </div>
          ) : (
            rankingInventario.map((r, i) => (
              <RankRow
                key={r.nombre}
                rank={i + 1}
                nombre={r.nombre}
                main={`${r.resueltas}/${r.total}`}
                sub={`${r.abiertas} abiertas`}
                badge={`${r.tasa}%`}
                color={r.tasa >= 80 ? "var(--success)" : r.tasa >= 50 ? "var(--warning)" : "var(--error)"}
              />
            ))
          )}
        </div>

        {/* Ranking Conductores */}
        <div className="ds-card" style={{ padding: "20px 22px" }}>
          <SectionHeader title="Rendimiento Transporte — Conductores" />
          {(kpis?.conductores ?? []).length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "var(--muted)" }}>
              Sin rutas registradas en los últimos 30 días
            </div>
          ) : (
            (kpis?.conductores ?? []).slice(0, 7).map((c: any, i: number) => {
              const tasa = c.tasaEntrega ?? 0;
              const color = tasa >= 90 ? "var(--success)" : tasa >= 70 ? "var(--warning)" : "var(--error)";
              return (
                <RankRow
                  key={c.transportistaId}
                  rank={i + 1}
                  nombre={c.nombre}
                  main={`${tasa}%`}
                  sub={`${c.entregadas}/${c.totalParadas} entregas${c.incidencias > 0 ? ` · ${c.incidencias} incid.` : ""}`}
                  badge={c.tiempoPromedio ? `${c.tiempoPromedio}min` : undefined}
                  color={color}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Top insights warnings */}
      {insights.filter((i) => i.level === "warning").length > 0 && (
        <IntelBanner
          insights={insights.filter((i) => i.level === "warning")}
          maxVisible={5}
          title="Alertas operativas"
        />
      )}
    </div>
  );
}
