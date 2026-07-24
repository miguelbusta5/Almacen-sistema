"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle, Clock, FileText, Minus,
  Plus, RefreshCw, Search, Send, X,
} from "lucide-react";
import { ModuleHero } from "@/components/ui";
import { useConfirm } from "@/components/ui/useDialogs";
import { useListDetailScroll } from "@/hooks/useListDetailScroll";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { getModuleColor, getModuleCssVars } from "@/lib/moduleTheme";
import { puedeEliminarSolicitudTransporte, puedeGestionarSolicitudTransporte } from "@/lib/solicitudesTransporte";
import { canSeeModule } from "@/lib/modulePermissions";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useApi } from "@/hooks/useApi";
import { apiGet, apiSend, apiPost, apiPatch, apiDelete, buildQuery } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import {
  SolicitudesTable, SolicitudDetailPanel, Field, inputStyle, ESTADO_COLOR, SEMAFORO_COLOR,
  type Solicitud, type Estado, type PluLinea,
} from "./_components";

interface Catalogos {
  areas: string[];
  ciudades: string[];
  puntosRecogida: string[];
  tiposVenta: string[];
  zonas: string[];
  volumenes: string[];
  tiposMercancia: string[];
  ventanasEntrega: string[];
  tiposServicio: string[];
  transportadoras: string[];
}

const COLOR = getModuleColor("solicitudes-transporte");

const emptyPlu = (): PluLinea => ({ plu: "", descripcion: "", unidades: 1 });

const emptyForm = {
  fechaSolicitud: new Date().toISOString().slice(0, 10),
  areaSolicitante: "Despachos",
  areaOtro: "",
  solicitanteNombre: "",
  solicitanteCorreo: "",
  solicitanteTelefono: "",
  tipoVenta: "N/A",
  numeroPedido: "",
  facturaIntegracion: "",
  cobroFlete: false,
  valorFlete: "",
  cantidadCajas: "1",
  volumenEstimado: "Mediano",
  tipoMercancia: "Mixto",
  ciudadOrigen: "Bogota D.C.",
  zonaRecogida: "Urbana",
  direccionRecogida: "",
  puntoRecogida: "90 Cedi",
  puntoRecogidaOtro: "",
  ciudadEntrega: "Bogota D.C.",
  direccionEntrega: "",
  zonaEntrega: "Urbana",
  fechaPromesaEntrega: "",
  ventanaEntrega: "Horario A.M",
  restriccionHoraria: false,
  descripcionRestriccion: "",
  tipoServicio: "Entrega directa",
  tipoServicioOtro: "",
  observacionesSolicitante: "",
  plines: [emptyPlu()],
};

function SelectField({ value, onChange, options, required = true }: { value: string; onChange: (v: string) => void; options: string[]; required?: boolean }) {
  return (
    <select required={required} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

async function buscarProductoMaestro(plu: string): Promise<string | null> {
  const clean = plu.trim();
  if (!clean) return null;
  try {
    const json = await apiGet<{ data?: { descripcion?: string | null } }>(`/api/productos-maestro/${encodeURIComponent(clean)}`);
    return json?.data?.descripcion ?? null;
  } catch {
    return null;
  }
}

function SolicitudForm({ catalogos, initial, onClose, onSaved }: {
  catalogos: Catalogos | null;
  initial?: Solicitud | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => initial ? {
    ...emptyForm,
    ...initial,
    valorFlete: initial.valorFlete?.toString() ?? "",
    cantidadCajas: (initial.cantidadCajas ?? initial.unidades ?? 1).toString(),
    fechaPromesaEntrega: initial.fechaPromesaEntrega ?? "",
    cobroFlete: Boolean(initial.cobroFlete),
    restriccionHoraria: Boolean(initial.restriccionHoraria),
    plines: initial.plines?.length ? initial.plines.map((p) => ({ ...p, unidades: p.unidades || 1 })) : [emptyPlu()],
  } : emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const c = catalogos;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setPlu(index: number, patch: Partial<PluLinea>) {
    set("plines", form.plines.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function autocompletePlu(index: number) {
    const row = form.plines[index];
    const descripcion = await buscarProductoMaestro(row.plu);
    if (descripcion) setPlu(index, { descripcion });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      cantidadCajas: Number(form.cantidadCajas),
      unidades: Number(form.cantidadCajas),
      valorFlete: form.cobroFlete ? Number(form.valorFlete) : null,
      fechaPromesaEntrega: form.fechaPromesaEntrega,
      areaOtro: form.areaSolicitante === "Otro" ? form.areaOtro : null,
      puntoRecogidaOtro: form.puntoRecogida === "Otros" ? form.puntoRecogidaOtro : null,
      tipoServicioOtro: form.tipoServicio === "Otro" ? form.tipoServicioOtro : null,
      descripcionRestriccion: form.restriccionHoraria ? form.descripcionRestriccion : null,
      plines: form.plines.map((p) => ({
        plu: p.plu.trim(),
        descripcion: p.descripcion.trim(),
        unidades: Number(p.unidades),
      })),
    };
    try {
      await apiSend(initial ? `/api/solicitudes-transporte/${initial.id}` : "/api/solicitudes-transporte", initial ? "PATCH" : "POST", payload);
      setSaving(false);
      onSaved();
    } catch (err) {
      setSaving(false);
      setError(getErrorMessage(err, "No se pudo guardar"));
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 9000, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: 18, overflowY: "auto" }} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 980, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-xl)", padding: 20, display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text)", fontSize: 18 }}>{initial ? "Editar solicitud" : "Nueva solicitud de transporte"}</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>Todos los campos visibles son obligatorios.</p>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {error && <div style={{ padding: 10, borderRadius: 8, background: "var(--error-tint)", color: "var(--error)", fontSize: 13 }}>{error}</div>}

        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: COLOR }}>Información general</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
            <Field label="Fecha de solicitud"><input required type="date" value={form.fechaSolicitud} onChange={(e) => set("fechaSolicitud", e.target.value)} style={inputStyle} /></Field>
            <Field label="Area solicitante"><SelectField value={form.areaSolicitante} onChange={(v) => set("areaSolicitante", v)} options={c?.areas ?? [form.areaSolicitante]} /></Field>
            {form.areaSolicitante === "Otro" && <Field label="Otra area"><input required value={form.areaOtro ?? ""} onChange={(e) => set("areaOtro", e.target.value)} style={inputStyle} /></Field>}
            <Field label="Nombre solicitante"><input required value={form.solicitanteNombre} onChange={(e) => set("solicitanteNombre", e.target.value)} style={inputStyle} /></Field>
            <Field label="Correo corporativo"><input required type="email" value={form.solicitanteCorreo} onChange={(e) => set("solicitanteCorreo", e.target.value)} style={inputStyle} /></Field>
            <Field label="Contacto"><input required value={form.solicitanteTelefono ?? ""} onChange={(e) => set("solicitanteTelefono", e.target.value)} style={inputStyle} /></Field>
          </div>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: COLOR }}>Pedido y mercancía</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
            <Field label="Tipo de venta"><SelectField value={form.tipoVenta ?? "N/A"} onChange={(v) => set("tipoVenta", v)} options={c?.tiposVenta ?? ["N/A"]} /></Field>
            <Field label="Pedido / orden"><input required value={form.numeroPedido ?? ""} onChange={(e) => set("numeroPedido", e.target.value)} style={inputStyle} /></Field>
            <Field label="Factura integracion"><input value={form.facturaIntegracion ?? ""} onChange={(e) => set("facturaIntegracion", e.target.value)} style={inputStyle} /></Field>
            <Field label="Cantidad cajas"><input required type="number" min={1} value={form.cantidadCajas ?? "1"} onChange={(e) => set("cantidadCajas", e.target.value)} style={inputStyle} /></Field>
            <Field label="Volumen"><SelectField value={form.volumenEstimado ?? "Mediano"} onChange={(v) => set("volumenEstimado", v)} options={c?.volumenes ?? ["Mediano"]} /></Field>
            <Field label="Tipo mercancía"><SelectField value={form.tipoMercancia ?? "Mixto"} onChange={(v) => set("tipoMercancia", v)} options={c?.tiposMercancia ?? ["Mixto"]} /></Field>
            <Field label="Se cobro flete">
              <select required value={form.cobroFlete ? "SI" : "NO"} onChange={(e) => set("cobroFlete", e.target.value === "SI")} style={inputStyle}>
                <option value="NO">No</option>
                <option value="SI">Si</option>
              </select>
            </Field>
            {form.cobroFlete && <Field label="Valor flete"><input required type="number" min={0} value={form.valorFlete ?? ""} onChange={(e) => set("valorFlete", e.target.value)} style={inputStyle} /></Field>}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 12, color: "var(--muted2)" }}>PLUs</strong>
              <button type="button" onClick={() => set("plines", [...form.plines, emptyPlu()])} style={{ border: "none", background: `${COLOR}18`, color: COLOR, borderRadius: 8, height: 30, padding: "0 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <Plus size={13} /> Agregar PLU
              </button>
            </div>
            {form.plines.map((line, index) => (
              <div key={index} style={{ display: "grid", gridTemplateColumns: "120px 1fr 92px 34px", gap: 8, alignItems: "center" }}>
                <input required placeholder="PLU" value={line.plu} onBlur={() => autocompletePlu(index)} onChange={(e) => setPlu(index, { plu: e.target.value })} style={inputStyle} />
                <input required placeholder="Descripción" value={line.descripcion} onChange={(e) => setPlu(index, { descripcion: e.target.value })} style={inputStyle} />
                <input required type="number" min={1} placeholder="Unid." value={line.unidades} onChange={(e) => setPlu(index, { unidades: Math.max(1, Number(e.target.value) || 1) })} style={inputStyle} />
                <button type="button" disabled={form.plines.length === 1} onClick={() => set("plines", form.plines.filter((_, i) => i !== index))} style={{ width: 34, height: 34, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", borderRadius: 8, cursor: form.plines.length === 1 ? "not-allowed" : "pointer" }}>
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: COLOR }}>Origen y destino</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
            <Field label="Ciudad origen"><SelectField value={form.ciudadOrigen} onChange={(v) => set("ciudadOrigen", v)} options={c?.ciudades ?? [form.ciudadOrigen]} /></Field>
            <Field label="Zona recogida"><SelectField value={form.zonaRecogida ?? "Urbana"} onChange={(v) => set("zonaRecogida", v)} options={c?.zonas ?? ["Urbana"]} /></Field>
            <Field label="Direccion recogida"><input required value={form.direccionRecogida ?? ""} onChange={(e) => set("direccionRecogida", e.target.value)} style={inputStyle} /></Field>
            <Field label="Punto recogida"><SelectField value={form.puntoRecogida ?? "90 Cedi"} onChange={(v) => set("puntoRecogida", v)} options={c?.puntosRecogida ?? ["90 Cedi"]} /></Field>
            {form.puntoRecogida === "Otros" && <Field label="Otro punto"><input required value={form.puntoRecogidaOtro ?? ""} onChange={(e) => set("puntoRecogidaOtro", e.target.value)} style={inputStyle} /></Field>}
            <Field label="Ciudad entrega"><SelectField value={form.ciudadEntrega} onChange={(v) => set("ciudadEntrega", v)} options={c?.ciudades ?? [form.ciudadEntrega]} /></Field>
            <Field label="Direccion entrega"><input required value={form.direccionEntrega} onChange={(e) => set("direccionEntrega", e.target.value)} style={inputStyle} /></Field>
            <Field label="Zona entrega"><SelectField value={form.zonaEntrega ?? "Urbana"} onChange={(v) => set("zonaEntrega", v)} options={c?.zonas ?? ["Urbana"]} /></Field>
          </div>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: COLOR }}>Programacion y servicio</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
            <Field label="Fecha promesa"><input required type="date" value={form.fechaPromesaEntrega ?? ""} onChange={(e) => set("fechaPromesaEntrega", e.target.value)} style={inputStyle} /></Field>
            <Field label="Ventana entrega"><SelectField value={form.ventanaEntrega ?? "Horario A.M"} onChange={(v) => set("ventanaEntrega", v)} options={c?.ventanasEntrega ?? ["Horario A.M"]} /></Field>
            <Field label="Tipo servicio"><SelectField value={form.tipoServicio ?? "Entrega directa"} onChange={(v) => set("tipoServicio", v)} options={c?.tiposServicio ?? ["Entrega directa"]} /></Field>
            {form.tipoServicio === "Otro" && <Field label="Otro servicio"><input required value={form.tipoServicioOtro ?? ""} onChange={(e) => set("tipoServicioOtro", e.target.value)} style={inputStyle} /></Field>}
            <Field label="Restriccion horaria">
              <select required value={form.restriccionHoraria ? "SI" : "NO"} onChange={(e) => set("restriccionHoraria", e.target.value === "SI")} style={inputStyle}>
                <option value="NO">No</option>
                <option value="SI">Si</option>
              </select>
            </Field>
          </div>
          {form.restriccionHoraria && (
            <Field label="Descripción restricción">
              <textarea required value={form.descripcionRestriccion ?? ""} onChange={(e) => set("descripcionRestriccion", e.target.value)} rows={2} style={{ ...inputStyle, height: "auto", padding: 10 }} />
            </Field>
          )}
          <Field label="Observaciones">
            <textarea required value={form.observacionesSolicitante ?? ""} onChange={(e) => set("observacionesSolicitante", e.target.value)} rows={3} style={{ ...inputStyle, height: "auto", padding: 10 }} />
          </Field>
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}>Cancelar</button>
          <button disabled={saving} style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "none", background: COLOR, color: "white", fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Guardando..." : initial ? "Guardar cambios" : "Crear solicitud"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SolicitudesTransportePage() {
  const { data: session } = useSession();
  const user = session?.user as { role?: string; id?: string } | undefined;
  const role = user?.role;
  const userId = user?.id;
  const puedeVer = canSeeModule(role, "solicitudes-transporte");
  const isGestor = puedeGestionarSolicitudTransporte(role);
  const canDelete = puedeEliminarSolicitudTransporte(role);
  const { confirm, confirmModal } = useConfirm();
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [estado, setEstado] = useState("");
  const [selected, setSelected] = useState<Solicitud | null>(null);
  useListDetailScroll(selected !== null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Solicitud | null>(null);
  const [error, setError] = useState("");
  const [rejectText, setRejectText] = useState("");
  const [gestion, setGestion] = useState({ documentoNetSuite: "", stellaEstado: "PENDIENTE", transportadora: "", numeroGuia: "", fechaProgramacion: "", observacionTransporte: "" });
  const [debugTable, setDebugTable] = useState(false);

  // Modo debug de tabla: /dashboard/solicitudes-transporte?debugTable=1 (diagnóstico de mapeo de columnas).
  useEffect(() => { setDebugTable(new URLSearchParams(window.location.search).get("debugTable") === "1"); }, []);

  // ── Lectura SWR (estado reactivo en la key; query se aplica con Enter) ──────
  // key null cuando el rol no ve el módulo → SWR no dispara la petición (que
  // ahora responde 403) y la página no queda con un error de carga en pantalla.
  const listKey = puedeVer
    ? `/api/solicitudes-transporte${buildQuery({ q: appliedQuery, estado })}`
    : null;
  const { data: rowsData, isLoading: loading, error: rowsError, mutate: mutateRows } = useApi<{ data: Solicitud[] }>(listKey);
  const rows = useMemo(() => rowsData?.data ?? [], [rowsData]);
  const load = useCallback(() => { void mutateRows(); }, [mutateRows]);

  const kpis = useMemo(() => ({
    pendientes: rows.filter((r) => ["PENDIENTE", "REENVIADA"].includes(r.estado)).length,
    programadas: rows.filter((r) => r.estado === "PROGRAMADA").length,
    rechazadas: rows.filter((r) => r.estado === "RECHAZADA").length,
    alerta: rows.filter((r) => ["VENCIDO", "ALERTA"].includes(r.semaforo)).length,
  }), [rows]);
  const rechazadas = rows.filter((r) => r.estado === "RECHAZADA");

  useEffect(() => {
    if (rowsError) setError(getErrorMessage(rowsError, "No se pudieron cargar las solicitudes"));
  }, [rowsError]);

  useEffect(() => {
    if (!puedeVer) return;
    apiGet<{ data: Catalogos | null }>("/api/solicitudes-transporte/catalogos")
      .then((j) => setCatalogos(j.data ?? null))
      .catch(() => {});
  }, [puedeVer]);

  const autoRefresh = useAutoRefresh({
    enabled: puedeVer,
    pause: Boolean(showForm || editing || selected || rejectText.trim()),
    onRefresh: () => load(),
  });

  useEffect(() => {
    if (!selected) return;
    setGestion({
      documentoNetSuite: selected.documentoNetSuite ?? "",
      stellaEstado: selected.stellaEstado,
      transportadora: selected.transportadora ?? "",
      numeroGuia: selected.numeroGuia ?? "",
      fechaProgramacion: selected.fechaProgramacion ?? "",
      observacionTransporte: selected.observacionTransporte ?? "",
    });
    setRejectText("");
  }, [selected]);

  function canEditSelected(solicitud: Solicitud) {
    return canDelete || solicitud.creadoPorId === userId || isGestor;
  }

  async function saveGestion() {
    if (!selected) return;
    if (!gestion.transportadora) {
      setError("Selecciona una transportadora");
      return;
    }
    try {
      const json = await apiPatch<{ data: Solicitud }>(`/api/solicitudes-transporte/${selected.id}`, gestion);
      setSelected(json.data);
      await load();
    } catch (e) { setError(getErrorMessage(e, "No se pudo actualizar gestion")); }
  }

  async function rechazar() {
    if (!selected) return;
    try {
      const json = await apiPost<{ data: Solicitud }>(`/api/solicitudes-transporte/${selected.id}/rechazar`, { motivoRechazo: rejectText });
      setSelected(json.data);
      setRejectText("");
      await load();
    } catch (e) { setError(getErrorMessage(e, "No se pudo rechazar")); }
  }

  async function reenviar(solicitud: Solicitud) {
    try {
      const json = await apiPost<{ data: Solicitud }>(`/api/solicitudes-transporte/${solicitud.id}/reenviar`);
      setSelected(json.data);
      await load();
    } catch (e) { setError(getErrorMessage(e, "No se pudo reenviar")); }
  }

  async function borrarSolicitud(solicitud: Solicitud) {
    const ok = await confirm({
      title: "Archivar solicitud",
      message: "Esta solicitud se ocultará del módulo y conservará su historial. ¿Continuar?",
      confirmLabel: "Archivar",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiDelete(`/api/solicitudes-transporte/${solicitud.id}`, { deleteReason: "Eliminada desde interfaz" });
      setSelected(null);
      await load();
    } catch (e) { setError(getErrorMessage(e, "No se pudo borrar")); }
  }

  // Espejo del gate de servidor (puedeCrear/puedeVerSolicitudTransporte); los
  // roles OPERACIONES_* ya no tienen este módulo. Ver AGENTS.md: doble validación.
  if (!puedeVer) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>No tienes acceso a este módulo.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ ...getModuleCssVars("solicitudes-transporte"), display: "grid", gap: 18 } as React.CSSProperties}>
      <ModuleHero
        moduleKey="solicitudes-transporte"
        kicker="Control transporte"
        title="Solicitudes de Transporte"
        description="Bandeja interna para crear, programar, rechazar y cerrar servicios de transporte con prioridad y semáforo operativo."
        actions={
          <>
            <AutoRefreshIndicator
              lastUpdatedAt={autoRefresh.lastUpdatedAt}
              refreshing={autoRefresh.refreshing}
              onRefresh={autoRefresh.refreshNow}
            />
            <button onClick={() => { setEditing(null); setShowForm(true); }} className="ds-btn ds-btn-primary" style={{ height: 40 }}>
              <Plus size={16} /> Nueva solicitud
            </button>
          </>
        }
      />
      {selected ? (
        <SolicitudDetailPanel
          selected={selected}
          isGestor={isGestor}
          canEdit={canEditSelected(selected)}
          canDelete={canDelete}
          gestion={gestion}
          setGestion={setGestion}
          rejectText={rejectText}
          setRejectText={setRejectText}
          transportadoras={catalogos?.transportadoras ?? []}
          moduleColor={COLOR}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditing(selected); setShowForm(true); }}
          onDelete={() => borrarSolicitud(selected)}
          onReenviar={() => reenviar(selected)}
          onSaveGestion={saveGestion}
          onRechazar={rechazar}
        />
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLOR, marginBottom: 8 }}>
                <FileText size={22} />
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800 }}>Control transporte</span>
              </div>
              <h1 style={{ margin: 0, color: "var(--text)", fontSize: 28 }}>Bandeja operativa</h1>
              <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 14 }}>Servicio interno para entregas, recolecciones, traslados e inversa.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            {[
              ["Pendientes", kpis.pendientes, <Clock key="i" size={16} />, ESTADO_COLOR.PENDIENTE],
              ["Programadas", kpis.programadas, <Send key="i" size={16} />, ESTADO_COLOR.PROGRAMADA],
              ["Rechazadas", kpis.rechazadas, <AlertTriangle key="i" size={16} />, ESTADO_COLOR.RECHAZADA],
              ["Alertas", kpis.alerta, <AlertTriangle key="i" size={16} />, SEMAFORO_COLOR.ALERTA],
            ].map(([label, value, icon, color]) => (
              <div key={String(label)} className="ds-stat" style={{ "--stat-color": color as string } as React.CSSProperties}>
                <div style={{ display: "flex", justifyContent: "space-between", color: color as string }}>{icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 8 }}>{value as number}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{label as string}</div>
              </div>
            ))}
          </div>

          {rechazadas.length > 0 && !isGestor && (
            <div style={{ border: "1px solid color-mix(in srgb, var(--error) 25%, transparent)", background: "var(--error-tint)", borderRadius: 12, padding: 14 }}>
              <strong style={{ color: "var(--error)", fontSize: 13 }}>Solicitudes rechazadas por corregir</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {rechazadas.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", background: "var(--surface)", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 13, color: "var(--text)" }}>{r.numeroPedido ?? r.ciudadEntrega} - {r.motivoRechazo}</div>
                    <button onClick={() => { setEditing(r); setShowForm(true); }} style={{ border: "none", background: COLOR, color: "white", borderRadius: 8, height: 32, padding: "0 10px", cursor: "pointer" }}>Corregir</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 260px" }}>
              <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "var(--muted)" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setAppliedQuery(query.trim())} placeholder="Buscar por solicitante, pedido, ciudad, guia..." style={{ ...inputStyle, paddingLeft: 32, paddingRight: 32 }} />
              {/* Limpia también la búsqueda ya APLICADA con Enter, no solo el texto. */}
              {query && (
                <button
                  aria-label="Borrar búsqueda"
                  onClick={() => { setQuery(""); setAppliedQuery(""); }}
                  style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 28, height: 28, display: "grid", placeItems: "center", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", borderRadius: 6 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...inputStyle, width: 190 }}>
              <option value="">Todos los estados</option>
              {["PENDIENTE", "REENVIADA", "PROGRAMADA", "EFECTUADA", "RECHAZADA", "CANCELADA"].map((e) => <option key={e}>{e}</option>)}
            </select>
            <button onClick={load} style={{ height: 36, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: 8, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><RefreshCw size={14} /> Actualizar</button>
          </div>

          {error && <div style={{ color: "var(--error)", background: "var(--error-tint)", borderRadius: 8, padding: 10, fontSize: 13 }}>{error}</div>}

          <SolicitudesTable
            loading={loading}
            rows={rows}
            onOpen={(r) => setSelected(r)}
            debug={debugTable}
          />
        </>
      )}

      {showForm && (
        <SolicitudForm
          catalogos={catalogos}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => { setShowForm(false); setEditing(null); await load(); }}
        />
      )}

      {confirmModal}
    </div>
  );
}
