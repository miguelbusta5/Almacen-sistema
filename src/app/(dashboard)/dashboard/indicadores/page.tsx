"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw, Sheet } from "lucide-react";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { CediBadge, CediEmpty, CediPage, CediPanel, CediStat } from "@/components/ui/cedi";
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtN = new Intl.NumberFormat("es-CO");
const fmt = (n: number) => fmtN.format(n);

const MES_LABEL: Record<number, string> = {
  1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril", 5: "Mayo", 6: "Junio",
  7: "Julio", 8: "Agosto", 9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
};

function sum(rows: ResumenMes[], grupoFilter?: string, tipoMovFilter?: string): { ordenes: number; unidades: number; lineas: number } {
  return rows
    .filter((r) => (!grupoFilter || r.grupo === grupoFilter) && (!tipoMovFilter || r.tipoMov === tipoMovFilter))
    .reduce((acc, r) => ({ ordenes: acc.ordenes + r.ordenes, unidades: acc.unidades + r.unidades, lineas: acc.lineas + r.lineas }), { ordenes: 0, unidades: 0, lineas: 0 });
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

function buildTipoOrdenPivot(rows: TipoOrden[], grupoFilter: string, years: number[]) {
  const filtered = rows.filter((r) => r.grupo === grupoFilter);
  const tipos = [...new Map(filtered.map((r) => [r.tipoOrden, r])).keys()].sort();
  const byTipoAnio = new Map<string, number>();
  for (const r of filtered) byTipoAnio.set(`${r.tipoOrden}_${r.anio}`, r.ordenes);
  return { tipos, byTipoAnio };
}

// ── Componentes ───────────────────────────────────────────────────────────────

function PivotTable({ rows, grupoFilter, label }: { rows: ResumenMes[]; grupoFilter?: string; label: string }) {
  const { years, meses, ordenesByMesAnio } = buildPivot(rows, grupoFilter);
  if (!meses.length) return <p style={{ color: "var(--muted2)", fontSize: 13 }}>Sin datos mensuales.</p>;

  const yearsColspan = years.length + 1; // +1 for total
  return (
    <div>
      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "var(--foreground)" }}>{label}</p>
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
                  <td style={{ textTransform: "capitalize" }}>{MES_LABEL[m] ?? m}</td>
                  {vals.map((v, i) => <td key={i} style={{ textAlign: "right" }}>{v ? fmt(v) : "—"}</td>)}
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(total)}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "2px solid var(--border-strong)", fontWeight: 700 }}>
              <td>Total</td>
              {years.map((y) => {
                const colTotal = meses.reduce((s, m) => s + (ordenesByMesAnio.get(`${m}_${y}`) ?? 0), 0);
                return <td key={y} style={{ textAlign: "right" }}>{fmt(colTotal)}</td>;
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
      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "var(--foreground)" }}>
        Cantidad líneas (PLUs) procesadas × AÑO - MES
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

function TipoOrdenTable({ tipoOrden, grupoFilter, years }: { tipoOrden: TipoOrden[]; grupoFilter: string; years: number[] }) {
  const { tipos, byTipoAnio } = buildTipoOrdenPivot(tipoOrden, grupoFilter, years);
  if (!tipos.length) return null;
  return (
    <div>
      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "var(--foreground)" }}>
        Cantidad órdenes × AÑO - TIPO DE ORDEN
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

function PLUTop10({ plus, years }: { plus: PLU[]; years: number[] }) {
  const [selYear, setSelYear] = useState<number>(0);
  const displayYear = selYear || years[years.length - 1] || 2026;

  const byYear = plus.filter((p) => p.anio === displayYear);
  const topEnv = [...byYear].sort((a, b) => b.enviados - a.enviados).slice(0, 10);
  const topUnd = [...byYear].sort((a, b) => b.unidades - a.unidades).slice(0, 10);
  const grupos = [...new Set(byYear.map((p) => p.grupo))].sort();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Año:</span>
        {years.map((y) => (
          <button
            key={y}
            className={`ds-btn ds-btn-sm ${displayYear === y ? "ds-btn-primary" : ""}`}
            onClick={() => setSelYear(y)}
            style={{ minWidth: 56 }}
          >
            {y}
          </button>
        ))}
        {grupos.length > 1 && (
          <span style={{ marginLeft: 12, fontSize: 12, color: "var(--muted2)" }}>
            Grupos: {grupos.join(", ")}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Top 10 PLU con más rotación {displayYear} — Envíos
          </p>
          <table className="cedi-table">
            <thead>
              <tr><th>PLU</th><th>Descripción</th><th style={{ textAlign: "right" }}>Envíos</th></tr>
            </thead>
            <tbody>
              {topEnv.map((p) => (
                <tr key={p.plu + p.grupo}>
                  <td style={{ fontWeight: 600 }}>{p.plu}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.descripcion}</td>
                  <td style={{ textAlign: "right" }}>{fmt(p.enviados)}</td>
                </tr>
              ))}
              {!topEnv.length && (
                <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--muted2)" }}>Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Top 10 PLU con más rotación {displayYear} — Unidades
          </p>
          <table className="cedi-table">
            <thead>
              <tr><th>PLU</th><th>Descripción</th><th style={{ textAlign: "right" }}>Unidades</th></tr>
            </thead>
            <tbody>
              {topUnd.map((p) => (
                <tr key={p.plu + p.grupo}>
                  <td style={{ fontWeight: 600 }}>{p.plu}</td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.descripcion}</td>
                  <td style={{ textAlign: "right" }}>{fmt(p.unidades)}</td>
                </tr>
              ))}
              {!topUnd.length && (
                <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--muted2)" }}>Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
  const hasData = resumen.length > 0 || plus.length > 0;

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
      description="Operaciones y rotación sincronizadas desde Google Sheets (Base general + Rotacion PLU)."
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
          description="Presiona 'Sincronizar' para cargar datos desde Google Sheets (Base general + Rotacion PLU)."
        />
      )}

      {/* ── Tab: CEDI ─────────────────────────────────────── */}
      {!loading && hasData && activeTab === "cedi" && (
        <>
          <div className="cedi-grid" style={{ marginBottom: 24 }}>
            <CediStat label="# Órdenes procesadas" value={fmt(kpiCedi.total.ordenes)} hint="Todas" />
            <CediStat label="# Unidades despachadas" value={fmt(kpiCedi.total.unidades)} hint="Cantidad completada" />
            <CediStat label="CANTIDAD OVDM" value={fmt(kpiCedi.ovdm.ordenes)} hint="Órdenes de venta directa" />
            <CediStat label="CANTIDAD TSDM" value={fmt(kpiCedi.tsdm.ordenes)} hint="Órdenes de traslado" />
            <CediStat label="# Órdenes AG" value={fmt(kpiCedi.ag.ordenes)} hint="Ambiente Gourmet" />
            <CediStat label="# Órdenes Muebles" value={fmt(kpiCedi.mue.ordenes)} hint="Línea Muebles" />
            <CediStat label="Und. despachadas OVDM" value={fmt(kpiCedi.ovdm.unidades)} hint="Cantidad completada OVDM" />
            <CediStat label="Und. despachadas TSDM" value={fmt(kpiCedi.tsdm.unidades)} hint="Cantidad completada TSDM" />
          </div>

          <CediPanel title="Órdenes procesadas × AÑO - MES" description="Total CEDI (AG + Muebles)">
            <PivotTable rows={resumen} label="Cantidad órdenes procesadas × AÑO - MES" />
          </CediPanel>

          <CediPanel title="Líneas y Tipo de Orden" description="Desagregados operativos">
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <LineasTable rows={resumen} />
              <TipoOrdenTable tipoOrden={tipoOrden} grupoFilter="TODOS" years={years} />
            </div>
          </CediPanel>
        </>
      )}

      {/* ── Tab: AG ──────────────────────────────────────── */}
      {!loading && hasData && activeTab === "ag" && (
        <>
          <div className="cedi-grid" style={{ marginBottom: 24 }}>
            <CediStat label="# Órdenes AG" value={fmt(kpiAG.total.ordenes)} hint="Ambiente Gourmet" />
            <CediStat label="# Unidades AG" value={fmt(kpiAG.total.unidades)} hint="Cantidad completada" />
            <CediStat label="CANTIDAD OVDM" value={fmt(kpiAG.ovdm.ordenes)} hint="Órdenes de venta AG" />
            <CediStat label="CANTIDAD TSDM" value={fmt(kpiAG.tsdm.ordenes)} hint="Traslados AG" />
            <CediStat label="Und. OVDM AG" value={fmt(kpiAG.ovdm.unidades)} hint="Unidades venta AG" />
            <CediStat label="Und. TSDM AG" value={fmt(kpiAG.tsdm.unidades)} hint="Unidades traslado AG" />
          </div>

          <CediPanel title="Órdenes AG procesadas × AÑO - MES">
            <PivotTable rows={resumen} grupoFilter="AG" label="Cantidad órdenes (AG) × AÑO - MES" />
          </CediPanel>

          <CediPanel title="Líneas AG">
            <LineasTable rows={resumen} grupoFilter="AG" />
          </CediPanel>
        </>
      )}

      {/* ── Tab: Muebles ─────────────────────────────────── */}
      {!loading && hasData && activeTab === "muebles" && (
        <>
          <div className="cedi-grid" style={{ marginBottom: 24 }}>
            <CediStat label="# Órdenes Muebles" value={fmt(kpiMue.total.ordenes)} hint="Línea Muebles" />
            <CediStat label="# Unidades Muebles" value={fmt(kpiMue.total.unidades)} hint="Cantidad completada" />
            <CediStat label="CANTIDAD OVDM" value={fmt(kpiMue.ovdm.ordenes)} hint="Órdenes de venta Muebles" />
            <CediStat label="CANTIDAD TSDM" value={fmt(kpiMue.tsdm.ordenes)} hint="Traslados Muebles" />
            <CediStat label="Und. OVDM Muebles" value={fmt(kpiMue.ovdm.unidades)} hint="Unidades venta Muebles" />
            <CediStat label="Und. TSDM Muebles" value={fmt(kpiMue.tsdm.unidades)} hint="Unidades traslado Muebles" />
          </div>

          <CediPanel title="Órdenes Muebles procesadas × AÑO - MES">
            <PivotTable rows={resumen} grupoFilter="MUEBLES" label="Cantidad órdenes (Muebles) × AÑO - MES" />
          </CediPanel>

          <CediPanel title="Líneas Muebles">
            <LineasTable rows={resumen} grupoFilter="MUEBLES" />
          </CediPanel>
        </>
      )}

      {/* ── Tab: Rotación PLU ────────────────────────────── */}
      {!loading && hasData && activeTab === "plu" && (
        <CediPanel title="Rotación PLU" description="Top 10 PLUs por año según envíos y unidades despachadas.">
          {plus.length === 0 ? (
            <CediEmpty title="Sin datos PLU" description="La pestaña 'Rotacion PLU' del Sheet no tiene datos o no se ha sincronizado." />
          ) : (
            <PLUTop10 plus={plus} years={years.filter((y) => plus.some((p) => p.anio === y))} />
          )}
        </CediPanel>
      )}
    </CediPage>
  );
}
