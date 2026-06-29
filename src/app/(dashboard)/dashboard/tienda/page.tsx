"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import {
  Store, Plus, CheckCircle2, Truck, AlertTriangle,
  Pencil, Package, Minus, PackageCheck, UserPlus, Trash2,
} from "lucide-react";
import {
  DespachoTienda, EstadoDespacho, ESTADO_DESPACHO_LABEL,
  ESTADO_DESPACHO_COLOR, COLOR_TIENDA, estadoDespachoVariant,
  fmtFechaTienda, todayISO, ESTADOS_ACTIVOS,
} from "@/lib/tienda";
import { Badge, ModuleHero, ModuleDetailView, SkeletonLine, NetSuiteChip } from "@/components/ui";
import { usePrompt } from "@/components/ui/useDialogs";
import { useListDetailScroll } from "@/hooks/useListDetailScroll";
import { useToast } from "@/contexts/ToastContext";
import { Modal } from "@/components/ui/Modal";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { IntelBanner, DetailSection, DetailGrid, MiniHistory } from "@/components/ui/SlidePanel";
import { insightsTienda, insightsPorDespacho } from "@/lib/inteligencia";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { getModuleColor, getModuleCssVars } from "@/lib/moduleTheme";
import {
  DetailFlow,
  EstadoPipeline,
  FacturaFilterBar,
  FacturaIntelBanner,
  FacturaKpiGrid,
  FacturasTable,
  Field,
  FormSection,
  PluList,
  RejectedQueue,
} from "./_components";
import styles from "./tienda.module.css";

type ProductoMaestro = {
  plu: string;
  descripcion: string | null;
  fabricante: string | null;
  precio: number | null;
  marca: string | null;
};

const COLOR_TRANSPORTE = getModuleColor("transporte");
const COLOR_CEDI = ESTADO_DESPACHO_COLOR.ENTREGADO_CEDI;

// Modal base: adaptador del Modal premium compartido.
// Mantiene la firma { title, sub, children, onClose } usada por los
// modales de esta página; delega chrome (portal, blur, Esc, scroll-lock,
// animación) al Modal único del design system.
function ModalBase({ title, sub, children, onClose }: { title: string; sub?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={title} subtitle={sub}>
      {children}
    </Modal>
  );
}

// Entrada de historial de auditoría que devuelve GET /api/tienda/[id].
interface HistorialEntry {
  action: string;
  details: string | null;
  userName: string | null;
  createdAt: string;
}

// Pagina principal.
export default function TiendaPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canEdit   = can(role, "edit");
  const canDelete = can(role, "delete");
  const canEditBasic = ["TIENDA", "SUPERVISOR_TIENDA", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"].includes(role ?? "");
  const canChangeOperationalState = ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"].includes(role ?? "");
  const canCreate = ["TIENDA", "SUPERVISOR_TIENDA"].includes(role ?? "");

  const [items, setItems] = useState<DespachoTienda[]>([]);
  const [loading, setLoading] = useState(true);
  const toastCtx = useToast();
  const { prompt, promptModal } = usePrompt();

  const [fq, setFq] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fCC, setFCC] = useState("");
  const [debugTable, setDebugTable] = useState(false);

  const [panelItem, setPanelItem] = useState<DespachoTienda | null>(null);
  useListDetailScroll(panelItem !== null);
  const [panelHistorial, setPanelHistorial] = useState<HistorialEntry[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [creando, setCreando] = useState(false);
  const [editing, setEditing] = useState<DespachoTienda | null>(null);
  const [deleting, setDeleting] = useState<DespachoTienda | null>(null);
  const [asignandoGuardado, setAsignandoGuardado] = useState<DespachoTienda | null>(null);
  const [rechazarItem, setRechazarItem] = useState<DespachoTienda | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/tienda?pageSize=500");
      const json = await res.json();
      if (json.success) setItems(json.data);
    } catch { showToast("Error al cargar", true); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  // Modo debug de tabla: /dashboard/tienda?debugTable=1 (diagnóstico de mapeo de columnas).
  useEffect(() => { setDebugTable(new URLSearchParams(window.location.search).get("debugTable") === "1"); }, []);

  const autoRefresh = useAutoRefresh({
    pause: Boolean(creando || editing || panelItem || rechazarItem || deleting || asignandoGuardado),
    onRefresh: () => load(),
  });

  function showToast(msg: string, err = false) { err ? toastCtx.error(msg) : toastCtx.success(msg); }

  async function abrirPanel(d: DespachoTienda) {
    // d (fila de lista) ya trae el encabezado → el panel nunca arranca vacío.
    setPanelItem(d);
    setPanelHistorial([]);
    setPanelLoading(true);
    try {
      const res = await fetch(`/api/tienda/${d.id}`);
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        // Mergea el detalle sobre d (nunca reemplaza por algo más pobre) y
        // protege contra carreras si el usuario abrió otra factura entretanto.
        setPanelItem((prev) => (prev?.id === d.id ? { ...d, ...json.data } : prev));
        setPanelHistorial(json.historial ?? []);
      } else {
        showToast(json.error || "No se pudo cargar el detalle", true); // se conserva d
      }
    } catch {
      showToast("No se pudo cargar el detalle completo", true);        // se conserva d
    } finally {
      setPanelLoading(false);
    }
  }

  async function cambiarEstado(d: DespachoTienda, estado: EstadoDespacho, extra?: Record<string, unknown>) {
    const body: Record<string, unknown> = { estado, ...extra };
    const res = await fetch(`/api/tienda/${d.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.success) {
      setItems((prev) => prev.map((x) => x.id === d.id ? json.data : x));
      if (panelItem?.id === d.id) { setPanelItem(json.data); abrirPanel(json.data); }
      showToast(`Estado actualizado: ${ESTADO_DESPACHO_LABEL[estado]} ✓`);
    } else showToast(json.error || "Error", true);
  }

  async function asignarAGuardado(d: DespachoTienda, asignadoAId: string, nota: string | null) {
    const res = await fetch(`/api/tienda/${d.id}/guardado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asignadoAId, nota }),
    });
    const json = await res.json();
    if (json.success) {
      setAsignandoGuardado(null);
      await load();
      if (panelItem?.id === d.id) abrirPanel(d);
      showToast("Despacho enviado a guardado");
    } else showToast(json.error || "Error", true);
  }

  const rechazados = useMemo(() => items.filter((d) => d.estado === "RECHAZADO"), [items]);

  async function reenviarDespacho(id: string) {
    const res = await fetch(`/api/tienda/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "CREADO_TIENDA" }),
    });
    if (res.ok) { await load(); showToast("Solicitud re-enviada ✓"); }
    else { showToast("Error al re-enviar", true); }
  }

  const globalInsights = useMemo(() => insightsTienda(items), [items]);
  const panelInsights  = useMemo(() => panelItem ? insightsPorDespacho(panelItem, items) : [], [panelItem, items]);

  const kpis = useMemo(() => ({
    total:             items.length,
    creadosTienda:     items.filter((d) => d.estado === "CREADO_TIENDA").length,
    recogidoTienda:    items.filter((d) => d.estado === "RECOGIDO_TIENDA").length,
    entregadoCedi:     items.filter((d) => d.estado === "ENTREGADO_CEDI").length,
    enviadoCliente:    items.filter((d) => d.estado === "ENVIADO_CLIENTE").length,
    novedades:         items.filter((d) => d.estado === "CON_NOVEDAD").length,
    pendientesRecogida: items.filter((d) => d.estado === "CREADO_TIENDA").length,
  }), [items]);

  const centrosCostos = useMemo(() => [...new Set(items.map((d) => d.centroCostos))].sort(), [items]);

  // Solo filtra; el ordenamiento interactivo lo gestiona <DataTable> (DS).
  const filtered = useMemo(() => {
    const q = fq.toLowerCase();
    return items.filter((d) => {
      if (fEstado && d.estado !== fEstado) return false;
      if (fCC && d.centroCostos !== fCC) return false;
      if (q && !d.numeroDocumento.toLowerCase().includes(q) && !d.clienteNombre.toLowerCase().includes(q) && !d.consecutivo.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, fq, fEstado, fCC]);

  // Historial timeline del panel
  const historialItems = panelHistorial.map((h) => ({
    label: h.details ?? h.action,
    meta: h.userName ?? "Sistema",
    time: h.createdAt ? new Date(h.createdAt).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "",
    color: h.action === "CREATE" ? "var(--brand)" : h.action === "DELETE" ? "var(--error)" : "var(--muted2)",
  }));

  return (
    <div className={`animate-fade-in ${styles.page}`} style={getModuleCssVars("tienda") as React.CSSProperties}>
      <ModuleHero
        moduleKey="tienda"
        kicker="Flujo tienda CEDI"
        title="Facturas Contado"
        description={loading ? "Cargando..." : `${items.length} registros · ${kpis.pendientesRecogida} creados en tienda`}
        actions={
          <div className={styles.heroActions}>
            <AutoRefreshIndicator
              lastUpdatedAt={autoRefresh.lastUpdatedAt}
              refreshing={autoRefresh.refreshing}
              onRefresh={autoRefresh.refreshNow}
            />
            <button className={`ds-btn ds-btn-primary ${styles.heroPrimary}`} onClick={() => setCreando(true)}>
              <Plus size={14} />Nueva Factura
            </button>
          </div>
        }
      />

      {!panelItem && (
        <>
      <FacturaKpiGrid loading={loading} kpis={kpis} onEstado={setFEstado} />

      {!loading && (
        <EstadoPipeline
          items={items}
          activeEstado={fEstado}
          onToggle={(estado) => setFEstado(fEstado === estado ? "" : estado)}
        />
      )}

      {!loading && (
        <FacturaIntelBanner
          insights={globalInsights}
          onOpenFirst={() => {
            const target = globalInsights[0]?.recordId
              ? items.find((d) => d.id === globalInsights[0].recordId)
              : undefined;
            if (target) abrirPanel(target);
          }}
        />
      )}

      {!loading && canCreate && (
        <RejectedQueue
          rejected={rechazados}
          onOpen={abrirPanel}
          onEdit={setEditing}
          onResend={reenviarDespacho}
        />
      )}

      <FacturaFilterBar
        query={fq}
        estado={fEstado}
        centro={fCC}
        centros={centrosCostos}
        count={filtered.length}
        total={items.length}
        onQuery={setFq}
        onEstado={setFEstado}
        onCentro={setFCC}
        onClear={() => { setFq(""); setFEstado(""); setFCC(""); }}
      />

      <FacturasTable
        loading={loading}
        items={filtered}
        allCount={items.length}
        selectedId={undefined}
        onOpen={abrirPanel}
        onClearFilters={() => { setFq(""); setFEstado(""); setFCC(""); }}
        debug={debugTable}
      />
        </>
      )}

      {panelItem && (
        <ModuleDetailView
          testId="factura-detalle-view"
          onBack={() => setPanelItem(null)}
          title={panelItem.numeroDocumento || "Factura sin número"}
          subtitle={[panelItem.centroCostos, panelItem.consecutivo && `#${panelItem.consecutivo}`].filter(Boolean).join(" · ") || undefined}
          moduleColor={ESTADO_DESPACHO_COLOR[panelItem.estado]}
          badge={<Badge label={ESTADO_DESPACHO_LABEL[panelItem.estado]} variant={estadoDespachoVariant(panelItem.estado)} color={ESTADO_DESPACHO_COLOR[panelItem.estado]} />}
          actions={
            <>
              {canChangeOperationalState && ESTADOS_ACTIVOS.includes(panelItem.estado) && (
                <button className="ds-btn ds-btn-sm ds-btn-secondary" style={{ color: "var(--error)" }}
                  onClick={async () => {
                    const novedad = await prompt({ title: "Registrar novedad", label: "Describe la novedad:", placeholder: "Detalle de la novedad", multiline: true, required: true, confirmLabel: "Registrar" });
                    if (novedad !== null) cambiarEstado(panelItem, "CON_NOVEDAD", { novedad });
                  }}>
                  <AlertTriangle size={13} />Novedad
                </button>
              )}
              {canChangeOperationalState && panelItem.estado === "CREADO_TIENDA" && (
                <button className="ds-btn ds-btn-sm ds-btn-secondary" style={{ color: "var(--error)" }}
                  onClick={() => setRechazarItem(panelItem)}>
                  Rechazar
                </button>
              )}
              {canChangeOperationalState && panelItem.estado === "ENTREGADO_CEDI" && !panelItem.guardadoPendiente && (
                <button className="ds-btn ds-btn-sm ds-btn-secondary" style={{ color: COLOR_TRANSPORTE }}
                  onClick={() => setAsignandoGuardado(panelItem)}>
                  <UserPlus size={13} />Enviar a guardado
                </button>
              )}
              {canEditBasic && (panelItem.estado === "RECHAZADO" || (panelItem.estado === "CREADO_TIENDA" && role !== "TIENDA") || canEdit) && <button className="ds-btn ds-btn-sm ds-btn-secondary" onClick={() => setEditing(panelItem)}><Pencil size={13} /></button>}
              {canDelete && (
                <button className="ds-btn ds-btn-sm ds-btn-secondary" style={{ color: "var(--error)" }} onClick={() => setDeleting(panelItem)} title="Eliminar">
                  <Trash2 size={13} />
                </button>
              )}
              {canChangeOperationalState && panelItem.estado === "CREADO_TIENDA" ? (
                <button className="ds-btn ds-btn-primary" style={{ background: "var(--info)" }} onClick={() => cambiarEstado(panelItem, "RECOGIDO_TIENDA")}>
                  <Truck size={13} />Marcar como Recogido
                </button>
              ) : canChangeOperationalState && panelItem.estado === "RECOGIDO_TIENDA" ? (
                <button className="ds-btn ds-btn-primary" style={{ background: COLOR_CEDI }} onClick={() => cambiarEstado(panelItem, "ENTREGADO_CEDI")}>
                  <PackageCheck size={13} />Entregado en CEDI
                </button>
              ) : canChangeOperationalState && panelItem.estado === "ENTREGADO_CEDI" ? (
                <button className="ds-btn ds-btn-primary" style={{ background: "var(--success)" }} onClick={() => cambiarEstado(panelItem, "ENVIADO_CLIENTE")}>
                  <CheckCircle2 size={13} />Marcar enviado al cliente
                </button>
              ) : canCreate && panelItem.estado === "RECHAZADO" ? (
                <button className="ds-btn ds-btn-primary" style={{ background: COLOR_TIENDA }} onClick={() => reenviarDespacho(panelItem.id)}>
                  <CheckCircle2 size={13} />Re-enviar solicitud
                </button>
              ) : null}
            </>
          }
        >
          {panelInsights.length > 0 && (
            <IntelBanner insights={panelInsights} title="Inteligencia operacional" />
          )}
          <>
            <DetailSection title="Flujo logístico" color={panelItem.estado === "RECHAZADO" ? ESTADO_DESPACHO_COLOR.RECHAZADO : COLOR_TIENDA}>
              <DetailFlow estado={panelItem.estado} />
              {panelItem.estado === "CON_NOVEDAD" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, padding: "6px 10px", background: "var(--error-tint)", borderRadius: 8, fontSize: 12, color: "var(--error)", fontWeight: 600 }}>
                  <AlertTriangle size={13} />Flujo interrumpido por novedad
                </div>
              )}
            </DetailSection>

            <DetailSection title="Datos de la factura" color={COLOR_TIENDA}>
              <DetailGrid items={[
                { label: "Centro de costos",         value: <span style={{ fontWeight: 700 }}>{panelItem.centroCostos}</span> },
                { label: "Fecha creación",           value: fmtFechaTienda(panelItem.fechaCreacion) },
                { label: "N° Documento",             value: <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{panelItem.numeroDocumento}</span> },
                { label: "Consecutivo",              value: <span style={{ fontFamily: "var(--mono)" }}>#{panelItem.consecutivo}</span> },
                { label: "Entrega comprometida",     value: panelItem.fechaEntregaComprometida ? fmtFechaTienda(panelItem.fechaEntregaComprometida) : undefined },
                { label: "Número de cajas",          value: panelItem.numeroCajas != null ? String(panelItem.numeroCajas) : undefined },
                { label: "Recogido",                 value: panelItem.recibidoAt  ? new Date(panelItem.recibidoAt).toLocaleString("es-CO",  { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : undefined },
                { label: "Llegada CEDI",             value: panelItem.entregadoCediAt ? new Date(panelItem.entregadoCediAt).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : undefined },
                { label: "Enviado cliente",          value: panelItem.despachadoAt ? new Date(panelItem.despachadoAt).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : undefined },
                { label: "ID NetSuite",
                  value: (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {panelItem.netsuiteId
                        ? <NetSuiteChip id={panelItem.netsuiteId} />
                        : <span style={{ fontSize: 12, color: "var(--faint)" }}>Sin vincular</span>
                      }
                      {canEdit && (
                        <button className="ds-btn ds-btn-ghost ds-btn-sm" style={{ fontSize: 11, height: 22, color: "var(--muted)" }}
                          onClick={async () => {
                            const id = await prompt({ title: "ID NetSuite", label: "ID interno de NetSuite:", defaultValue: panelItem.netsuiteId ?? "", confirmLabel: "Guardar" });
                            if (id === null) return;
                            const val = id.trim() || null;
                            const r = await fetch(`/api/tienda/${panelItem.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ netsuiteId: val }) });
                            const j = await r.json();
                            if (j.success) { setPanelItem(p => p ? { ...p, netsuiteId: val } : p); setItems(prev => prev.map(d => d.id === panelItem.id ? { ...d, netsuiteId: val } : d)); showToast(val ? "ID NetSuite vinculado ✓" : "ID eliminado"); }
                          }}>
                          {panelItem.netsuiteId ? "Cambiar" : "Vincular"}
                        </button>
                      )}
                    </div>
                  )
                },
              ]} />
            </DetailSection>

            {panelItem.plines && panelItem.plines.length > 0 && (
              <DetailSection title={`PLUs de la factura (${panelItem.plines.length})`} color={COLOR_TIENDA}>
                <PluList plines={panelItem.plines} />
              </DetailSection>
            )}

            <DetailSection title="Cliente" color={ESTADO_DESPACHO_COLOR.RECOGIDO_TIENDA}>
              <DetailGrid items={[
                { label: "Nombre",    value: panelItem.clienteNombre },
                { label: "Documento", value: panelItem.clienteDocumento ?? undefined },
                { label: "Teléfono",  value: panelItem.clienteTelefono ?? undefined },
              ]} />
            </DetailSection>

            {panelItem.notaEntrega && (
              <DetailSection title="Nota de entrega" color={ESTADO_DESPACHO_COLOR.ENTREGADO_CEDI}>
                <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--muted)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  {panelItem.notaEntrega}
                </div>
              </DetailSection>
            )}

            {panelItem.guardadoPendiente && (
              <DetailSection title="Guardado transporte" color={COLOR_TRANSPORTE}>
                <DetailGrid items={[
                  { label: "Estado", value: panelItem.guardadoPendiente.estado },
                  { label: "Operario", value: panelItem.guardadoPendiente.asignadoANombre ?? panelItem.guardadoPendiente.asignadoAId },
                  { label: "Guardado", value: panelItem.guardadoPendiente.guardadoClientId ?? undefined },
                ]} />
              </DetailSection>
            )}

            {panelItem.motivoRechazo && (
              <DetailSection title="Motivo de rechazo" color={ESTADO_DESPACHO_COLOR.RECHAZADO}>
                <div style={{ background: "rgba(239,68,68,0.06)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--error)", display: "flex", gap: 8, borderLeft: "3px solid var(--error)" }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  {panelItem.motivoRechazo}
                </div>
              </DetailSection>
            )}

            {panelItem.novedad && (
              <DetailSection title="Novedad registrada" color={ESTADO_DESPACHO_COLOR.CON_NOVEDAD}>
                <div style={{ background: "var(--error-tint)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--error)", display: "flex", gap: 8 }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  {panelItem.novedad}
                </div>
              </DetailSection>
            )}

            {(historialItems.length > 0 || panelLoading) && (
              <DetailSection title="Timeline de cambios" color={COLOR_TIENDA}>
                {panelLoading && historialItems.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <SkeletonLine width="80%" />
                    <SkeletonLine width="60%" />
                    <SkeletonLine width="70%" />
                  </div>
                ) : (
                  <MiniHistory items={historialItems} />
                )}
              </DetailSection>
            )}
          </>
        </ModuleDetailView>
      )}

      {/* Modales */}
      {(creando || editing) && (
        <ModalDespacho
          despacho={editing ?? undefined}
          role={role}
          onClose={() => { setCreando(false); setEditing(null); }}
          onSaved={() => { setCreando(false); setEditing(null); load(); showToast(editing ? "Actualizado ✓" : "Factura registrada ✓"); }}
          onError={(m) => showToast(m, true)}
        />
      )}

      {deleting && (
        <ModalBase title="Eliminar factura" sub={`${deleting.numeroDocumento} · ${deleting.clienteNombre}`} onClose={() => setDeleting(null)}>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>Esta acción es permanente.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ds-btn ds-btn-secondary" style={{ flex: 1 }} onClick={() => setDeleting(null)}>Cancelar</button>
            <button className="ds-btn ds-btn-danger" style={{ flex: 1 }} onClick={async () => {
              const res = await fetch(`/api/tienda/${deleting.id}`, { method: "DELETE" });
              if (res.ok) { setDeleting(null); setPanelItem(null); load(); showToast("Eliminado"); }
              else showToast("Error", true);
            }}>Eliminar</button>
          </div>
        </ModalBase>
      )}

      {asignandoGuardado && (
        <ModalAsignarGuardado
          despacho={asignandoGuardado}
          onClose={() => setAsignandoGuardado(null)}
          onAsignado={(userId, nota) => asignarAGuardado(asignandoGuardado, userId, nota)}
          onError={(m) => showToast(m, true)}
        />
      )}

      {rechazarItem && (
        <ModalRechazar
          despacho={rechazarItem}
          onClose={() => setRechazarItem(null)}
          onRechazado={() => { setRechazarItem(null); setPanelItem(null); load(); showToast("Factura rechazada"); }}
        />
      )}

      {promptModal}
    </div>
  );
}

// Modal rechazar despacho
function ModalRechazar({ despacho, onClose, onRechazado }: {
  despacho: DespachoTienda;
  onClose: () => void;
  onRechazado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (motivo.trim().length < 5) { setError("Describe el motivo (mínimo 5 caracteres)"); return; }
    setSaving(true);
    const res = await fetch(`/api/tienda/${despacho.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "RECHAZADO", motivoRechazo: motivo.trim() }),
    });
    if (!res.ok) {
      const j = await res.json();
      setError(j.error || "Error al rechazar");
      setSaving(false);
      return;
    }
    onRechazado();
  }

  return (
    <ModalBase title="Rechazar solicitud" sub={`Doc. ${despacho.numeroDocumento} · ${despacho.clienteNombre}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
          La factura será devuelta al área de tienda con el motivo indicado para que pueda ser corregida y re-enviada.
        </p>
        <Field label="Motivo del rechazo *">
          <textarea
            value={motivo}
            onChange={(e) => { setMotivo(e.target.value); setError(""); }}
            rows={4}
            required
            placeholder="Ej: Los PLUs no corresponden al documento, favor corregir antes de re-enviar..."
            className={`ds-input${error ? " ds-input-error" : ""}`}
            style={{ minHeight: 96, height: "auto", paddingTop: 10, resize: "vertical" }}
          />
        </Field>
        {error && <p style={{ fontSize: 12, color: "var(--error)", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onClose} className="ds-btn ds-btn-secondary" style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" disabled={saving} className="ds-btn"
            style={{ flex: 2, background: "var(--error)", color: "#fff", border: "none" }}>
            {saving ? "Rechazando..." : "Confirmar rechazo"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

// Modal crear/editar
function ModalAsignarGuardado({ despacho, onClose, onAsignado, onError }: {
  despacho: DespachoTienda;
  onClose: () => void;
  onAsignado: (userId: string, nota: string | null) => Promise<void>;
  onError: (m: string) => void;
}) {
  const [usuarios, setUsuarios] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [userId, setUserId] = useState("");
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/users?role=TRANSPORTE")
      .then((r) => r.json())
      .then((j) => { if (j.success) setUsuarios(j.data ?? []); })
      .catch(() => onError("No se pudieron cargar operarios transporte"))
      .finally(() => setLoading(false));
  }, [onError]);

  return (
    <ModalBase title="Enviar a guardado" sub={`${despacho.numeroDocumento} - ${despacho.clienteNombre}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "18px 0", fontSize: 13, color: "var(--muted)" }}>Cargando operarios...</div>
        ) : (
          <>
            <Field label="Operario transporte *">
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className="ds-input">
                <option value="">Selecciona un operario</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.name} - {u.email}</option>)}
              </select>
            </Field>
            <Field label="Nota para guardado">
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Ubicación sugerida, instrucciones internas o contexto para el operario"
                className="ds-input" style={{ minHeight: 80, height: "auto", paddingTop: 10, resize: "vertical" }}
              />
            </Field>
            {despacho.notaEntrega && (
              <div style={{ padding: "10px 12px", background: "var(--surface2)", borderRadius: 8, fontSize: 12, color: "var(--muted)", whiteSpace: "pre-wrap" }}>
                {despacho.notaEntrega}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ds-btn ds-btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
              <button
                className="ds-btn ds-btn-primary"
                style={{ flex: 2, background: COLOR_TRANSPORTE }}
                disabled={!userId || saving}
                onClick={async () => {
                  if (!userId) { onError("Selecciona un operario transporte"); return; }
                  setSaving(true);
                  await onAsignado(userId, nota.trim() || null);
                  setSaving(false);
                }}
              >
                <UserPlus size={14} />{saving ? "Asignando..." : "Asignar pendiente"}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalBase>
  );
}

function ModalDespacho({ despacho, role, onClose, onSaved, onError }: {
  despacho?: DespachoTienda; role?: string; onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const isEdit = !!despacho;
  const [centroCostos,            setCC]     = useState(despacho?.centroCostos ?? "");
  const [numeroDocumento,         setDoc]    = useState(despacho?.numeroDocumento ?? "");
  const [consecutivo,             setCons]   = useState(despacho?.consecutivo ?? "");
  const [clienteNombre,           setCN]     = useState(despacho?.clienteNombre ?? "");
  const [clienteDocumento,        setCD]     = useState(despacho?.clienteDocumento ?? "");
  const [clienteTelefono,         setCT]     = useState(despacho?.clienteTelefono ?? "");
  const [fechaCreacion,           setFecha]  = useState(despacho?.fechaCreacion ?? todayISO());
  const [fechaEntrega,            setFEntrega]=useState(despacho?.fechaEntregaComprometida ?? "");
  const [numeroCajas,             setNCajas] = useState(despacho?.numeroCajas != null ? String(despacho.numeroCajas) : "");
  const [notaEntrega,             setNotaEntrega] = useState(despacho?.notaEntrega ?? "");
  const [plines, setPlines] = useState<Array<{ plu: string; descripcion: string; unidades: string; maestro?: boolean; status?: "idle" | "loading" | "found" | "missing"; override?: boolean }>>(
    despacho?.plines?.map((p) => ({ plu: p.plu, descripcion: p.descripcion ?? "", unidades: String(p.unidades), status: "idle" })) ?? []
  );
  const [saving, setSaving] = useState(false);

  function addPlin() { setPlines((prev) => [...prev, { plu: "", descripcion: "", unidades: "1", status: "idle" }]); }
  function removePlin(i: number) { setPlines((prev) => prev.filter((_, j) => j !== i)); }
  function updatePlin(i: number, key: string, val: string) { setPlines((prev) => prev.map((p, j) => j === i ? { ...p, [key]: val } : p)); }

  const isAdmin = role === "ADMIN";

  async function lookupPlinMaestro(i: number) {
    const current = plines[i];
    const normalized = current?.plu.trim().toUpperCase();
    if (!current || !normalized) return;
    setPlines((prev) => prev.map((p, j) => j === i ? { ...p, plu: normalized, status: "loading" } : p));
    try {
      const res = await fetch(`/api/productos-maestro/${encodeURIComponent(normalized)}`);
      const json = await res.json();
      if (res.ok && json.success) {
        const producto = json.data as ProductoMaestro;
        setPlines((prev) => prev.map((p, j) => j === i ? { ...p, descripcion: producto.descripcion ?? "", maestro: true, status: "found", override: false } : p));
      } else {
        setPlines((prev) => prev.map((p, j) => j === i ? { ...p, maestro: false, status: "missing" } : p));
      }
    } catch {
      setPlines((prev) => prev.map((p, j) => j === i ? { ...p, maestro: false, status: "missing" } : p));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!centroCostos.trim() || !numeroDocumento.trim() || !consecutivo.trim() || !clienteNombre.trim()) {
      onError("Completa los campos obligatorios"); return;
    }
    const plinesValidos = plines.filter((p) => p.plu.trim() && parseInt(p.unidades) > 0);
    setSaving(true);
    try {
      const url = isEdit ? `/api/tienda/${despacho!.id}` : "/api/tienda";
      const method = isEdit ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        centroCostos: centroCostos.trim(), numeroDocumento: numeroDocumento.trim(),
        consecutivo: consecutivo.trim(), clienteNombre: clienteNombre.trim(),
        clienteDocumento: clienteDocumento.trim() || null,
        clienteTelefono: clienteTelefono.trim() || null,
        fechaCreacion,
        fechaEntregaComprometida: fechaEntrega || null,
        numeroCajas: numeroCajas ? parseInt(numeroCajas) : null,
        notaEntrega: notaEntrega.trim() || null,
      };
      if (!isEdit && plinesValidos.length > 0) {
        body.plines = plinesValidos.map((p) => ({ plu: p.plu.trim(), descripcion: p.descripcion.trim() || null, unidades: parseInt(p.unidades) }));
      }
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.success) onSaved(); else onError(json.error || "Error");
    } catch { onError("Error de conexión"); } finally { setSaving(false); }
  }

  return (
    <ModalBase title={isEdit ? "Editar factura" : "Nueva Factura"} sub={isEdit ? `${despacho!.numeroDocumento}` : undefined} onClose={onClose}>
      <form onSubmit={submit} className={styles.form}>
        <FormSection title="Información de la factura" icon={<Store size={14} />}>
          <div className={styles.grid2}>
            <Field label="Centro de costos *"><input value={centroCostos} onChange={(e) => setCC(e.target.value)} placeholder="CC-001" className="ds-input" /></Field>
            <Field label="Fecha creación *"><input type="date" value={fechaCreacion} onChange={(e) => setFecha(e.target.value)} className="ds-input" /></Field>
          </div>
          <div className={styles.gridDoc}>
            <Field label="N° Documento *"><input value={numeroDocumento} onChange={(e) => setDoc(e.target.value)} placeholder="FAC-0001" className="ds-input" /></Field>
            <Field label="Consecutivo *"><input value={consecutivo} onChange={(e) => setCons(e.target.value)} placeholder="001" className="ds-input" /></Field>
          </div>
        </FormSection>

        <FormSection title="Cliente y entrega" icon={<Truck size={14} />}>
          <Field label="Nombre del cliente *"><input value={clienteNombre} onChange={(e) => setCN(e.target.value)} className="ds-input" /></Field>
          <div className={styles.grid2}>
            <Field label="Documento cliente"><input value={clienteDocumento} onChange={(e) => setCD(e.target.value)} className="ds-input" /></Field>
            <Field label="Teléfono cliente"><input value={clienteTelefono} onChange={(e) => setCT(e.target.value)} placeholder="300..." className="ds-input" /></Field>
          </div>
          <div className={styles.grid2}>
            <Field label="Entrega comprometida"><input type="date" value={fechaEntrega} onChange={(e) => setFEntrega(e.target.value)} className="ds-input" /></Field>
            <Field label="Número de cajas"><input type="number" value={numeroCajas} onChange={(e) => setNCajas(e.target.value)} min="1" placeholder="0" className="ds-input" /></Field>
          </div>
          <Field label="Nota de entrega">
            <textarea
              value={notaEntrega}
              onChange={(e) => setNotaEntrega(e.target.value)}
              placeholder="Dirección, contacto, observaciones o instrucciones de entrega"
              className="ds-input" style={{ minHeight: 96, height: "auto", paddingTop: 10, resize: "vertical" }}
            />
          </Field>
        </FormSection>

        <FormSection title={`PLUs de la factura (${plines.length})`} icon={<Package size={14} />}>
          <div className={styles.pluEditor}>
            <div className={styles.pluEditorHead}>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>Autocompleta descripción desde maestro cuando exista el PLU.</span>
              <button type="button" className="ds-btn ds-btn-sm ds-btn-secondary" onClick={addPlin}>
                <Plus size={12} />Agregar PLU
              </button>
            </div>
          {plines.map((p, i) => (
            <div key={i}>
              <div className={styles.pluRow}>
                <input value={p.plu} onChange={(e) => { updatePlin(i, "plu", e.target.value); updatePlin(i, "status", "idle"); }} onBlur={() => lookupPlinMaestro(i)} placeholder="PLU" className="ds-input" />
                <input value={p.descripcion} onChange={(e) => updatePlin(i, "descripcion", e.target.value)} disabled={!!p.maestro && !p.override} placeholder="Descripción (opc.)" className="ds-input" style={{ opacity: p.maestro && !p.override ? 0.7 : 1 }} />
                <input type="number" value={p.unidades} onChange={(e) => updatePlin(i, "unidades", e.target.value)} min="1" placeholder="Uds." className="ds-input" />
                <button type="button" className="ds-btn ds-btn-danger ds-btn-sm" onClick={() => removePlin(i)} style={{ width: 34, padding: 0, justifyContent: "center" }}>
                  <Minus size={12} />
                </button>
              </div>
              {p.status && p.status !== "idle" && (
                <div className={`${styles.pluStatus} ${p.status === "found" ? styles.pluStatusFound : ""} ${p.status === "missing" ? styles.pluStatusMissing : ""}`}>
                  {p.status === "loading" && "Buscando PLU en maestro..."}
                  {p.status === "found" && "Datos cargados desde maestro"}
                  {p.status === "missing" && "PLU no encontrado en maestro"}
                  {p.status === "found" && isAdmin && !p.override && (
                    <button type="button" onClick={() => setPlines((prev) => prev.map((x, j) => j === i ? { ...x, override: true } : x))} className={styles.manualButton}>
                      Editar manualmente
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {plines.length === 0 && <p style={{ fontSize: 12, color: "var(--faint)", textAlign: "center", margin: "10px 0 0" }}>Sin PLUs - opcional</p>}
          </div>
        </FormSection>

        <div className={styles.modalActions}>
          <button type="button" className="ds-btn ds-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="ds-btn ds-btn-primary" disabled={saving} style={{ background: COLOR_TIENDA }}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Registrar Factura"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

