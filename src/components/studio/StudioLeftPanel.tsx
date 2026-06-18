"use client";

import { useState } from "react";
import type {
  StudioFuenteData,
  StudioComponentType,
  FieldDef,
  FormulaField,
  Parametro,
  ColumnPreview,
} from "@/types/studio";

type LeftTab = "datos" | "campos" | "calculados" | "parametros" | "componentes";

interface Props {
  fuentes: StudioFuenteData[];
  onAddFuente: (f: { nombre: string; urlSheets: string; hojaActiva: string; campos: FieldDef[] }) => void;
  onUpdateFields: (fuenteId: string, campos: FieldDef[]) => void;
  onUpdateFormulas: (fuenteId: string, formulas: FormulaField[]) => void;
  onUpdateParametros: (fuenteId: string, parametros: Parametro[]) => void;
  onAddComponent: (tipo: StudioComponentType) => void;
}

const COMPONENT_TYPES: { tipo: StudioComponentType; label: string; icon: string }[] = [
  { tipo: "kpi", label: "KPI", icon: "📊" },
  { tipo: "tabla", label: "Tabla", icon: "📋" },
  { tipo: "barra", label: "Gráfico Barras", icon: "📈" },
  { tipo: "texto", label: "Texto", icon: "📝" },
  { tipo: "separador", label: "Separador", icon: "—" },
];

export function StudioLeftPanel({
  fuentes,
  onAddFuente,
  onUpdateFields,
  onUpdateFormulas,
  onUpdateParametros,
  onAddComponent,
}: Props) {
  const [tab, setTab] = useState<LeftTab>("datos");
  const [activeFuenteIdx, setActiveFuenteIdx] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", url: "", hoja: "" });
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState<ColumnPreview[] | null>(null);
  const [newFormula, setNewFormula] = useState({ nombre: "", formula: "" });
  const [newParam, setNewParam] = useState({ nombre: "", tipo: "texto" as Parametro["tipo"] });

  const fuente = fuentes[activeFuenteIdx] ?? null;

  async function handleConnect() {
    if (!form.url.trim() || !form.nombre.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/studio/datos/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.url.trim(), hoja: form.hoja.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setConnectError(d.error ?? "Error"); return; }
      const campos: FieldDef[] = d.columnas.map((c: ColumnPreview) => ({ nombre: c.nombre, tipo: c.tipo }));
      setPreview(d.columnas);
      onAddFuente({ nombre: form.nombre.trim(), urlSheets: form.url.trim(), hojaActiva: form.hoja.trim(), campos });
      setForm({ nombre: "", url: "", hoja: "" });
      setShowForm(false);
    } catch {
      setConnectError("Error de red");
    } finally {
      setConnecting(false);
    }
  }

  const tabStyle = (t: LeftTab): React.CSSProperties => ({
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: tab === t ? 700 : 500,
    color: tab === t ? "var(--brand)" : "var(--muted2)",
    background: tab === t ? "var(--brand-tint)" : "transparent",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2, padding: "10px 8px 6px", borderBottom: "1px solid var(--border)" }}>
        {(["datos", "campos", "calculados", "parametros", "componentes"] as LeftTab[]).map((t) => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>
            {t === "datos" ? "Datos" : t === "campos" ? "Campos" : t === "calculados" ? "Calculados" : t === "parametros" ? "Parámetros" : "Componentes"}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "10px 10px" }}>

        {/* ── DATOS ── */}
        {tab === "datos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {fuentes.map((f, i) => (
              <div
                key={f.id}
                onClick={() => setActiveFuenteIdx(i)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: i === activeFuenteIdx ? "1px solid var(--brand)" : "1px solid var(--border)",
                  background: i === activeFuenteIdx ? "var(--brand-tint)" : "var(--surface2)",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--text)" }}>{f.nombre}</div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
                  {f.campos.length} campo{f.campos.length !== 1 ? "s" : ""}
                  {f.hojaActiva ? ` · ${f.hojaActiva}` : ""}
                </div>
              </div>
            ))}

            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                style={{ padding: "8px", fontSize: 12, borderRadius: 8, border: "1px dashed var(--border)", background: "transparent", color: "var(--brand)", cursor: "pointer" }}
              >
                + Conectar Google Sheets
              </button>
            )}

            {showForm && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--border)" }}>
                <input
                  placeholder="Nombre de la fuente"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}
                />
                <input
                  placeholder="URL del Google Sheet"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}
                />
                <input
                  placeholder="Pestaña (opcional)"
                  value={form.hoja}
                  onChange={(e) => setForm((f) => ({ ...f, hoja: e.target.value }))}
                  style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}
                />
                {connectError && <div style={{ fontSize: 11, color: "#EF4444" }}>{connectError}</div>}
                {preview && (
                  <div style={{ fontSize: 11, color: "#22C55E" }}>✓ {preview.length} columnas detectadas</div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    style={{ flex: 1, padding: "7px", fontSize: 12, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 6, cursor: connecting ? "wait" : "pointer" }}
                  >
                    {connecting ? "Conectando…" : "Conectar"}
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setConnectError(null); setPreview(null); }}
                    style={{ padding: "7px 10px", fontSize: 12, background: "transparent", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--muted2)" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CAMPOS ── */}
        {tab === "campos" && (
          <div>
            {!fuente ? (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Conecta una fuente primero.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {fuente.campos.filter((c) => !c.oculto).map((campo, ci) => (
                  <div key={ci} style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 8px", background: "var(--surface2)", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <div style={{ flex: 1, fontSize: 11, color: "var(--muted2)", fontFamily: "var(--mono)" }}>{campo.nombre}</div>
                    <input
                      value={campo.alias ?? ""}
                      placeholder="Alias"
                      onChange={(e) => {
                        const updatedCampos = fuente.campos.map((c, i) => i === ci ? { ...c, alias: e.target.value || undefined } : c);
                        onUpdateFields(fuente.id, updatedCampos);
                      }}
                      style={{ width: 80, padding: "3px 6px", fontSize: 11, border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)" }}
                    />
                    <span style={{ fontSize: 10, color: "var(--muted)", minWidth: 40 }}>{campo.tipo}</span>
                    <button
                      onClick={() => {
                        const updatedCampos = fuente.campos.map((c, i) => i === ci ? { ...c, oculto: true } : c);
                        onUpdateFields(fuente.id, updatedCampos);
                      }}
                      style={{ fontSize: 11, border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {fuente.campos.some((c) => c.oculto) && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    {fuente.campos.filter((c) => c.oculto).length} campo(s) oculto(s)
                    <button
                      onClick={() => onUpdateFields(fuente.id, fuente.campos.map((c) => ({ ...c, oculto: false })))}
                      style={{ marginLeft: 6, fontSize: 11, border: "none", background: "transparent", cursor: "pointer", color: "var(--brand)" }}
                    >
                      Mostrar todos
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CALCULADOS ── */}
        {tab === "calculados" && (
          <div>
            {!fuente ? (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Conecta una fuente primero.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fuente.camposFormulados.map((f, fi) => (
                  <div key={fi} style={{ padding: "8px 10px", background: "var(--surface2)", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}>
                    <div style={{ fontWeight: 700 }}>{f.nombre}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted2)" }}>{f.formula}</div>
                    <button
                      onClick={() => onUpdateFormulas(fuente.id, fuente.camposFormulados.filter((_, i) => i !== fi))}
                      style={{ fontSize: 10, color: "#EF4444", border: "none", background: "transparent", cursor: "pointer", marginTop: 4 }}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <input
                    placeholder="Nombre del campo (ej: Margen)"
                    value={newFormula.nombre}
                    onChange={(e) => setNewFormula((f) => ({ ...f, nombre: e.target.value }))}
                    style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}
                  />
                  <input
                    placeholder="Fórmula (ej: Ventas - Costo)"
                    value={newFormula.formula}
                    onChange={(e) => setNewFormula((f) => ({ ...f, formula: e.target.value }))}
                    style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", fontFamily: "var(--mono)" }}
                  />
                  <button
                    onClick={() => {
                      if (!newFormula.nombre.trim() || !newFormula.formula.trim()) return;
                      const updated: FormulaField[] = [...fuente.camposFormulados, { id: crypto.randomUUID(), nombre: newFormula.nombre.trim(), formula: newFormula.formula.trim(), tipo: "numero" }];
                      onUpdateFormulas(fuente.id, updated);
                      setNewFormula({ nombre: "", formula: "" });
                    }}
                    style={{ padding: "6px", fontSize: 12, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                  >
                    + Agregar campo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PARÁMETROS ── */}
        {tab === "parametros" && (
          <div>
            {!fuente ? (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Conecta una fuente primero.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fuente.parametros.map((p, pi) => (
                  <div key={pi} style={{ padding: "8px 10px", background: "var(--surface2)", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12 }}>
                    <div style={{ fontWeight: 700 }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.tipo}</div>
                    <button
                      onClick={() => onUpdateParametros(fuente.id, fuente.parametros.filter((_, i) => i !== pi))}
                      style={{ fontSize: 10, color: "#EF4444", border: "none", background: "transparent", cursor: "pointer", marginTop: 4 }}
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <input
                    placeholder="Nombre del parámetro"
                    value={newParam.nombre}
                    onChange={(e) => setNewParam((p) => ({ ...p, nombre: e.target.value }))}
                    style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}
                  />
                  <select
                    value={newParam.tipo}
                    onChange={(e) => setNewParam((p) => ({ ...p, tipo: e.target.value as Parametro["tipo"] }))}
                    style={{ padding: "6px 8px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}
                  >
                    <option value="texto">Texto</option>
                    <option value="numero">Número</option>
                    <option value="fecha">Fecha</option>
                    <option value="lista">Lista</option>
                  </select>
                  <button
                    onClick={() => {
                      if (!newParam.nombre.trim()) return;
                      const updated: Parametro[] = [...fuente.parametros, { id: crypto.randomUUID(), nombre: newParam.nombre.trim(), tipo: newParam.tipo }];
                      onUpdateParametros(fuente.id, updated);
                      setNewParam({ nombre: "", tipo: "texto" });
                    }}
                    style={{ padding: "6px", fontSize: 12, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                  >
                    + Agregar parámetro
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── COMPONENTES ── */}
        {tab === "componentes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Haz clic para agregar al lienzo</p>
            {COMPONENT_TYPES.map((c) => (
              <button
                key={c.tipo}
                onClick={() => onAddComponent(c.tipo)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text)",
                  transition: "border-color .14s",
                }}
              >
                <span style={{ fontSize: 18 }}>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
