"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { can } from "@/lib/permissions";
import {
  ClipboardList, Plus, X, Upload, Users, BarChart3, List,
  ChevronRight, Download, RefreshCw, CheckCircle2, AlertTriangle,
  Settings, Play, Calculator, Trash2, Pencil, UserPlus,
} from "lucide-react";
import {
  CicloConteo, OperarioCiclo, LineaConteo,
  CICLO_ESTADO_LABEL, CICLO_ESTADO_COLOR, LINEA_ESTADO_LABEL, LINEA_ESTADO_COLOR,
  COLOR_CONTEO, fmtFecha, fmtNum, todayISO,
} from "@/lib/conteo";

type View = "ciclos" | "detalle" | "asignar" | "lineas" | "reconteo";

const inp: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "0.55rem 0.85rem",
  fontSize: 13, fontFamily: "var(--mono)", outline: "none", background: "var(--bg)",
  width: "100%", boxSizing: "border-box",
};
const iconBtn: React.CSSProperties = {
  background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7,
  padding: "5px 8px", cursor: "pointer", color: "var(--muted2)", display: "inline-flex", alignItems: "center",
};

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: color + "18", color }}>{label}</span>;
}

function Kpi({ label, val, color, sub }: { label: string; val: string | number; color: string; sub?: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${color}`, borderRadius: 12, padding: "0.9rem 1.1rem" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--mono)", color }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function ProgBar({ val, total, color }: { val: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round(val / total * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .4s" }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", minWidth: 36, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function Modal({ title, sub, children, onClose, wide }: { title: string; sub?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const [m, setM] = useState(false);
  useEffect(() => { setM(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);
  if (!m) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0f172a80", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "1rem" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: wide ? 680 : 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px #0f172a40" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "1.25rem 1.25rem 0.9rem", borderBottom: "1px solid var(--border)" }}>
          <div><h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{title}</h3>{sub && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{sub}</p>}</div>
          <button onClick={onClose} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 6, cursor: "pointer", color: "var(--muted2)", display: "flex" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "1.1rem 1.25rem 1.25rem" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>{label}</label>
    {children}
  </div>;
}

// ── Modal: Crear ciclo ────────────────────────────────
function ModalNuevoCiclo({ onClose, onCreado }: { onClose: () => void; onCreado: (c: CicloConteo) => void }) {
  const [nombre, setNombre] = useState(`Ciclo ${new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" })}`);
  const [fechaInicio, setFecha] = useState(todayISO());
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/conteo/ciclos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre, fechaInicio, notas: notas || null }) });
    const json = await res.json();
    if (json.success) onCreado(json.data); else alert(json.error);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} title="Nuevo ciclo de conteo">
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <Field label="Nombre *"><input value={nombre} onChange={(e) => setNombre(e.target.value)} style={inp} /></Field>
        <Field label="Fecha inicio *"><input type="date" value={fechaInicio} onChange={(e) => setFecha(e.target.value)} style={inp} /></Field>
        <Field label="Notas"><textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></Field>
        <button type="submit" disabled={saving} style={{ padding: "0.65rem", background: saving ? "#94a3b8" : COLOR_CONTEO, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Creando…" : "Crear ciclo"}
        </button>
      </form>
    </Modal>
  );
}

// ── Modal: Importar CSV ───────────────────────────────
function ModalImportar({ ciclo, onClose, onImportado }: { ciclo: CicloConteo; onClose: () => void; onImportado: (res: { totalLineas: number; fisicas: number; autoFill: number }) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resultado, setResultado] = useState<{ totalLineas: number; fisicas: number; autoFill: number } | null>(null);
  const [error, setError] = useState("");

  async function upload() {
    if (!file) return;
    setUploading(true); setError("");
    const form = new FormData();
    form.append("archivo", file);
    const res = await fetch(`/api/conteo/ciclos/${ciclo.id}/importar`, { method: "POST", body: form });
    const json = await res.json();
    if (json.success) { setResultado(json); onImportado(json); }
    else setError(json.error);
    setUploading(false);
  }

  return (
    <Modal onClose={onClose} title="Importar Teórico del WMS" sub={ciclo.nombre}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "0.85rem", fontSize: 12, color: "var(--muted2)", lineHeight: 1.6 }}>
          <strong>Columnas requeridas en el CSV/Excel:</strong><br />
          PLU o Artículo · Nombre para mostrar · Número de Depósito · Disponible o Teórico · WMS: PASILLO
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
        {file ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLOR_CONTEO + "10", border: `1px solid ${COLOR_CONTEO}30`, borderRadius: 9, padding: "0.7rem 1rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{file.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{(file.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={() => setFile(null)} style={{ ...iconBtn, color: "#ef4444" }}><X size={14} /></button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} style={{ padding: "0.9rem", background: "var(--surface2)", border: "1px dashed var(--border)", borderRadius: 10, cursor: "pointer", color: "var(--muted2)", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Upload size={16} />Seleccionar archivo Excel o CSV
          </button>
        )}
        {error && <div style={{ color: "#ef4444", fontSize: 12 }}>{error}</div>}
        {resultado && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "0.85rem 1rem" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#15803d", marginBottom: 6 }}>✓ Importación exitosa</div>
            <div style={{ fontSize: 13, color: "#166534" }}>Total: {resultado.totalLineas} líneas · Físicas: {resultado.fisicas} · Auto-fill: {resultado.autoFill}</div>
          </div>
        )}
        <button onClick={upload} disabled={!file || uploading} style={{ padding: "0.65rem", background: (!file || uploading) ? "#94a3b8" : COLOR_CONTEO, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {uploading ? "Importando…" : "Importar archivo"}
        </button>
      </div>
    </Modal>
  );
}

// ── Modal: Asignar operarios ──────────────────────────
function ModalAsignar({ ciclo, operarios, onClose, onAsignado }: { ciclo: CicloConteo; operarios: OperarioCiclo[]; onClose: () => void; onAsignado: () => void }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [operario, setOperario] = useState("");
  const [dia, setDia] = useState("1");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function asignar(e: React.FormEvent) {
    e.preventDefault();
    if (!desde || !hasta || !operario) { setMsg("Completa todos los campos"); return; }
    setSaving(true); setMsg("");
    const res = await fetch(`/api/conteo/ciclos/${ciclo.id}/asignar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ubicacionDesde: desde.toUpperCase(), ubicacionHasta: hasta.toUpperCase(), operarioNombre: operario, diaAsignado: parseInt(dia) }),
    });
    const json = await res.json();
    setMsg(json.success ? `✓ ${json.actualizadas} líneas asignadas a ${operario}` : json.error);
    if (json.success) onAsignado();
    setSaving(false);
  }

  return (
    <Modal onClose={onClose} title="Asignar operarios" sub={ciclo.nombre} wide>
      <form onSubmit={asignar} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
          <Field label="Depósito desde (A→Z)"><input value={desde} onChange={(e) => setDesde(e.target.value)} placeholder="01-A-01-01-01" style={inp} /></Field>
          <Field label="Depósito hasta"><input value={hasta} onChange={(e) => setHasta(e.target.value)} placeholder="01-Z-99-99-99" style={inp} /></Field>
        </div>
        <Field label="Operario">
          <select value={operario} onChange={(e) => setOperario(e.target.value)} style={inp}>
            <option value="">Seleccionar operario…</option>
            {operarios.filter((o) => o.activo).map((o) => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}
          </select>
        </Field>
        <Field label="Día del ciclo">
          <select value={dia} onChange={(e) => setDia(e.target.value)} style={inp}>
            <option value="1">Día 1</option><option value="2">Día 2</option>
            <option value="3">Día 3</option><option value="4">Día 4</option>
          </select>
        </Field>
        {msg && <div style={{ fontSize: 12, color: msg.startsWith("✓") ? COLOR_CONTEO : "#ef4444" }}>{msg}</div>}
        <button type="submit" disabled={saving} style={{ padding: "0.65rem", background: saving ? "#94a3b8" : COLOR_CONTEO, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Asignando…" : "Asignar bloque"}
        </button>
      </form>
    </Modal>
  );
}

// ── Modal: CRUD Operarios ─────────────────────────────
function ModalOperarios({ operarios, onClose, onCambio }: { operarios: OperarioCiclo[]; onClose: () => void; onCambio: () => void }) {
  const [lista, setLista] = useState<OperarioCiclo[]>(operarios);
  const [nuevo, setNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.trim()) return;
    setGuardando(true);
    const res = await fetch("/api/conteo/operarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nuevo.trim() }) });
    const json = await res.json();
    if (json.success) { setLista((p) => [...p, json.data]); setNuevo(""); onCambio(); }
    setGuardando(false);
  }

  async function toggleActivo(op: OperarioCiclo) {
    const res = await fetch(`/api/conteo/operarios/${op.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: !op.activo }) });
    const json = await res.json();
    if (json.success) { setLista((p) => p.map((o) => o.id === op.id ? { ...o, activo: !o.activo } : o)); onCambio(); }
  }

  async function eliminar(op: OperarioCiclo) {
    const res = await fetch(`/api/conteo/operarios/${op.id}`, { method: "DELETE" });
    if (res.ok) { setLista((p) => p.filter((o) => o.id !== op.id)); onCambio(); }
  }

  return (
    <Modal onClose={onClose} title="Gestión de operarios" wide>
      <form onSubmit={agregar} style={{ display: "flex", gap: 8, marginBottom: "1rem" }}>
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre del operario…" style={{ ...inp, flex: 1 }} />
        <button type="submit" disabled={guardando || !nuevo.trim()} style={{ padding: "0.55rem 1rem", background: COLOR_CONTEO, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
          <UserPlus size={14} />Agregar
        </button>
      </form>
      <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {lista.length === 0 && <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Sin operarios. Agrega el primero.</div>}
        {lista.map((op, i) => (
          <div key={op.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.65rem 0.9rem", borderBottom: i < lista.length - 1 ? "1px solid var(--border)" : "none", background: op.activo ? "var(--surface)" : "var(--surface2)", opacity: op.activo ? 1 : 0.6 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{op.nombre}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: op.activo ? "#10b98118" : "#94a3b818", color: op.activo ? "#10b981" : "#94a3b8" }}>{op.activo ? "Activo" : "Inactivo"}</span>
            <button onClick={() => toggleActivo(op)} style={{ ...iconBtn, fontSize: 11, padding: "4px 8px" }} title={op.activo ? "Desactivar" : "Activar"}>{op.activo ? "Pausar" : "Activar"}</button>
            <button onClick={() => eliminar(op)} style={{ ...iconBtn, color: "#ef4444" }} title="Eliminar"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: "0.75rem" }}>Los operarios inactivos no aparecen en la lista de selección al contar.</div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ══════════════════════════════════════════════════════════════
export default function ConteoPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canManage = can(role, "manageConteo");
  const canDownload = can(role, "edit");

  const [ciclos, setCiclos] = useState<CicloConteo[]>([]);
  const [operarios, setOperarios] = useState<OperarioCiclo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cicloActivo, setCicloActivo] = useState<CicloConteo | null>(null);
  const [lineas, setLineas] = useState<LineaConteo[]>([]);
  const [loadingLineas, setLoadingLineas] = useState(false);
  const [view, setView] = useState<View>("ciclos");
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  // Modales
  const [showNuevo, setShowNuevo] = useState(false);
  const [showImportar, setShowImportar] = useState(false);
  const [showAsignar, setShowAsignar] = useState(false);
  const [showOperarios, setShowOperarios] = useState(false);
  const [cicloABorrar, setCicloABorrar] = useState<CicloConteo | null>(null);

  // Filtros de líneas
  const [fq, setFq] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fDia, setFDia] = useState("");
  const [fOperario, setFOperario] = useState("");

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3500); }

  const loadCiclos = useCallback(async () => {
    setLoading(true);
    const [cRes, oRes] = await Promise.all([fetch("/api/conteo/ciclos"), fetch("/api/conteo/operarios")]);
    const [cJ, oJ] = await Promise.all([cRes.json(), oRes.json()]);
    if (cJ.success) setCiclos(cJ.data);
    if (oJ.success) setOperarios(oJ.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadCiclos(); }, [loadCiclos]);

  const loadLineas = useCallback(async (ciclo: CicloConteo) => {
    setLoadingLineas(true);
    const p = new URLSearchParams({ cicloId: ciclo.id });
    if (fq) p.set("q", fq);
    if (fEstado) p.set("estado", fEstado);
    if (fDia) p.set("dia", fDia);
    if (fOperario) p.set("operario", fOperario);
    const res = await fetch(`/api/conteo/lineas?${p}`);
    const json = await res.json();
    if (json.success) setLineas(json.data);
    setLoadingLineas(false);
  }, [fq, fEstado, fDia, fOperario]);

  useEffect(() => {
    if (cicloActivo && view === "lineas") loadLineas(cicloActivo);
  }, [cicloActivo, view, loadLineas]);

  async function cambiarEstado(ciclo: CicloConteo, estado: string) {
    const res = await fetch(`/api/conteo/ciclos/${ciclo.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) });
    const json = await res.json();
    if (json.success) { await loadCiclos(); showToast(`Estado → ${estado}`); if (cicloActivo?.id === ciclo.id) setCicloActivo(json.data); }
    else showToast(json.error, true);
  }

  async function calcularDiferencias() {
    if (!cicloActivo) return;
    const res = await fetch(`/api/conteo/ciclos/${cicloActivo.id}/calcular`, { method: "POST" });
    const json = await res.json();
    if (json.success) { await loadCiclos(); showToast(`✓ ${json.ok} OK · ${json.enReconteo} en reconteo`); }
    else showToast(json.error, true);
  }

  async function borrarCiclo(ciclo: CicloConteo) {
    const res = await fetch(`/api/conteo/ciclos/${ciclo.id}`, { method: "DELETE" });
    if (res.ok) { setCiclos((p) => p.filter((c) => c.id !== ciclo.id)); setCicloABorrar(null); showToast("Ciclo eliminado"); }
    else showToast("Error al eliminar", true);
  }

  async function descargarReporte(ciclo: CicloConteo) {
    const res = await fetch(`/api/conteo/ciclos/${ciclo.id}/reporte`);
    if (!res.ok) { showToast("Error al generar reporte", true); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `conteo-${ciclo.nombre}-${ciclo.fechaInicio}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  }

  const activo = useMemo(() => ciclos.find((c) => c.estado === "EN_PROGRESO" || c.estado === "EN_RECONTEO") ?? null, [ciclos]);

  if (loading) return (
    <div className="animate-fade-in">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 76, borderRadius: 12 }} />)}
      </div>
      <div className="skeleton" style={{ height: 300, borderRadius: 14 }} />
    </div>
  );

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: COLOR_CONTEO + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ClipboardList size={20} color={COLOR_CONTEO} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Conteo Cíclico</h1>
            <p style={{ fontSize: 12, color: "var(--muted)" }}>{ciclos.length} ciclo{ciclos.length !== 1 ? "s" : ""} · {activo ? `1 activo (${CICLO_ESTADO_LABEL[activo.estado as keyof typeof CICLO_ESTADO_LABEL]})` : "Sin ciclo activo"}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["ciclos", "lineas"].map((v) => (
            <button key={v} onClick={() => setView(v as View)} style={{ padding: "0.5rem 0.9rem", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${view === v ? COLOR_CONTEO : "var(--border)"}`, background: view === v ? COLOR_CONTEO : "var(--surface)", color: view === v ? "#fff" : "var(--muted2)" }}>
              {v === "ciclos" ? <><BarChart3 size={14} style={{ marginRight: 5, verticalAlign: "middle" }} />Ciclos</> : <><List size={14} style={{ marginRight: 5, verticalAlign: "middle" }} />Líneas</>}
            </button>
          ))}
          <button onClick={loadCiclos} style={{ ...iconBtn }}><RefreshCw size={14} /></button>
          {canManage && <button onClick={() => setShowOperarios(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--muted2)" }}><Users size={14} />Operarios</button>}
          {canManage && <button onClick={() => setShowNuevo(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: COLOR_CONTEO, color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Plus size={14} />Nuevo ciclo</button>}
        </div>
      </div>

      {/* KPIs del ciclo activo */}
      {activo && (
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted2)", marginBottom: "0.6rem", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Ciclo activo — {activo.nombre}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <Kpi label="Total líneas" val={activo.totalLineas} color={COLOR_CONTEO} />
            <Kpi label="Pendientes" val={activo.pendientes ?? 0} color="#94a3b8" />
            <Kpi label="Contados" val={activo.contados ?? 0} color="#3b82f6" />
            <Kpi label="En reconteo" val={activo.enReconteo ?? 0} color="#7c3aed" />
            <Kpi label="OK" val={activo.ok ?? 0} color="#10b981" />
            <Kpi label="Novedades" val={activo.novedades ?? 0} color="#ef4444" />
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "0.9rem 1.1rem" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Progreso del conteo</div>
            <ProgBar val={(activo.ok ?? 0) + (activo.novedades ?? 0) + (activo.enReconteo ?? 0) + (activo.contados ?? 0)} total={activo.totalLineas} color={COLOR_CONTEO} />
          </div>
          {/* Acciones del ciclo activo */}
          {canManage && (
            <div style={{ display: "flex", gap: 8, marginTop: "0.75rem", flexWrap: "wrap" }}>
              <button onClick={async () => {
                const res = await fetch(`/api/conteo/ciclos/${activo.id}/recalcular`, { method: "POST" });
                const json = await res.json();
                if (json.success) { await loadCiclos(); showToast(`✓ Recalculado: ${json.pasaronAAutoFill} auto-fill · ${json.pasaronAFisica} físicas`); }
                else showToast(json.error, true);
              }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: "#f59e0b15", color: "#d97706", border: "1px solid #f59e0b40", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><RefreshCw size={14} />Recalcular auto-fill</button>
              <button onClick={() => { setCicloActivo(activo); setShowImportar(true); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--muted2)" }}><Upload size={14} />Reimportar</button>
              <button onClick={() => { setCicloActivo(activo); setShowAsignar(true); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--muted2)" }}><Users size={14} />Asignar</button>
              <button onClick={calcularDiferencias} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: "#7c3aed15", color: "#7c3aed", border: "1px solid #7c3aed40", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Calculator size={14} />Calcular diferencias</button>
              {activo.estado === "EN_PROGRESO" && (
                <button onClick={() => cambiarEstado(activo, "CERRADO")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: "#10b98115", color: "#10b981", border: "1px solid #10b98140", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><CheckCircle2 size={14} />Cerrar ciclo</button>
              )}
              {canDownload && <button onClick={() => descargarReporte(activo)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.9rem", background: COLOR_CONTEO + "15", color: COLOR_CONTEO, border: `1px solid ${COLOR_CONTEO}40`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Download size={14} />Descargar Excel</button>}
            </div>
          )}
        </div>
      )}

      {/* Vista: Ciclos */}
      {view === "ciclos" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
              {["Ciclo", "Fecha inicio", "Estado", "Progreso", "Novedades", ""].map((h) => (
                <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {ciclos.length === 0 && <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Sin ciclos aún. Crea el primero.</td></tr>}
              {ciclos.map((c) => {
                const completados = (c.ok ?? 0) + (c.novedades ?? 0);
                return (
                  <tr key={c.id} className="hover-row" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.65rem 0.85rem", fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ padding: "0.65rem 0.85rem", fontFamily: "var(--mono)" }}>{fmtFecha(c.fechaInicio)}</td>
                    <td style={{ padding: "0.65rem 0.85rem" }}><Badge label={CICLO_ESTADO_LABEL[c.estado as keyof typeof CICLO_ESTADO_LABEL] ?? c.estado} color={CICLO_ESTADO_COLOR[c.estado as keyof typeof CICLO_ESTADO_COLOR] ?? "#64748b"} /></td>
                    <td style={{ padding: "0.65rem 0.85rem", minWidth: 160 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{completados} / {c.totalLineas}</div>
                      <ProgBar val={completados} total={c.totalLineas} color={COLOR_CONTEO} />
                    </td>
                    <td style={{ padding: "0.65rem 0.85rem" }}>
                      {(c.novedades ?? 0) > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#ef4444" }}><AlertTriangle size={12} />{c.novedades}</span>}
                      {(c.novedades ?? 0) === 0 && <span style={{ color: "var(--border)" }}>—</span>}
                    </td>
                    <td style={{ padding: "0.65rem 0.85rem", whiteSpace: "nowrap" }}>
                      {canManage && c.estado === "PLANIFICADO" && (
                        <>
                          <button onClick={() => { setCicloActivo(c); setShowImportar(true); }} style={{ ...iconBtn, marginRight: 4 }} title="Importar CSV"><Upload size={13} /></button>
                          <button onClick={() => { setCicloActivo(c); setShowAsignar(true); }} style={{ ...iconBtn, marginRight: 4 }} title="Asignar operarios"><Users size={13} /></button>
                          <button onClick={() => cambiarEstado(c, "EN_PROGRESO")} style={{ ...iconBtn, color: COLOR_CONTEO }} title="Lanzar ciclo"><Play size={13} /></button>
                        </>
                      )}
                      {canDownload && c.estado === "CERRADO" && (
                        <button onClick={() => descargarReporte(c)} style={{ ...iconBtn, color: COLOR_CONTEO }} title="Descargar reporte"><Download size={13} /></button>
                      )}
                      <button onClick={() => { setCicloActivo(c); setView("lineas"); }} style={{ ...iconBtn, marginLeft: 4 }} title="Ver líneas"><ChevronRight size={13} /></button>
                      {canManage && <button onClick={() => setCicloABorrar(c)} style={{ ...iconBtn, marginLeft: 4, color: "#ef4444" }} title="Eliminar ciclo"><Trash2 size={13} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vista: Líneas */}
      {view === "lineas" && (
        <div>
          {!cicloActivo && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              Selecciona un ciclo desde la vista "Ciclos" para ver sus líneas.
            </div>
          )}
          {cicloActivo && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
                <input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Buscar PLU, descripción, depósito…" style={{ flex: 1, minWidth: 200, border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.85rem", fontSize: 12, outline: "none" }} />
                <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.85rem", fontSize: 12, outline: "none" }}>
                  <option value="">Todos los estados</option>
                  {["PENDIENTE", "CONTADO", "EN_RECONTEO", "OK", "NOVEDAD"].map((e) => <option key={e} value={e}>{LINEA_ESTADO_LABEL[e as keyof typeof LINEA_ESTADO_LABEL]}</option>)}
                </select>
                <select value={fDia} onChange={(e) => setFDia(e.target.value)} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.85rem", fontSize: 12, outline: "none" }}>
                  <option value="">Todos los días</option>
                  {[1, 2, 3, 4].map((d) => <option key={d} value={d}>Día {d}</option>)}
                </select>
                <button onClick={() => loadLineas(cicloActivo)} style={{ ...iconBtn }}><RefreshCw size={14} /></button>
              </div>
              {loadingLineas ? (
                <div className="skeleton" style={{ height: 300, borderRadius: 14 }} />
              ) : (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                        {["PLU", "Depósito", "Descripción", "Operario", "Día", "Teórico", "Contado", "Diferencia", "Estado"].map((h) => (
                          <th key={h} style={{ padding: "0.6rem 0.85rem", textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {lineas.length === 0 && <tr><td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Sin líneas (mostrando hasta 500)</td></tr>}
                        {lineas.map((l) => {
                          const contada = l.cantidadRecontada ?? l.cantidadContada;
                          const dif = l.diferenciaFinal;
                          return (
                            <tr key={l.id} className="hover-row" style={{ borderBottom: "1px solid var(--border)" }}>
                              <td style={{ padding: "0.5rem 0.85rem", fontFamily: "var(--mono)", fontWeight: 600 }}>{l.plu}</td>
                              <td style={{ padding: "0.5rem 0.85rem", fontFamily: "var(--mono)", fontSize: 11 }}>{l.ubicacion}</td>
                              <td style={{ padding: "0.5rem 0.85rem", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descripcion}</td>
                              <td style={{ padding: "0.5rem 0.85rem", fontSize: 11, color: "var(--muted2)" }}>{l.operarioNombre ?? "—"}</td>
                              <td style={{ padding: "0.5rem 0.85rem", fontFamily: "var(--mono)" }}>{l.diaAsignado ?? "—"}</td>
                              <td style={{ padding: "0.5rem 0.85rem", fontFamily: "var(--mono)", textAlign: "right" }}>{fmtNum(l.teorico)}</td>
                              <td style={{ padding: "0.5rem 0.85rem", fontFamily: "var(--mono)", textAlign: "right" }}>{fmtNum(contada)}</td>
                              <td style={{ padding: "0.5rem 0.85rem", fontFamily: "var(--mono)", textAlign: "right", color: dif == null ? "var(--muted)" : dif === 0 ? "#10b981" : "#ef4444", fontWeight: dif != null && dif !== 0 ? 700 : 400 }}>
                                {dif == null ? "—" : dif > 0 ? `+${fmtNum(dif)}` : fmtNum(dif)}
                              </td>
                              <td style={{ padding: "0.5rem 0.85rem" }}><Badge label={LINEA_ESTADO_LABEL[l.estado as keyof typeof LINEA_ESTADO_LABEL]} color={LINEA_ESTADO_COLOR[l.estado as keyof typeof LINEA_ESTADO_COLOR]} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modales */}
      {showNuevo && <ModalNuevoCiclo onClose={() => setShowNuevo(false)} onCreado={(c) => { setCiclos((p) => [c as CicloConteo, ...p]); setShowNuevo(false); showToast("Ciclo creado ✓"); }} />}
      {showImportar && cicloActivo && <ModalImportar ciclo={cicloActivo} onClose={() => setShowImportar(false)} onImportado={async () => { await loadCiclos(); }} />}
      {showAsignar && cicloActivo && <ModalAsignar ciclo={cicloActivo} operarios={operarios} onClose={() => setShowAsignar(false)} onAsignado={async () => { await loadCiclos(); showToast("Asignación guardada ✓"); }} />}
      {showOperarios && <ModalOperarios operarios={operarios} onClose={() => setShowOperarios(false)} onCambio={async () => { const r = await fetch("/api/conteo/operarios"); const j = await r.json(); if (j.success) setOperarios(j.data); }} />}
      {cicloABorrar && (
        <Modal onClose={() => setCicloABorrar(null)} title="Eliminar ciclo" sub={cicloABorrar.nombre}>
          <p style={{ fontSize: 13, color: "var(--muted2)", marginBottom: "1rem" }}>Esta acción eliminará el ciclo y todas sus líneas de conteo. No se puede deshacer.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setCicloABorrar(null)} style={{ flex: 1, padding: "0.65rem", background: "var(--surface2)", color: "var(--muted2)", border: "1px solid var(--border)", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
            <button onClick={() => borrarCiclo(cicloABorrar)} style={{ flex: 1, padding: "0.65rem", background: "#ef4444", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Eliminar</button>
          </div>
        </Modal>
      )}

      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 10000, background: toast.err ? "#ef4444" : "#0f172a", color: "#fff", padding: "0.8rem 1.2rem", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 28px #0f172a40" }}>{toast.msg}</div>}
    </div>
  );
}
