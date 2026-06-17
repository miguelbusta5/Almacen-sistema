"use client";

import { useState } from "react";
import type { StudioComponent, StudioFuenteData, ComponentConfig, ComponentStyle } from "@/types/studio";

type PropTab = "config" | "estilo";

interface Props {
  component: StudioComponent | null;
  fuentes: StudioFuenteData[];
  onUpdate: (id: string, updates: Partial<StudioComponent>) => void;
  onDelete: (id: string) => void;
}

const AGG_OPTIONS = [
  { value: "sum", label: "Suma" },
  { value: "count", label: "Conteo" },
  { value: "avg", label: "Promedio" },
  { value: "min", label: "Mínimo" },
  { value: "max", label: "Máximo" },
  { value: "ninguna", label: "Ninguna" },
];

const FORMAT_OPTIONS = [
  { value: "entero", label: "Entero" },
  { value: "decimal", label: "Decimal" },
  { value: "moneda", label: "Moneda (COP)" },
  { value: "porcentaje", label: "Porcentaje" },
];

export function StudioPropertiesPanel({ component, fuentes, onUpdate, onDelete }: Props) {
  const [tab, setTab] = useState<PropTab>("config");

  if (!component) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <p style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
          Selecciona un componente para ver sus propiedades
        </p>
      </div>
    );
  }

  const fuente = fuentes.find((f) => f.id === component.config.fuenteId);
  const camposDisponibles = fuente
    ? [...fuente.campos.filter((c) => !c.oculto).map((c) => c.alias ?? c.nombre), ...fuente.camposFormulados.map((c) => c.nombre)]
    : [];

  function updateConfig(patch: Partial<ComponentConfig>) {
    onUpdate(component!.id, { config: { ...component!.config, ...patch } });
  }
  function updateEstilo(patch: Partial<ComponentStyle>) {
    onUpdate(component!.id, { estilo: { ...component!.estilo, ...patch } });
  }

  const tabStyle = (t: PropTab): React.CSSProperties => ({
    flex: 1,
    padding: "7px",
    fontSize: 12,
    fontWeight: tab === t ? 700 : 500,
    color: tab === t ? "var(--brand)" : "var(--muted2)",
    background: tab === t ? "var(--brand-tint)" : "transparent",
    border: "none",
    borderBottom: tab === t ? "2px solid var(--brand)" : "2px solid transparent",
    cursor: "pointer",
  });

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    fontSize: 12,
    border: "1px solid var(--border)",
    borderRadius: 6,
    background: "var(--surface)",
    color: "var(--foreground)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted2)",
    marginBottom: 2,
    display: "block",
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "10px 12px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          {component.tipo.toUpperCase()}
        </div>
        <div style={{ display: "flex" }}>
          <button style={tabStyle("config")} onClick={() => setTab("config")}>Configuración</button>
          <button style={tabStyle("estilo")} onClick={() => setTab("estilo")}>Estilo</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>

        {tab === "config" && (
          <>
            {/* Fuente de datos */}
            {component.tipo !== "texto" && component.tipo !== "separador" && (
              <div>
                <label style={labelStyle}>Fuente de datos</label>
                <select
                  style={fieldStyle}
                  value={component.config.fuenteId ?? ""}
                  onChange={(e) => updateConfig({ fuenteId: e.target.value || undefined })}
                >
                  <option value="">Sin fuente</option>
                  {fuentes.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dimensión */}
            {(component.tipo === "barra" || component.tipo === "tabla") && (
              <div>
                <label style={labelStyle}>Dimensión (Eje X / Agrupación)</label>
                <select
                  style={fieldStyle}
                  value={component.config.dimension ?? ""}
                  onChange={(e) => updateConfig({ dimension: e.target.value || undefined })}
                >
                  <option value="">Seleccionar campo…</option>
                  {camposDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Métrica */}
            {component.tipo !== "texto" && component.tipo !== "separador" && component.tipo !== "tabla" && (
              <div>
                <label style={labelStyle}>Métrica (Valor)</label>
                <select
                  style={fieldStyle}
                  value={component.config.metrica ?? ""}
                  onChange={(e) => updateConfig({ metrica: e.target.value || undefined })}
                >
                  <option value="">Seleccionar campo…</option>
                  {camposDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Agregación */}
            {(component.tipo === "kpi" || component.tipo === "barra") && (
              <div>
                <label style={labelStyle}>Agregación</label>
                <select
                  style={fieldStyle}
                  value={component.config.agregacion ?? "sum"}
                  onChange={(e) => updateConfig({ agregacion: e.target.value as ComponentConfig["agregacion"] })}
                >
                  {AGG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}

            {/* Columnas tabla */}
            {component.tipo === "tabla" && camposDisponibles.length > 0 && (
              <div>
                <label style={labelStyle}>Columnas a mostrar</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 150, overflow: "auto" }}>
                  {camposDisponibles.map((c) => {
                    const selected = component.config.columnas?.includes(c) ?? true;
                    return (
                      <label key={c} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const current = component.config.columnas ?? camposDisponibles;
                            const next = e.target.checked
                              ? [...current, c]
                              : current.filter((x) => x !== c);
                            updateConfig({ columnas: next });
                          }}
                        />
                        {c}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Límite filas */}
            {component.tipo !== "texto" && component.tipo !== "separador" && (
              <div>
                <label style={labelStyle}>Límite de filas</label>
                <input
                  type="number"
                  style={fieldStyle}
                  value={component.config.limiteFilas ?? ""}
                  onChange={(e) => updateConfig({ limiteFilas: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="Sin límite"
                  min={1}
                />
              </div>
            )}

            {/* Contenido texto */}
            {component.tipo === "texto" && (
              <div>
                <label style={labelStyle}>Contenido</label>
                <textarea
                  style={{ ...fieldStyle, minHeight: 60, resize: "vertical" }}
                  value={component.config.contenido ?? ""}
                  onChange={(e) => updateConfig({ contenido: e.target.value })}
                  placeholder="Escribe el texto aquí…"
                />
              </div>
            )}

            {/* URL Imagen */}
            {component.tipo === "imagen" && (
              <div>
                <label style={labelStyle}>URL de la imagen</label>
                <input
                  style={fieldStyle}
                  value={component.config.urlImagen ?? ""}
                  onChange={(e) => updateConfig({ urlImagen: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}
          </>
        )}

        {tab === "estilo" && (
          <>
            <div>
              <label style={labelStyle}>Título</label>
              <input style={fieldStyle} value={component.estilo.titulo ?? ""} onChange={(e) => updateEstilo({ titulo: e.target.value })} placeholder="Título del componente" />
            </div>
            <div>
              <label style={labelStyle}>Subtítulo</label>
              <input style={fieldStyle} value={component.estilo.subtitulo ?? ""} onChange={(e) => updateEstilo({ subtitulo: e.target.value })} placeholder="Texto secundario" />
            </div>
            <div>
              <label style={labelStyle}>Color principal</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="color" value={component.estilo.color ?? "#1D4ED8"} onChange={(e) => updateEstilo({ color: e.target.value })} style={{ width: 32, height: 32, border: "none", cursor: "pointer", borderRadius: 4 }} />
                <input style={{ ...fieldStyle, flex: 1 }} value={component.estilo.color ?? "#1D4ED8"} onChange={(e) => updateEstilo({ color: e.target.value })} />
              </div>
            </div>
            {component.tipo === "kpi" && (
              <div>
                <label style={labelStyle}>Tamaño de texto (px)</label>
                <input type="number" style={fieldStyle} value={component.estilo.tamanoTexto ?? 36} onChange={(e) => updateEstilo({ tamanoTexto: parseInt(e.target.value) || 36 })} min={12} max={80} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Formato de número</label>
              <select style={fieldStyle} value={component.estilo.formatoNumero ?? "entero"} onChange={(e) => updateEstilo({ formatoNumero: e.target.value as ComponentStyle["formatoNumero"] })}>
                {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {(component.tipo === "barra" || component.tipo === "linea" || component.tipo === "pie") && (
              <>
                <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={component.estilo.mostrarLeyenda ?? false} onChange={(e) => updateEstilo({ mostrarLeyenda: e.target.checked })} />
                  Mostrar leyenda
                </label>
                <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={component.estilo.mostrarEtiquetas ?? false} onChange={(e) => updateEstilo({ mostrarEtiquetas: e.target.checked })} />
                  Mostrar etiquetas
                </label>
              </>
            )}
          </>
        )}
      </div>

      {/* Footer — eliminar */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => onDelete(component.id)}
          style={{ width: "100%", padding: "7px", fontSize: 12, background: "transparent", border: "1px solid #FCA5A5", color: "#EF4444", borderRadius: 6, cursor: "pointer" }}
        >
          Eliminar componente
        </button>
      </div>
    </div>
  );
}
