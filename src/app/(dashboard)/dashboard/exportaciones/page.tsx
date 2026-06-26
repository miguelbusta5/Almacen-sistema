"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { BarChart3, CheckCircle2, ChevronDown, ChevronUp, Clock, Pencil, RefreshCw, Search, Tags, Trash2 } from "lucide-react";
import { EmptyState, ModuleHero, SkeletonTable } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { getModuleColor, getModuleCssVars } from "@/lib/moduleTheme";
import { puedeGestionarExportaciones, puedeUsarExportaciones } from "@/lib/exportaciones";
import { useIsMobile } from "@/lib/useIsMobile";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { RegistrosTable, ProductividadTable, fmtTime, type Exportacion, type UserStat } from "./_components";

const COLOR = getModuleColor("exportaciones");


function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function sumarDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function fmtRango(desde: string, hasta: string): string {
  if (!desde || !hasta) return "Hoy";
  if (desde === hasta) return desde;
  return `${desde} → ${hasta}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {label}
      {children}
    </label>
  );
}

async function lookupDescripcion(plu: string) {
  const clean = plu.trim();
  if (!clean) return null;
  const res = await fetch(`/api/productos-maestro/${encodeURIComponent(clean)}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.data?.descripcion as string | null;
}

export default function ExportacionesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isMobile = useIsMobile();
  const canUse = puedeUsarExportaciones(role);
  const canManage = puedeGestionarExportaciones(role);

  const [items, setItems] = useState<Exportacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<UserStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [statsOperario, setStatsOperario] = useState("");
  const [statsDesde, setStatsDesde] = useState("");
  const [statsHasta, setStatsHasta] = useState("");
  const [query, setQuery] = useState("");
  const [fecha, setFecha] = useState("");
  const [estado, setEstado] = useState("");
  const [operarioFiltro, setOperarioFiltro] = useState("");
  const [operarios, setOperarios] = useState<{ id: string; nombre: string }[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const PAGE_SIZE = 40;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const [form, setForm] = useState({ numeroCaja: "", plu: "", descripcion: "", unidadEmpaque: "1" });
  const [editing, setEditing] = useState<Exportacion | null>(null);
  const [editForm, setEditForm] = useState({ numeroCaja: "", plu: "", descripcion: "", unidadEmpaque: "1", horaInicio: "", horaFinalizacion: "", motivoCorreccion: "" });
  const [debugTable, setDebugTable] = useState(false);

  // Modo debug de tabla: /dashboard/exportaciones?debugTable=1 (diagnóstico de mapeo de columnas).
  useEffect(() => { setDebugTable(new URLSearchParams(window.location.search).get("debugTable") === "1"); }, []);

  const openItem = useMemo(() => items.find((item) => !item.horaFinalizacion) ?? null, [items]);
  const formDirty = Boolean(form.numeroCaja.trim() || form.plu.trim() || form.descripcion.trim());
  const statsFiltrados = useMemo(
    () => (statsOperario ? stats.filter((s) => s.id === statsOperario) : stats),
    [stats, statsOperario],
  );

  async function load(targetPage = page) {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (fecha) params.set("fecha", fecha);
    if (estado) params.set("estado", estado);
    if (operarioFiltro) params.set("usuarioId", operarioFiltro);
    params.set("page", String(targetPage));
    params.set("pageSize", String(PAGE_SIZE));
    const res = await fetch(`/api/exportaciones?${params.toString()}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      setItems(json.data ?? []);
      setTotalItems(json.total ?? 0);
    } else {
      setError(json.error ?? "No se pudo cargar Exportaciones");
    }
    setLoading(false);
  }

  async function loadStats(desde = statsDesde, hasta = statsHasta) {
    if (!canManage) return;
    setLoadingStats(true);
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    const res = await fetch(`/api/exportaciones/stats?${params.toString()}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) setStats(json.data ?? []);
    setLoadingStats(false);
  }

  async function loadOperarios() {
    if (!canManage) return;
    const res = await fetch("/api/exportaciones/operarios");
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) setOperarios(json.data ?? []);
  }

  function aplicarRangoStats(desde: string, hasta: string) {
    setStatsDesde(desde);
    setStatsHasta(hasta);
    loadStats(desde, hasta);
  }

  useEffect(() => { if (canUse) load(1); }, [canUse]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!canManage) return;
    loadOperarios();
    const hasta = hoyBogota();
    const desde = sumarDias(hasta, -6); // acumulado de los últimos 7 días por defecto
    setStatsDesde(desde);
    setStatsHasta(hasta);
    loadStats(desde, hasta);
  }, [canManage]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoRefresh = useAutoRefresh({
    enabled: canUse,
    pause: Boolean(editing || saving || finalizing || formDirty),
    onRefresh: () => load(),
  });

  async function autocomplete(plu: string, target: "create" | "edit") {
    const descripcion = await lookupDescripcion(plu);
    if (target === "create") setForm((f) => ({ ...f, descripcion: descripcion ?? "" }));
    else setEditForm((f) => ({ ...f, descripcion: descripcion ?? "" }));
    if (!descripcion && plu.trim()) setError("PLU no encontrado en maestro");
    else setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/exportaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numeroCaja:    form.numeroCaja,
        plu:           form.plu,
        unidadEmpaque: Number(form.unidadEmpaque),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "No se pudo guardar");
      return;
    }
    setForm({ numeroCaja: "", plu: "", descripcion: "", unidadEmpaque: "1" });
    await load();
  }

  async function finalize() {
    if (!openItem) return;
    setFinalizing(true);
    setError("");
    const res = await fetch(`/api/exportaciones/${openItem.id}/finalize`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setFinalizing(false);
    if (!res.ok) { setError(json.error ?? "No se pudo finalizar"); return; }
    await load();
  }

  function startEdit(item: Exportacion) {
    setEditing(item);
    setEditForm({
      numeroCaja:     item.numeroCaja,
      plu:            item.plu,
      descripcion:    item.descripcion,
      unidadEmpaque:  String(item.unidadEmpaque),
      horaInicio:     item.horaInicio.slice(0, 16),
      horaFinalizacion: item.horaFinalizacion ? item.horaFinalizacion.slice(0, 16) : "",
      motivoCorreccion: "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    const payload: any = {
      numeroCaja:       editForm.numeroCaja,
      plu:              editForm.plu,
      unidadEmpaque:    Number(editForm.unidadEmpaque),
      motivoCorreccion: editForm.motivoCorreccion || undefined,
    };
    if (editForm.horaInicio) payload.horaInicio = new Date(editForm.horaInicio).toISOString();
    payload.horaFinalizacion = editForm.horaFinalizacion ? new Date(editForm.horaFinalizacion).toISOString() : null;
    const res = await fetch(`/api/exportaciones/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "No se pudo editar");
      return;
    }
    setEditing(null);
    await load();
  }

  async function remove(item: Exportacion) {
    if (!window.confirm(`Borrar caja ${item.numeroCaja}?`)) return;
    const res = await fetch(`/api/exportaciones/${item.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivoCorreccion: "Borrado desde gestion Exportaciones" }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "No se pudo borrar");
      return;
    }
    await load();
  }

  if (!session) return <SkeletonTable rows={6} cols={4} />;
  if (!canUse) return <EmptyState icon={<Tags size={28} />} title="Sin acceso" description="Tu rol no tiene acceso al modulo Exportaciones." />;

  const captureCard = (
    <section className="op-panel" style={{ "--module-color": COLOR, padding: isMobile ? 16 : 18 } as React.CSSProperties}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 26, letterSpacing: 0 }}>Exportaciones</h1>
          <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 13 }}>Captura de etiquetado por caja y PLU maestro</p>
        </div>
        <span style={{ width: 44, height: 44, borderRadius: 10, display: "grid", placeItems: "center", background: `${COLOR}26`, color: COLOR }}>
          <Tags size={22} />
        </span>
      </div>

      {openItem && (
        <div style={{ border: `1px solid ${COLOR}44`, background: `${COLOR}10`, borderRadius: 10, padding: 12, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ fontSize: 13, color: COLOR }}>Registro en curso</strong>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Caja {openItem.numeroCaja} · PLU {openItem.plu} · inicio {fmtTime(openItem.horaInicio)}</span>
          </div>
          <button onClick={finalize} disabled={finalizing} className="ds-btn ds-btn-sm" style={{ background: COLOR, color: "white", border: "none", flexShrink: 0, opacity: finalizing ? 0.65 : 1 }}>
            <CheckCircle2 size={14} />{finalizing ? "Finalizando..." : "Finalizar rotulación"}
          </button>
        </div>
      )}

      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Field label="Numero de caja">
          <input required value={form.numeroCaja} onChange={(e) => setForm((f) => ({ ...f, numeroCaja: e.target.value }))} className="ds-input" autoFocus />
        </Field>
        <Field label="PLU">
          <input required value={form.plu} onBlur={() => autocomplete(form.plu, "create")} onChange={(e) => setForm((f) => ({ ...f, plu: e.target.value }))} className="ds-input" />
        </Field>
        <Field label="Descripción">
          <input value={form.descripcion} readOnly placeholder="Se carga desde maestro" className="ds-input" style={{ opacity: 0.85 }} />
        </Field>
        <Field label="Unidad de empaque">
          <input required type="number" min={1} value={form.unidadEmpaque} onChange={(e) => setForm((f) => ({ ...f, unidadEmpaque: e.target.value }))} className="ds-input" />
        </Field>
        <button disabled={saving} className="ds-btn ds-btn-primary" style={{ gridColumn: isMobile ? "auto" : "1 / -1", background: COLOR }}>
          <CheckCircle2 size={17} /> {saving ? "Guardando..." : "Guardar y comenzar siguiente"}
        </button>
      </form>
      {error && <p style={{ margin: "12px 0 0", color: "var(--error)", fontSize: 13, fontWeight: 700 }}>{error}</p>}
    </section>
  );

  const filters = (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (canManage ? "1.4fr 150px 150px 170px auto" : "1.4fr 180px 180px auto"), gap: 10, marginBottom: 14 }}>
      <div style={{ position: "relative" }}>
        <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)" }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar caja, PLU o descripcion" className="ds-input" style={{ paddingLeft: 32 }} />
      </div>
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="ds-input" />
      <select value={estado} onChange={(e) => setEstado(e.target.value)} className="ds-input">
        <option value="">Todos</option>
        <option value="en-curso">En curso</option>
        <option value="finalizado">Finalizados</option>
      </select>
      {canManage && (
        <select value={operarioFiltro} onChange={(e) => setOperarioFiltro(e.target.value)} className="ds-input" aria-label="Filtrar por operario">
          <option value="">Todos los operarios</option>
          {operarios.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      )}
      <button onClick={() => { setPage(1); load(1); }} style={{ height: 38, border: `1px solid ${COLOR}55`, color: COLOR, background: `${COLOR}10`, borderRadius: 8, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        <RefreshCw size={15} /> Filtrar
      </button>
    </div>
  );

  const list = loading ? <SkeletonTable rows={6} cols={7} /> : items.length === 0 ? (
    <EmptyState icon={<Tags size={28} />} title="Sin registros" description="Aun no hay cajas etiquetadas con estos filtros." />
  ) : isMobile ? (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => (
        <article key={item.id} className="op-record-card" style={{ "--module-color": COLOR, padding: 14 } as React.CSSProperties}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <strong>Caja {item.numeroCaja}</strong>
            <span style={{ color: item.horaFinalizacion ? "var(--muted2)" : COLOR, fontSize: 12, fontWeight: 800 }}>{item.horaFinalizacion ? "Finalizado" : "En curso"}</span>
          </div>
          <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            PLU {item.plu} · {item.descripcion}<br />
            Empaque {item.unidadEmpaque} · Inicio {fmtTime(item.horaInicio)} · Fin {fmtTime(item.horaFinalizacion)}
          </div>
          {(canManage || item.creadoPorId === userId) && <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={() => startEdit(item)} className="ds-btn ds-btn-ghost ds-btn-sm"><Pencil size={14} /> Editar</button>{canManage && <button onClick={() => remove(item)} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ color: "var(--error)" }}><Trash2 size={14} /> Borrar</button>}</div>}
        </article>
      ))}
    </div>
  ) : (
    <RegistrosTable
      loading={false}
      items={items}
      canManage={canManage}
      userId={userId}
      onEdit={startEdit}
      onDelete={remove}
      debug={debugTable}
    />
  );

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pagination = totalItems > PAGE_SIZE ? (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px 0", borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--muted2)" }}>
      <span>Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalItems)} de {totalItems} registros</span>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          disabled={page <= 1}
          onClick={() => { const p = page - 1; setPage(p); load(p); }}
          className="ds-btn ds-btn-ghost ds-btn-sm" style={{ opacity: page <= 1 ? 0.4 : 1 }}
        >
          ← Anterior
        </button>
        <span style={{ padding: "0 8px", lineHeight: "30px", fontWeight: 700 }}>
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => { const p = page + 1; setPage(p); load(p); }}
          className="ds-btn ds-btn-ghost ds-btn-sm" style={{ opacity: page >= totalPages ? 0.4 : 1 }}
        >
          Siguiente →
        </button>
      </div>
    </div>
  ) : null;

  const hoy = hoyBogota();
  const statsPresets = [
    { label: "Hoy", desde: hoy, hasta: hoy },
    { label: "7 días", desde: sumarDias(hoy, -6), hasta: hoy },
    { label: "30 días", desde: sumarDias(hoy, -29), hasta: hoy },
  ];
  const statsControls = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Desde</span>
        <input type="date" value={statsDesde} max={statsHasta || undefined} onChange={(e) => setStatsDesde(e.target.value)} className="ds-input" style={{ height: 32, width: "auto", fontSize: 12 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Hasta</span>
        <input type="date" value={statsHasta} min={statsDesde || undefined} onChange={(e) => setStatsHasta(e.target.value)} className="ds-input" style={{ height: 32, width: "auto", fontSize: 12 }} />
      </div>
      <button onClick={() => loadStats()} className="ds-btn ds-btn-sm" style={{ height: 32, background: COLOR, color: "white", border: "none" }}>
        <RefreshCw size={13} /> Aplicar
      </button>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {statsPresets.map((p) => {
          const active = statsDesde === p.desde && statsHasta === p.hasta;
          return (
            <button
              key={p.label}
              onClick={() => aplicarRangoStats(p.desde, p.hasta)}
              style={{ height: 32, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: `1px solid ${active ? COLOR : "var(--border)"}`, background: active ? `${COLOR}18` : "transparent", color: active ? COLOR : "var(--muted2)" }}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ ...getModuleCssVars("exportaciones"), "--module-color": COLOR, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, maxWidth: 1180 } as React.CSSProperties}>
      <ModuleHero
        moduleKey="exportaciones"
        kicker="Operacion de etiquetado"
        title="Exportaciones"
        description="Captura consecutiva por caja, PLU maestro, unidad de empaque y tiempos automaticos de inicio/finalizacion."
      />
      {captureCard}

      {canManage && (
        <section className="op-panel" style={{ padding: isMobile ? 14 : 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showStats ? 14 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", background: `${COLOR}18`, color: COLOR, flexShrink: 0 }}>
                <BarChart3 size={16} />
              </span>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Productividad por operario</h2>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{fmtRango(statsDesde, statsHasta)} · acumulado · promedio minutos por caja finalizada</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {stats.length > 0 && (
                <select
                  value={statsOperario}
                  onChange={(e) => setStatsOperario(e.target.value)}
                  className="ds-input"
                  style={{ height: 32, width: "auto", minWidth: 170, fontSize: 12 }}
                  aria-label="Filtrar productividad por operario"
                >
                  <option value="">Todos los operarios</option>
                  {stats.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              )}
              <button
                onClick={() => setShowStats((v) => !v)}
                style={{ border: "1px solid var(--border)", background: "transparent", borderRadius: 6, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--muted2)", fontSize: 12, fontWeight: 600 }}
              >
                {showStats ? <><ChevronUp size={14} /> Colapsar</> : <><ChevronDown size={14} /> Expandir</>}
              </button>
            </div>
          </div>
          {showStats && (
            <>
            {statsControls}
            {loadingStats ? (
              <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>Cargando estadísticas…</div>
            ) : statsFiltrados.length === 0 ? (
              <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>
                {statsOperario ? "Sin registros del operario seleccionado en este rango" : "Sin registros para este rango"}
              </div>
            ) : (
              <ProductividadTable stats={statsFiltrados} debug={debugTable} />
            )}
            </>
          )}
        </section>
      )}

      <section className="op-panel" style={{ padding: isMobile ? 14 : 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Registros</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>Inicio y finalizacion se calculan automaticamente al capturar cajas consecutivas.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AutoRefreshIndicator
              lastUpdatedAt={autoRefresh.lastUpdatedAt}
              refreshing={autoRefresh.refreshing}
              onRefresh={autoRefresh.refreshNow}
            />
            <Clock size={20} color={COLOR} />
          </div>
        </div>
        {filters}
        {list}
        {pagination}
      </section>

      {editing && (canManage || editing.creadoPorId === userId) && (
        <Modal open onClose={() => setEditing(null)} title="Editar registro" subtitle={`Caja ${editing.numeroCaja} · PLU ${editing.plu}`} size="lg">
          <form onSubmit={saveEdit} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <Field label="Numero caja"><input required value={editForm.numeroCaja} onChange={(e) => setEditForm((f) => ({ ...f, numeroCaja: e.target.value }))} className="ds-input" /></Field>
              <Field label="PLU"><input required value={editForm.plu} onBlur={() => autocomplete(editForm.plu, "edit")} onChange={(e) => setEditForm((f) => ({ ...f, plu: e.target.value }))} className="ds-input" /></Field>
              <Field label="Descripción"><input readOnly value={editForm.descripcion} className="ds-input" /></Field>
              <Field label="Unidad empaque"><input required type="number" min={1} value={editForm.unidadEmpaque} onChange={(e) => setEditForm((f) => ({ ...f, unidadEmpaque: e.target.value }))} className="ds-input" /></Field>
              {canManage && <>
                <Field label="Hora inicio"><input type="datetime-local" value={editForm.horaInicio} onChange={(e) => setEditForm((f) => ({ ...f, horaInicio: e.target.value }))} className="ds-input" /></Field>
                <Field label="Hora finalización"><input type="datetime-local" value={editForm.horaFinalizacion} onChange={(e) => setEditForm((f) => ({ ...f, horaFinalizacion: e.target.value }))} className="ds-input" /></Field>
              </>}
            </div>
            {canManage && <Field label="Motivo correccion"><textarea value={editForm.motivoCorreccion} onChange={(e) => setEditForm((f) => ({ ...f, motivoCorreccion: e.target.value }))} rows={3} className="ds-input" style={{ height: "auto", padding: 10 }} /></Field>}
            <button disabled={saving} className="ds-btn ds-btn-primary" style={{ background: COLOR }}>Guardar cambios</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
