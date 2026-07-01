"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { Plus, Search, X, Minus, Trash2 } from "lucide-react";
import { Badge, ModuleDetailView, ModuleHero } from "@/components/ui";
import { DetailSection, DetailGrid } from "@/components/ui/SlidePanel";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useApi } from "@/hooks/useApi";
import { apiPut, apiDelete, buildQuery } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { useIsMobile } from "@/lib/useIsMobile";
import { useListDetailScroll } from "@/hooks/useListDetailScroll";
import { getModuleColor, getModuleCssVars } from "@/lib/moduleTheme";
import {
  IntegracionTable, ESTADO_LABEL, estadoVariant, fmtDate,
  type Integracion, type EstadoIntegracion, type PlinItem,
} from "./_components";

const COLOR = getModuleColor("integracion");
const TIPO_DOC_OPTIONS = ["OVDM", "TSDM"] as const;
const AREA_OPTIONS = ["MUEBLES", "GOURMET"] as const;

const ESTADO_COLOR: Record<EstadoIntegracion, string> = {
  PENDIENTE_AREA2:   "var(--warning)",
  LISTA_TRANSPORTE:  "var(--brand)",
  COMPLETADA:        "var(--success)",
};

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const inp: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 12px",
  background: "var(--surface2)", border: "1px solid transparent",
  borderRadius: 8, fontSize: 14, fontFamily: "var(--sans)",
  color: "var(--text)", outline: "none",
  transition: "border-color .15s, box-shadow .15s, background .15s",
};
const focusProps = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = COLOR;
    e.target.style.boxShadow = "0 0 0 2.5px var(--ring)";
    e.target.style.background = "var(--surface)";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = "transparent";
    e.target.style.boxShadow = "none";
    e.target.style.background = "var(--surface2)";
  },
};

// ── PLU row input ──────────────────────────────────────────
interface PluRow { plu: string; descripcion: string; unidades: number; }
function emptyPlu(): PluRow { return { plu: "", descripcion: "", unidades: 1 }; }

function PluRowInput({ row, onChange, onRemove, isMobile }: {
  row: PluRow; onChange: (r: PluRow) => void; onRemove: () => void; isMobile: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "80px 1fr 60px 28px" : "110px 1fr 72px 28px", gap: 6, alignItems: "center" }}>
      <input placeholder="PLU" value={row.plu} onChange={(e) => onChange({ ...row, plu: e.target.value })}
        style={{ ...inp, height: 34, padding: "0 8px", fontSize: 13 }} {...focusProps} />
      <input placeholder="Descripción (opcional)" value={row.descripcion} onChange={(e) => onChange({ ...row, descripcion: e.target.value })}
        style={{ ...inp, height: 34, padding: "0 8px", fontSize: 13 }} {...focusProps} />
      <input type="number" min={1} placeholder="Uds" value={row.unidades} onChange={(e) => onChange({ ...row, unidades: Math.max(1, parseInt(e.target.value) || 1) })}
        style={{ ...inp, height: 34, padding: "0 8px", fontSize: 13 }} {...focusProps} />
      <button type="button" onClick={onRemove} style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "var(--error-tint)", color: "var(--error)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Minus size={13} />
      </button>
    </div>
  );
}

// ── Modal base ─────────────────────────────────────────────
function ModalBase({ title, sub, children, onClose, maxWidth = 520 }: {
  title: string; sub?: string; children: React.ReactNode; onClose: () => void; maxWidth?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="animate-scale-in"
        style={{ background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth, maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border)", padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h2>
            {sub && <p style={{ fontSize: 12, color: "var(--muted)", margin: "3px 0 0" }}>{sub}</p>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ── Modal: Nueva integración ───────────────────────────────
function ModalNuevaIntegracion({ role, onClose, onCreated, onNeedCompleteArea2 }: {
  role: string;
  onClose: () => void;
  onCreated: () => void;
  onNeedCompleteArea2: (integracion: Integracion) => void;
}) {
  const isMobile = useIsMobile();
  const areaFromRole = role === "OPERACIONES_MUEBLES" ? "MUEBLES" : role === "OPERACIONES_GOURMET" ? "GOURMET" : null;
  const isAdminLike = areaFromRole === null;

  const [tipoDoc, setTipoDoc] = useState<"OVDM" | "TSDM">("OVDM");
  const [numDoc, setNumDoc] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [areaIniciadora, setAreaIniciadora] = useState<"MUEBLES" | "GOURMET">("MUEBLES");
  const [numCajas, setNumCajas] = useState("");
  const [plines, setPlines] = useState<PluRow[]>([emptyPlu()]);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const area = areaFromRole ?? areaIniciadora;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validPlines = plines.filter((p) => p.plu.trim());
    if (validPlines.length === 0) { setError("Agrega al menos un PLU"); return; }

    setSaving(true);
    try {
      const body = {
        tipoDocumento: tipoDoc,
        numeroDocumento: numDoc.trim(),
        fecha,
        areaIniciadora: area,
        numeroCajas: numCajas ? parseInt(numCajas) : undefined,
        plines: validPlines.map((p) => ({ plu: p.plu.trim(), descripcion: p.descripcion.trim() || undefined, unidades: p.unidades })),
        observaciones: obs.trim() || undefined,
      };
      const res = await fetch("/api/integracion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();

      if (res.status === 409 && json.pendiente) {
        onNeedCompleteArea2(json.integracion);
        return;
      }
      if (!res.ok) { setError(json.error ?? "Error al crear"); return; }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalBase title="Nueva integración de pedido" sub="Área que crea la solicitud" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {isAdminLike && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5 }}>Área que crea la solicitud</label>
            <select value={areaIniciadora} onChange={(e) => setAreaIniciadora(e.target.value as "MUEBLES" | "GOURMET")} style={{ ...inp }} {...focusProps}>
              <option value="MUEBLES">Operaciones Muebles</option>
              <option value="GOURMET">Operaciones Gourmet</option>
            </select>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5 }}>Tipo doc.</label>
            <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value as "OVDM" | "TSDM")} style={{ ...inp }} {...focusProps}>
              {TIPO_DOC_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5 }}>N° documento</label>
            <input required value={numDoc} onChange={(e) => setNumDoc(e.target.value)} placeholder="Ej. 1234567" style={{ ...inp }} {...focusProps} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5 }}>Fecha</label>
            <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...inp }} {...focusProps} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5 }}>N° cajas</label>
            <input type="number" min={1} value={numCajas} onChange={(e) => setNumCajas(e.target.value)} placeholder="Opcional" style={{ ...inp }} {...focusProps} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>PLUs — Área {area}</label>
            <button type="button" onClick={() => setPlines([...plines, emptyPlu()])} style={{ fontSize: 12, color: COLOR, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>+ Añadir fila</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "80px 1fr 60px 28px" : "110px 1fr 72px 28px", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 4 }}>PLU</span>
              <span style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 4 }}>Descripción</span>
              <span style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 4 }}>Uds</span>
              <span />
            </div>
            {plines.map((row, i) => (
              <PluRowInput key={i} row={row} isMobile={isMobile}
                onChange={(r) => setPlines(plines.map((x, j) => j === i ? r : x))}
                onRemove={() => plines.length > 1 && setPlines(plines.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5 }}>Observaciones</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Opcional"
            style={{ ...inp, height: "auto", padding: "8px 12px", resize: "vertical" }} {...focusProps} />
        </div>

        {error && <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
          <button type="button" onClick={onClose} className="ds-btn ds-btn-ghost" style={{ fontSize: 14 }}>Cancelar</button>
          <button type="submit" disabled={saving} className="ds-btn ds-btn-primary" style={{ fontSize: 14, background: saving ? "var(--muted)" : COLOR, border: "none" }}>
            {saving ? "Creando…" : "Crear integración"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

// ── Modal: Completar Área 2 ────────────────────────────────
function ModalCompletarArea2({ integracion, role, onClose, onCompleted }: {
  integracion: Integracion; role: string; onClose: () => void; onCompleted: () => void;
}) {
  const isMobile = useIsMobile();
  const areaFromRole = role === "OPERACIONES_MUEBLES" ? "MUEBLES" : role === "OPERACIONES_GOURMET" ? "GOURMET" : null;
  const areaContraria = integracion.areaIniciadora === "MUEBLES" ? "GOURMET" : "MUEBLES";
  const areaUsada = areaFromRole ?? areaContraria;

  const plines1 = integracion.plines.filter((p) => p.area === integracion.areaIniciadora);

  const [numCajas, setNumCajas] = useState("");
  const [plines, setPlines] = useState<PluRow[]>([emptyPlu()]);
  const [obs, setObs] = useState(integracion.observaciones ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validPlines = plines.filter((p) => p.plu.trim());
    if (validPlines.length === 0) { setError("Agrega al menos un PLU"); return; }
    setSaving(true);
    try {
      const body = {
        accion: "COMPLETAR_AREA2",
        numeroCajasArea2: numCajas ? parseInt(numCajas) : undefined,
        plines: validPlines.map((p) => ({ plu: p.plu.trim(), descripcion: p.descripcion.trim() || undefined, unidades: p.unidades })),
        observaciones: obs.trim() || undefined,
      };
      await apiPut(`/api/integracion/${integracion.id}`, body);
      onCompleted();
    } catch (e) {
      setError(getErrorMessage(e, "Error al completar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalBase title={`Completar — ${integracion.tipoDocumento} ${integracion.numeroDocumento}`}
      sub={`Área ${integracion.areaIniciadora} ya registró su picking. Ahora completa el área ${areaUsada}.`}
      onClose={onClose} maxWidth={560}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Datos de área 1 — readonly */}
        <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
            PLUs Área {integracion.areaIniciadora} (referencia)
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["PLU", "Descripción", "Uds"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "4px 8px", color: "var(--muted)", fontWeight: 500, borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plines1.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: "4px 8px", fontFamily: "var(--mono)", fontSize: 12 }}>{p.plu}</td>
                  <td style={{ padding: "4px 8px", color: "var(--muted)" }}>{p.descripcion ?? "—"}</td>
                  <td style={{ padding: "4px 8px" }}>{p.unidades}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {integracion.numeroCajasArea1 && <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 0" }}>Cajas Área 1: <strong>{integracion.numeroCajasArea1}</strong></p>}
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5 }}>N° cajas — Área {areaUsada}</label>
          <input type="number" min={1} value={numCajas} onChange={(e) => setNumCajas(e.target.value)} placeholder="Opcional" style={{ ...inp }} {...focusProps} />
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)" }}>PLUs — Área {areaUsada}</label>
            <button type="button" onClick={() => setPlines([...plines, emptyPlu()])} style={{ fontSize: 12, color: COLOR, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}>+ Añadir fila</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {plines.map((row, i) => (
              <PluRowInput key={i} row={row} isMobile={isMobile}
                onChange={(r) => setPlines(plines.map((x, j) => j === i ? r : x))}
                onRemove={() => plines.length > 1 && setPlines(plines.filter((_, j) => j !== i))}
              />
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5 }}>Observaciones</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Opcional"
            style={{ ...inp, height: "auto", padding: "8px 12px", resize: "vertical" }} {...focusProps} />
        </div>

        {error && <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
          <button type="button" onClick={onClose} className="ds-btn ds-btn-ghost" style={{ fontSize: 14 }}>Cancelar</button>
          <button type="submit" disabled={saving} className="ds-btn ds-btn-primary" style={{ fontSize: 14, background: saving ? "var(--muted)" : COLOR, border: "none" }}>
            {saving ? "Guardando…" : "Completar picking Área 2"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

// ── Modal: Confirmar recepción transporte ──────────────────
function ModalMarcarRecibido({ integracion, onClose, onDone }: {
  integracion: Integracion; onClose: () => void; onDone: () => void;
}) {
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPut(`/api/integracion/${integracion.id}`, { accion: "MARCAR_COMPLETADA", observaciones: obs.trim() || undefined });
      onDone();
    } catch (e) {
      setError(getErrorMessage(e, "Error"));
      setSaving(false);
    }
  }

  return (
    <ModalBase title="Confirmar recepción física" sub={`${integracion.tipoDocumento} ${integracion.numeroDocumento}`} onClose={onClose} maxWidth={420}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
          ¿Confirmas que recibiste físicamente el pedido de las dos áreas y está listo para despacho?
        </p>
        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted2)", display: "block", marginBottom: 5 }}>Observaciones (opcional)</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Ej. Pedido revisado sin novedades"
            style={{ ...inp, height: "auto", padding: "8px 12px", resize: "vertical" }} {...focusProps} />
        </div>
        {error && <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} className="ds-btn ds-btn-ghost" style={{ fontSize: 14 }}>Cancelar</button>
          <button type="submit" disabled={saving} className="ds-btn ds-btn-primary" style={{ fontSize: 14, background: saving ? "var(--muted)" : "var(--success)", border: "none" }}>
            {saving ? "Guardando…" : "Confirmar recepción"}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

// ════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════
const ALLOWED = ["OPERACIONES_MUEBLES", "OPERACIONES_GOURMET", "ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE", "TRANSPORTE"];
const TRANSPORT_ROLES = ["SUPERVISOR_TRANSPORTE", "TRANSPORTE", "ADMIN", "GERENTE"];
const CREATOR_ROLES = ["OPERACIONES_MUEBLES", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"];

export default function IntegracionPage() {
  const isMobile = useIsMobile();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterTipo, setFilterTipo] = useState("");

  const [selected, setSelected] = useState<Integracion | null>(null);
  useListDetailScroll(selected !== null);
  const [showNueva, setShowNueva] = useState(false);
  const [completarItem, setCompletarItem] = useState<Integracion | null>(null);
  const [recibidoItem, setRecibidoItem] = useState<Integracion | null>(null);
  const [deletingIntId, setDeletingIntId] = useState<string | null>(null);
  const [debugTable, setDebugTable] = useState(false);

  // Modo debug de tabla: /dashboard/integracion?debugTable=1 (diagnóstico de mapeo de columnas).
  useEffect(() => { setDebugTable(new URLSearchParams(window.location.search).get("debugTable") === "1"); }, []);

  const canCreate = CREATOR_ROLES.includes(role);
  const canTransport = TRANSPORT_ROLES.includes(role);
  const isAdmin = role === "ADMIN";

  const areaFromRole = role === "OPERACIONES_MUEBLES" ? "MUEBLES" : role === "OPERACIONES_GOURMET" ? "GOURMET" : null;

  const canCompleteArea2 = useCallback((item: Integracion): boolean => {
    if (item.estado !== "PENDIENTE_AREA2") return false;
    if (role === "ADMIN" || role === "GERENTE") return true;
    if (!areaFromRole) return false;
    return areaFromRole !== item.areaIniciadora;
  }, [role, areaFromRole]);

  const puedeVer = Boolean(role && ALLOWED.includes(role));
  const listKey = puedeVer
    ? `/api/integracion${buildQuery({ estado: filterEstado, area: filterArea, tipoDocumento: filterTipo })}`
    : null;
  const { data: listJson, isLoading: loading, mutate: mutateList } = useApi<{ data: Integracion[]; total: number }>(listKey);
  const integraciones = listJson?.data ?? [];
  const total = listJson?.total ?? 0;
  const load = useCallback(() => { void mutateList(); }, [mutateList]);

  const autoRefresh = useAutoRefresh({
    enabled: puedeVer,
    pause: Boolean(selected || showNueva || completarItem || recibidoItem || deletingIntId),
    onRefresh: () => { void mutateList(); },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return integraciones;
    return integraciones.filter((i) =>
      i.numeroDocumento.toLowerCase().includes(q) ||
      i.tipoDocumento.toLowerCase().includes(q) ||
      (i.creadoPorNombre ?? "").toLowerCase().includes(q)
    );
  }, [integraciones, search]);

  function refresh() { load(); setSelected(null); setCompletarItem(null); setRecibidoItem(null); }

  async function deleteIntegracion(id: string) {
    try {
      await apiDelete(`/api/integracion/${id}`);
      setSelected(null);
      setDeletingIntId(null);
      refresh();
    } catch { setDeletingIntId(null); }
  }

  if (!session) return null;
  if (!ALLOWED.includes(role)) {
    return (
      <div style={{ padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>No tienes acceso a este módulo.</p>
      </div>
    );
  }

  return (
    <div style={{ ...getModuleCssVars("integracion"), display: "flex", flexDirection: "column", gap: 20, padding: isMobile ? "0 0 24px" : "0 0 32px" } as React.CSSProperties}>

      <ModuleHero
        moduleKey="integracion"
        kicker="OVDM + TSDM"
        title="Integracion de Pedidos"
        description={loading ? "Cargando..." : `${total} integracion${total !== 1 ? "es" : ""}`}
        actions={(
        <>
          <AutoRefreshIndicator
            lastUpdatedAt={autoRefresh.lastUpdatedAt}
            refreshing={autoRefresh.refreshing}
            onRefresh={autoRefresh.refreshNow}
          />
          {canCreate && (
            <button onClick={() => setShowNueva(true)} className="ds-btn ds-btn-primary" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14 }}>
              <Plus size={15} /> Nueva integración
            </button>
          )}
        </>
        )}
      />

      {selected ? (
        <ModuleDetailView
          testId="integracion-detalle-view"
          onBack={() => setSelected(null)}
          title={`${selected.tipoDocumento} ${selected.numeroDocumento}`}
          badge={<Badge variant={estadoVariant(selected.estado)} label={ESTADO_LABEL[selected.estado]} />}
          moduleColor={COLOR}
          actions={
            canCompleteArea2(selected) ? (
              <button onClick={() => { setCompletarItem(selected); setSelected(null); }}
                className="ds-btn ds-btn-primary" style={{ fontSize: 13, background: COLOR, border: "none" }}>
                Completar Área 2
              </button>
            ) : canTransport && selected.estado === "LISTA_TRANSPORTE" ? (
              <button onClick={() => { setRecibidoItem(selected); setSelected(null); }}
                className="ds-btn ds-btn-primary" style={{ fontSize: 13, background: "var(--success)", border: "none" }}>
                Confirmar recepción
              </button>
            ) : undefined
          }
        >
            <DetailSection title="Información general">
              <DetailGrid items={[
                { label: "Fecha", value: fmtDate(selected.fecha) },
                { label: "Área iniciadora", value: selected.areaIniciadora },
                { label: "Tipo documento", value: selected.tipoDocumento },
                { label: "Creado por", value: selected.creadoPorNombre ?? "—" },
                { label: "Creado el", value: fmtDateTime(selected.creadoAt) },
                { label: `Cajas Área ${selected.areaIniciadora}`, value: selected.numeroCajasArea1 ?? "—" },
                ...(selected.completadoPorNombre ? [{ label: "Completado por (Área 2)", value: selected.completadoPorNombre }] : []),
                ...(selected.completadoAt ? [{ label: "Completado el", value: fmtDateTime(selected.completadoAt) }] : []),
                ...(selected.marcadoCompletadoAt ? [{ label: "Recibido transporte", value: fmtDateTime(selected.marcadoCompletadoAt) }] : []),
                { label: `Cajas Área ${selected.areaIniciadora === "MUEBLES" ? "GOURMET" : "MUEBLES"}`, value: selected.numeroCajasArea2 ?? "—" },
              ]} />
            </DetailSection>

            {selected.observaciones && (
              <DetailSection title="Observaciones">
                <p style={{ fontSize: 13, color: "var(--text)", background: "var(--surface2)", borderRadius: 8, padding: "10px 12px", margin: 0 }}>{selected.observaciones}</p>
              </DetailSection>
            )}

            {[selected.areaIniciadora, selected.areaIniciadora === "MUEBLES" ? "GOURMET" : "MUEBLES"].map((area) => {
              const pls = selected.plines.filter((p) => p.area === area);
              if (pls.length === 0 && area !== selected.areaIniciadora) return null;
              return (
                <DetailSection key={area} title={`PLUs — Área ${area}${area === selected.areaIniciadora ? " (iniciadora)" : ""}`}>
                  {pls.length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", margin: 0 }}>Pendiente de completar</p>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "var(--surface2)" }}>
                          {["PLU", "Descripción", "Uds"].map((h) => (
                            <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pls.map((p) => (
                          <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "7px 10px", fontFamily: "var(--mono)", fontSize: 12 }}>{p.plu}</td>
                            <td style={{ padding: "7px 10px", color: "var(--muted)" }}>{p.descripcion ?? "—"}</td>
                            <td style={{ padding: "7px 10px" }}>{p.unidades}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </DetailSection>
              );
            })}

            {isAdmin && (
              <DetailSection title="Zona de administración">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Eliminar esta integración permanentemente</p>
                  {deletingIntId === selected.id ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => deleteIntegracion(selected.id)}
                        className="ds-btn" style={{ fontSize: 12, background: "var(--error)", color: "#fff", border: "none" }}>
                        Confirmar eliminación
                      </button>
                      <button onClick={() => setDeletingIntId(null)} className="ds-btn ds-btn-ghost" style={{ fontSize: 12 }}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeletingIntId(selected.id)}
                      className="ds-btn ds-btn-ghost" style={{ fontSize: 12, color: "var(--error)", border: "1px solid var(--error)" }}>
                      <Trash2 size={13} /> Eliminar
                    </button>
                  )}
                </div>
              </DetailSection>
            )}
        </ModuleDetailView>
      ) : (
        <>
          {/* Filtros */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <div style={{ position: "relative", flex: "1 1 160px", minWidth: 140 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar documento…"
                style={{ ...inp, paddingLeft: 32 }} {...focusProps} />
            </div>
            <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} style={{ ...inp, flex: "0 0 auto", width: "auto" }} {...focusProps}>
              <option value="">Todos los estados</option>
              <option value="PENDIENTE_AREA2">Pendiente Área 2</option>
              <option value="LISTA_TRANSPORTE">Lista para Transporte</option>
              <option value="COMPLETADA">Completada</option>
            </select>
            <select value={filterArea} onChange={(e) => setFilterArea(e.target.value)} style={{ ...inp, flex: "0 0 auto", width: "auto" }} {...focusProps}>
              <option value="">Todas las áreas</option>
              <option value="MUEBLES">Muebles</option>
              <option value="GOURMET">Gourmet</option>
            </select>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} style={{ ...inp, flex: "0 0 auto", width: "auto" }} {...focusProps}>
              <option value="">OVDM + TSDM</option>
              <option value="OVDM">OVDM</option>
              <option value="TSDM">TSDM</option>
            </select>
          </div>

          {/* Tabla */}
          <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            <IntegracionTable
              items={filtered}
              loading={loading}
              color={COLOR}
              canCompleteArea2={canCompleteArea2}
              canTransport={canTransport}
              isAdmin={isAdmin}
              deletingIntId={deletingIntId}
              onRowClick={(item) => setSelected(item)}
              onCompletar={(item) => setCompletarItem(item)}
              onRecibido={(item) => setRecibidoItem(item)}
              onDeleteStart={(id) => setDeletingIntId(id)}
              onDeleteConfirm={(id) => deleteIntegracion(id)}
              onDeleteCancel={() => setDeletingIntId(null)}
              hasSearch={Boolean(search)}
              onClearSearch={() => setSearch("")}
              debug={debugTable}
            />
          </div>
        </>
      )}

      {/* Modales */}
      {showNueva && (
        <ModalNuevaIntegracion
          role={role}
          onClose={() => setShowNueva(false)}
          onCreated={() => { setShowNueva(false); refresh(); }}
          onNeedCompleteArea2={(item) => { setShowNueva(false); setCompletarItem(item); }}
        />
      )}
      {completarItem && (
        <ModalCompletarArea2
          integracion={completarItem}
          role={role}
          onClose={() => setCompletarItem(null)}
          onCompleted={() => { setCompletarItem(null); refresh(); }}
        />
      )}
      {recibidoItem && (
        <ModalMarcarRecibido
          integracion={recibidoItem}
          onClose={() => setRecibidoItem(null)}
          onDone={() => { setRecibidoItem(null); refresh(); }}
        />
      )}
    </div>
  );
}
