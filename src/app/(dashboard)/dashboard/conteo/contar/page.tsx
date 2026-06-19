"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ClipboardList, CheckCircle2, RotateCcw, X, ChevronDown, ChevronUp, Search,
} from "lucide-react";
import { LineaConteo, OperarioCiclo, CicloConteo, LINEA_ESTADO_COLOR, COLOR_CONTEO, fmtNum } from "@/lib/conteo";
import { getModuleCssVars } from "@/lib/moduleTheme";

const inp: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 10, padding: "0.7rem 0.9rem",
  fontSize: 15, fontFamily: "var(--mono)", outline: "none", background: "var(--bg)",
  width: "100%", boxSizing: "border-box", textAlign: "center",
};

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: color + "18", color }}>{label}</span>;
}

// ── Modal de conteo ───────────────────────────────────
function ModalConteo({ linea, tipo, operario, onClose, onGuardado }: {
  linea: LineaConteo; tipo: "conteo" | "reconteo"; operario: string;
  onClose: () => void; onGuardado: () => void;
}) {
  const [modo, setModo] = useState<"simple" | "caja">("simple");
  const [total, setTotal] = useState("");
  const [cajas, setCajas] = useState("");
  const [undEmp, setUndEmp] = useState("");
  const [reguero, setReguero] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [onClose]);

  const calculado = modo === "caja" && cajas && undEmp
    ? parseInt(cajas) * parseInt(undEmp) + (parseInt(reguero) || 0)
    : null;

  async function guardar() {
    const body: any = { tipo, operarioNombre: operario };
    if (modo === "simple") {
      if (!total) { setError("Ingresa la cantidad"); return; }
      body.cantidadTotal = parseFloat(total);
    } else {
      if (!cajas || !undEmp) { setError("Ingresa cajas y und/emp"); return; }
      body.cajas = parseInt(cajas); body.undEmp = parseInt(undEmp); body.reguero = parseInt(reguero) || 0;
    }
    setSaving(true); setError("");
    const res = await fetch(`/api/conteo/lineas/${linea.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (json.success) onGuardado(); else setError(json.error);
    setSaving(false);
  }

  if (!mounted) return null;
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0f172a80", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 9999 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 540, padding: "1.5rem", boxShadow: "0 -12px 40px #0f172a30" }}>
        <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 1.25rem" }} />

        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: 2 }}>{linea.ubicacion}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{linea.descripcion}</div>
          <div style={{ fontSize: 13, color: "var(--muted2)", marginTop: 2 }}>PLU {linea.plu}{linea.marca ? ` · ${linea.marca}` : ""}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "0.75rem" }}>
            <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "0.4rem 0.8rem", fontSize: 12 }}>
              <span style={{ color: "var(--muted)" }}>Teórico: </span>
              <strong style={{ fontFamily: "var(--mono)" }}>{fmtNum(linea.teorico)}</strong>
            </div>
            {tipo === "reconteo" && linea.cantidadContada != null && (
              <div style={{ background: "var(--warning-tint)", borderRadius: 8, padding: "0.4rem 0.8rem", fontSize: 12 }}>
                <span style={{ color: "var(--warning)" }}>1er conteo: </span>
                <strong style={{ fontFamily: "var(--mono)", color: "var(--warning)" }}>{fmtNum(linea.cantidadContada)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Selector de modo */}
        <div style={{ display: "flex", gap: 6, marginBottom: "1rem" }}>
          {(["simple", "caja"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)} style={{ flex: 1, padding: "0.55rem", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${modo === m ? COLOR_CONTEO : "var(--border)"}`, background: modo === m ? COLOR_CONTEO : "var(--surface)", color: modo === m ? "#fff" : "var(--muted2)" }}>
              {m === "simple" ? "Cantidad total" : "Cajas + Reguero"}
            </button>
          ))}
        </div>

        {modo === "simple" && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 6 }}>Cantidad contada</label>
            <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" style={{ ...inp, fontSize: 28, fontWeight: 800 }} autoFocus />
          </div>
        )}

        {modo === "caja" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 4 }}>Cajas</label>
                <input type="number" value={cajas} onChange={(e) => setCajas(e.target.value)} placeholder="0" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 4 }}>Und/Emp</label>
                <input type="number" value={undEmp} onChange={(e) => setUndEmp(e.target.value)} placeholder="0" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 4 }}>Reguero</label>
                <input type="number" value={reguero} onChange={(e) => setReguero(e.target.value)} placeholder="0" style={inp} />
              </div>
            </div>
            {calculado != null && (
              <div style={{ textAlign: "center", background: COLOR_CONTEO + "12", border: `1px solid ${COLOR_CONTEO}30`, borderRadius: 10, padding: "0.6rem" }}>
                <span style={{ fontSize: 13, color: "var(--muted2)" }}>Total = </span>
                <strong style={{ fontSize: 22, fontFamily: "var(--mono)", color: COLOR_CONTEO }}>{calculado}</strong>
              </div>
            )}
          </div>
        )}

        {error && <div style={{ color: "var(--error)", fontSize: 12, marginBottom: "0.75rem" }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={guardar} disabled={saving} style={{ flex: 2, padding: "0.9rem", background: saving ? "#94a3b8" : COLOR_CONTEO, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <CheckCircle2 size={18} />{saving ? "Guardando…" : tipo === "reconteo" ? "Guardar reconteo" : "Guardar conteo"}
          </button>
          <button onClick={onClose} style={{ padding: "0.9rem 1rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", color: "var(--muted2)" }}>
            <X size={18} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ══════════════════════════════════════════════════════════════
// PÁGINA OPERARIO
// ══════════════════════════════════════════════════════════════
export default function ContarPage() {
  const [operario, setOperario] = useState<string | null>(null);
  const [operarios, setOperarios] = useState<OperarioCiclo[]>([]);
  const [cicloActivo, setCicloActivo] = useState<CicloConteo | null>(null);
  const [lineas, setLineas] = useState<LineaConteo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lineaSeleccionada, setLineaSeleccionada] = useState<LineaConteo | null>(null);
  const [tipoConteo, setTipoConteo] = useState<"conteo" | "reconteo">("conteo");
  const [fq, setFq] = useState("");
  const [dia, setDia] = useState<string>(""); // "" = hoy automático

  const loadOperarios = useCallback(async () => {
    const res = await fetch("/api/conteo/operarios");
    const json = await res.json();
    if (json.success) setOperarios(json.data.filter((o: OperarioCiclo) => o.activo));
    setLoading(false);
  }, []);

  const loadCicloYLineas = useCallback(async (opNombre: string, diaFiltro?: string) => {
    setLoading(true);
    // Buscar ciclo activo
    const cRes = await fetch("/api/conteo/ciclos");
    const cJson = await cRes.json();
    const activo: CicloConteo | undefined = cJson.data?.find((c: CicloConteo) => c.estado === "EN_PROGRESO" || c.estado === "EN_RECONTEO");
    if (!activo) { setCicloActivo(null); setLineas([]); setLoading(false); return; }
    setCicloActivo(activo);

    // Determinar día (si no se especifica, usar día del ciclo actual basado en fecha)
    const diasDesde = Math.floor((Date.now() - new Date(activo.fechaInicio + "T00:00:00").getTime()) / 86400000) + 1;
    const diaHoy = Math.min(Math.max(1, diasDesde), 4);
    const diaUsado = diaFiltro || String(diaHoy);

    const p = new URLSearchParams({ cicloId: activo.id, operario: opNombre });
    // Para reconteo no filtramos por día
    if (activo.estado !== "EN_RECONTEO") p.set("dia", diaUsado);
    if (activo.estado === "EN_RECONTEO") p.set("estado", "EN_RECONTEO");

    const lRes = await fetch(`/api/conteo/lineas?${p}`);
    const lJson = await lRes.json();
    if (lJson.success) setLineas(lJson.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadOperarios(); }, [loadOperarios]);

  useEffect(() => {
    if (operario) loadCicloYLineas(operario, dia);
  }, [operario, dia, loadCicloYLineas]);

  function seleccionarOperario(nombre: string) {
    setOperario(nombre);
    localStorage.setItem("conteo_operario", nombre);
  }

  // Recuperar operario de localStorage
  useEffect(() => {
    const saved = localStorage.getItem("conteo_operario");
    if (saved) setOperario(saved);
  }, []);

  const filtradas = lineas.filter((l) => {
    if (!fq) return true;
    const q = fq.toLowerCase();
    return l.plu.toLowerCase().includes(q) || l.descripcion.toLowerCase().includes(q) || l.ubicacion.toLowerCase().includes(q);
  });

  const pendientes = filtradas.filter((l) => l.estado === "PENDIENTE" || l.estado === "EN_RECONTEO").length;
  const completadas = filtradas.filter((l) => l.estado === "CONTADO" || l.estado === "OK" || l.estado === "NOVEDAD").length;

  // Pantalla de selección de operario
  if (!operario) {
    return (
      <div className="animate-fade-in" style={{ ...getModuleCssVars("conteo-contar"), maxWidth: 480, margin: "0 auto" } as React.CSSProperties}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: COLOR_CONTEO + "15", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
            <ClipboardList size={28} color={COLOR_CONTEO} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>Conteo Cíclico</h1>
          <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 6 }}>Selecciona tu nombre para ver tu lista</p>
        </div>
        {loading ? <div className="skeleton" style={{ height: 300, borderRadius: 14 }} /> : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
            {operarios.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>Sin operarios configurados. Pide al supervisor de inventario que los agregue.</div>}
            {operarios.map((o, i) => (
              <button key={o.id} onClick={() => seleccionarOperario(o.nombre)} style={{ width: "100%", padding: "1rem 1.25rem", textAlign: "left", background: "none", border: "none", borderBottom: i < operarios.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
                {o.nombre}
                <ChevronDown size={16} color="var(--muted)" style={{ transform: "rotate(-90deg)" }} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={getModuleCssVars("conteo-contar") as React.CSSProperties}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: "1rem" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Contando como</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{operario}</div>
          {cicloActivo && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{cicloActivo.nombre} · {cicloActivo.estado === "EN_RECONTEO" ? "🔁 Reconteo" : "Conteo"}</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => loadCicloYLineas(operario, dia)} style={{ padding: "0.5rem 0.8rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--muted2)" }}>↻ Actualizar</button>
          <button onClick={() => { setOperario(null); localStorage.removeItem("conteo_operario"); }} style={{ padding: "0.5rem 0.8rem", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--muted2)" }}>Cambiar</button>
        </div>
      </div>

      {!cicloActivo && !loading && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "3rem 2rem", textAlign: "center" }}>
          <ClipboardList size={40} color="var(--muted)" style={{ margin: "0 auto 1rem" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Sin ciclo activo</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>El supervisor lanzará el ciclo e importará el teórico cuando esté listo.</div>
        </div>
      )}

      {cicloActivo && (
        <>
          {/* Progreso */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "0.9rem 1.1rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted2)" }}>Tu progreso</span>
              <span style={{ fontSize: 13, fontFamily: "var(--mono)", fontWeight: 800, color: COLOR_CONTEO }}>{completadas} / {filtradas.length}</span>
            </div>
            <div style={{ height: 8, background: "var(--border)", borderRadius: 4 }}>
              <div style={{ width: filtradas.length > 0 ? `${Math.round(completadas / filtradas.length * 100)}%` : "0%", height: "100%", background: COLOR_CONTEO, borderRadius: 4, transition: "width .4s" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{pendientes} pendiente{pendientes !== 1 ? "s" : ""}</div>
          </div>

          {/* Búsqueda */}
          <div style={{ display: "flex", gap: 8, marginBottom: "0.75rem" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input value={fq} onChange={(e) => setFq(e.target.value)} placeholder="Buscar PLU, descripción, depósito…" style={{ ...inp, paddingLeft: 32, textAlign: "left", fontSize: 13 }} />
            </div>
          </div>

          {/* Lista de líneas */}
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtradas.length === 0 && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                  {fq ? "Sin resultados para esa búsqueda" : "Sin líneas asignadas para hoy"}
                </div>
              )}
              {filtradas.map((l) => {
                const pendiente = l.estado === "PENDIENTE" || l.estado === "EN_RECONTEO";
                const esReconteo = l.estado === "EN_RECONTEO";
                const color = LINEA_ESTADO_COLOR[l.estado as keyof typeof LINEA_ESTADO_COLOR];
                return (
                  <div key={l.id} style={{ background: "var(--surface)", border: `1px solid ${pendiente ? "var(--border)" : color + "30"}`, borderRadius: 14, padding: "0.85rem 1rem", opacity: l.estado === "OK" ? 0.7 : 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted2)", background: "var(--surface2)", padding: "1px 6px", borderRadius: 6 }}>{l.ubicacion}</span>
                          <Badge label={l.estado === "PENDIENTE" ? "Pendiente" : l.estado === "EN_RECONTEO" ? "Reconteo" : l.estado === "CONTADO" ? "Contado" : l.estado === "OK" ? "OK" : "Novedad"} color={color} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{l.descripcion}</div>
                        <div style={{ fontSize: 12, color: "var(--muted2)", marginTop: 2 }}>PLU {l.plu}{l.marca ? ` · ${l.marca}` : ""}</div>
                        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12 }}>
                          <span style={{ color: "var(--muted)" }}>Teórico: <strong style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{fmtNum(l.teorico)}</strong></span>
                          {l.cantidadContada != null && <span style={{ color: "var(--muted)" }}>Contado: <strong style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{fmtNum(l.cantidadContada)}</strong></span>}
                        </div>
                      </div>
                      {pendiente && (
                        <button
                          onClick={() => { setLineaSeleccionada(l); setTipoConteo(esReconteo ? "reconteo" : "conteo"); }}
                          style={{ padding: "0.6rem 1rem", background: COLOR_CONTEO, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          {esReconteo ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                          {esReconteo ? "Recontar" : "Contar"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {lineaSeleccionada && (
        <ModalConteo
          linea={lineaSeleccionada}
          tipo={tipoConteo}
          operario={operario}
          onClose={() => setLineaSeleccionada(null)}
          onGuardado={() => {
            setLineaSeleccionada(null);
            loadCicloYLineas(operario, dia);
          }}
        />
      )}
    </div>
  );
}
