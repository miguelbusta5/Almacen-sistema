"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { BarChart3, CheckCircle2, ChevronDown, ChevronUp, Clock, Pencil, RefreshCw, Search, Tags, Trash2, X } from "lucide-react";
import { EmptyState, SkeletonTable } from "@/components/ui";
import { AutoRefreshIndicator } from "@/components/ui/AutoRefreshIndicator";
import { getModuleColor } from "@/lib/moduleTheme";
import { puedeGestionarExportaciones, puedeUsarExportaciones } from "@/lib/exportaciones";
import { useIsMobile } from "@/lib/useIsMobile";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

const COLOR = getModuleColor("exportaciones");

interface Exportacion {
  id: string;
  numeroCaja: string;
  plu: string;
  descripcion: string;
  unidadEmpaque: number;
  fecha: string;
  horaInicio: string;
  horaFinalizacion: string | null;
  duracionMinutos: number | null;
  motivoCorreccion?: string | null;
  creadoPorId?: string | null;
  creadoPorNombre?: string | null;
}

interface UserStat {
  id: string;
  nombre: string;
  cajas: number;
  plusDistintos: number;
  totalUnidades: number;
  finalizadas: number;
  duracionTotalMin: number;
  promedioPorCajaMin: number | null;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 38,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--foreground)",
  padding: "0 10px",
  fontSize: 13,
  outline: "none",
};

function fmtTime(value: string | null) {
  if (!value) return "En curso";
  return new Date(value).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
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
  const [query, setQuery] = useState("");
  const [fecha, setFecha] = useState("");
  const [estado, setEstado] = useState("");
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const PAGE_SIZE = 40;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const [form, setForm] = useState({ numeroCaja: "", plu: "", descripcion: "", unidadEmpaque: "1" });
  const [editing, setEditing] = useState<Exportacion | null>(null);
  const [editForm, setEditForm] = useState({ numeroCaja: "", plu: "", descripcion: "", unidadEmpaque: "1", horaInicio: "", horaFinalizacion: "", motivoCorreccion: "" });

  const openItem = useMemo(() => items.find((item) => !item.horaFinalizacion) ?? null, [items]);
  const formDirty = Boolean(form.numeroCaja.trim() || form.plu.trim() || form.descripcion.trim());

  async function load(targetPage = page) {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (fecha) params.set("fecha", fecha);
    if (estado) params.set("estado", estado);
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

  async function loadStats() {
    if (!canManage) return;
    setLoadingStats(true);
    const params = new URLSearchParams();
    if (fecha) params.set("fecha", fecha);
    const res = await fetch(`/api/exportaciones/stats?${params.toString()}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) setStats(json.data ?? []);
    setLoadingStats(false);
  }

  useEffect(() => { if (canUse) load(1); }, [canUse]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (canManage) loadStats(); }, [canManage]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <button onClick={finalize} disabled={finalizing} style={{ height: 34, padding: "0 14px", border: `1px solid ${COLOR}55`, borderRadius: 8, background: COLOR, color: "white", fontWeight: 700, cursor: finalizing ? "not-allowed" : "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 6, opacity: finalizing ? 0.65 : 1, whiteSpace: "nowrap", flexShrink: 0 }}>
            <CheckCircle2 size={14} />{finalizing ? "Finalizando..." : "Finalizar rotulación"}
          </button>
        </div>
      )}

      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <Field label="Numero de caja">
          <input required value={form.numeroCaja} onChange={(e) => setForm((f) => ({ ...f, numeroCaja: e.target.value }))} style={inputStyle} autoFocus />
        </Field>
        <Field label="PLU">
          <input required value={form.plu} onBlur={() => autocomplete(form.plu, "create")} onChange={(e) => setForm((f) => ({ ...f, plu: e.target.value }))} style={inputStyle} />
        </Field>
        <Field label="Descripción">
          <input value={form.descripcion} readOnly placeholder="Se carga desde maestro" style={{ ...inputStyle, opacity: 0.85 }} />
        </Field>
        <Field label="Unidad de empaque">
          <input required type="number" min={1} value={form.unidadEmpaque} onChange={(e) => setForm((f) => ({ ...f, unidadEmpaque: e.target.value }))} style={inputStyle} />
        </Field>
        <button disabled={saving} style={{ gridColumn: isMobile ? "auto" : "1 / -1", height: 42, border: "none", borderRadius: 9, background: COLOR, color: "white", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <CheckCircle2 size={17} /> {saving ? "Guardando..." : "Guardar y comenzar siguiente"}
        </button>
      </form>
      {error && <p style={{ margin: "12px 0 0", color: "var(--error)", fontSize: 13, fontWeight: 700 }}>{error}</p>}
    </section>
  );

  const filters = (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 180px 180px auto", gap: 10, marginBottom: 14 }}>
      <div style={{ position: "relative" }}>
        <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)" }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar caja, PLU o descripcion" style={{ ...inputStyle, paddingLeft: 32 }} />
      </div>
      <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inputStyle} />
      <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inputStyle}>
        <option value="">Todos</option>
        <option value="en-curso">En curso</option>
        <option value="finalizado">Finalizados</option>
      </select>
      <button onClick={() => { setPage(1); load(1); loadStats(); }} style={{ height: 38, border: `1px solid ${COLOR}55`, color: COLOR, background: `${COLOR}10`, borderRadius: 8, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
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
          {(canManage || item.creadoPorId === userId) && <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button onClick={() => startEdit(item)} style={miniBtn}><Pencil size={14} /> Editar</button>{canManage && <button onClick={() => remove(item)} style={miniBtn}><Trash2 size={14} /> Borrar</button>}</div>}
        </article>
      ))}
    </div>
  ) : (
    <div className="op-table-wrap" style={{ "--module-color": COLOR, overflowX: "auto" } as React.CSSProperties}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ color: "var(--muted)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
          <th style={th}>Fecha</th><th style={th}>Usuario</th><th style={th}>Caja</th><th style={th}>PLU</th><th style={th}>Descripción</th><th style={th}>Empaque</th><th style={th}>Inicio</th><th style={th}>Fin</th><th style={th}>Dur.</th><th style={th}>Acciones</th>
        </tr></thead>
        <tbody>
          {items.map((item) => {
            const canEditItem = canManage || item.creadoPorId === userId;
            return (
              <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={td}>{item.fecha}</td><td style={td}>{item.creadoPorNombre ?? "-"}</td><td style={td}>{item.numeroCaja}</td><td style={td}>{item.plu}</td><td style={td}>{item.descripcion}</td><td style={td}>{item.unidadEmpaque}</td><td style={td}>{fmtTime(item.horaInicio)}</td><td style={td}>{fmtTime(item.horaFinalizacion)}</td><td style={td}>{item.duracionMinutos ?? "-"}</td>
                <td style={td}>
                  {canEditItem && <button onClick={() => startEdit(item)} style={iconBtn}><Pencil size={15} /></button>}
                  {canManage && <button onClick={() => remove(item)} style={iconBtn}><Trash2 size={15} /></button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pagination = totalItems > PAGE_SIZE ? (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px 0", borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--muted2)" }}>
      <span>Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalItems)} de {totalItems} registros</span>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          disabled={page <= 1}
          onClick={() => { const p = page - 1; setPage(p); load(p); }}
          style={{ ...iconBtn, opacity: page <= 1 ? 0.4 : 1, padding: "0 12px", minWidth: "auto" }}
        >
          ← Anterior
        </button>
        <span style={{ padding: "0 8px", lineHeight: "30px", fontWeight: 700 }}>
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => { const p = page + 1; setPage(p); load(p); }}
          style={{ ...iconBtn, opacity: page >= totalPages ? 0.4 : 1, padding: "0 12px", minWidth: "auto" }}
        >
          Siguiente →
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="animate-fade-in" style={{ "--module-color": COLOR, display: "grid", gap: 16, maxWidth: 1180 } as React.CSSProperties}>
      <section className="op-module-header" style={{ "--module-color": COLOR } as React.CSSProperties}>
        <div className="op-module-kicker">Operación de etiquetado</div>
        <h1 className="op-module-title">Exportaciones</h1>
        <p className="op-module-copy">Captura consecutiva por caja, PLU maestro, unidad de empaque y tiempos automáticos de inicio/finalización.</p>
      </section>
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
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{fecha || "Hoy"} · promedio minutos por caja finalizada</p>
              </div>
            </div>
            <button
              onClick={() => setShowStats((v) => !v)}
              style={{ border: "1px solid var(--border)", background: "transparent", borderRadius: 6, padding: "4px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: "var(--muted2)", fontSize: 12, fontWeight: 600 }}
            >
              {showStats ? <><ChevronUp size={14} /> Colapsar</> : <><ChevronDown size={14} /> Expandir</>}
            </button>
          </div>
          {showStats && (
            loadingStats ? (
              <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>Cargando estadísticas…</div>
            ) : stats.length === 0 ? (
              <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>Sin registros para esta fecha</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: "var(--muted)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                      <th style={th}>Operario</th>
                      <th style={{ ...th, textAlign: "right" }}>Cajas</th>
                      <th style={{ ...th, textAlign: "right" }}>PLUs</th>
                      <th style={{ ...th, textAlign: "right" }}>Unidades</th>
                      <th style={{ ...th, textAlign: "right" }}>Finalizadas</th>
                      <th style={{ ...th, textAlign: "right" }}>Tiempo total</th>
                      <th style={{ ...th, textAlign: "right" }}>Prom. min/caja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={td}><strong>{s.nombre}</strong></td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.cajas}</td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.plusDistintos}</td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.totalUnidades}</td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.finalizadas}</td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{s.duracionTotalMin > 0 ? `${s.duracionTotalMin} min` : "–"}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {s.promedioPorCajaMin != null ? (
                            <span style={{ fontWeight: 700, color: s.promedioPorCajaMin <= 5 ? "var(--success)" : s.promedioPorCajaMin <= 10 ? "var(--warning)" : "var(--error)" }}>
                              {s.promedioPorCajaMin} min
                            </span>
                          ) : <span style={{ color: "var(--muted)" }}>–</span>}
                        </td>
                      </tr>
                    ))}
                    {stats.length > 1 && (() => {
                      const totalCajas = stats.reduce((a, s) => a + s.cajas, 0);
                      const totalUnidades = stats.reduce((a, s) => a + s.totalUnidades, 0);
                      const totalFin = stats.reduce((a, s) => a + s.finalizadas, 0);
                      const totalMin = stats.reduce((a, s) => a + s.duracionTotalMin, 0);
                      const promTotal = totalFin > 0 ? Math.round((totalMin / totalFin) * 10) / 10 : null;
                      return (
                        <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface2)" }}>
                          <td style={{ ...td, fontWeight: 700 }}>Total</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{totalCajas}</td>
                          <td style={{ ...td, textAlign: "right", color: "var(--muted)" }}>—</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{totalUnidades}</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{totalFin}</td>
                          <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{totalMin > 0 ? `${totalMin} min` : "–"}</td>
                          <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                            {promTotal != null ? `${promTotal} min` : "–"}
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            )
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
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", padding: 16 }}>
          <form onSubmit={saveEdit} className="ds-card" style={{ width: "min(620px, 100%)", padding: 18, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Editar registro</h3>
              <button type="button" onClick={() => setEditing(null)} style={iconBtn}><X size={16} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <Field label="Numero caja"><input required value={editForm.numeroCaja} onChange={(e) => setEditForm((f) => ({ ...f, numeroCaja: e.target.value }))} style={inputStyle} /></Field>
              <Field label="PLU"><input required value={editForm.plu} onBlur={() => autocomplete(editForm.plu, "edit")} onChange={(e) => setEditForm((f) => ({ ...f, plu: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Descripción"><input readOnly value={editForm.descripcion} style={inputStyle} /></Field>
              <Field label="Unidad empaque"><input required type="number" min={1} value={editForm.unidadEmpaque} onChange={(e) => setEditForm((f) => ({ ...f, unidadEmpaque: e.target.value }))} style={inputStyle} /></Field>
              {canManage && <>
                <Field label="Hora inicio"><input type="datetime-local" value={editForm.horaInicio} onChange={(e) => setEditForm((f) => ({ ...f, horaInicio: e.target.value }))} style={inputStyle} /></Field>
                <Field label="Hora finalización"><input type="datetime-local" value={editForm.horaFinalizacion} onChange={(e) => setEditForm((f) => ({ ...f, horaFinalizacion: e.target.value }))} style={inputStyle} /></Field>
              </>}
            </div>
            {canManage && <Field label="Motivo correccion"><textarea value={editForm.motivoCorreccion} onChange={(e) => setEditForm((f) => ({ ...f, motivoCorreccion: e.target.value }))} rows={3} style={{ ...inputStyle, height: "auto", padding: 10 }} /></Field>}
            <button disabled={saving} style={{ height: 40, border: "none", borderRadius: 8, background: COLOR, color: "white", fontWeight: 800, cursor: "pointer" }}>Guardar cambios</button>
          </form>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" };
const td: React.CSSProperties = { padding: "11px 8px", verticalAlign: "top" };
const iconBtn: React.CSSProperties = { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", borderRadius: 8, height: 30, minWidth: 30, display: "inline-grid", placeItems: "center", cursor: "pointer", marginRight: 6 };
const miniBtn: React.CSSProperties = { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)", borderRadius: 8, height: 32, padding: "0 10px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 700 };
