"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle2, Clock, FileText, Plus, RefreshCw, Search, Send, X } from "lucide-react";
import { EmptyState, SkeletonTable } from "@/components/ui";
import { getModuleColor } from "@/lib/moduleTheme";
import { puedeGestionarSolicitudTransporte } from "@/lib/solicitudesTransporte";

type Estado = "PENDIENTE" | "RECHAZADA" | "REENVIADA" | "PROGRAMADA" | "EFECTUADA" | "CANCELADA";
type StellaEstado = "PENDIENTE" | "PROGRAMADO" | "EFECTUADO" | "CANCELADO";

interface Solicitud {
  id: string;
  fechaSolicitud: string;
  areaSolicitante: string;
  areaOtro?: string | null;
  solicitanteNombre: string;
  solicitanteCorreo: string;
  solicitanteTelefono?: string | null;
  tipoVenta?: string | null;
  numeroPedido?: string | null;
  facturaIntegracion?: string | null;
  cobroFlete?: boolean | null;
  valorFlete?: number | null;
  unidades?: number | null;
  volumenEstimado?: string | null;
  tipoMercancia?: string | null;
  ciudadOrigen: string;
  zonaRecogida?: string | null;
  direccionRecogida?: string | null;
  puntoRecogida?: string | null;
  puntoRecogidaOtro?: string | null;
  ciudadEntrega: string;
  direccionEntrega: string;
  zonaEntrega?: string | null;
  fechaPromesaEntrega?: string | null;
  ventanaEntrega?: string | null;
  restriccionHoraria?: boolean | null;
  descripcionRestriccion?: string | null;
  tipoServicio?: string | null;
  tipoServicioOtro?: string | null;
  observacionesSolicitante?: string | null;
  estado: Estado;
  stellaEstado: StellaEstado;
  documentoNetSuite?: string | null;
  transportadora?: string | null;
  numeroGuia?: string | null;
  fechaProgramacion?: string | null;
  observacionTransporte?: string | null;
  prioridad?: "ALTO" | "MEDIO" | "BAJO" | null;
  semaforo: string;
  mesSolicitud?: string | null;
  motivoRechazo?: string | null;
  creadoPorId: string;
  creadoPorNombre?: string | null;
  gestionadoPorNombre?: string | null;
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
}

const COLOR = getModuleColor("solicitudes-transporte");
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
  unidades: "1",
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
};

function estadoColor(estado: Estado) {
  if (estado === "RECHAZADA" || estado === "CANCELADA") return "#DC2626";
  if (estado === "PROGRAMADA") return "#2563EB";
  if (estado === "EFECTUADA") return "#16A34A";
  if (estado === "REENVIADA") return "#D97706";
  return COLOR;
}

function semaforoColor(semaforo: string) {
  if (semaforo === "VENCIDO" || semaforo === "CANCELADO") return "#DC2626";
  if (semaforo === "ALERTA") return "#D97706";
  if (semaforo === "EFECTUADO" || semaforo === "NORMAL") return "#16A34A";
  return "#64748B";
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "4px 9px", fontSize: 11, fontWeight: 800, background: `${color}18`, color, border: `1px solid ${color}33` }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--muted2)" }}>
      {label}
      {children}
    </label>
  );
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
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
    unidades: initial.unidades?.toString() ?? "1",
    fechaPromesaEntrega: initial.fechaPromesaEntrega ?? "",
    cobroFlete: Boolean(initial.cobroFlete),
    restriccionHoraria: Boolean(initial.restriccionHoraria),
  } : emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const c = catalogos;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      valorFlete: form.valorFlete ? Number(form.valorFlete) : null,
      unidades: form.unidades ? Number(form.unidades) : null,
      fechaPromesaEntrega: form.fechaPromesaEntrega || null,
      areaOtro: form.areaSolicitante === "Otro" ? form.areaOtro : null,
      puntoRecogidaOtro: form.puntoRecogida === "Otros" ? form.puntoRecogidaOtro : null,
      tipoServicioOtro: form.tipoServicio === "Otro" ? form.tipoServicioOtro : null,
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
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 940, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, boxShadow: "var(--shadow-xl)", padding: 20, display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text)", fontSize: 18 }}>{initial ? "Corregir solicitud" : "Nueva solicitud de transporte"}</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>Formulario interno para centralizar servicios de transporte.</p>
          </div>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
        </div>

        {error && <div style={{ padding: 10, borderRadius: 8, background: "var(--error-tint)", color: "var(--error)", fontSize: 13 }}>{error}</div>}

        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: COLOR }}>Informacion general</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
            <Field label="Fecha de solicitud"><input required type="date" value={form.fechaSolicitud} onChange={(e) => set("fechaSolicitud", e.target.value)} style={inputStyle} /></Field>
            <Field label="Area solicitante"><SelectField value={form.areaSolicitante} onChange={(v) => set("areaSolicitante", v)} options={c?.areas ?? [form.areaSolicitante]} /></Field>
            {form.areaSolicitante === "Otro" && <Field label="Otra area"><input value={form.areaOtro ?? ""} onChange={(e) => set("areaOtro", e.target.value)} style={inputStyle} /></Field>}
            <Field label="Nombre solicitante"><input required value={form.solicitanteNombre} onChange={(e) => set("solicitanteNombre", e.target.value)} style={inputStyle} /></Field>
            <Field label="Correo corporativo"><input required type="email" value={form.solicitanteCorreo} onChange={(e) => set("solicitanteCorreo", e.target.value)} style={inputStyle} /></Field>
            <Field label="Contacto"><input value={form.solicitanteTelefono ?? ""} onChange={(e) => set("solicitanteTelefono", e.target.value)} style={inputStyle} /></Field>
          </div>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: COLOR }}>Pedido y mercancia</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
            <Field label="Tipo de venta"><SelectField value={form.tipoVenta ?? "N/A"} onChange={(v) => set("tipoVenta", v)} options={c?.tiposVenta ?? ["N/A"]} /></Field>
            <Field label="Pedido / orden"><input value={form.numeroPedido ?? ""} onChange={(e) => set("numeroPedido", e.target.value)} style={inputStyle} /></Field>
            <Field label="Factura integracion"><input value={form.facturaIntegracion ?? ""} onChange={(e) => set("facturaIntegracion", e.target.value)} style={inputStyle} /></Field>
            <Field label="Unidades"><input type="number" min={1} value={form.unidades ?? "1"} onChange={(e) => set("unidades", e.target.value)} style={inputStyle} /></Field>
            <Field label="Volumen"><SelectField value={form.volumenEstimado ?? "Mediano"} onChange={(v) => set("volumenEstimado", v)} options={c?.volumenes ?? ["Mediano"]} /></Field>
            <Field label="Tipo mercancia"><SelectField value={form.tipoMercancia ?? "Mixto"} onChange={(v) => set("tipoMercancia", v)} options={c?.tiposMercancia ?? ["Mixto"]} /></Field>
            <Field label="Valor flete"><input type="number" min={0} value={form.valorFlete ?? ""} onChange={(e) => set("valorFlete", e.target.value)} style={inputStyle} /></Field>
          </div>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: COLOR }}>Origen y destino</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
            <Field label="Ciudad origen"><SelectField value={form.ciudadOrigen} onChange={(v) => set("ciudadOrigen", v)} options={c?.ciudades ?? [form.ciudadOrigen]} /></Field>
            <Field label="Zona recogida"><SelectField value={form.zonaRecogida ?? "Urbana"} onChange={(v) => set("zonaRecogida", v)} options={c?.zonas ?? ["Urbana"]} /></Field>
            <Field label="Direccion recogida"><input value={form.direccionRecogida ?? ""} onChange={(e) => set("direccionRecogida", e.target.value)} style={inputStyle} /></Field>
            <Field label="Punto recogida"><SelectField value={form.puntoRecogida ?? "90 Cedi"} onChange={(v) => set("puntoRecogida", v)} options={c?.puntosRecogida ?? ["90 Cedi"]} /></Field>
            <Field label="Ciudad entrega"><SelectField value={form.ciudadEntrega} onChange={(v) => set("ciudadEntrega", v)} options={c?.ciudades ?? [form.ciudadEntrega]} /></Field>
            <Field label="Direccion entrega"><input required value={form.direccionEntrega} onChange={(e) => set("direccionEntrega", e.target.value)} style={inputStyle} /></Field>
            <Field label="Zona entrega"><SelectField value={form.zonaEntrega ?? "Urbana"} onChange={(v) => set("zonaEntrega", v)} options={c?.zonas ?? ["Urbana"]} /></Field>
          </div>
        </section>

        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, color: COLOR }}>Programacion y servicio</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
            <Field label="Fecha promesa"><input type="date" value={form.fechaPromesaEntrega ?? ""} onChange={(e) => set("fechaPromesaEntrega", e.target.value)} style={inputStyle} /></Field>
            <Field label="Ventana entrega"><SelectField value={form.ventanaEntrega ?? "Horario A.M"} onChange={(v) => set("ventanaEntrega", v)} options={c?.ventanasEntrega ?? ["Horario A.M"]} /></Field>
            <Field label="Tipo servicio"><SelectField value={form.tipoServicio ?? "Entrega directa"} onChange={(v) => set("tipoServicio", v)} options={c?.tiposServicio ?? ["Entrega directa"]} /></Field>
          </div>
          <Field label="Restriccion horaria">
            <textarea value={form.descripcionRestriccion ?? ""} onChange={(e) => set("descripcionRestriccion", e.target.value)} rows={2} style={{ ...inputStyle, height: "auto", padding: 10 }} />
          </Field>
          <Field label="Observaciones">
            <textarea value={form.observacionesSolicitante ?? ""} onChange={(e) => set("observacionesSolicitante", e.target.value)} rows={3} style={{ ...inputStyle, height: "auto", padding: 10 }} />
          </Field>
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}>Cancelar</button>
          <button disabled={saving} style={{ height: 38, padding: "0 16px", borderRadius: 8, border: "none", background: COLOR, color: "white", fontWeight: 700, cursor: "pointer" }}>
            {saving ? "Guardando..." : initial ? "Guardar correccion" : "Crear solicitud"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SolicitudesTransportePage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string; id?: string; name?: string; email?: string } | undefined)?.role;
  const isGestor = puedeGestionarSolicitudTransporte(role);
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

  async function saveGestion() {
    if (!selected) return;
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

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLOR, marginBottom: 8 }}>
            <FileText size={22} />
            <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800 }}>Control transporte</span>
          </div>
          <h1 style={{ margin: 0, color: "var(--text)", fontSize: 28, letterSpacing: "-0.04em" }}>Solicitudes de Transporte</h1>
          <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 14 }}>Servicio interno para entregas, recolecciones, traslados e inversa.</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ height: 40, border: "none", borderRadius: 10, background: COLOR, color: "#fff", padding: "0 16px", fontWeight: 800, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <Plus size={16} /> Nueva solicitud
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
        {[
          ["Pendientes", kpis.pendientes, <Clock key="i" size={16} />, COLOR],
          ["Programadas", kpis.programadas, <Send key="i" size={16} />, "#2563EB"],
          ["Rechazadas", kpis.rechazadas, <AlertTriangle key="i" size={16} />, "#DC2626"],
          ["Alertas", kpis.alerta, <AlertTriangle key="i" size={16} />, "#D97706"],
        ].map(([label, value, icon, color]) => (
          <div key={String(label)} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
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

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? <SkeletonTable rows={6} /> : rows.length === 0 ? (
          <EmptyState icon={<FileText size={28} />} title="Sin solicitudes" description="Crea la primera solicitud de transporte interna." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr style={{ background: "var(--surface2)", textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>
                  {["Solicitud", "Origen", "Destino", "Promesa", "Estado", "Semaforo", "Gestion"].map((h) => <th key={h} style={{ padding: "11px 12px" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setSelected(r)} style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13 }}>{r.numeroPedido || "Sin pedido"}</div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{r.solicitanteNombre} - {r.areaSolicitante}</div>
                    </td>
                    <td style={{ padding: 12, color: "var(--text)", fontSize: 13 }}>{r.ciudadOrigen}</td>
                    <td style={{ padding: 12, color: "var(--text)", fontSize: 13 }}>{r.ciudadEntrega}</td>
                    <td style={{ padding: 12, color: "var(--muted)", fontSize: 13 }}>{r.fechaPromesaEntrega ?? "Sin fecha"}</td>
                    <td style={{ padding: 12 }}><StatusBadge label={r.estado} color={estadoColor(r.estado)} /></td>
                    <td style={{ padding: 12 }}><StatusBadge label={r.semaforo} color={semaforoColor(r.semaforo)} /></td>
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
          <aside onClick={(e) => e.stopPropagation()} style={{ width: "min(560px,100vw)", height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--border)", padding: 20, overflowY: "auto", display: "grid", gap: 16, alignContent: "start" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>{selected.numeroPedido || "Solicitud transporte"}</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{selected.ciudadOrigen} {"->"} {selected.ciudadEntrega}</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {selected.motivoRechazo && (
              <div style={{ padding: 12, borderRadius: 10, background: "var(--error-tint)", color: "var(--error)", fontSize: 13 }}>
                <strong>Motivo de rechazo:</strong> {selected.motivoRechazo}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatusBadge label={selected.estado} color={estadoColor(selected.estado)} />
              <StatusBadge label={selected.semaforo} color={semaforoColor(selected.semaforo)} />
            </div>

            <section style={{ display: "grid", gap: 8, fontSize: 13, color: "var(--text)" }}>
              <strong>Datos de solicitud</strong>
              <span>Solicitante: {selected.solicitanteNombre} ({selected.solicitanteCorreo})</span>
              <span>Entrega: {selected.direccionEntrega}</span>
              <span>Servicio: {selected.tipoServicio ?? "N/A"} - {selected.tipoMercancia ?? "N/A"}</span>
              <span>Unidades: {selected.unidades ?? "N/A"} - Volumen: {selected.volumenEstimado ?? "N/A"}</span>
              {selected.observacionesSolicitante && <span>Observaciones: {selected.observacionesSolicitante}</span>}
            </section>

            {!isGestor && selected.estado === "RECHAZADA" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setEditing(selected); setShowForm(true); }} style={{ flex: 1, height: 36, border: "none", borderRadius: 8, background: COLOR, color: "white", fontWeight: 700, cursor: "pointer" }}>Corregir</button>
                <button onClick={() => reenviar(selected)} style={{ flex: 1, height: 36, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontWeight: 700, cursor: "pointer" }}>Reenviar</button>
              </div>
            )}

            {isGestor && (
              <section style={{ display: "grid", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <strong style={{ color: "var(--text)", fontSize: 14 }}>Gestion transporte</strong>
                <Field label="Stella / estado gestion">
                  <select value={gestion.stellaEstado} onChange={(e) => setGestion((g) => ({ ...g, stellaEstado: e.target.value }))} style={inputStyle}>
                    {["PENDIENTE", "PROGRAMADO", "EFECTUADO", "CANCELADO"].map((e) => <option key={e}>{e}</option>)}
                  </select>
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Documento NetSuite"><input value={gestion.documentoNetSuite} onChange={(e) => setGestion((g) => ({ ...g, documentoNetSuite: e.target.value }))} style={inputStyle} /></Field>
                  <Field label="Fecha programacion"><input type="date" value={gestion.fechaProgramacion} onChange={(e) => setGestion((g) => ({ ...g, fechaProgramacion: e.target.value }))} style={inputStyle} /></Field>
                  <Field label="Transportadora"><input value={gestion.transportadora} onChange={(e) => setGestion((g) => ({ ...g, transportadora: e.target.value }))} style={inputStyle} /></Field>
                  <Field label="Numero guia"><input value={gestion.numeroGuia} onChange={(e) => setGestion((g) => ({ ...g, numeroGuia: e.target.value }))} style={inputStyle} /></Field>
                </div>
                <Field label="Observacion transporte">
                  <textarea value={gestion.observacionTransporte} onChange={(e) => setGestion((g) => ({ ...g, observacionTransporte: e.target.value }))} rows={3} style={{ ...inputStyle, height: "auto", padding: 10 }} />
                </Field>
                <button onClick={saveGestion} style={{ height: 36, border: "none", borderRadius: 8, background: COLOR, color: "white", fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 7 }}><CheckCircle2 size={15} /> Guardar gestion</button>

                {!["EFECTUADA", "CANCELADA"].includes(selected.estado) && (
                  <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <Field label="Motivo rechazo">
                      <textarea value={rejectText} onChange={(e) => setRejectText(e.target.value)} rows={2} style={{ ...inputStyle, height: "auto", padding: 10 }} />
                    </Field>
                    <button onClick={rechazar} style={{ height: 36, border: "1px solid rgba(220,38,38,.35)", borderRadius: 8, background: "var(--error-tint)", color: "var(--error)", fontWeight: 700, cursor: "pointer" }}>Rechazar solicitud</button>
                  </div>
                )}
              </section>
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
