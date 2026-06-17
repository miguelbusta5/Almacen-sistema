"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw, Sheet, ChevronDown, ChevronUp } from "lucide-react";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { CediBadge, CediEmpty, CediPage, CediPanel, CediStat } from "@/components/ui/cedi";
import {
  BarGroupedChart,
  LineTrendChart,
  DonutChart,
  HBarChart,
  ChartCard,
} from "@/components/ui/charts";
import type { BarDataset, HBarItem } from "@/components/ui/charts";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

// ── Tipos ────────────────────────────────────────────────────────────────────

interface ResumenMes {
  anio: number; mes: number; mesNombre: string; grupo: string; tipoMov: string;
  ordenes: number; unidades: number; lineas: number;
}
interface TipoOrden {
  anio: number; tipoOrden: string; grupo: string; ordenes: number; unidades: number;
}
interface PLU {
  plu: string; descripcion: string; grupo: string; anio: number; enviados: number; unidades: number;
}
interface FuenteInfo {
  lastSyncAt: string | null; lastSyncStatus: string | null; lastSyncError: string | null;
}
interface APIResponse {
  success: boolean;
  data: { fuente: FuenteInfo | null; resumenMes: ResumenMes[]; tipoOrden: TipoOrden[]; plus: PLU[] };
}

type Tab = "cedi" | "ag" | "muebles" | "plu";

// ── Constantes ────────────────────────────────────────────────────────────────

const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MES_LABEL: Record<number, string> = {
  1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
  7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
};

const fmtN = new Intl.NumberFormat("es-CO");
const fmt = (n: number) => fmtN.format(n);

// ── Helpers de datos ─────────────────────────────────────────────────────────

function sum(rows: ResumenMes[], grupoFilter?: string, tipoMovFilter?: string) {
  return rows
    .filter((r) => (!grupoFilter || r.grupo === grupoFilter) && (!tipoMovFilter || r.tipoMov === tipoMovFilter))
    .reduce((acc, r) => ({ ordenes: acc.ordenes + r.ordenes, unidades: acc.unidades + r.unidades, lineas: acc.lineas + r.lineas }), { ordenes: 0, unidades: 0, lineas: 0 });
}

function buildMonthlyDatasets(
  resumen: ResumenMes[],
  field: "ordenes" | "unidades",
  grupoFilter?: string
): BarDataset[] {
  const filtered = grupoFilter ? resumen.filter((r) => r.grupo === grupoFilter) : resumen;
  const sortedYears = [...new Set(filtered.map((r) => r.anio))].sort();
  return sortedYears.map((year) => ({
    label: String(year),
    data: Array.from({ length: 12 }, (_, i) =>
      filtered.filter((r) => r.anio === year && r.mes === i + 1).reduce((s, r) => s + r[field], 0)
    ),
  }));
}

function buildHBarItems(plus: PLU[], year: number, field: "enviados" | "unidades"): HBarItem[] {
  return plus
    .filter((p) => p.anio === year)
    .sort((a, b) => b[field] - a[field])
    .slice(0, 10)
    .map((p) => ({ label: (p.descripcion.slice(0, 34) || p.plu), value: p[field] }));
}

function buildPivot(rows: ResumenMes[], grupoFilter?: string) {
  const filtered = grupoFilter ? rows.filter((r) => r.grupo === grupoFilter) : rows;
  const years = [...new Set(filtered.map((r) => r.anio))].sort();
  const meses = [...new Set(filtered.map((r) => r.mes))].sort();
  const ordenesByMesAnio = new Map<string, number>();
  const unidadesByMesAnio = new Map<string, number>();
  const lineasByMesAnio = new Map<string, number>();
  for (const r of filtered) {
    const k = `${r.mes}_${r.anio}`;
    ordenesByMesAnio.set(k, (ordenesByMesAnio.get(k) ?? 0) + r.ordenes);
    unidadesByMesAnio.set(k, (unidadesByMesAnio.get(k) ?? 0) + r.unidades);
    lineasByMesAnio.set(k, (lineasByMesAnio.get(k) ?? 0) + r.lineas);
  }
  return { years, meses, ordenesByMesAnio, unidadesByMesAnio, lineasByMesAnio };
}

function buildTipoOrdenPivot(rows: TipoOrden[], grupoFilter: string) {
  const filtered = rows.filter((r) => r.grupo === grupoFilter);
  const tipos = [...new Map(filtered.map((r) => [r.tipoOrden, r])).keys()].sort();
  const byTipoAnio = new Map<string, number>();
  for (const r of filtered) byTipoAnio.set(`${r.tipoOrden}_${r.anio}`, r.ordenes);
  const years = [...new Set(filtered.map((r) => r.anio))].sort();
  return { tipos, byTipoAnio, years };
}

// ── Sub-componentes de tabla ──────────────────────────────────────────────────

function PivotTable({ rows, grupoFilter }: { rows: ResumenMes[]; grupoFilter?: string }) {
  const { years, meses, ordenesByMesAnio } = buildPivot(rows, grupoFilter);
  if (!meses.length) return <p style={{ color: "var(--muted2)", fontSize: 13 }}>Sin datos mensuales.</p>;
  return (
    <div>
      <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Órdenes × mes-año
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="cedi-table" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Mes</th>
              {years.map((y) => <th key={y} style={{ textAlign: "right" }}>{y}</th>)}
              <th style={{ textAlign: "right", fontWeight: 700 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => {
              const vals = years.map((y) => ordenesByMesAnio.get(`${m}_${y}`) ?? 0);
              const total = vals.reduce((s, v) => s + v, 0);
              return (
                <tr key={m}>
                  <td>{MES_LABEL[m] ?? m}</td>
                  {vals.map((v, i) => <td key={i} style={{ textAlign: "right" }}>{v ? fmt(v) : "—"}</td>)}
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(total)}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "2px solid var(--border-strong)", fontWeight: 700 }}>
              <td>Total</td>
              {years.map((y) => {
                const t = meses.reduce((s, m) => s + (ordenesByMesAnio.get(`${m}_${y}`) ?? 0), 0);
                return <td key={y} style={{ textAlign: "right" }}>{fmt(t)}</td>;
              })}
              <td style={{ textAlign: "right" }}>
                {fmt(meses.reduce((s, m) => s + years.reduce((ss, y) => ss + (ordenesByMesAnio.get(`${m}_${y}`) ?? 0), 0), 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineasTable({ rows, grupoFilter }: { rows: ResumenMes[]; grupoFilter?: string }) {
  const { years, meses, lineasByMesAnio } = buildPivot(rows, grupoFilter);
  if (!meses.length) return null;
  return (
    <div>
      <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Líneas (PLUs) × año-mes
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="cedi-table" style={{ minWidth: 420 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Año</th>
              {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"].map((m) => (
                <th key={m} style={{ textAlign: "right" }}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y}>
                <td><strong>{y}</strong></td>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const v = meses.includes(m) ? (lineasByMesAnio.get(`${m}_${y}`) ?? 0) : 0;
                  return <td key={m} style={{ textAlign: "right" }}>{v ? fmt(v) : "—"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TipoOrdenTable({ tipoOrden, grupoFilter }: { tipoOrden: TipoOrden[]; grupoFilter: string }) {
  const { tipos, byTipoAnio, years } = buildTipoOrdenPivot(tipoOrden, grupoFilter);
  if (!tipos.length) return null;
  return (
    <div>
      <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Órdenes × año-tipo
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="cedi-table" style={{ minWidth: 380 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Tipo de orden</th>
              {years.map((y) => <th key={y} style={{ textAlign: "right" }}>{y}</th>)}
              <th style={{ textAlign: "right", fontWeight: 700 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {tipos.map((t) => {
              const vals = years.map((y) => byTipoAnio.get(`${t}_${y}`) ?? 0);
              const total = vals.reduce((s, v) => s + v, 0);
              return (
                <tr key={t}>
                  <td style={{ fontWeight: 500 }}>{t}</td>
                  {vals.map((v, i) => <td key={i} style={{ textAlign: "right" }}>{v ? fmt(v) : "—"}</td>)}
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      className="ds-btn"
      onClick={onToggle}
      style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}
    >
      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      {open ? "Ocultar detalle" : "Ver detalle en tabla"}
    </button>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function IndicadoresPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canSync = role === "ADMIN" || role === "GERENTE";

  const [data, setData] = useState<APIResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("cedi");
  const [detail, setDetail] = useState<Record<Tab, boolean>>({
    cedi: false, ag: false, muebles: false, plu: false,
  });
  const toggleDetail = (tab: Tab) => setDetail((d) => ({ ...d, [tab]: !d[tab] }));

  const load = useCallback(async () => {
    const res = await fetch("/api/indicadores");
    const json: APIResponse = await res.json();
    if (!res.ok || !json.success) throw new Error("No fue posible cargar indicadores");
    setData(json.data);
    setError(null);
  }, []);

  const { refreshing, lastUpdatedAt, refreshNow } = useAutoRefresh({ intervalMs: 120_000, onRefresh: load });

  useEffect(() => {
    setLoading(true);
    load().catch((e) => setError(e instanceof Error ? e.message : "Error cargando")).finally(() => setLoading(false));
  }, [load]);

  async function syncNow() {
    if (!canSync) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/indicadores/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "No fue posible sincronizar");
      await refreshNow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No fue posible sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const resumen = data?.resumenMes ?? [];
  const tipoOrden = data?.tipoOrden ?? [];
  const plus = data?.plus ?? [];
  const years = useMemo(() => [...new Set(resumen.map((r) => r.anio))].sort(), [resumen]);
  const pluYears = useMemo(() => [...new Set(plus.map((p) => p.anio))].sort(), [plus]);
  const hasData = resumen.length > 0 || plus.length > 0;

  const [selPluYear, setSelPluYear] = useState(0);
  const displayPluYear = selPluYear || pluYears[pluYears.length - 1] || new Date().getFullYear();

  const kpiCedi = useMemo(() => ({
    total: sum(resumen),
    ovdm: sum(resumen, undefined, "OVDM"),
    tsdm: sum(resumen, undefined, "TSDM"),
    ag: sum(resumen, "AG"),
    mue: sum(resumen, "MUEBLES"),
  }), [resumen]);

  const kpiAG = useMemo(() => ({
    total: sum(resumen, "AG"),
    ovdm: sum(resumen, "AG", "OVDM"),
    tsdm: sum(resumen, "AG", "TSDM"),
  }), [resumen]);

  const kpiMue = useMemo(() => ({
    total: sum(resumen, "MUEBLES"),
    ovdm: sum(resumen, "MUEBLES", "OVDM"),
    tsdm: sum(resumen, "MUEBLES", "TSDM"),
  }), [resumen]);

  // Datasets para gráficas
  const dsOrdenesAll = useMemo(() => buildMonthlyDatasets(resumen, "ordenes"), [resumen]);
  const dsUnidadesAll = useMemo(() => buildMonthlyDatasets(resumen, "unidades"), [resumen]);
  const dsOrdenesAG = useMemo(() => buildMonthlyDatasets(resumen, "ordenes", "AG"), [resumen]);
  const dsUnidadesAG = useMemo(() => buildMonthlyDatasets(resumen, "unidades", "AG"), [resumen]);
  const dsOrdenesMue = useMemo(() => buildMonthlyDatasets(resumen, "ordenes", "MUEBLES"), [resumen]);
  const dsUnidadesMue = useMemo(() => buildMonthlyDatasets(resumen, "unidades", "MUEBLES"), [resumen]);

  const topEnvios = useMemo(() => buildHBarItems(plus, displayPluYear, "enviados"), [plus, displayPluYear]);
  const topUnidades = useMemo(() => buildHBarItems(plus, displayPluYear, "unidades"), [plus, displayPluYear]);

  const syncStatus = data?.fuente?.lastSyncStatus;
  const syncTone: "info" | "danger" | "neutral" = syncStatus === "OK" ? "info" : syncStatus === "ERROR" ? "danger" : "neutral";

  const TABS: { id: Tab; label: string }[] = [
    { id: "cedi", label: "Operaciones CEDI" },
    { id: "ag", label: "Operacion AG" },
    { id: "muebles", label: "Operacion Muebles" },
    { id: "plu", label: "Rotación PLU" },
  ];

  return (
    <CediPage
      title="Indicadores CEDI"
      description="Operaciones y rotación sincronizadas desde Google Sheets."
      actions={
        <>
          <AutoRefreshIndicator lastUpdatedAt={lastUpdatedAt} refreshing={refreshing || loading} onRefresh={refreshNow} />
          {canSync && (
            <button className="ds-btn ds-btn-primary" onClick={syncNow} disabled={syncing}>
              <RefreshCw size={15} style={{ animation: syncing ? "spin .8s linear infinite" : "none" }} />
              {syncing ? "Sincronizando…" : "Sincronizar"}
            </button>
          )}
        </>
      }
    >
      {error && (
        <div className="op-status-band" style={{ borderColor: "rgba(180,35,24,0.18)", background: "var(--error-tint)", color: "var(--error)" }}>
          {error}
        </div>
      )}

      {/* Barra de sync */}
      {data?.fuente && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--muted2)", marginBottom: 4, flexWrap: "wrap" }}>
          <Sheet size={14} color="var(--brand)" />
          <span>
            {data.fuente.lastSyncAt
              ? `Última sincronización: ${new Date(data.fuente.lastSyncAt).toLocaleString("es-CO")}`
              : "Sin sincronización registrada"}
          </span>
          <CediBadge tone={syncTone}>{syncStatus ?? "Sin datos"}</CediBadge>
          {data.fuente.lastSyncError && (
            <span style={{ color: "var(--error)", fontWeight: 500 }}>— {data.fuente.lastSyncError}</span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              color: activeTab === t.id ? "var(--brand)" : "var(--muted2)",
              borderBottom: activeTab === t.id ? "2px solid var(--brand)" : "2px solid transparent",
              marginBottom: -1, transition: "color .15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--muted2)" }}>Cargando indicadores…</div>
      )}

      {!loading && !hasData && (
        <CediEmpty
          title="Sin datos sincronizados"
          description="Presiona 'Sincronizar' para cargar datos desde Google Sheets."
        />
      )}

      {/* ── Tab: CEDI ─────────────────────────────────────── */}
      {!loading && hasData && activeTab === "cedi" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* KPIs principales */}
          <div className="cedi-grid">
            <CediStat label="Órdenes procesadas" value={fmt(kpiCedi.total.ordenes)} hint="Total CEDI" />
            <CediStat label="Unidades despachadas" value={fmt(kpiCedi.total.unidades)} hint="Cantidad completada" />
            <CediStat label="OVDM" value={fmt(kpiCedi.ovdm.ordenes)} hint="Órdenes de venta directa" />
            <CediStat label="TSDM" value={fmt(kpiCedi.tsdm.ordenes)} hint="Órdenes de traslado" />
          </div>

          {/* KPIs secundarios AG / Muebles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <CediStat label="Órdenes AG" value={fmt(kpiCedi.ag.ordenes)} hint="Ambiente Gourmet" />
            <CediStat label="Órdenes Muebles" value={fmt(kpiCedi.mue.ordenes)} hint="Línea Muebles" />
            <CediStat label="Und. OVDM" value={fmt(kpiCedi.ovdm.unidades)} hint="Unidades venta directa" />
            <CediStat label="Und. TSDM" value={fmt(kpiCedi.tsdm.unidades)} hint="Unidades traslado" />
          </div>

          {/* Gráficas: barras + donut */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "3 1 300px", minWidth: 0 }}>
              <ChartCard title="Órdenes procesadas por mes" hint="Comparativo anual — Total CEDI" height={240}>
                <BarGroupedChart labels={MONTH_LABELS} datasets={dsOrdenesAll} />
              </ChartCard>
            </div>
            <div style={{ flex: "2 1 220px", minWidth: 0 }}>
              <ChartCard title="OVDM vs TSDM" hint="Proporción de tipos de movimiento" height={240}>
                <DonutChart
                  segments={[
                    { label: "OVDM", value: kpiCedi.ovdm.ordenes, color: "#1D4ED8" },
                    { label: "TSDM", value: kpiCedi.tsdm.ordenes, color: "#60A5FA" },
                  ]}
                  centerValue={kpiCedi.total.ordenes}
                  centerLabel="Órdenes"
                />
              </ChartCard>
            </div>
          </div>

          {/* Gráfica: tendencia de unidades */}
          <ChartCard title="Unidades despachadas por mes" hint="Comparativo anual — Total CEDI" height={200}>
            <LineTrendChart labels={MONTH_LABELS} datasets={dsUnidadesAll} />
          </ChartCard>

          {/* Detalle tabular plegable */}
          <div>
            <DetailToggle open={detail.cedi} onToggle={() => toggleDetail("cedi")} />
            {detail.cedi && (
              <CediPanel title="Detalle tabular — CEDI" description="Pivotes por mes/año y tipo de orden" style={{ marginTop: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                  <PivotTable rows={resumen} />
                  <LineasTable rows={resumen} />
                  <TipoOrdenTable tipoOrden={tipoOrden} grupoFilter="TODOS" />
                </div>
              </CediPanel>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: AG ──────────────────────────────────────── */}
      {!loading && hasData && activeTab === "ag" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="cedi-grid">
            <CediStat label="Órdenes AG" value={fmt(kpiAG.total.ordenes)} hint="Ambiente Gourmet" />
            <CediStat label="Unidades AG" value={fmt(kpiAG.total.unidades)} hint="Cantidad completada" />
            <CediStat label="OVDM" value={fmt(kpiAG.ovdm.ordenes)} hint="Órdenes de venta AG" />
            <CediStat label="TSDM" value={fmt(kpiAG.tsdm.ordenes)} hint="Traslados AG" />
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "3 1 300px", minWidth: 0 }}>
              <ChartCard title="Órdenes AG por mes" hint="Comparativo anual" height={240}>
                <BarGroupedChart labels={MONTH_LABELS} datasets={dsOrdenesAG} />
              </ChartCard>
            </div>
            <div style={{ flex: "2 1 220px", minWidth: 0 }}>
              <ChartCard title="OVDM vs TSDM — AG" height={240}>
                <DonutChart
                  segments={[
                    { label: "OVDM", value: kpiAG.ovdm.ordenes, color: "#1D4ED8" },
                    { label: "TSDM", value: kpiAG.tsdm.ordenes, color: "#60A5FA" },
                  ]}
                  centerValue={kpiAG.total.ordenes}
                  centerLabel="Órdenes AG"
                />
              </ChartCard>
            </div>
          </div>

          <ChartCard title="Unidades AG por mes" hint="Comparativo anual" height={200}>
            <LineTrendChart labels={MONTH_LABELS} datasets={dsUnidadesAG} />
          </ChartCard>

          <div>
            <DetailToggle open={detail.ag} onToggle={() => toggleDetail("ag")} />
            {detail.ag && (
              <CediPanel title="Detalle tabular — AG" style={{ marginTop: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                  <PivotTable rows={resumen} grupoFilter="AG" />
                  <LineasTable rows={resumen} grupoFilter="AG" />
                </div>
              </CediPanel>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Muebles ─────────────────────────────────── */}
      {!loading && hasData && activeTab === "muebles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="cedi-grid">
            <CediStat label="Órdenes Muebles" value={fmt(kpiMue.total.ordenes)} hint="Línea Muebles" />
            <CediStat label="Unidades Muebles" value={fmt(kpiMue.total.unidades)} hint="Cantidad completada" />
            <CediStat label="OVDM" value={fmt(kpiMue.ovdm.ordenes)} hint="Órdenes de venta Muebles" />
            <CediStat label="TSDM" value={fmt(kpiMue.tsdm.ordenes)} hint="Traslados Muebles" />
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: "3 1 300px", minWidth: 0 }}>
              <ChartCard title="Órdenes Muebles por mes" hint="Comparativo anual" height={240}>
                <BarGroupedChart labels={MONTH_LABELS} datasets={dsOrdenesMue} />
              </ChartCard>
            </div>
            <div style={{ flex: "2 1 220px", minWidth: 0 }}>
              <ChartCard title="OVDM vs TSDM — Muebles" height={240}>
                <DonutChart
                  segments={[
                    { label: "OVDM", value: kpiMue.ovdm.ordenes, color: "#1D4ED8" },
                    { label: "TSDM", value: kpiMue.tsdm.ordenes, color: "#60A5FA" },
                  ]}
                  centerValue={kpiMue.total.ordenes}
                  centerLabel="Órdenes Muebles"
                />
              </ChartCard>
            </div>
          </div>

          <ChartCard title="Unidades Muebles por mes" hint="Comparativo anual" height={200}>
            <LineTrendChart labels={MONTH_LABELS} datasets={dsUnidadesMue} />
          </ChartCard>

          <div>
            <DetailToggle open={detail.muebles} onToggle={() => toggleDetail("muebles")} />
            {detail.muebles && (
              <CediPanel title="Detalle tabular — Muebles" style={{ marginTop: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                  <PivotTable rows={resumen} grupoFilter="MUEBLES" />
                  <LineasTable rows={resumen} grupoFilter="MUEBLES" />
                </div>
              </CediPanel>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Rotación PLU ────────────────────────────── */}
      {!loading && hasData && activeTab === "plu" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {plus.length === 0 ? (
            <CediEmpty title="Sin datos PLU" description="La pestaña 'Rotacion PLU' del Sheet no tiene datos o no se ha sincronizado." />
          ) : (
            <>
              {/* Selector de año */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--foreground)" }}>Año:</span>
                {pluYears.map((y) => (
                  <button
                    key={y}
                    className={`ds-btn ds-btn-sm ${displayPluYear === y ? "ds-btn-primary" : ""}`}
                    onClick={() => setSelPluYear(y)}
                    style={{ minWidth: 56 }}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {/* Gráficas Top 10 */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                  <ChartCard title={`Top 10 PLU — Envíos ${displayPluYear}`} height={280}>
                    <HBarChart items={topEnvios} label="Envíos" color="#1D4ED8" />
                  </ChartCard>
                </div>
                <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                  <ChartCard title={`Top 10 PLU — Unidades ${displayPluYear}`} height={280}>
                    <HBarChart items={topUnidades} label="Unidades" color="#60A5FA" />
                  </ChartCard>
                </div>
              </div>

              {/* Detalle plegable */}
              <div>
                <DetailToggle open={detail.plu} onToggle={() => toggleDetail("plu")} />
                {detail.plu && (
                  <CediPanel title={`Rotación PLU ${displayPluYear}`} description="Top 10 por envíos y por unidades." style={{ marginTop: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Top 10 — Envíos</p>
                        <table className="cedi-table">
                          <thead>
                            <tr><th>PLU</th><th>Descripción</th><th style={{ textAlign: "right" }}>Envíos</th></tr>
                          </thead>
                          <tbody>
                            {topEnvios.map((p, idx) => {
                              const src = plus.filter((x) => x.anio === displayPluYear).sort((a, b) => b.enviados - a.enviados)[idx];
                              return (
                                <tr key={src?.plu ?? idx}>
                                  <td style={{ fontWeight: 600 }}>{src?.plu ?? "—"}</td>
                                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</td>
                                  <td style={{ textAlign: "right" }}>{fmt(p.value)}</td>
                                </tr>
                              );
                            })}
                            {!topEnvios.length && (
                              <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--muted2)" }}>Sin datos</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Top 10 — Unidades</p>
                        <table className="cedi-table">
                          <thead>
                            <tr><th>PLU</th><th>Descripción</th><th style={{ textAlign: "right" }}>Unidades</th></tr>
                          </thead>
                          <tbody>
                            {topUnidades.map((p, idx) => {
                              const src = plus.filter((x) => x.anio === displayPluYear).sort((a, b) => b.unidades - a.unidades)[idx];
                              return (
                                <tr key={src?.plu ?? idx}>
                                  <td style={{ fontWeight: 600 }}>{src?.plu ?? "—"}</td>
                                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.label}</td>
                                  <td style={{ textAlign: "right" }}>{fmt(p.value)}</td>
                                </tr>
                              );
                            })}
                            {!topUnidades.length && (
                              <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--muted2)" }}>Sin datos</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CediPanel>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </CediPage>
  );
}
