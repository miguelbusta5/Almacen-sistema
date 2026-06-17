"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle, Camera, CheckCircle2, ChevronLeft, ChevronRight,
  Download, RefreshCw, Save, ShieldCheck, Trash2, Truck, XCircle,
} from "lucide-react";
import { Badge, EmptyState, SkeletonTable, Stat } from "@/components/ui";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { SlidePanel, DetailSection, DetailGrid } from "@/components/ui/SlidePanel";
import { useIsMobile } from "@/lib/useIsMobile";
import type { ResultadoInspeccion } from "@/lib/preoperacional";
import { getModuleColor } from "@/lib/moduleTheme";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

// ─── tipos ──────────────────────────────────────────────────────────────────

type EstadoInspeccion = "APROBADA" | "APROBADA_CON_OBSERVACIONES" | "BLOQUEADA";

interface ChecklistItem {
  categoria: string;
  item: string;
  esCritico: boolean;
}

interface FormItem extends ChecklistItem {
  resultado: ResultadoInspeccion;
  observacion: string;
  fotoUrl: string | null;
  uploading?: boolean;
}

interface Inspeccion {
  id: string;
  fecha: string;
  kilometraje: number | null;
  observaciones: string | null;
  estado: EstadoInspeccion;
  createdAt: string;
  items: Array<FormItem & { id: string }>;
}

interface ConductorData {
  checklist: ChecklistItem[];
  transportista: { id: string; nombre: string; telefono: string | null } | null;
  vehiculo: { id: string; placa: string; tipo: string; estado: string } | null;
  inspeccionHoy: Inspeccion | null;
  historial: Inspeccion[];
}

interface HistorialRow {
  id: string;
  fecha: string;
  kilometraje: number | null;
  estado: EstadoInspeccion;
  conductor: { id: string; nombre: string; telefono: string | null };
  vehiculo: { id: string; placa: string; tipo: string };
  itemsCount: number;
  noConformes: number;
  criticos: number;
}

interface InspeccionDetalle {
  id: string;
  fecha: string;
  kilometraje: number | null;
  observaciones: string | null;
  estado: EstadoInspeccion;
  conductor: { id: string; nombre: string; telefono: string | null };
  vehiculo: { id: string; placa: string; tipo: string };
  realizadoPor: { id: string; name: string } | null;
  items: Array<{
    id: string; categoria: string; item: string;
    resultado: ResultadoInspeccion; esCritico: boolean;
    fotoUrl: string | null; observacion: string | null;
  }>;
}

// ─── constantes ─────────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<EstadoInspeccion, string> = {
  APROBADA: "Aprobada",
  APROBADA_CON_OBSERVACIONES: "Con observaciones",
  BLOQUEADA: "Bloqueada",
};

const ESTADO_COLOR: Record<EstadoInspeccion, string> = {
  APROBADA: "var(--success)",
  APROBADA_CON_OBSERVACIONES: "var(--warning)",
  BLOQUEADA: "var(--error)",
};

const RESULTADO_LABEL: Record<ResultadoInspeccion, string> = {
  CONFORME:    "Conforme",
  NO_CONFORME: "No conforme",
  NO_APLICA:   "No aplica",
};

const SUPERVISOR_ROLES = ["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE"];
const PREOP_COLOR = getModuleColor("preoperacional");
const PREOP_TINT = `${PREOP_COLOR}14`;

function estadoEstimado(items: FormItem[]): EstadoInspeccion {
  if (items.some((i) => i.esCritico && i.resultado === "NO_CONFORME")) return "BLOQUEADA";
  if (items.some((i) => i.resultado === "NO_CONFORME")) return "APROBADA_CON_OBSERVACIONES";
  return "APROBADA";
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function PreoperacionalPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (status === "loading") return <SkeletonTable rows={8} cols={4} />;

  if (role && SUPERVISOR_ROLES.includes(role)) return <SupervisorView role={role} />;

  if (role === "TRANSPORTISTA") return <ConductorView />;

  return (
    <EmptyState
      icon={<ShieldCheck size={24} />}
      title="Sin acceso"
      description="El preoperacional está disponible para transportistas y supervisores de transporte."
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VISTA CONDUCTOR (TRANSPORTISTA)
// ════════════════════════════════════════════════════════════════════════════

function ConductorView() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isMobile = useIsMobile();

  const [data, setData] = useState<ConductorData | null>(null);
  const [items, setItems] = useState<FormItem[]>([]);
  const [kilometraje, setKilometraje] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 2600);
  };

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/preoperacional");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error");
      setData(json);
      setItems((json.checklist ?? []).map((i: ChecklistItem) => ({
        ...i,
        resultado: "CONFORME" as ResultadoInspeccion,
        observacion: "",
        fotoUrl: null,
      })));
    } catch (e: any) {
      showToast(e.message || "No se pudo cargar preoperacional", true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const autoRefresh = useAutoRefresh({
    pause: Boolean(saving || kilometraje || observaciones || items.some((item) => item.resultado !== "CONFORME" || item.observacion || item.fotoUrl)),
    onRefresh: () => load(),
  });

  const resumen = useMemo(() => {
    const noConformes = items.filter((i) => i.resultado === "NO_CONFORME");
    return {
      estado: estadoEstimado(items),
      noConformes: noConformes.length,
      criticos: noConformes.filter((i) => i.esCritico).length,
      completados: items.filter((i) => i.resultado).length,
    };
  }, [items]);

  function updateItem(index: number, patch: Partial<FormItem>) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function uploadFoto(index: number, file: File | null) {
    if (!file) return;
    updateItem(index, { uploading: true });
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const res = await fetch("/api/uploads/foto", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "No se pudo subir la foto");
      updateItem(index, { fotoUrl: json.url });
      showToast("Foto cargada");
    } catch (e: any) {
      showToast(e.message || "Error cargando foto", true);
    } finally {
      updateItem(index, { uploading: false });
    }
  }

  async function submit() {
    if (role !== "TRANSPORTISTA") return showToast("Solo transportistas pueden registrar preoperacional", true);
    const faltanObs = items.some((i) => i.resultado === "NO_CONFORME" && !i.observacion.trim());
    if (faltanObs) return showToast("Describe cada item no conforme", true);

    setSaving(true);
    try {
      const res = await fetch("/api/preoperacional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kilometraje: kilometraje ? Number(kilometraje) : null,
          observaciones: observaciones.trim() || null,
          items: items.map((i) => ({
            item: i.item,
            resultado: i.resultado,
            observacion: i.observacion.trim() || null,
            fotoUrl: i.fotoUrl,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "No se pudo guardar");
      showToast("Preoperacional registrado");
      setKilometraje("");
      setObservaciones("");
      await load();
    } catch (e: any) {
      showToast(e.message || "Error guardando", true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonTable rows={8} cols={4} />;

  if (!data?.transportista || !data.vehiculo) {
    return (
      <div className="animate-fade-in" style={{ maxWidth: 720 }}>
        <EmptyState
          icon={<Truck size={24} />}
          title="Sin vehículo asignado"
          description="Tu usuario debe estar vinculado a un transportista activo y a un vehículo antes de registrar el preoperacional."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 980 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: PREOP_TINT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={16} color={PREOP_COLOR} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", margin: 0 }}>Preoperacional</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            {data.transportista.nombre} — {data.vehiculo.placa} — {data.vehiculo.tipo}
          </p>
        </div>
        <AutoRefreshIndicator
          lastUpdatedAt={autoRefresh.lastUpdatedAt}
          refreshing={autoRefresh.refreshing}
          onRefresh={autoRefresh.refreshNow}
        />
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fit,minmax(150px,1fr))", gap: 18, marginBottom: 22 }}>
        <Stat value={data.inspeccionHoy ? "Sí" : "No"} label="Registrado hoy" color={data.inspeccionHoy ? "var(--success)" : "var(--warning)"} />
        <Stat value={ESTADO_LABEL[resumen.estado]} label="Resultado estimado" color={ESTADO_COLOR[resumen.estado]} />
        <Stat value={resumen.noConformes} label="No conformes" color={resumen.noConformes > 0 ? "var(--warning)" : "var(--success)"} />
        <Stat value={resumen.criticos} label="Críticos" color={resumen.criticos > 0 ? "var(--error)" : "var(--success)"} />
      </div>

      {/* Banner inspeccion hoy */}
      {data.inspeccionHoy && (
        <div style={{ padding: "12px 14px", border: `1px solid ${ESTADO_COLOR[data.inspeccionHoy.estado]}44`, background: ESTADO_COLOR[data.inspeccionHoy.estado] + "12", borderRadius: 8, marginBottom: 18, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {data.inspeccionHoy.estado === "BLOQUEADA" ? <XCircle size={16} color="var(--error)" /> : <CheckCircle2 size={16} color={ESTADO_COLOR[data.inspeccionHoy.estado]} />}
          <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>
            Ya registraste una inspección hoy: {ESTADO_LABEL[data.inspeccionHoy.estado]}
          </div>
        </div>
      )}

      {/* Formulario */}
      <div className="ds-card" style={{ padding: 18, marginBottom: 22 }}>
        {/* Km + observaciones generales */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "160px 1fr", gap: 12, marginBottom: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
            Kilometraje
            <input type="number" min="0" value={kilometraje} onChange={(e) => setKilometraje(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
            Observaciones generales
            <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} style={inputStyle} placeholder="Sin observaciones" />
          </label>
        </div>

        {/* Checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, index) => {
            const bad = item.resultado === "NO_CONFORME";

            if (isMobile) {
              return (
                <div key={item.item} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px", border: "1px solid var(--border)", borderRadius: 8, background: bad ? "rgba(239,68,68,0.04)" : "var(--surface)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{item.item}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "capitalize" }}>{item.categoria}</span>
                    {item.esCritico && <Badge label="Crítico" variant="error" dot={false} />}
                  </div>
                  <select value={item.resultado} onChange={(e) => updateItem(index, { resultado: e.target.value as ResultadoInspeccion })} style={inputStyle}>
                    {Object.entries(RESULTADO_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input value={item.observacion} onChange={(e) => updateItem(index, { observacion: e.target.value })} style={inputStyle} placeholder={bad ? "Describe la novedad" : "Observación"} />
                  <label className="ds-btn ds-btn-sm ds-btn-ghost" style={{ justifyContent: "center", cursor: "pointer", margin: 0, width: "100%", boxSizing: "border-box" }}>
                    <Camera size={13} />{item.uploading ? "Subiendo" : item.fotoUrl ? "Cargada" : "Foto"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => uploadFoto(index, e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              );
            }

            return (
              <div key={item.item} style={{ display: "grid", gridTemplateColumns: "1fr 150px 220px 120px", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, background: bad ? "rgba(239,68,68,0.04)" : "var(--surface)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{item.item}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "capitalize" }}>{item.categoria}</span>
                    {item.esCritico && <Badge label="Crítico" variant="error" dot={false} />}
                  </div>
                </div>
                <select value={item.resultado} onChange={(e) => updateItem(index, { resultado: e.target.value as ResultadoInspeccion })} style={inputStyle}>
                  {Object.entries(RESULTADO_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input value={item.observacion} onChange={(e) => updateItem(index, { observacion: e.target.value })} style={inputStyle} placeholder={bad ? "Describe la novedad" : "Observación"} />
                <label className="ds-btn ds-btn-sm ds-btn-ghost" style={{ justifyContent: "center", cursor: "pointer", margin: 0 }}>
                  <Camera size={13} />{item.uploading ? "Subiendo" : item.fotoUrl ? "Cargada" : "Foto"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => uploadFoto(index, e.target.files?.[0] ?? null)} />
                </label>
              </div>
            );
          })}
        </div>

        {/* Footer formulario */}
        <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: ESTADO_COLOR[resumen.estado], fontWeight: 700 }}>
            {resumen.estado === "BLOQUEADA" && <AlertTriangle size={14} />}
            Resultado: {ESTADO_LABEL[resumen.estado]}
          </div>
          <button className="ds-btn ds-btn-primary" style={{ background: PREOP_COLOR }} disabled={saving} onClick={submit}>
            <Save size={14} />{saving ? "Guardando..." : "Guardar inspección"}
          </button>
        </div>
      </div>

      {/* Historial */}
      <div className="ds-card" style={{ padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Historial reciente</div>
        {data.historial.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Aún no hay inspecciones registradas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.historial.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{h.fecha}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{h.kilometraje != null ? `${h.kilometraje} km` : "Sin kilometraje"}</div>
                </div>
                <Badge label={ESTADO_LABEL[h.estado]} variant={h.estado === "BLOQUEADA" ? "error" : h.estado === "APROBADA" ? "success" : "warning"} dot={false} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="animate-fade-up" style={{ position: "fixed", bottom: 24, right: isMobile ? 12 : 24, zIndex: 10000, background: toast.err ? "var(--error)" : "#0F0F10", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: "var(--shadow-xl)", ...(isMobile && { maxWidth: "calc(100vw - 24px)" }) }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VISTA SUPERVISOR (ADMIN / GERENTE / SUPERVISOR_TRANSPORTE)
// ════════════════════════════════════════════════════════════════════════════

function SupervisorView({ role }: { role: string }) {
  const [rows, setRows]           = useState<HistorialRow[]>([]);
  const [conductores, setConductores] = useState<{ id: string; nombre: string }[]>([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected,      setSelected]      = useState<HistorialRow | null>(null);
  const [detail,        setDetail]        = useState<InspeccionDetalle | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toast, setToast]         = useState<{ msg: string; err?: boolean } | null>(null);

  const [fDesde, setFDesde]           = useState("");
  const [fHasta, setFHasta]           = useState("");
  const [fConductor, setFConductor]   = useState("");
  const [fEstado, setFEstado]         = useState("");

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3000);
  };

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    if (fDesde)     p.set("fechaDesde",  fDesde);
    if (fHasta)     p.set("fechaHasta",  fHasta);
    if (fConductor) p.set("conductorId", fConductor);
    if (fEstado)    p.set("estado",      fEstado);
    if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return p.toString();
  }, [fDesde, fHasta, fConductor, fEstado]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const qs = buildParams({ page: String(p), pageSize: "50" });
      const res = await fetch(`/api/preoperacional/historial?${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Error al cargar");
      setRows(json.data);
      setTotal(json.total);
      setPages(json.pages);
      setPage(p);
      if (json.conductores?.length) setConductores(json.conductores);
    } catch (e: any) {
      showToast(e.message || "Error", true);
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { load(1); }, [load]);

  const autoRefresh = useAutoRefresh({
    pause: Boolean(selected || deletingId || exporting),
    onRefresh: () => load(page),
  });

  async function exportar() {
    setExporting(true);
    try {
      const qs = buildParams();
      const res = await fetch(`/api/preoperacional/export?${qs}`);
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `preoperacionales-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showToast(e.message || "Error al exportar", true);
    } finally {
      setExporting(false);
    }
  }

  async function openDetail(row: HistorialRow) {
    setSelected(row);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/preoperacional/${row.id}`);
      const json = await res.json();
      if (json.success) setDetail(json.data);
    } catch { /* panel abierto, ítems no cargaron */ }
    finally { setLoadingDetail(false); }
  }

  async function deleteRow(id: string) {
    try {
      const res = await fetch(`/api/preoperacional/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      showToast("Inspección eliminada");
      setDeletingId(null);
      load(page);
    } catch (e: any) {
      showToast(e.message || "Error al eliminar", true);
      setDeletingId(null);
    }
  }

  const hayFiltros = fDesde || fHasta || fConductor || fEstado;
  function limpiar() {
    setFDesde(""); setFHasta(""); setFConductor(""); setFEstado("");
  }

  const estadoBadge = (e: EstadoInspeccion) =>
    e === "APROBADA" ? "success" : e === "BLOQUEADA" ? "error" : "warning";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: PREOP_TINT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={20} color={PREOP_COLOR} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Preoperacional</h1>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>{total} inspeccion{total !== 1 ? "es" : ""} registrada{total !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <AutoRefreshIndicator
            lastUpdatedAt={autoRefresh.lastUpdatedAt}
            refreshing={autoRefresh.refreshing}
            onRefresh={autoRefresh.refreshNow}
          />
          <button onClick={exportar} disabled={exporting} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.55rem 1rem", background: PREOP_COLOR, color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: exporting ? 0.7 : 1 }}>
            <Download size={14} />{exporting ? "Exportando..." : "Exportar Excel"}
          </button>
          <button onClick={() => load(page)} className="ds-btn ds-btn-ghost" style={{ fontSize: 12 }}>
            <RefreshCw size={14} />Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "1rem", alignItems: "center" }}>
        <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} style={inp} title="Desde" />
        <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} style={inp} title="Hasta" />
        <select value={fConductor} onChange={(e) => setFConductor(e.target.value)} style={inp}>
          <option value="">Todos los conductores</option>
          {conductores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={inp}>
          <option value="">Todos los estados</option>
          <option value="APROBADA">Aprobada</option>
          <option value="APROBADA_CON_OBSERVACIONES">Con observaciones</option>
          <option value="BLOQUEADA">Bloqueada</option>
        </select>
        {hayFiltros && (
          <button onClick={limpiar} style={{ background: "none", border: "none", color: "var(--muted2)", cursor: "pointer", fontSize: 12, padding: "0.4rem 0.6rem" }}>
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                  {["Fecha", "Conductor", "Vehículo", "Km", "Estado", "Ítems"].map((h) => (
                    <th key={h} style={{ padding: "0.7rem 0.9rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                  {role === "ADMIN" && <th style={{ padding: "0.7rem 0.9rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}></th>}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={role === "ADMIN" ? 7 : 6} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Sin inspecciones para los filtros seleccionados</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => openDetail(r)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                    <td style={{ padding: "0.7rem 0.9rem", fontFamily: "var(--mono)", fontSize: 12 }}>{r.fecha}</td>
                    <td style={{ padding: "0.7rem 0.9rem", fontWeight: 600 }}>{r.conductor?.nombre ?? "—"}</td>
                    <td style={{ padding: "0.7rem 0.9rem", fontFamily: "var(--mono)", fontSize: 12 }}>
                      {r.vehiculo?.placa ?? "—"}
                      <span style={{ color: "var(--muted)", marginLeft: 4 }}>{r.vehiculo?.tipo}</span>
                    </td>
                    <td style={{ padding: "0.7rem 0.9rem", fontSize: 12, color: "var(--muted2)" }}>{r.kilometraje != null ? r.kilometraje.toLocaleString() : "—"}</td>
                    <td style={{ padding: "0.7rem 0.9rem" }}>
                      <Badge label={ESTADO_LABEL[r.estado]} variant={estadoBadge(r.estado)} dot={false} />
                    </td>
                    <td style={{ padding: "0.7rem 0.9rem", fontSize: 12 }}>
                      <span style={{ color: "var(--muted2)" }}>{r.itemsCount} ítems</span>
                      {r.noConformes > 0 && (
                        <span style={{ marginLeft: 6, color: r.criticos > 0 ? "var(--error)" : "var(--warning)", fontWeight: 700 }}>
                          · {r.noConformes} ✗{r.criticos > 0 ? ` (${r.criticos} crít.)` : ""}
                        </span>
                      )}
                    </td>
                    {role === "ADMIN" && (
                      <td style={{ padding: "0.7rem 0.9rem" }}>
                        {deletingId === r.id ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button onClick={(e) => { e.stopPropagation(); deleteRow(r.id); }}
                              style={{ fontSize: 11, padding: "3px 8px", background: "var(--error)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                              Sí, eliminar
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                              style={{ fontSize: 11, padding: "3px 8px", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--muted)" }}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setDeletingId(r.id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted2)", padding: 4, display: "flex", alignItems: "center" }}
                            title="Eliminar inspección">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {pages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "0.75rem 1rem", borderTop: "1px solid var(--border)", fontSize: 13 }}>
              <button onClick={() => load(page - 1)} disabled={page <= 1} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ opacity: page <= 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />Anterior
              </button>
              <span style={{ color: "var(--muted)" }}>Página {page} de {pages}</span>
              <button onClick={() => load(page + 1)} disabled={page >= pages} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ opacity: page >= pages ? 0.4 : 1 }}>
                Siguiente<ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Slide panel detalle */}
      <SlidePanel
        open={!!selected}
        onClose={() => { setSelected(null); setDetail(null); setDeletingId(null); }}
        title={selected ? `${selected.conductor?.nombre ?? "Inspector"} — ${selected.fecha}` : ""}
        badge={selected ? <Badge label={ESTADO_LABEL[selected.estado]} variant={estadoBadge(selected.estado)} dot={false} /> : undefined}
      >
        {selected && (
          <>
            <DetailSection title="Información general">
              <DetailGrid items={[
                { label: "Fecha",            value: selected.fecha },
                { label: "Conductor",        value: selected.conductor?.nombre ?? "—" },
                { label: "Vehículo",         value: `${selected.vehiculo?.placa ?? "—"} · ${selected.vehiculo?.tipo ?? ""}` },
                { label: "Kilometraje",      value: selected.kilometraje != null ? `${selected.kilometraje.toLocaleString()} km` : "—" },
                { label: "Estado",           value: ESTADO_LABEL[selected.estado] },
                { label: "Ítems evaluados",  value: selected.itemsCount },
                { label: "No conformes",     value: selected.noConformes },
                { label: "Críticos",         value: selected.criticos },
                ...(detail?.observaciones ? [{ label: "Observaciones", value: detail.observaciones }] : []),
              ]} />
            </DetailSection>

            {loadingDetail && (
              <DetailSection title="Checklist">
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Cargando ítems…</p>
              </DetailSection>
            )}

            {detail && detail.items.length > 0 && (() => {
              const cats = Array.from(new Set(detail.items.map((i) => i.categoria)));
              return cats.map((cat) => (
                <DetailSection key={cat} title={`Checklist — ${cat}`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {detail.items.filter((i) => i.categoria === cat).map((itm) => (
                      <div key={itm.id} style={{
                        display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px",
                        border: "1px solid var(--border)", borderRadius: 8,
                        background: itm.resultado === "NO_CONFORME" ? "rgba(239,68,68,0.04)" : "var(--surface2)",
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {itm.item}
                            {itm.esCritico && <Badge label="Crítico" variant="error" dot={false} />}
                          </div>
                          {itm.observacion && (
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{itm.observacion}</div>
                          )}
                          {itm.fotoUrl && (
                            <a href={itm.fotoUrl} target="_blank" rel="noreferrer"
                              style={{ fontSize: 11, color: PREOP_COLOR, marginTop: 3, display: "block" }}>
                              Ver foto →
                            </a>
                          )}
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                          color: itm.resultado === "CONFORME"    ? "var(--success)"
                               : itm.resultado === "NO_CONFORME" ? "var(--error)"
                               : "var(--muted)",
                        }}>
                          {RESULTADO_LABEL[itm.resultado]}
                        </span>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              ));
            })()}

            {role === "ADMIN" && (
              <DetailSection title="Zona de administración">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Eliminar esta inspección permanentemente</p>
                  {deletingId === selected.id ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => deleteRow(selected.id)}
                        className="ds-btn" style={{ fontSize: 12, background: "var(--error)", color: "#fff", border: "none" }}>
                        Confirmar eliminación
                      </button>
                      <button onClick={() => setDeletingId(null)} className="ds-btn ds-btn-ghost" style={{ fontSize: 12 }}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeletingId(selected.id)}
                      className="ds-btn ds-btn-ghost" style={{ fontSize: 12, color: "var(--error)", border: "1px solid var(--error)" }}>
                      <Trash2 size={13} /> Eliminar
                    </button>
                  )}
                </div>
              </DetailSection>
            )}
          </>
        )}
      </SlidePanel>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10001, background: toast.err ? "var(--error)" : "var(--text)", color: "#fff", padding: "0.8rem 1.2rem", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "var(--shadow-xl)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── estilos compartidos ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
};

const inp: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "0.5rem 0.75rem",
  fontSize: 12,
  background: "var(--surface)",
  color: "var(--text)",
  outline: "none",
};
