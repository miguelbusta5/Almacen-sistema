"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import {
  Plus, X, Pencil, Trash2, Package, CheckCircle2, Search,
  AlertTriangle, BarChart3, List, Clock, UserCheck, ExternalLink, Camera,
} from "lucide-react";
import {
  Novedad, EstadoNovedad, ESTADOS, ESTADO_COLOR, estadoLabel, fmtFecha, fmtCOP, todayISO,
  TIPOS_NOVEDAD, TIPO_NOVEDAD_LABEL, TIPO_NOVEDAD_COLOR, CAUSAS_RAIZ, CAUSA_RAIZ_LABEL, TURNOS,
} from "@/lib/muebles";
import { insightsNovedades, insightsPorNovedad } from "@/lib/inteligencia";
import { Stat, SkeletonStat, Badge, EmptyState, SkeletonTable } from "@/components/ui";
import { SlidePanel, IntelBanner, IntelAlert, DetailSection, DetailGrid, MiniHistory } from "@/components/ui/SlidePanel";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type ProductoMaestro = {
  plu: string;
  descripcion: string | null;
  fabricante: string | null;
  precio: number | null;
  marca: string | null;
};

const CHART_BASE = { maintainAspectRatio: false, plugins: { legend: { display: false } } };

function estadoBadgeVariant(e: EstadoNovedad): "error" | "warning" | "success" {
  return e === "PENDIENTE" ? "error" : e === "EN PROCESO" ? "warning" : "success";
}

const inp: React.CSSProperties = {
  width: "100%", height: 36,
  padding: "0 12px",
  background: "var(--surface2)", border: "1px solid transparent",
  borderRadius: 8, fontSize: 14, fontFamily: "var(--sans)",
  color: "var(--text)", outline: "none",
  transition: "border-color .15s, box-shadow .15s, background .15s",
};
const focusProps = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = "var(--brand)";
    e.target.style.boxShadow = "var(--ring)";
    e.target.style.background = "var(--surface)";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = "transparent";
    e.target.style.boxShadow = "none";
    e.target.style.background = "var(--surface2)";
  },
};

// Modal para confirmación de borrado (sí usamos modal para destructivo)
function DeleteModal({ novedad, onClose, onDeleted, onError }: {
  novedad: Novedad; onClose: () => void;
  onDeleted: () => void; onError: (m: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  async function confirm() {
    setDeleting(true);
    const res = await fetch(`/api/novedades/${novedad.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) onDeleted(); else onError(json.error || "Error");
    setDeleting(false);
  }

  if (!mounted) return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in"
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 380, padding: "24px", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--error-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={16} color="var(--error)" />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>Eliminar novedad</h3>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, marginTop: 2 }}>PLU {novedad.plu} · {novedad.posicion}</p>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 20 }}>
          Esta acción es permanente y no se puede deshacer.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ds-btn ds-btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="ds-btn ds-btn-danger" style={{ flex: 1 }} disabled={deleting} onClick={confirm}>
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function MueblesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canEdit = can(role, "edit");
  const canDelete = can(role, "delete");

  const [items, setItems] = useState<Novedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"lista" | "graficos" | "analisis">("lista");
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const [fq, setFq] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fFab, setFFab] = useState("");
  const [sortCol, setSortCol] = useState("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [panelItem, setPanelItem] = useState<Novedad | null>(null);
  const [editing, setEditing] = useState<Novedad | null>(null);
  const [deleting, setDeleting] = useState<Novedad | null>(null);
  const [creando, setCreando] = useState(false);

  async function loadStats() {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/novedades/stats?dias=30");
      const json = await res.json();
      if (json.success) setStats(json);
    } catch { /* noop */ }
    finally { setLoadingStats(false); }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/novedades?pageSize=500");
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch { showToast("Error al cargar datos", true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  // Insights operacionales
  const globalInsights = useMemo(() => insightsNovedades(items), [items]);
  const panelInsights = useMemo(
    () => panelItem ? insightsPorNovedad(panelItem, items) : [],
    [panelItem, items]
  );

  // PLUs con insight (para indicador en tabla)
  const pluConInsight = useMemo(() => {
    const set = new Set<string>();
    for (const ins of globalInsights) {
      const m = ins.message.match(/PLU (\S+)/);
      if (m) set.add(m[1]);
    }
    return set;
  }, [globalInsights]);

  const kpis = useMemo(() => {
    const pend = items.filter((n) => n.estado === "PENDIENTE").length;
    const proc = items.filter((n) => n.estado === "EN PROCESO").length;
    const sol = items.filter((n) => n.estado === "SOLUCIONADO").length;
    const impacto = items.reduce((s, n) => s + Math.abs(n.costoIncidencia || 0), 0);
    return { total: items.length, pend, proc, sol, impacto };
  }, [items]);

  const fabricantes = useMemo(() =>
    [...new Set(items.filter((n) => n.fabricante).map((n) => n.fabricante as string))].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const q = fq.toLowerCase();
    return [...items]
      .filter((n) => {
        if (fEstado && n.estado !== fEstado) return false;
        if (fFab && n.fabricante !== fFab) return false;
        if (q && !n.plu.toLowerCase().includes(q) && !n.posicion.toLowerCase().includes(q)
          && !(n.descripcion || "").toLowerCase().includes(q)
          && !(n.fabricante || "").toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        switch (sortCol) {
          case "fecha": return dir * a.fecha.localeCompare(b.fecha);
          case "plu": return dir * a.plu.localeCompare(b.plu);
          case "descripcion": return dir * (a.descripcion || "").localeCompare(b.descripcion || "");
          case "fabricante": return dir * (a.fabricante || "").localeCompare(b.fabricante || "");
          case "posicion": return dir * a.posicion.localeCompare(b.posicion);
          case "cantidad": return dir * (a.cantidad - b.cantidad);
          case "impacto": return dir * (Math.abs(a.costoIncidencia || 0) - Math.abs(b.costoIncidencia || 0));
          case "estado": return dir * a.estado.localeCompare(b.estado);
          default: return 0;
        }
      });
  }, [items, fq, fEstado, fFab, sortCol, sortDir]);

  const Th = ({ col, label, right }: { col: string; label: string; right?: boolean }) => {
    const active = sortCol === col;
    return (
      <th className="sortable" onClick={() => toggleSort(col)}
        style={{ textAlign: right ? "right" : "left", color: active ? "var(--brand)" : undefined }}>
        {label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕"}
      </th>
    );
  };

  // Datos gráficos
  const donutData = useMemo(() => ({
    labels: ESTADOS.map(estadoLabel),
    datasets: [{ data: ESTADOS.map((e) => items.filter((n) => n.estado === e).length), backgroundColor: ESTADOS.map((e) => ESTADO_COLOR[e]), borderWidth: 0 }],
  }), [items]);

  const fabData = useMemo(() => {
    const byFab: Record<string, number> = {};
    for (const n of items) {
      if (!n.fabricante) continue;
      byFab[n.fabricante] = (byFab[n.fabricante] || 0) + Math.abs(n.costoIncidencia || 0);
    }
    const top = Object.entries(byFab).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { labels: top.map(([f]) => f), datasets: [{ label: "Impacto", data: top.map(([, v]) => v), backgroundColor: "#2563eb", borderRadius: 4 }] };
  }, [items]);

  const lineData = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const n of items) byDate[n.fecha] = (byDate[n.fecha] || 0) + 1;
    const keys = Object.keys(byDate).sort().slice(-14);
    return {
      labels: keys.map((k) => fmtFecha(k).slice(0, 5)),
      datasets: [{ label: "Novedades", data: keys.map((k) => byDate[k]), borderColor: "#2563eb", backgroundColor: "#2563eb18", fill: true, tension: 0.3, pointRadius: 3 }],
    };
  }, [items]);

  // Historial del PLU en el panel
  const panelHistorial = useMemo(() => {
    if (!panelItem) return [];
    return items
      .filter((n) => n.plu === panelItem.plu && n.id !== panelItem.id)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 5);
  }, [panelItem, items]);

  return (
    <div className="animate-fade-in">
      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(37,99,235,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={16} color="#2563EB" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", margin: 0 }}>Novedades Inventario</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            {loading ? "Cargando…" : `${items.length} registros · ${kpis.pend + kpis.proc} sin resolver`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`ds-btn ${view === "analisis" ? "ds-btn-secondary" : "ds-btn-ghost"}`}
            onClick={() => { if (view !== "analisis") { setView("analisis"); loadStats(); } else setView("lista"); }}>
            <BarChart3 size={14} />{view === "analisis" ? "← Lista" : "Análisis"}
          </button>
          <button className={`ds-btn ${view === "graficos" ? "ds-btn-secondary" : "ds-btn-ghost"}`}
            onClick={() => setView(view === "graficos" ? "lista" : "graficos")}>
            {view === "graficos" ? <><List size={14} />Lista</> : <>Gráficos</>}
          </button>
          <button className="ds-btn ds-btn-primary" onClick={() => setCreando(true)}>
            <Plus size={14} />Nueva novedad de inventario
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 28, marginBottom: 28, padding: "0 2px" }}>
        {loading ? <><SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat /></> : (
          <>
            <Stat value={kpis.total} label="Total novedades" />
            <Stat value={kpis.pend} label="Pendientes" color={kpis.pend > 0 ? "var(--error)" : "var(--success)"} onClick={() => setFEstado("PENDIENTE")} />
            <Stat value={kpis.proc} label="En proceso" color="var(--warning)" onClick={() => setFEstado("EN PROCESO")} />
            <Stat value={kpis.sol} label="Solucionadas" color="var(--success)" onClick={() => setFEstado("SOLUCIONADO")} />
            <Stat value={fmtCOP(kpis.impacto)} label="Impacto total" color="var(--brand)" />
          </>
        )}
      </div>

      {/* ── Inteligencia operacional ── */}
      {!loading && globalInsights.length > 0 && (
        <IntelBanner insights={globalInsights} title="Inteligencia operacional" />
      )}

      {/* ── Vista: Gráficos ── */}
      {view === "graficos" && (
        <div className="animate-fade-in">
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="ds-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>Tasa de resolución</div>
              <div style={{ height: 220 }}><Doughnut data={donutData} options={{ ...CHART_BASE, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (ctx) => { const t = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0); return ` ${ctx.parsed} (${Math.round(ctx.parsed / t * 100)}%)`; } } } } }} /></div>
            </div>
            <div className="ds-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>Evolución 14 días</div>
              <div style={{ height: 220 }}><Line data={lineData} options={{ ...CHART_BASE, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "var(--border)" } }, x: { grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} novedad${ctx.parsed.y !== 1 ? "es" : ""}` } } } }} /></div>
            </div>
          </div>
          <div className="ds-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>Impacto por fabricante</div>
            <div style={{ height: 260 }}><Bar data={fabData} options={{ ...CHART_BASE, indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => " " + fmtCOP(ctx.parsed.x ?? 0) } } }, scales: { x: { beginAtZero: true, ticks: { callback: (v: unknown) => "$" + (Number(v) / 1e6).toFixed(0) + "M" }, grid: { color: "var(--border)" } }, y: { grid: { display: false } } } }} /></div>
          </div>
        </div>
      )}

      {/* ── Vista: Lista ── */}
      {/* ── Vista: Análisis operativo ── */}
      {view === "analisis" && (
        <div className="animate-fade-in">
          {loadingStats ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 28, marginBottom: 28 }}>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 10 }} />)}
            </div>
          ) : stats ? (
            <>
              {/* KPIs operativos */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 24, marginBottom: 32, padding: "0 2px" }}>
                {[
                  { label: "Sin asignar", value: (stats.resumen as any)?.sinAsignar ?? 0, color: (stats.resumen as any)?.sinAsignar > 0 ? "var(--error)" : "var(--success)" },
                  { label: "Sin ajustar en NetSuite", value: (stats.resumen as any)?.sinNetSuite ?? 0, color: (stats.resumen as any)?.sinNetSuite > 0 ? "var(--warning)" : "var(--success)" },
                  { label: "Clasificadas", value: `${stats.tasaClasificacion as number}%`, color: (stats.tasaClasificacion as number) < 80 ? "var(--warning)" : "var(--success)" },
                  { label: "T. prom. resolución", value: stats.tiempoPromResolucion ? `${stats.tiempoPromResolucion}d` : "—", color: "var(--brand)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="ds-stat">
                    <div className="ds-stat-value sm" style={{ color }}>{value}</div>
                    <div className="ds-stat-label">{label}</div>
                  </div>
                ))}
              </div>

              <div className="grid-2" style={{ marginBottom: 16 }}>
                {/* Pareto de PLUs */}
                <div className="ds-card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14 }}>
                    Top PLUs por frecuencia (últimos 30 días)
                  </div>
                  {((stats.paretoPlu as any[]) ?? []).slice(0, 7).map((item: any) => (
                    <div key={item.plu} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, width: 60, flexShrink: 0 }}>{item.plu}</span>
                      <div style={{ flex: 1, height: 6, background: "var(--surface2)", borderRadius: 3 }}>
                        <div style={{ width: `${item.pct}%`, height: "100%", background: "var(--brand)", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", width: 40, textAlign: "right" }}>{item.count} ({item.pct}%)</span>
                    </div>
                  ))}
                  {((stats.paretoPlu as any[]) ?? []).length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>Sin datos clasificados</div>}
                </div>

                {/* Distribución por tipo */}
                <div className="ds-card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14 }}>
                    Por tipo de novedad
                  </div>
                  {Object.entries((stats.byTipo as Record<string, number>) ?? {})
                    .filter(([k]) => k !== "SIN_CLASIFICAR")
                    .sort((a, b) => b[1] - a[1])
                    .map(([tipo, count]) => {
                      const total = Object.values((stats.byTipo as Record<string, number>) ?? {}).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round((count as number) / total * 100) : 0;
                      const color = TIPO_NOVEDAD_COLOR[tipo as keyof typeof TIPO_NOVEDAD_COLOR] ?? "#6b7280";
                      return (
                        <div key={tipo} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, flex: 1, color: "var(--text)" }}>{TIPO_NOVEDAD_LABEL[tipo as keyof typeof TIPO_NOVEDAD_LABEL] ?? tipo}</span>
                          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{count as number} ({pct}%)</span>
                        </div>
                      );
                    })}
                  {Object.keys((stats.byTipo as object) ?? {}).filter(k => k !== "SIN_CLASIFICAR").length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>Clasifica novedades para ver distribución</p>
                  )}
                </div>
              </div>

              <div className="grid-2">
                {/* Distribución por turno */}
                <div className="ds-card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14 }}>
                    Por turno
                  </div>
                  {Object.entries((stats.byTurno as Record<string, number>) ?? {})
                    .filter(([k]) => k !== "SIN_TURNO")
                    .sort((a, b) => b[1] - a[1])
                    .map(([turno, count]) => {
                      const total = Object.values((stats.byTurno as Record<string, number>) ?? {}).filter((_, i, arr) => Object.keys((stats.byTurno as object) ?? {})[i] !== "SIN_TURNO").reduce((a, b) => a + (b as number), 0);
                      const pct = total > 0 ? Math.round((count as number) / total * 100) : 0;
                      const col = turno === "MAÑANA" ? "#f59e0b" : turno === "TARDE" ? "#2563eb" : "#7c3aed";
                      return (
                        <div key={turno} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "var(--text)", fontWeight: 600 }}>
                              <span>{turno}</span><span style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>{count as number} ({pct}%)</span>
                            </div>
                            <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3 }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 3 }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {Object.keys((stats.byTurno as object) ?? {}).filter(k => k !== "SIN_TURNO").length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>Registra turno en nuevas novedades</p>
                  )}
                </div>

                {/* Top zonas de bodega */}
                <div className="ds-card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14 }}>
                    Zonas con más novedades
                  </div>
                  {((stats.topZonas as any[]) ?? []).map((z: any, i: number) => (
                    <div key={z.zona} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)", width: 16, textAlign: "right" }}>{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{z.zona}</span>
                      <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--muted)" }}>{z.count}</span>
                    </div>
                  ))}
                  {((stats.topZonas as any[]) ?? []).length === 0 && (
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>Registra zona de bodega en nuevas novedades</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>Error al cargar estadísticas</div>
          )}
        </div>
      )}

      {view === "lista" && (
        <div className="animate-fade-in">
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--faint)" }} />
              <input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Buscar PLU, posición, descripción…" style={{ ...inp, paddingLeft: 32 }} {...focusProps} />
            </div>
            <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={{ ...inp, width: "auto", minWidth: 150 }} {...focusProps}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{estadoLabel(e)}</option>)}
            </select>
            <select value={fFab} onChange={(e) => setFFab(e.target.value)} style={{ ...inp, width: "auto", minWidth: 160 }} {...focusProps}>
              <option value="">Todos los fabricantes</option>
              {fabricantes.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            {(fq || fEstado || fFab) && (
              <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => { setFq(""); setFEstado(""); setFFab(""); }}>
                <X size={12} />Limpiar
              </button>
            )}
            <span style={{ alignSelf: "center", fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)" }}>
              {filtered.length} de {items.length}
            </span>
          </div>

          <div className="ds-panel" style={{ border: "1px solid var(--border)" }}>
            {loading ? <SkeletonTable rows={8} cols={8} /> : filtered.length === 0 ? (
              <EmptyState
                icon={<Package size={22} />}
                title="Sin novedades"
                description={fq || fEstado || fFab ? "No hay resultados para estos filtros." : "Las novedades de inventario aparecerán aquí."}
                action={(fq || fEstado || fFab) ? { label: "Limpiar filtros", onClick: () => { setFq(""); setFEstado(""); setFFab(""); } } : { label: "Registrar novedad de inventario", onClick: () => setCreando(true) }}
              />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th style={{ width: 20 }} />
                      <Th col="fecha" label="Fecha" />
                      <Th col="plu" label="PLU" />
                      <Th col="descripcion" label="Descripción" />
                      <Th col="fabricante" label="Fabricante" />
                      <Th col="posicion" label="Posición" />
                      <Th col="cantidad" label="Cant." right />
                      <Th col="impacto" label="Impacto" right />
                      <Th col="estado" label="Estado" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((n) => (
                      <tr
                        key={n.id}
                        className="ds-row"
                        onClick={() => setPanelItem(n)}
                        style={{ background: panelItem?.id === n.id ? "var(--surface2)" : undefined }}
                      >
                        {/* Indicador de inteligencia */}
                        <td style={{ padding: "0 4px 0 12px" }}>
                          {pluConInsight.has(n.plu) && (
                            <span title="Hay alertas para este PLU" style={{ fontSize: 12, color: "var(--warning)" }}>⚠</span>
                          )}
                        </td>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtFecha(n.fecha)}</td>
                        <td style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13 }}>{n.plu}</td>
                        <td title={n.descripcion ?? undefined} style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                          {n.descripcion || <span style={{ color: "var(--faint)" }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--muted)" }}>{n.fabricante || <span style={{ color: "var(--faint)" }}>—</span>}</td>
                        <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>{n.posicion}</td>
                        <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600, fontSize: 13, color: n.cantidad > 0 ? "var(--success)" : n.cantidad < 0 ? "var(--error)" : "var(--muted)" }}>
                          {n.cantidad > 0 ? `+${n.cantidad}` : n.cantidad}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12, color: (n.costoIncidencia || 0) < 0 ? "var(--error)" : "var(--muted)" }}>
                          {n.costoIncidencia ? fmtCOP(n.costoIncidencia) : <span style={{ color: "var(--faint)" }}>—</span>}
                        </td>
                        <td>
                          <Badge label={estadoLabel(n.estado)} variant={estadoBadgeVariant(n.estado)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Panel lateral de detalle ── */}
      <SlidePanel
        open={!!panelItem}
        onClose={() => setPanelItem(null)}
        title={panelItem ? `PLU ${panelItem.plu}` : ""}
        subtitle={panelItem?.descripcion ?? undefined}
        insights={panelInsights}
        badge={panelItem && <Badge label={estadoLabel(panelItem.estado)} variant={estadoBadgeVariant(panelItem.estado)} />}
        primaryAction={canEdit && panelItem ? (
          <button
            className="ds-btn ds-btn-primary"
            style={{ width: "100%" }}
            onClick={() => { setEditing(panelItem); setPanelItem(null); }}
          >
            <Pencil size={13} />Editar novedad
          </button>
        ) : undefined}
        secondaryActions={
          <div style={{ display: "flex", gap: 8 }}>
            {canDelete && panelItem && (
              <button
                className="ds-btn ds-btn-ghost ds-btn-sm"
                style={{ color: "var(--error)" }}
                onClick={() => { setDeleting(panelItem); setPanelItem(null); }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        }
      >
        {panelItem && (
          <>
            {/* Clasificación operativa */}
            {(panelItem.tipoNovedad || panelItem.causaRaiz || panelItem.turno || panelItem.zonaBodega) && (
              <DetailSection title="Clasificación operativa">
                <DetailGrid items={[
                  { label: "Tipo de novedad", value: panelItem.tipoNovedad ? TIPO_NOVEDAD_LABEL[panelItem.tipoNovedad as keyof typeof TIPO_NOVEDAD_LABEL] : undefined },
                  { label: "Causa raíz", value: panelItem.causaRaiz ? CAUSA_RAIZ_LABEL[panelItem.causaRaiz as keyof typeof CAUSA_RAIZ_LABEL] : undefined },
                  { label: "Turno", value: panelItem.turno ?? undefined },
                  { label: "Zona de bodega", value: panelItem.zonaBodega ?? undefined },
                ]} />
              </DetailSection>
            )}

            {/* Estado operativo */}
            {panelItem.estado !== "SOLUCIONADO" && canEdit && (
              <DetailSection title="Gestión operativa">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  {/* Asignar responsable */}
                  {!panelItem.asignadoA ? (
                    <button
                      className="ds-btn ds-btn-secondary ds-btn-sm"
                      style={{ color: "var(--brand)" }}
                      onClick={async () => {
                        const nombre = prompt("Email o nombre del responsable:");
                        if (!nombre) return;
                        // Buscar usuario
                        const res = await fetch(`/api/novedades/${panelItem.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asignadoA: nombre }) });
                        const json = await res.json();
                        if (json.success) { setItems(prev => prev.map(n => n.id === panelItem.id ? { ...n, asignadoA: nombre } : n)); setPanelItem(p => p ? { ...p, asignadoA: nombre } : p); showToast("Asignada ✓"); }
                      }}
                    >
                      <UserCheck size={13} />Asignar responsable
                    </button>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                      <UserCheck size={12} color="var(--success)" />Asignada a: <strong>{panelItem.asignadoA}</strong>
                    </div>
                  )}
                </div>
                {/* NetSuite flag */}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={panelItem.netsuiteAjust}
                    onChange={async (e) => {
                      const val = e.target.checked;
                      await fetch(`/api/novedades/${panelItem.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ netsuiteAjust: val }) });
                      setItems(prev => prev.map(n => n.id === panelItem.id ? { ...n, netsuiteAjust: val } : n));
                      setPanelItem(p => p ? { ...p, netsuiteAjust: val } : p);
                      showToast(val ? "Marcado como ajustado en NetSuite ✓" : "Desmarcado");
                    }}
                    style={{ width: 16, height: 16 }}
                  />
                  <ExternalLink size={13} color={panelItem.netsuiteAjust ? "var(--success)" : "var(--muted)"} />
                  Ajustado en NetSuite
                  {!panelItem.netsuiteAjust && (panelItem.estado as string) === "SOLUCIONADO" && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--warning)", marginLeft: 4 }}>⚠ Pendiente</span>
                  )}
                </label>

                {/* ID de trazabilidad NetSuite */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  {panelItem.netsuiteId ? (
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "#2563EB", background: "#2563EB0d", padding: "2px 8px", borderRadius: 6, border: "1px solid #2563EB25" }}>
                      NS:{panelItem.netsuiteId}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--faint)" }}>Sin ID NetSuite</span>
                  )}
                  <button className="ds-btn ds-btn-ghost ds-btn-sm" style={{ fontSize: 11, height: 24, color: "var(--muted)" }}
                    onClick={async () => {
                      const id = prompt("ID interno de NetSuite (número):", panelItem.netsuiteId ?? "");
                      if (id === null) return;
                      const val = id.trim() || null;
                      await fetch(`/api/novedades/${panelItem.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ netsuiteId: val }) });
                      setItems(prev => prev.map(n => n.id === panelItem.id ? { ...n, netsuiteId: val } : n));
                      setPanelItem(p => p ? { ...p, netsuiteId: val } : p);
                      showToast(val ? `ID NetSuite vinculado ✓` : "ID NetSuite eliminado");
                    }}>
                    {panelItem.netsuiteId ? "Cambiar" : "Vincular"}
                  </button>
                </div>
              </DetailSection>
            )}

            {/* Foto de evidencia */}
            {panelItem.imagenUrl ? (
              <DetailSection title="Evidencia fotográfica">
                <a href={panelItem.imagenUrl} target="_blank" rel="noreferrer">
                  <img src={panelItem.imagenUrl} alt="Evidencia" style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)", maxHeight: 180, objectFit: "cover" }} />
                </a>
              </DetailSection>
            ) : canEdit && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--muted)" }}>
                  <Camera size={14} />
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const form = new FormData();
                      form.append("foto", file);
                      const r = await fetch("/api/uploads/foto", { method: "POST", body: form });
                      const j = await r.json();
                      if (j.success) {
                        await fetch(`/api/novedades/${panelItem.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagenUrl: j.url }) });
                        setItems(prev => prev.map(n => n.id === panelItem.id ? { ...n, imagenUrl: j.url } : n));
                        setPanelItem(p => p ? { ...p, imagenUrl: j.url } : p);
                        showToast("Foto guardada ✓");
                      }
                    }}
                  />
                  Agregar foto de evidencia
                </label>
              </div>
            )}

            {/* Impacto destacado */}
            {panelItem.costoIncidencia != null && (
              <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>Impacto económico</div>
                <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.04em", color: panelItem.costoIncidencia < 0 ? "var(--error)" : "var(--success)", lineHeight: 1 }}>
                  {fmtCOP(panelItem.costoIncidencia)}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                  {panelItem.cantidad > 0 ? `+${panelItem.cantidad}` : panelItem.cantidad} unidades {panelItem.cantidad > 0 ? "sobrantes" : "faltantes"}
                </div>
              </div>
            )}

            {/* Datos del registro */}
            <DetailSection title="Detalle">
              <DetailGrid items={[
                { label: "PLU", value: <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{panelItem.plu}</span> },
                { label: "Fecha", value: fmtFecha(panelItem.fecha) },
                { label: "Posición", value: <span style={{ fontFamily: "var(--mono)" }}>{panelItem.posicion}</span> },
                { label: "Estado", value: <Badge label={estadoLabel(panelItem.estado)} variant={estadoBadgeVariant(panelItem.estado)} /> },
                { label: "Fabricante", value: panelItem.fabricante },
                { label: "Costo unitario", value: panelItem.costoUnitario ? fmtCOP(panelItem.costoUnitario) : undefined },
              ]} />
            </DetailSection>

            {/* Historial del mismo PLU */}
            {panelHistorial.length > 0 && (
              <DetailSection title={`Historial PLU ${panelItem.plu} (${panelHistorial.length} más)`}>
                <MiniHistory items={panelHistorial.map((n) => ({
                  label: `${n.cantidad > 0 ? "+" : ""}${n.cantidad} · ${estadoLabel(n.estado)}`,
                  meta: fmtFecha(n.fecha),
                  color: ESTADO_COLOR[n.estado],
                }))} />
              </DetailSection>
            )}

            {/* Acción rápida: marcar solucionado */}
            {panelItem.estado !== "SOLUCIONADO" && canEdit && (
              <button
                className="ds-btn ds-btn-secondary"
                style={{ width: "100%", color: "var(--success)", borderColor: "var(--success)", marginTop: 4 }}
                onClick={async () => {
                  const res = await fetch(`/api/novedades/${panelItem.id}`, {
                    method: "PUT", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ estado: "SOLUCIONADO" }),
                  });
                  const json = await res.json();
                  if (json.success) {
                    setItems((prev) => prev.map((n) => n.id === panelItem.id ? { ...n, estado: "SOLUCIONADO" as EstadoNovedad } : n));
                    setPanelItem((p) => p ? { ...p, estado: "SOLUCIONADO" as EstadoNovedad } : null);
                    showToast("Marcada como solucionada ✓");
                  } else showToast(json.error || "Error", true);
                }}
              >
                <CheckCircle2 size={14} />Marcar como solucionada
              </button>
            )}
          </>
        )}
      </SlidePanel>

      {/* ── Modal crear/editar ── */}
      {(creando || editing) && (
        <ModalForm
          novedad={editing ?? undefined}
          role={role}
          onClose={() => { setCreando(false); setEditing(null); }}
          onSaved={() => { setCreando(false); setEditing(null); load(); showToast(editing ? "Novedad actualizada ✓" : "Novedad registrada ✓"); }}
          onError={(m) => showToast(m, true)}
        />
      )}

      {/* ── Modal eliminar ── */}
      {deleting && (
        <DeleteModal
          novedad={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); load(); showToast("Novedad eliminada"); }}
          onError={(m) => showToast(m, true)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          className="animate-fade-up"
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, background: toast.err ? "var(--error)" : "#0F0F10", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: "var(--shadow-xl)", display: "flex", alignItems: "center", gap: 8 }}
        >
          {!toast.err && <CheckCircle2 size={14} />}{toast.msg}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FORM MODAL (modal para crear/editar — acción compleja)
// ═══════════════════════════════════════════════════════════
function ModalForm({ novedad, role, onClose, onSaved, onError }: {
  novedad?: Novedad; role?: string; onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const isEdit = !!novedad;
  const [plu, setPlu] = useState(novedad?.plu ?? "");
  const [posicion, setPos] = useState(novedad?.posicion ?? "");
  const [fecha, setFecha] = useState(novedad?.fecha ?? todayISO());
  const [descripcion, setDesc] = useState(novedad?.descripcion ?? "");
  const [cantidad, setCant] = useState(String(novedad?.cantidad ?? 0));
  const [fabricante, setFab] = useState(novedad?.fabricante ?? "");
  const [costoUnitario, setCu] = useState(novedad?.costoUnitario != null ? String(novedad.costoUnitario) : "");
  const [estado, setEstado] = useState<EstadoNovedad>(novedad?.estado ?? "PENDIENTE");
  const [tipoNovedad, setTipo] = useState(novedad?.tipoNovedad ?? "");
  const [causaRaiz, setCausa] = useState(novedad?.causaRaiz ?? "");
  const [fechaCompromiso, setFC] = useState((novedad as any)?.fechaCompromiso ?? "");
  const [turno, setTurno] = useState(novedad?.turno ?? "");
  const [zonaBodega, setZona] = useState(novedad?.zonaBodega ?? "");
  const [saving, setSaving] = useState(false);
  const [productoMaestro, setProductoMaestro] = useState<ProductoMaestro | null>(null);
  const [maestroStatus, setMaestroStatus] = useState<"idle" | "loading" | "found" | "missing">("idle");
  const [adminOverride, setAdminOverride] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  const isAdmin = role === "ADMIN";
  const lockMaestro = !!productoMaestro && !adminOverride;

  async function lookupMaestro(nextPlu = plu) {
    const normalized = nextPlu.trim().toUpperCase();
    if (!normalized) {
      setProductoMaestro(null);
      setMaestroStatus("idle");
      return;
    }
    setMaestroStatus("loading");
    try {
      const res = await fetch(`/api/productos-maestro/${encodeURIComponent(normalized)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        const producto = json.data as ProductoMaestro;
        setProductoMaestro(producto);
        setMaestroStatus("found");
        setDesc(producto.descripcion ?? "");
        setFab(producto.fabricante ?? "");
        setCu(producto.precio != null ? String(Math.round(producto.precio)) : "");
        setAdminOverride(false);
      } else {
        setProductoMaestro(null);
        setMaestroStatus("missing");
      }
    } catch {
      setProductoMaestro(null);
      setMaestroStatus("missing");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plu.trim() || !posicion.trim()) { onError("PLU y posición son requeridos"); return; }
    setSaving(true);
    try {
      const url = isEdit ? `/api/novedades/${novedad!.id}` : "/api/novedades";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plu: plu.trim(), posicion: posicion.trim(), fecha, descripcion: descripcion.trim() || null, cantidad: parseInt(cantidad) || 0, fabricante: fabricante.trim() || null, costoUnitario: costoUnitario ? parseInt(costoUnitario) : null, estado, tipoNovedad: tipoNovedad || null, causaRaiz: causaRaiz || null, turno: turno || null, zonaBodega: zonaBodega.trim() || null, fechaCompromiso: fechaCompromiso || null }),
      });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }

  if (!mounted) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-scale-in"
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>{isEdit ? "Editar novedad" : "Nueva novedad de inventario"}</h2>
          <button onClick={onClose} style={{ background: "var(--surface2)", border: "none", borderRadius: 7, padding: 7, cursor: "pointer", color: "var(--muted)", display: "flex" }}><X size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>PLU *</label>
              <input value={plu} onChange={(e) => { setPlu(e.target.value); setMaestroStatus("idle"); }} onBlur={() => lookupMaestro()} disabled={isEdit} style={inp} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Fecha *</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} {...focusProps} />
            </div>
          </div>
          {maestroStatus !== "idle" && (
            <div style={{ marginTop: -4, padding: "8px 10px", borderRadius: 8, background: maestroStatus === "found" ? "#10b98118" : maestroStatus === "missing" ? "#f59e0b18" : "var(--surface2)", color: maestroStatus === "found" ? "#10b981" : maestroStatus === "missing" ? "#f59e0b" : "var(--muted)", fontSize: 12, fontWeight: 700 }}>
              {maestroStatus === "loading" && "Buscando PLU en maestro..."}
              {maestroStatus === "found" && "Datos cargados desde maestro"}
              {maestroStatus === "missing" && "PLU no encontrado en maestro"}
              {maestroStatus === "found" && isAdmin && !adminOverride && (
                <button type="button" onClick={() => setAdminOverride(true)} style={{ marginLeft: 10, border: "none", background: "transparent", color: "inherit", textDecoration: "underline", cursor: "pointer", fontWeight: 800 }}>
                  Editar manualmente
                </button>
              )}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Posición *</label>
            <input value={posicion} onChange={(e) => setPos(e.target.value)} placeholder="05-H-14-04-02" style={inp} {...focusProps} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Descripción</label>
            <input value={descripcion} onChange={(e) => setDesc(e.target.value)} disabled={lockMaestro} style={{ ...inp, opacity: lockMaestro ? 0.7 : 1 }} {...focusProps} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Fabricante</label>
              <input value={fabricante} onChange={(e) => setFab(e.target.value)} disabled={lockMaestro} style={{ ...inp, opacity: lockMaestro ? 0.7 : 1 }} {...focusProps} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Cantidad (+/-)</label>
              <input type="number" value={cantidad} onChange={(e) => setCant(e.target.value)} style={inp} {...focusProps} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Costo unitario</label>
              <input type="number" value={costoUnitario} onChange={(e) => setCu(e.target.value)} disabled={lockMaestro} style={{ ...inp, opacity: lockMaestro ? 0.7 : 1 }} {...focusProps} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoNovedad)} style={{ ...inp, paddingRight: 28 }} {...focusProps}>
              {ESTADOS.map((e) => <option key={e} value={e}>{estadoLabel(e)}</option>)}
            </select>
          </div>
          {/* Campos operativos */}
          <div style={{ gridColumn: "1/-1", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>Clasificación operativa (opcional pero recomendada)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Tipo de novedad</label>
                <select value={tipoNovedad} onChange={(e) => setTipo(e.target.value)} style={{ ...inp, paddingRight: 28 }} {...focusProps}>
                  <option value="">Sin clasificar</option>
                  {TIPOS_NOVEDAD.map((t) => <option key={t} value={t}>{TIPO_NOVEDAD_LABEL[t]}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Causa raíz</label>
                <select value={causaRaiz} onChange={(e) => setCausa(e.target.value)} style={{ ...inp, paddingRight: 28 }} {...focusProps}>
                  <option value="">Sin clasificar</option>
                  {CAUSAS_RAIZ.map((c) => <option key={c} value={c}>{CAUSA_RAIZ_LABEL[c]}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Turno</label>
                <select value={turno} onChange={(e) => setTurno(e.target.value)} style={{ ...inp, paddingRight: 28 }} {...focusProps}>
                  <option value="">Sin turno</option>
                  {TURNOS.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Zona de bodega</label>
                <input value={zonaBodega} onChange={(e) => setZona(e.target.value)} placeholder="Zona A, Mezzanine, Pasillo H…" style={inp} {...focusProps} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>Fecha compromiso SLA</label>
                <input type="date" value={fechaCompromiso} onChange={(e) => setFC(e.target.value)} style={inp} {...focusProps} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <button type="button" className="ds-btn ds-btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" className="ds-btn ds-btn-primary" disabled={saving} style={{ flex: 2 }}>
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Registrar novedad de inventario"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
