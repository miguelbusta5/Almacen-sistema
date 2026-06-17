"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { RefreshCw, Search, Sheet, SlidersHorizontal } from "lucide-react";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { CediBadge, CediEmpty, CediPage, CediPanel, CediStat } from "@/components/ui/cedi";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

interface IndicadorItem {
  id: string;
  proceso: string;
  indicador: string;
  periodo: string;
  valor: number;
  meta: number | null;
  unidad: string | null;
  estado: string;
  syncedAt: string;
  fuente: {
    nombre: string;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
    rango: string;
  };
}

interface IndicadoresResponse {
  success: boolean;
  data: IndicadorItem[];
  error?: string;
  meta: {
    total: number;
    promedioCumplimiento: number;
    fuentes: Array<{ nombre: string; lastSyncAt: string | null; lastSyncStatus: string | null; lastSyncError: string | null; rango: string }>;
    procesos: string[];
    periodos: string[];
    estados: Array<{ estado: string; total: number }>;
  };
}

const fmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });

function estadoTone(estado: string): "neutral" | "info" | "warning" | "danger" {
  if (["CRITICO", "VENCIDO", "ERROR"].includes(estado)) return "danger";
  if (["ALERTA", "PENDIENTE"].includes(estado)) return "warning";
  if (["EN_META", "OK", "NORMAL"].includes(estado)) return "info";
  return "neutral";
}

export default function IndicadoresPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canSync = role === "ADMIN" || role === "GERENTE";

  const [data, setData] = useState<IndicadoresResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proceso, setProceso] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (proceso) params.set("proceso", proceso);
    if (periodo) params.set("periodo", periodo);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/indicadores?${params.toString()}`);
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error ?? "No fue posible cargar indicadores");
    setData(json);
    setError(null);
  }, [periodo, proceso, q]);

  const { refreshing, lastUpdatedAt, refreshNow } = useAutoRefresh({
    intervalMs: 60_000,
    onRefresh: load,
  });

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "No fue posible cargar indicadores"))
      .finally(() => setLoading(false));
  }, [load]);

  const stats = useMemo(() => {
    const items = data?.data ?? [];
    const criticos = items.filter((i) => estadoTone(i.estado) === "danger").length;
    const alertas = items.filter((i) => estadoTone(i.estado) === "warning").length;
    const conMeta = items.filter((i) => i.meta !== null && i.meta !== 0);
    return {
      total: data?.meta.total ?? 0,
      procesos: new Set(items.map((i) => i.proceso)).size,
      criticos,
      alertas,
      cumplimiento: conMeta.length ? data?.meta.promedioCumplimiento ?? 0 : 0,
    };
  }, [data]);

  async function syncNow() {
    if (!canSync) return;
    setSyncing(true);
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

  return (
    <CediPage
      title="Indicadores CEDI"
      description="KPIs operativos sincronizados desde Google Sheets y cacheados en la base de datos para consultar sin depender de Looker Studio."
      actions={
        <>
          <AutoRefreshIndicator lastUpdatedAt={lastUpdatedAt} refreshing={refreshing || loading} onRefresh={refreshNow} />
          {canSync && (
            <button className="ds-btn ds-btn-primary" onClick={syncNow} disabled={syncing}>
              <RefreshCw size={15} style={{ animation: syncing ? "spin .8s linear infinite" : "none" }} />
              {syncing ? "Sincronizando" : "Sincronizar"}
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

      <div className="cedi-grid">
        <CediStat label="Indicadores" value={loading ? "..." : stats.total} hint="Registros cacheados" />
        <CediStat label="Procesos" value={loading ? "..." : stats.procesos} hint="Áreas con datos" />
        <CediStat label="Cumplimiento" value={loading ? "..." : pct.format(stats.cumplimiento)} hint="Promedio sobre meta" />
        <CediStat label="Alertas" value={loading ? "..." : stats.alertas + stats.criticos} hint={`${stats.criticos} críticos`} />
      </div>

      <CediPanel
        title="Filtros"
        description="Consulta por proceso, periodo o nombre del indicador."
        actions={<SlidersHorizontal size={17} color="var(--muted)" />}
      >
        <div className="grid-2" style={{ gridTemplateColumns: "1.2fr 1fr 1fr" }}>
          <label className="field">
            <span>Buscar</span>
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: "var(--muted)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Indicador, proceso o periodo" style={{ paddingLeft: 34 }} />
            </div>
          </label>
          <label className="field">
            <span>Proceso</span>
            <select value={proceso} onChange={(e) => setProceso(e.target.value)}>
              <option value="">Todos</option>
              {(data?.meta.procesos ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Periodo</span>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="">Todos</option>
              {(data?.meta.periodos ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </CediPanel>

      <CediPanel
        title="Tablero de indicadores"
        description={data?.meta.fuentes[0]?.lastSyncAt ? `Última sincronización: ${new Date(data.meta.fuentes[0].lastSyncAt).toLocaleString("es-CO")}` : "Sin sincronización registrada"}
        actions={<CediBadge tone={data?.meta.fuentes[0]?.lastSyncStatus === "ERROR" ? "danger" : "info"}>{data?.meta.fuentes[0]?.lastSyncStatus ?? "Sin datos"}</CediBadge>}
      >
        {!loading && (data?.data.length ?? 0) === 0 ? (
          <CediEmpty
            title="No hay indicadores cargados"
            description="Configura las credenciales de Google Sheets y ejecuta la primera sincronización para poblar el tablero."
          />
        ) : (
          <div className="op-table-wrap" style={{ overflowX: "auto" }}>
            <table className="cedi-table">
              <thead>
                <tr>
                  <th>Proceso</th>
                  <th>Indicador</th>
                  <th>Periodo</th>
                  <th>Valor</th>
                  <th>Meta</th>
                  <th>Estado</th>
                  <th>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {(data?.data ?? []).map((item) => {
                  const cumplimiento = item.meta ? Math.min(1.25, item.valor / item.meta) : null;
                  return (
                    <tr key={item.id}>
                      <td data-label="Proceso"><strong>{item.proceso}</strong></td>
                      <td data-label="Indicador">{item.indicador}</td>
                      <td data-label="Periodo">{item.periodo}</td>
                      <td data-label="Valor">{fmt.format(item.valor)} {item.unidad ?? ""}</td>
                      <td data-label="Meta">
                        {item.meta === null ? "Sin meta" : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            {fmt.format(item.meta)}
                            <span style={{ width: 54, height: 5, borderRadius: 999, background: "var(--surface3)", overflow: "hidden" }}>
                              <span style={{ display: "block", width: `${Math.round((cumplimiento ?? 0) * 100)}%`, height: "100%", background: "var(--brand)" }} />
                            </span>
                          </span>
                        )}
                      </td>
                      <td data-label="Estado"><CediBadge tone={estadoTone(item.estado)}>{item.estado}</CediBadge></td>
                      <td data-label="Fuente">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--muted2)" }}>
                          <Sheet size={14} color="var(--brand)" />
                          {item.fuente.nombre}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CediPanel>
    </CediPage>
  );
}
