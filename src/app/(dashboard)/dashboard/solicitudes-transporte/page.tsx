"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle, CheckCircle2, Clock, FileText, Minus, Pencil,
  Plus, RefreshCw, Search, Send, Trash2, X,
} from "lucide-react";
import { Badge, EmptyState, SkeletonTable, ModuleHero } from "@/components/ui";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { getModuleColor, getModuleCssVars } from "@/lib/moduleTheme";
import { puedeEliminarSolicitudTransporte, puedeGestionarSolicitudTransporte } from "@/lib/solicitudesTransporte";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

type Estado = "PENDIENTE" | "RECHAZADA" | "REENVIADA" | "PROGRAMADA" | "EFECTUADA" | "CANCELADA";
type StellaEstado = "PENDIENTE" | "PROGRAMADO" | "EFECTUADO" | "CANCELADO";

interface PluLinea {
  id?: string;
  plu: string;
  descripcion: string;
  unidades: number;
}

interface Solicitud {
  id: string;
  fechaSolicitud: string;
  areaSolicitante: string;
  areaOtro?: string | null;
  solicitanteNombre: string;
  solicitanteCorreo: string;
  solicitanteTelefono: string;
  tipoVenta: string;
  numeroPedido: string;
  facturaIntegracion: string;
  cobroFlete: boolean;
  valorFlete?: number | null;
  cantidadCajas?: number | null;
  unidades?: number | null;
  volumenEstimado: string;
  tipoMercancia: string;
  ciudadOrigen: string;
  zonaRecogida: string;
  direccionRecogida: string;
  puntoRecogida: string;
  puntoRecogidaOtro?: string | null;
  ciudadEntrega: string;
  direccionEntrega: string;
  zonaEntrega: string;
  fechaPromesaEntrega: string;
  ventanaEntrega: string;
  restriccionHoraria: boolean;
  descripcionRestriccion?: string | null;
  tipoServicio: string;
  tipoServicioOtro?: string | null;
  observacionesSolicitante: string;
  estado: Estado;
  stellaEstado: StellaEstado;
  documentoNetSuite?: string | null;
  transportadora?: string | null;
  numeroGuia?: string | null;
  fechaProgramacion?: string | null;
  observacionTransporte?: string | null;
  prioridad?: "ALTO" | "MEDIO" | "BAJO" | null;
  semaforo: string;
  motivoRechazo?: string | null;
  creadoPorId: string;
  creadoPorNombre?: string | null;
  gestionadoPorNombre?: string | null;
  deletedAt?: string | null;
  plines: PluLinea[];
  updatedAt: string;
}

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
const ESTADO_COLOR: Record<Estado, string> = {
  PENDIENTE: "#7C3AED",
  REENVIADA: "#0891B2",
  PROGRAMADA: "#2563EB",
  EFECTUADA: "#16A34A",
  RECHAZADA: "#DC2626",
  CANCELADA: "#64748B",
};
const SEMAFORO_COLOR: Record<string, string> = {
  VENCIDO: "#DC2626",
  ALERTA: "#D97706",
  NORMAL: "#16A34A",
  EFECTUADO: "#16A34A",
  CANCELADO: "#64748B",
  SIN_FECHA: "#7C3AED",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface2)",
  color: "var(--text)",
  padding: "0 10px",
  fontSize: 13,
  outline: "none",
};

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

type BadgeVariant = "default" | "info" | "success" | "warning" | "error";
function estadoVariant(estado: Estado): BadgeVariant {
  if (estado === "RECHAZADA" || estado === "CANCELADA") return "error";
  if (estado === "EFECTUADA") return "success";
  if (estado === "PROGRAMADA") return "info";
  return "default";
}
function semaforoVariant(semaforo: string): BadgeVariant {
  if (semaforo === "VENCIDO" || semaforo === "CANCELADO") return "error";
  if (semaforo === "ALERTA") return "warning";
  if (semaforo === "EFECTUADO" || semaforo === "NORMAL") return "success";
  return "default";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--muted2)" }}>
      {label}
      {children}
    </label>
  );
}

function SelectField({ value, onChange, options, required = true }: { value: string; onChange: (v: string) => void; options: string[]; required?: boolean }) {
  return (
    <select required={required} value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function DetailSection({ title, children, color = COLOR }: { title: string; children: React.ReactNode; color?: string }) {
  return (
    <section className="detail-section" style={{ display: "grid", gap: 9, "--section-color": color } as React.CSSProperties}>
      <strong style={{ color: "var(--text)", fontSize: 14 }}>{title}</strong>
      <div style={{ display: "grid", gap: 7, fontSize: 13, color: "var(--text)" }}>{children}</div>
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span>{value || "N/A"}</span>
    </div>
  );
}

async function buscarProductoMaestro(plu: string): Promise<string | null> {
  const clean = plu.trim();
  if (!clean) return null;
  const res = await fetch(`/api/productos-maestro/${encodeURIComponent(clean)}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.descripcion ?? null;
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
    const res = await fetch(initial ? `/api/solicitudes-transporte/${initial.id}` : "/api/solicitudes-transporte", {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "No se pudo guardar");
      return;
    }
    onSaved();
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
  const isGestor = puedeGestionarSolicitudTransporte(role);
  const canDelete = puedeEliminarSolicitudTransporte(role);
  const [rows, setRows] = useState<Solicitud[]>([]);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState("");
  const [selected, setSelected] = useState<Solicitud | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Solicitud | null>(null);
  const [error, setError] = useState("");
  const [rejectText, setRejectText] = useState("");
  const [gestion, setGestion] = useState({ documentoNetSuite: "", stellaEstado: "PENDIENTE", transportadora: "", numeroGuia: "", fechaProgramacion: "", observacionTransporte: "" });

  const kpis = useMemo(() => ({
    pendientes: rows.filter((r) => ["PENDIENTE", "REENVIADA"].includes(r.estado)).length,
    programadas: rows.filter((r) => r.estado === "PROGRAMADA").length,
    rechazadas: rows.filter((r) => r.estado === "RECHAZADA").length,
    alerta: rows.filter((r) => ["VENCIDO", "ALERTA"].includes(r.semaforo)).length,
  }), [rows]);
  const rechazadas = rows.filter((r) => r.estado === "RECHAZADA");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (estado) params.set("estado", estado);
    const res = await fetch(`/api/solicitudes-transporte?${params.toString()}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "No se pudieron cargar las solicitudes");
      return;
    }
    setRows(json.data ?? []);
  }

  useEffect(() => {
    fetch("/api/solicitudes-transporte/catalogos")
      .then((r) => r.json())
      .then((j) => setCatalogos(j.data ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const autoRefresh = useAutoRefresh({
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
    const res = await fetch(`/api/solicitudes-transporte/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gestion),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "No se pudo actualizar gestion");
      return;
    }
    setSelected(json.data);
    await load();
  }

  async function rechazar() {
    if (!selected) return;
    const res = await fetch(`/api/solicitudes-transporte/${selected.id}/rechazar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivoRechazo: rejectText }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "No se pudo rechazar");
      return;
    }
    setSelected(json.data);
    setRejectText("");
    await load();
  }

  async function reenviar(solicitud: Solicitud) {
    const res = await fetch(`/api/solicitudes-transporte/${solicitud.id}/reenviar`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "No se pudo reenviar");
      return;
    }
    setSelected(json.data);
    await load();
  }

  async function borrarSolicitud(solicitud: Solicitud) {
    if (!window.confirm("Esta solicitud se ocultara del modulo y conservara historial. ¿Continuar?")) return;
    const res = await fetch(`/api/solicitudes-transporte/${solicitud.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteReason: "Eliminada desde interfaz" }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "No se pudo borrar");
      return;
    }
    setSelected(null);
    await load();
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
        <div style={{ border: "1px solid rgba(220,38,38,.25)", background: "var(--error-tint)", borderRadius: 12, padding: 14 }}>
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Buscar por solicitante, pedido, ciudad, guia..." style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...inputStyle, width: 190 }}>
          <option value="">Todos los estados</option>
          {["PENDIENTE", "REENVIADA", "PROGRAMADA", "EFECTUADA", "RECHAZADA", "CANCELADA"].map((e) => <option key={e}>{e}</option>)}
        </select>
        <button onClick={load} style={{ height: 36, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: 8, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><RefreshCw size={14} /> Actualizar</button>
      </div>

      {error && <div style={{ color: "var(--error)", background: "var(--error-tint)", borderRadius: 8, padding: 10, fontSize: 13 }}>{error}</div>}

      <div className="op-table-wrap" style={{ "--module-color": COLOR, overflow: "hidden" } as React.CSSProperties}>
        {loading ? <SkeletonTable rows={6} /> : rows.length === 0 ? (
          <EmptyState icon={<FileText size={28} />} title="Sin solicitudes" description="Crea la primera solicitud de transporte interna." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="ds-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ background: "var(--surface2)", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>
                  {["Solicitud", "Origen", "Destino", "Cajas", "Promesa", "Estado", "Semáforo", "Gestión"].map((h) => <th key={h} style={{ padding: "11px 12px" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    style={{
                      borderTop: "1px solid var(--border)",
                      cursor: "pointer",
                      "--row-color": ESTADO_COLOR[r.estado],
                    } as React.CSSProperties}
                  >
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13 }}>{r.numeroPedido || "Sin pedido"}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.solicitanteNombre} - {r.areaSolicitante}</div>
                    </td>
                    <td style={{ padding: 12, color: "var(--text)", fontSize: 13 }}>{r.ciudadOrigen}</td>
                    <td style={{ padding: 12, color: "var(--text)", fontSize: 13 }}>{r.ciudadEntrega}</td>
                    <td style={{ padding: 12, color: "var(--text)", fontSize: 13 }}>{r.cantidadCajas ?? r.unidades ?? "N/A"}</td>
                    <td style={{ padding: 12, color: "var(--muted)", fontSize: 13 }}>{r.fechaPromesaEntrega ?? "Sin fecha"}</td>
                    <td style={{ padding: 12 }}><Badge label={r.estado} variant={estadoVariant(r.estado)} dot={false} color={ESTADO_COLOR[r.estado]} /></td>
                    <td style={{ padding: 12 }}><Badge label={r.semaforo} variant={semaforoVariant(r.semaforo)} color={SEMAFORO_COLOR[r.semaforo] ?? COLOR} /></td>
                    <td style={{ padding: 12, color: "var(--muted)", fontSize: 12 }}>{r.transportadora || r.gestionadoPorNombre || "Pendiente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 8500, background: "rgba(0,0,0,.35)", display: "flex", justifyContent: "flex-end" }} onClick={() => setSelected(null)}>
          <aside onClick={(e) => e.stopPropagation()} className="slide-panel" style={{ width: "min(640px,100vw)", height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--border)", padding: 20, overflowY: "auto", display: "grid", gap: 16, alignContent: "start", "--panel-color": ESTADO_COLOR[selected.estado] } as React.CSSProperties}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>{selected.numeroPedido || "Solicitud transporte"}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{selected.ciudadOrigen} {"->"} {selected.ciudadEntrega}</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge label={selected.estado} variant={estadoVariant(selected.estado)} dot={false} color={ESTADO_COLOR[selected.estado]} />
              <Badge label={selected.semaforo} variant={semaforoVariant(selected.semaforo)} color={SEMAFORO_COLOR[selected.semaforo] ?? COLOR} />
              {canEditSelected(selected) && (
                <button onClick={() => { setEditing(selected); setShowForm(true); }} style={{ height: 30, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface2)", color: "var(--text)", display: "flex", alignItems: "center", gap: 6, padding: "0 10px", cursor: "pointer" }}>
                  <Pencil size={13} /> Editar
                </button>
              )}
              {canDelete && (
                <button onClick={() => borrarSolicitud(selected)} style={{ height: 30, border: "1px solid rgba(220,38,38,.35)", borderRadius: 8, background: "var(--error-tint)", color: "var(--error)", display: "flex", alignItems: "center", gap: 6, padding: "0 10px", cursor: "pointer" }}>
                  <Trash2 size={13} /> Borrar
                </button>
              )}
            </div>

            {selected.motivoRechazo && (
              <div style={{ padding: 12, borderRadius: 10, background: "var(--error-tint)", color: "var(--error)", fontSize: 13 }}>
                <strong>Motivo de rechazo:</strong> {selected.motivoRechazo}
              </div>
            )}

            <DetailSection title="Información general" color={COLOR}>
              <DetailLine label="Fecha solicitud" value={selected.fechaSolicitud} />
              <DetailLine label="Area" value={selected.areaSolicitante === "Otro" ? selected.areaOtro : selected.areaSolicitante} />
              <DetailLine label="Solicitante" value={selected.solicitanteNombre} />
              <DetailLine label="Correo" value={selected.solicitanteCorreo} />
              <DetailLine label="Contacto" value={selected.solicitanteTelefono} />
            </DetailSection>

            <DetailSection title="Pedido y mercancía" color={ESTADO_COLOR.PENDIENTE}>
              <DetailLine label="Tipo venta" value={selected.tipoVenta} />
              <DetailLine label="Pedido / orden" value={selected.numeroPedido} />
              <DetailLine label="Factura integracion" value={selected.facturaIntegracion} />
              <DetailLine label="Cantidad cajas" value={selected.cantidadCajas ?? selected.unidades} />
              <DetailLine label="Volumen" value={selected.volumenEstimado} />
              <DetailLine label="Tipo mercancía" value={selected.tipoMercancia} />
              <DetailLine label="Flete" value={selected.cobroFlete ? `Si - $${selected.valorFlete ?? 0}` : "No"} />
            </DetailSection>

            <DetailSection title="PLUs" color={ESTADO_COLOR.REENVIADA}>
              {selected.plines?.length ? selected.plines.map((p, i) => (
                <div key={p.id ?? i} style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--surface2)" }}>
                  <strong>{p.plu}</strong>
                  <span>{p.descripcion}</span>
                  <span>{p.unidades} und.</span>
                </div>
              )) : <span style={{ color: "var(--muted)" }}>Sin PLUs registrados</span>}
            </DetailSection>

            <DetailSection title="Origen y destino" color={COLOR}>
              <DetailLine label="Ciudad origen" value={selected.ciudadOrigen} />
              <DetailLine label="Zona recogida" value={selected.zonaRecogida} />
              <DetailLine label="Direccion recogida" value={selected.direccionRecogida} />
              <DetailLine label="Punto recogida" value={selected.puntoRecogida === "Otros" ? selected.puntoRecogidaOtro : selected.puntoRecogida} />
              <DetailLine label="Ciudad entrega" value={selected.ciudadEntrega} />
              <DetailLine label="Direccion entrega" value={selected.direccionEntrega} />
              <DetailLine label="Zona entrega" value={selected.zonaEntrega} />
            </DetailSection>

            <DetailSection title="Programacion y servicio" color={SEMAFORO_COLOR.ALERTA}>
              <DetailLine label="Fecha promesa" value={selected.fechaPromesaEntrega} />
              <DetailLine label="Ventana" value={selected.ventanaEntrega} />
              <DetailLine label="Restriccion" value={selected.restriccionHoraria ? selected.descripcionRestriccion : "No"} />
              <DetailLine label="Tipo servicio" value={selected.tipoServicio === "Otro" ? selected.tipoServicioOtro : selected.tipoServicio} />
              <DetailLine label="Observaciones" value={selected.observacionesSolicitante} />
            </DetailSection>

            {!isGestor && selected.estado === "RECHAZADA" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setEditing(selected); setShowForm(true); }} style={{ flex: 1, height: 36, border: "none", borderRadius: 8, background: COLOR, color: "white", fontWeight: 700, cursor: "pointer" }}>Corregir</button>
                <button onClick={() => reenviar(selected)} style={{ flex: 1, height: 36, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontWeight: 700, cursor: "pointer" }}>Reenviar</button>
              </div>
            )}

            {isGestor && (
              <DetailSection title="Gestión transporte" color={ESTADO_COLOR.PROGRAMADA}>
                <Field label="Stella / estado gestion">
                  <select value={gestion.stellaEstado} onChange={(e) => setGestion((g) => ({ ...g, stellaEstado: e.target.value }))} style={inputStyle}>
                    {["PENDIENTE", "PROGRAMADO", "EFECTUADO", "CANCELADO"].map((e) => <option key={e}>{e}</option>)}
                  </select>
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Documento NetSuite"><input value={gestion.documentoNetSuite} onChange={(e) => setGestion((g) => ({ ...g, documentoNetSuite: e.target.value }))} style={inputStyle} /></Field>
                  <Field label="Fecha programación"><input type="date" value={gestion.fechaProgramacion} onChange={(e) => setGestion((g) => ({ ...g, fechaProgramacion: e.target.value }))} style={inputStyle} /></Field>
                  <Field label="Transportadora">
                    <select required value={gestion.transportadora} onChange={(e) => setGestion((g) => ({ ...g, transportadora: e.target.value }))} style={inputStyle}>
                      <option value="">Seleccionar</option>
                      {(catalogos?.transportadoras ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Número guía"><input value={gestion.numeroGuia} onChange={(e) => setGestion((g) => ({ ...g, numeroGuia: e.target.value }))} style={inputStyle} /></Field>
                </div>
                <Field label="Observacion transporte">
                  <textarea value={gestion.observacionTransporte} onChange={(e) => setGestion((g) => ({ ...g, observacionTransporte: e.target.value }))} rows={3} style={{ ...inputStyle, height: "auto", padding: 10 }} />
                </Field>
                <button onClick={saveGestion} style={{ height: 36, border: "none", borderRadius: 8, background: COLOR, color: "white", fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 7 }}><CheckCircle2 size={15} /> Guardar gestión</button>

                {!["EFECTUADA", "CANCELADA"].includes(selected.estado) && (
                  <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <Field label="Motivo rechazo">
                      <textarea value={rejectText} onChange={(e) => setRejectText(e.target.value)} rows={2} style={{ ...inputStyle, height: "auto", padding: 10 }} />
                    </Field>
                    <button onClick={rechazar} style={{ height: 36, border: "1px solid rgba(220,38,38,.35)", borderRadius: 8, background: "var(--error-tint)", color: "var(--error)", fontWeight: 700, cursor: "pointer" }}>Rechazar solicitud</button>
                  </div>
                )}
              </DetailSection>
            )}
          </aside>
        </div>
      )}

      {showForm && (
        <SolicitudForm
          catalogos={catalogos}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={async () => { setShowForm(false); setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}
