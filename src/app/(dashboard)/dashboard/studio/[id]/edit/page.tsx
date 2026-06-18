"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ReactGridLayout from "react-grid-layout";
import type { LayoutItem as RglLayoutItem, Layout as RglLayout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type {
  StudioDashboardData,
  StudioFuenteData,
  StudioComponent,
  StudioComponentType,
  LayoutItem,
  FieldDef,
  FormulaField,
  Parametro,
} from "@/types/studio";
import { StudioLeftPanel } from "@/components/studio/StudioLeftPanel";
import { StudioPropertiesPanel } from "@/components/studio/StudioPropertiesPanel";
import { ComponentRenderer } from "@/components/studio/ComponentRenderer";

function defaultLayout(tipo: StudioComponentType): { w: number; h: number } {
  switch (tipo) {
    case "kpi": return { w: 3, h: 2 };
    case "tabla": return { w: 6, h: 4 };
    case "barra": return { w: 6, h: 4 };
    case "linea": return { w: 8, h: 4 };
    case "pie": return { w: 4, h: 4 };
    case "texto": return { w: 4, h: 1 };
    case "separador": return { w: 12, h: 1 };
    case "imagen": return { w: 3, h: 3 };
    default: return { w: 4, h: 3 };
  }
}

export default function StudioEditorPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [dashboard, setDashboard] = useState<StudioDashboardData | null>(null);
  const [fuentes, setFuentes] = useState<StudioFuenteData[]>([]);
  const [componentes, setComponentes] = useState<StudioComponent[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nombre, setNombre] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(900);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/studio/dashboards/${id}`);
      if (!res.ok) { router.push("/dashboard/studio"); return; }
      const d = await res.json();
      const db: StudioDashboardData = d.dashboard;
      setDashboard(db);
      setNombre(db.nombre);
      setFuentes(db.fuentes);
      setComponentes(db.componentes as StudioComponent[]);
      setLayout(db.layout as LayoutItem[]);
    }
    load();
  }, [id, router]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setCanvasWidth(entry.contentRect.width);
    });
    if (canvasRef.current) observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  const save = useCallback(async (
    overrideComponentes?: StudioComponent[],
    overrideLayout?: LayoutItem[],
    overrideFuentes?: StudioFuenteData[],
    overrideNombre?: string
  ) => {
    setSaving(true);
    try {
      await fetch(`/api/studio/dashboards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: overrideNombre ?? nombre,
          componentes: overrideComponentes ?? componentes,
          layout: overrideLayout ?? layout,
          fuentes: (overrideFuentes ?? fuentes).map((f) => ({
            id: f.id,
            nombre: f.nombre,
            tipo: f.tipo,
            urlSheets: f.urlSheets,
            hojaActiva: f.hojaActiva,
            campos: f.campos,
            camposFormulados: f.camposFormulados,
            parametros: f.parametros,
            combinaciones: f.combinaciones,
          })),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      dirty.current = false;
    } finally {
      setSaving(false);
    }
  }, [id, nombre, componentes, layout, fuentes]);

  function markDirty() { dirty.current = true; }

  function addComponent(tipo: StudioComponentType) {
    const compId = crypto.randomUUID();
    const def = defaultLayout(tipo);
    const newComp: StudioComponent = {
      id: compId,
      tipo,
      config: {},
      estilo: {},
    };
    const newLayoutItem: LayoutItem = {
      i: compId,
      x: 0,
      y: Infinity,
      ...def,
      minW: 2,
      minH: 1,
    };
    const updatedComp = [...componentes, newComp];
    const updatedLayout = [...layout, newLayoutItem];
    setComponentes(updatedComp);
    setLayout(updatedLayout);
    setSelectedId(compId);
    markDirty();
  }

  function updateComponent(compId: string, updates: Partial<StudioComponent>) {
    setComponentes((prev) =>
      prev.map((c) => c.id === compId ? { ...c, ...updates, config: { ...c.config, ...(updates.config ?? {}) }, estilo: { ...c.estilo, ...(updates.estilo ?? {}) } } : c)
    );
    markDirty();
  }

  function deleteComponent(compId: string) {
    setComponentes((prev) => prev.filter((c) => c.id !== compId));
    setLayout((prev) => prev.filter((l) => l.i !== compId));
    if (selectedId === compId) setSelectedId(null);
    markDirty();
  }

  function handleLayoutChange(newLayout: RglLayout) {
    setLayout(Array.from(newLayout).map((l: RglLayoutItem) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })));
    markDirty();
  }

  function addFuente(f: { nombre: string; urlSheets: string; hojaActiva: string; campos: FieldDef[] }) {
    const newFuente: StudioFuenteData = {
      id: crypto.randomUUID(),
      dashboardId: id,
      nombre: f.nombre,
      tipo: "sheets_csv",
      urlSheets: f.urlSheets,
      hojaActiva: f.hojaActiva || null,
      campos: f.campos,
      camposFormulados: [],
      parametros: [],
      combinaciones: [],
      syncedAt: new Date().toISOString(),
    };
    const updated = [...fuentes, newFuente];
    setFuentes(updated);
    save(componentes, layout, updated);
  }

  function updateFields(fuenteId: string, campos: FieldDef[]) {
    setFuentes((prev) => prev.map((f) => f.id === fuenteId ? { ...f, campos } : f));
    markDirty();
  }

  function updateFormulas(fuenteId: string, camposFormulados: FormulaField[]) {
    setFuentes((prev) => prev.map((f) => f.id === fuenteId ? { ...f, camposFormulados } : f));
    markDirty();
  }

  function updateParametros(fuenteId: string, parametros: Parametro[]) {
    setFuentes((prev) => prev.map((f) => f.id === fuenteId ? { ...f, parametros } : f));
    markDirty();
  }

  const selectedComp = componentes.find((c) => c.id === selectedId) ?? null;

  if (!dashboard) {
    return <div style={{ padding: 40, color: "var(--muted)" }}>Cargando editor…</div>;
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--surface2)" }}>
      {/* ── TOP BAR ── */}
      <div style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 16px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <Link href="/dashboard/studio" style={{ textDecoration: "none" }}>
          <button style={{ padding: "5px 10px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "transparent", color: "var(--muted2)" }}>
            ← Volver
          </button>
        </Link>

        {editingName ? (
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => { setEditingName(false); save(undefined, undefined, undefined, nombre); }}
            onKeyDown={(e) => { if (e.key === "Enter") { setEditingName(false); save(undefined, undefined, undefined, nombre); } }}
            style={{ fontSize: 15, fontWeight: 700, border: "none", outline: "1px solid var(--brand)", borderRadius: 4, padding: "3px 7px", background: "var(--surface2)", color: "var(--text)" }}
          />
        ) : (
          <h1
            onClick={() => setEditingName(true)}
            style={{ margin: 0, fontSize: 15, fontWeight: 700, cursor: "text", color: "var(--text)" }}
            title="Clic para editar el nombre"
          >
            {nombre}
          </h1>
        )}

        <div style={{ flex: 1 }} />

        <Link href={`/dashboard/studio/${id}/view`} style={{ textDecoration: "none" }}>
          <button style={{ padding: "6px 14px", fontSize: 12, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", background: "transparent", color: "var(--text)" }}>
            Vista previa
          </button>
        </Link>

        <button
          onClick={() => save()}
          disabled={saving}
          style={{
            padding: "6px 16px", fontSize: 12, border: "none", borderRadius: 6, cursor: saving ? "wait" : "pointer",
            background: saved ? "#22C55E" : "var(--brand)", color: "#fff", fontWeight: 700, transition: "background .2s",
          }}
        >
          {saving ? "Guardando…" : saved ? "✓ Guardado" : "Guardar"}
        </button>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── PANEL IZQ ── */}
        <div style={{
          width: 260,
          flexShrink: 0,
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          <StudioLeftPanel
            fuentes={fuentes}
            onAddFuente={addFuente}
            onUpdateFields={updateFields}
            onUpdateFormulas={updateFormulas}
            onUpdateParametros={updateParametros}
            onAddComponent={addComponent}
          />
        </div>

        {/* ── LIENZO ── */}
        <div
          ref={canvasRef}
          style={{
            flex: 1,
            overflow: "auto",
            padding: 20,
            background: "var(--surface2)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          {componentes.length === 0 ? (
            <div style={{
              height: 300,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: "2px dashed var(--border)",
              borderRadius: 12,
              color: "var(--muted)",
              fontSize: 13,
              gap: 8,
            }}>
              <span style={{ fontSize: 32 }}>📊</span>
              Agrega componentes desde el panel izquierdo
            </div>
          ) : (
            <ReactGridLayout
              className="layout"
              width={canvasWidth - 40}
              layout={layout as RglLayout}
              gridConfig={{ cols: 12, rowHeight: 80, margin: [10, 10] as const, containerPadding: null, maxRows: Infinity }}
              dragConfig={{ enabled: true, handle: ".drag-handle", bounded: false, threshold: 3 }}
              resizeConfig={{ enabled: true, handles: ["se"] as const }}
              onLayoutChange={handleLayoutChange}
            >
              {componentes.map((comp) => (
                <div key={comp.id} style={{ overflow: "hidden" }}>
                  <ComponentRenderer
                    component={comp}
                    isSelected={selectedId === comp.id}
                    onSelect={() => setSelectedId(comp.id)}
                  />
                </div>
              ))}
            </ReactGridLayout>
          )}
        </div>

        {/* ── PANEL DER ── */}
        <div style={{
          width: 280,
          flexShrink: 0,
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          <StudioPropertiesPanel
            component={selectedComp}
            fuentes={fuentes}
            onUpdate={updateComponent}
            onDelete={deleteComponent}
          />
        </div>
      </div>
    </div>
  );
}
