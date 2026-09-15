"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Package, Truck, AlertTriangle, BarChart3, Store,
  CheckCircle2, ArrowRight, TrendingUp, Info, ShieldAlert,
} from "lucide-react";
import { SectionHeader } from "@/components/ui";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useIsMobile } from "@/lib/useIsMobile";
import { calcAlmacenaje } from "@/lib/almacenaje";
import { scoreGuardado, urgencia } from "@/lib/transporte";
import { horasDesde } from "@/lib/tienda";
import { getModuleColor, getModuleCssVars } from "@/lib/moduleTheme";
import type { DespachoTienda } from "@/lib/tienda";
import type { Novedad } from "@/lib/muebles";
import type { Guardado } from "@/lib/transporte";

// ── Tipos ─────────────────────────────────────────────────
interface AlertaItem {
  id: string;
  count: number;
  title: string;
  context?: string;
  href: string;
}
interface InfoItem {
  id: string;
  title: string;
  context?: string;
  href: string;
}
interface SinContactoData {
  count: number;
  items: Array<{ clientId: string; documento: string; fecha: string }>;
}

// ── Componente: fila de alerta ────────────────────────────
function AlertaRow({ level, count, title, context, href }: {
  level: "critical" | "warning" | "info";
  count?: number;
  title: string;
  context?: string;
  href: string;
}) {
  const COLOR = level === "critical" ? "var(--error)" : level === "warning" ? "var(--warning)" : "var(--brand)";
  const BG    = level === "critical" ? "var(--error-tint)" : level === "warning" ? "var(--warning-tint)" : "var(--brand-tint)";
  const BORDER = level === "critical" ? "rgba(220, 38, 38, 0.22)" : level === "warning" ? "rgba(217, 119, 6, 0.22)" : "rgba(37, 99, 235, 0.22)";

  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px", borderRadius: 10,
          background: BG, border: `1px solid ${BORDER}`,
          cursor: "pointer", transition: "opacity .12s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = ".82"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: COLOR, flexShrink: 0,
        }} />

        {count !== undefined && (
          <span style={{
            fontSize: 14, fontWeight: 800, color: COLOR,
            fontFamily: "var(--mono)", flexShrink: 0, minWidth: 22, textAlign: "right",
          }}>
            {count}
          </span>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>
            {title}
          </div>
          {context && (
            <div style={{
              fontSize: 11, color: "var(--muted)", marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {context}
            </div>
          )}
        </div>

        <ArrowRight size={13} color={COLOR} style={{ flexShrink: 0 }} />
      </div>
    </Link>
  );
}

// ── Componente: grupo de nivel ────────────────────────────
function AlertaGroup({ level, items }: {
  level: "critical" | "warning" | "info";
  items: AlertaItem[] | InfoItem[];
}) {
  if (items.length === 0) return null;
  const LABELS = { critical: "CRITICO", warning: "ADVERTENCIA", info: "INFORMACION" };
  const COLORS = { critical: "var(--error)", warning: "var(--warning)", info: "var(--brand)" };
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
        textTransform: "uppercase", color: COLORS[level], marginBottom: 8,
      }}>
        {LABELS[level]}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => (
          <AlertaRow
            key={item.id}
            level={level}
            count={"count" in item ? item.count : undefined}
            title={item.title}
            context={item.context}
            href={item.href}
          />
        ))}
      </div>
    </div>
  );
}

// ── Componente: KPI bloque ────────────────────────────────
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

// ════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function CentroControlPage() {
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const userName = (session?.user as { name?: string } | undefined)?.name ?? "";

  const [novedades,   setNovedades]   = useState<Novedad[]>([]);
  const [guardados,   setGuardados]   = useState<Guardado[]>([]);
  const [despachos,   setDespachos]   = useState<DespachoTienda[]>([]);
  const [kpis,        setKpis]        = useState<{ stats: any } | null>(null);
  const [sinContacto, setSinContacto] = useState<SinContactoData>({ count: 0, items: [] });
  const [loading,     setLoading]     = useState(true);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [nR, gR, sR, dR, scR] = await Promise.all([
        fetch("/api/novedades?pageSize=500"),
        fetch("/api/transporte?pageSize=500"),
        fetch("/api/novedades/stats?dias=30"),
        fetch("/api/tienda?pageSize=500"),
        fetch("/api/transporte/sin-contacto"),
      ]);
      const [nJ, gJ, sJ, dJ, scJ] = await Promise.all([
        nR.json(), gR.json(), sR.json(), dR.json(), scR.json(),
      ]);
      if (nJ.success)  setNovedades(nJ.data ?? []);
      if (gJ.success)  setGuardados(gJ.data ?? []);
      if (dJ.success)  setDespachos(dJ.data ?? []);
      if (scJ.success) setSinContacto({ count: scJ.count ?? 0, items: scJ.items ?? [] });
      setKpis({
        stats:       sJ.success ? sJ : null,
      });
    } catch { /* noop */ }
    finally { if (!silent) setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const autoRefresh = useAutoRefresh({
    onRefresh: () => load(true),
  });

  // ── Rankings (para INFO y KPI blocks) ────────────────────
  const rankingCC = useMemo(() => {
    const byCC: Record<string, { total: number; pend: number; desp: number; nov: number }> = {};
    for (const d of despachos) {
      if (!byCC[d.centroCostos]) byCC[d.centroCostos] = { total: 0, pend: 0, desp: 0, nov: 0 };
      byCC[d.centroCostos].total++;
      if (d.estado === "CREADO_TIENDA") byCC[d.centroCostos].pend++;
      if (String(d.estado) === "ENVIADO_CLIENTE") byCC[d.centroCostos].desp++;
      if (d.estado === "CON_NOVEDAD")       byCC[d.centroCostos].nov++;
    }
    return Object.entries(byCC)
      .map(([cc, d]) => ({ cc, ...d }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);
  }, [despachos]);

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

  // ── KPIs ─────────────────────────────────────────────────
  const invKpis = useMemo(() => {
    const pend     = novedades.filter((n) => n.estado === "PENDIENTE").length;
    const criticas = novedades.filter((n) => n.estado === "PENDIENTE" && (Date.now() - new Date(n.fecha + "T00:00:00").getTime()) > 30 * 86_400_000).length;
    const impacto  = novedades.reduce((s, n) => s + Math.abs(n.costoIncidencia ?? 0), 0);
    return { total: novedades.length, pend, criticas, impacto };
  }, [novedades]);

  const grdKpis = useMemo(() => {
    const activos  = guardados.filter((g) => g.estado === "PENDIENTE DESPACHO");
    const costoTotal  = activos.reduce((s, g) => s + calcAlmacenaje(g.fecha, null).costo, 0);
    const proyeccion  = activos.reduce((s, g) => { const a = calcAlmacenaje(g.fecha, null); return s + (a.fase === "cobro" ? (a as any).costoProximo ?? a.costo : 0); }, 0);
    const criticos = activos.filter((g) => scoreGuardado(g) >= 70).length;
    const vencidos = activos.filter((g) => urgencia(g)?.tipo === "vencida").length;
    return { activos: activos.length, costoTotal, proyeccion, criticos, vencidos };
  }, [guardados]);

  const tiendaKpis = useMemo(() => ({
    pendientes:  despachos.filter((d) => d.estado === "CREADO_TIENDA").length,
    recibidos:   despachos.filter((d) => d.estado === "RECOGIDO_TIENDA" || d.estado === "ENTREGADO_CEDI").length,
    despachados: despachos.filter((d) => String(d.estado) === "ENVIADO_CLIENTE").length,
    novedades:   despachos.filter((d) => d.estado === "CON_NOVEDAD").length,
    criticos:    despachos.filter((d) => d.estado === "CREADO_TIENDA" && horasDesde(d.createdAt) >= 24).length,
  }), [despachos]);

  // ── ALERTAS OPERACIONALES ─────────────────────────────────
  const alertas = useMemo(() => {
    const now = Date.now();
    const dias = (iso: string) => Math.floor((now - new Date(iso + "T00:00:00").getTime()) / 86_400_000);

    // ── CRITICAL ─────────────────────────────────────────
    const g60d = guardados.filter((g) => g.estado === "PENDIENTE DESPACHO" && dias(g.fecha) > 60);
    const n7d  = novedades.filter((n) => n.estado !== "SOLUCIONADO" && dias(n.fecha) > 7);
    const t48h = despachos.filter((d) =>
      d.estado === "CREADO_TIENDA" && horasDesde(d.createdAt) > 48
    );

    const critical: AlertaItem[] = [
      {
        id:      "g60d",
        count:   g60d.length,
        title:   "Guardados con más de 60 días en bodega",
        context: g60d.length > 0 ? g60d.slice(0, 3).map((g) => g.documento).join(" · ") + (g60d.length > 3 ? ` · +${g60d.length - 3} más` : "") : undefined,
        href:    "/dashboard/transporte",
      },
      {
        id:      "n7d",
        count:   n7d.length,
        title:   "Novedades abiertas sin resolver por más de 7 días",
        context: n7d.length > 0 ? n7d.slice(0, 3).map((n) => n.plu).join(" · ") + (n7d.length > 3 ? ` · +${n7d.length - 3} más` : "") : undefined,
        href:    "/dashboard/inventario",
      },
      {
        id:      "t48h",
        count:   t48h.length,
        title:   "Despachos de tienda sin recoger por más de 48 horas",
        context: t48h.length > 0 ? t48h.slice(0, 3).map((d) => d.numeroDocumento).join(" · ") + (t48h.length > 3 ? ` · +${t48h.length - 3} más` : "") : undefined,
        href:    "/dashboard/tienda",
      },
    ].filter((a) => a.count > 0);

    // ── WARNING ───────────────────────────────────────────
    const novSinAsig = novedades.filter((n) => n.estado !== "SOLUCIONADO" && !(n as any).asignadoA);

    const warning: AlertaItem[] = [
      {
        id:      "nsa",
        count:   novSinAsig.length,
        title:   "Novedades sin responsable asignado",
        context: novSinAsig.length > 0 ? `${novSinAsig.length} novedade${novSinAsig.length !== 1 ? "s" : ""} sin seguimiento` : undefined,
        href:    "/dashboard/inventario",
      },
      {
        id:      "gsc",
        count:   sinContacto.count,
        title:   "Guardados sin ningún contacto registrado",
        context: sinContacto.items.length > 0
          ? sinContacto.items.slice(0, 3).map((i) => i.documento).join(" · ") + (sinContacto.count > 3 ? ` · +${sinContacto.count - 3} más` : "")
          : undefined,
        href:    "/dashboard/transporte",
      },
    ].filter((a) => a.count > 0);

    // ── INFO (top 1 de cada ranking) ──────────────────────
    const topCC   = rankingCC[0];
    const topResp = rankingInventario[0];

    const info: InfoItem[] = [
      topCC && {
        id:      "topCC",
        title:   `Top CC: ${topCC.cc}`,
        context: `${topCC.total} despacho${topCC.total !== 1 ? "s" : ""} · ${topCC.pend} pendiente${topCC.pend !== 1 ? "s" : ""} · ${topCC.desp} entregado${topCC.desp !== 1 ? "s" : ""}`,
        href:    "/dashboard/tienda",
      },
      topResp && {
        id:      "topResp",
        title:   `Top responsable: ${topResp.nombre}`,
        context: `${topResp.resueltas}/${topResp.total} novedades resueltas · ${topResp.tasa}% de tasa`,
        href:    "/dashboard/inventario",
      },
    ].filter(Boolean) as InfoItem[];

    return { critical, warning, info, totalCritical: critical.length, totalWarning: warning.length };
  }, [guardados, novedades, despachos, sinContacto, rankingCC, rankingInventario]);

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-fade-in" style={getModuleCssVars("centro-control") as React.CSSProperties}>
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton" style={{ height: 28, width: 320, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: 200, borderRadius: 4 }} />
        </div>
        <div className="ds-card" style={{ padding: 24, marginBottom: 24 }}>
          {[100, 80, 90].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 44, borderRadius: 10, marginBottom: 8, width: `${w}%` }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12 }} />
          ))}
        </div>
      </div>
    );
  }

  const hasExcepctions = alertas.totalCritical > 0 || alertas.totalWarning > 0;

  return (
    <div className="animate-fade-in" style={getModuleCssVars("centro-control") as React.CSSProperties}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
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
        <div style={{ marginTop: 12 }}>
          <AutoRefreshIndicator
            lastUpdatedAt={autoRefresh.lastUpdatedAt}
            refreshing={autoRefresh.refreshing}
            onRefresh={autoRefresh.refreshNow}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          ALERTAS OPERACIONALES — panel de excepciones
          ══════════════════════════════════════════════════════ */}
      <div className="ds-card" style={{ padding: "20px 22px", marginBottom: 24 }}>
        {/* Header de sección */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: hasExcepctions ? "var(--error-tint)" : "var(--brand-tint)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {hasExcepctions
                ? <ShieldAlert size={16} color="var(--error)" />
                : <CheckCircle2 size={16} color="var(--brand)" />}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              Alertas Operacionales
            </span>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            {alertas.totalCritical > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                background: "var(--error-tint)", color: "var(--error)", border: "1px solid rgba(180,35,24,.14)",
              }}>
                {alertas.totalCritical} crítica{alertas.totalCritical !== 1 ? "s" : ""}
              </span>
            )}
            {alertas.totalWarning > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                background: "var(--warning-tint)", color: "var(--warning)", border: "1px solid rgba(71,85,105,.14)",
              }}>
                {alertas.totalWarning} advertencia{alertas.totalWarning !== 1 ? "s" : ""}
              </span>
            )}
            {!hasExcepctions && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
                background: "var(--brand-tint)", color: "var(--brand)", border: "1px solid rgba(29,78,216,.15)",
              }}>
                Sin excepciones
              </span>
            )}
          </div>
        </div>

        {/* Sin excepciones */}
        {!hasExcepctions && alertas.info.length === 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
            background: "var(--brand-tint)", borderRadius: 10, border: "1px solid rgba(29,78,216,.15)",
          }}>
            <CheckCircle2 size={16} color="var(--brand)" />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Sistema operando sin excepciones. Todos los indicadores dentro del rango normal.
            </span>
          </div>
        )}

        {/* Grupos de alertas */}
        <div style={{ display: "flex", flexDirection: "column", gap: hasExcepctions ? 20 : 12 }}>
          <AlertaGroup level="critical" items={alertas.critical} />
          <AlertaGroup level="warning"  items={alertas.warning} />

          {/* Separador antes de INFO */}
          {(hasExcepctions && alertas.info.length > 0) && (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }} />
          )}

          {/* INFO: top rankings */}
          {alertas.info.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                textTransform: "uppercase", color: "#34D9F0", marginBottom: 8,
              }}>
                INFORMACIÓN
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 8 }}>
                {alertas.info.map((item) => (
                  <Link key={item.id} href={item.href} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        padding: "10px 12px", borderRadius: 10,
                        background: "#34D9F00d", border: "1px solid #34D9F025",
                        cursor: "pointer", transition: "opacity .12s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = ".8"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <TrendingUp size={12} color="#34D9F0" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#34D9F0" }}>{item.title}</span>
                      </div>
                      {item.context && (
                        <div style={{
                          fontSize: 11, color: "var(--muted)", lineHeight: 1.4,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {item.context}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Grid de KPIs por módulo ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        <KpiBlock title="Inventario" icon={<Package size={15} color={getModuleColor("inventario")} />}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <MiniKpi label="Novedades abiertas" value={invKpis.pend} color={invKpis.pend > 0 ? "var(--error)" : "var(--success)"} />
            <MiniKpi label="Críticas >30d"      value={invKpis.criticas} color={invKpis.criticas > 0 ? "var(--error)" : "var(--muted)"} />
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

        <KpiBlock title="Guardados" icon={<Truck size={15} color={getModuleColor("transporte")} />}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <MiniKpi label="Costo acumulado"    value={"$" + Math.round(grdKpis.costoTotal / 1_000_000 * 10) / 10 + "M"} color={getModuleColor("transporte")} />
            <MiniKpi label="Próx. mes"          value={"$" + Math.round(grdKpis.proyeccion / 1_000_000 * 10) / 10 + "M"} color="var(--muted)" />
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 16 }}>
            <MiniKpi label="Score crítico ≥70"  value={grdKpis.criticos} color={grdKpis.criticos > 0 ? "var(--error)" : "var(--success)"} />
            <MiniKpi label="Entregas vencidas"  value={grdKpis.vencidos} color={grdKpis.vencidos > 0 ? "var(--error)" : "var(--success)"} />
          </div>
        </KpiBlock>

        <KpiBlock title="Tienda" icon={<Store size={15} color={getModuleColor("tienda")} />}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <MiniKpi label="Activos tienda"     value={tiendaKpis.pendientes} color={tiendaKpis.pendientes > 0 ? "var(--warning)" : "var(--muted)"} />
            <MiniKpi label=">24h sin recoger"   value={tiendaKpis.criticos}   color={tiendaKpis.criticos > 0 ? "var(--error)" : "var(--muted)"} />
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 12 }}>
            <MiniKpi label="Recogidos/CEDI"     value={tiendaKpis.recibidos}   color="var(--info)" />
            <MiniKpi label="Enviados cliente"   value={tiendaKpis.despachados} color="var(--success)" />
            <MiniKpi label="Con novedad"        value={tiendaKpis.novedades}   color={tiendaKpis.novedades > 0 ? "var(--error)" : "var(--muted)"} />
          </div>
        </KpiBlock>
      </div>

      {/* ── Rankings ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <div className="ds-card" style={{ padding: "20px 22px" }}>
          <SectionHeader title="Inventario — Top responsables" />
          {rankingInventario.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "var(--muted)" }}>
              Asigna novedades a responsables para ver el ranking
            </div>
          ) : rankingInventario.map((r, i) => (
            <RankRow
              key={r.nombre} rank={i + 1} nombre={r.nombre}
              main={`${r.resueltas}/${r.total}`} sub={`${r.abiertas} abiertas`}
              badge={`${r.tasa}%`}
              color={r.tasa >= 80 ? "var(--success)" : r.tasa >= 50 ? "var(--warning)" : "var(--error)"}
            />
          ))}
        </div>

        <div className="ds-card" style={{ padding: "20px 22px" }}>
          <SectionHeader title="Tienda — Top centros de costo" />
          {rankingCC.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "var(--muted)" }}>Sin despachos registrados</div>
          ) : rankingCC.map((r, i) => (
            <RankRow
              key={r.cc} rank={i + 1} nombre={r.cc} main={String(r.total)}
              sub={`${r.pend} pend · ${r.desp} desp${r.nov > 0 ? ` · ${r.nov} nov` : ""}`}
              badge={r.pend > 0 ? `${r.pend} pend` : undefined}
              color={r.nov > 0 ? "var(--error)" : r.pend > 3 ? "var(--warning)" : "var(--success)"}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
