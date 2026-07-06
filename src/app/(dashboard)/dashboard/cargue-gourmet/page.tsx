"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Download } from "lucide-react";
import { ModuleHero } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { canSeeModule } from "@/lib/modulePermissions";
import { getModuleCssVars } from "@/lib/moduleTheme";
import { useListDetailScroll } from "@/hooks/useListDetailScroll";
import { useApi } from "@/hooks/useApi";
import { apiGet, apiPost, apiDelete, buildQuery, ApiError } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import {
  CargueGourmetTable, ESTADOS_PEDIDO_GOURMET, ESTADO_LABEL,
  type GourmetPedidoRow, type EstadoPedidoGourmet,
} from "./_components";
import { CrearPedidoModal } from "./_components/CrearPedidoModal";
import { PedidoDetalleView } from "./_components/PedidoDetalleView";
import type { PedidoDetalle } from "./_components/PedidoDetalleTypes";
import { EditarPedidoModal } from "./_components/EditarPedidoModal";
import { AsignarUbicacionModal } from "./_components/AsignarUbicacionModal";
import { ConfirmModal } from "@/components/ui/Modal";
import type { ProgresoEscaneo, ResultadoEscaneo, UltimoResultadoEscaneo } from "./_components/EscaneoCajasPanel";
import { CierreManualModal } from "./_components/CierreManualModal";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;
const ROLES_CREAN = ["OPERACIONES_GOURMET", "ADMIN", "GERENTE"];
// Mismo set de roles para las acciones del lado Gourmet (crear, editar,
// asignar ubicación) — coincide con ROLES_PERMITIDOS de los endpoints
// PUT/[id] y POST/ubicacion.
const ROLES_GOURMET = ROLES_CREAN;
// Roles que operan el cargue del camión (iniciar, escanear, finalizar) — ambas
// áreas: Transporte y Gourmet. Coincide con ROLES_PERMITIDOS de /iniciar-cargue,
// /escanear y /finalizar.
const ROLES_TRANSPORTE = ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"];
// Roles para cierre manual — coincide con ROLES_PERMITIDOS de /cierre-manual.
// Incluye Gourmet (decisión 2026-06-30); TRANSPORTE sigue sin cierre manual.
const ROLES_CIERRE_MANUAL = ["SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"];
// Eliminar pedidos y revertir un cargue accidental — acciones de supervisión,
// coincide con ROLES_ELIMINAN de /[id] (DELETE) y de /revertir-cargue.
const ROLES_ADMIN_GERENTE = ["ADMIN", "GERENTE"];
// Despacho masivo sin verificación de cajas — solo ADMIN (antes también
// auxiliar-transporte@gmail.com por email; acceso retirado 2026-07-04, ver
// docs/cerebro/pendientes.md). Coincide con la restricción del backend en
// /api/cargue-gourmet/despacho-masivo.

const RESULTADO_TOAST_ERROR: Record<ResultadoEscaneo, string> = {
  VALIDO: "",
  DUPLICADO: "Caja duplicada — ya fue escaneada antes",
  CAJA_AJENA: "Esta caja no pertenece a este pedido",
  FORMATO_INVALIDO: "Código vacío o ilegible — vuelve a escanear",
  EXCEDE_CANTIDAD: "Ya se alcanzó la cantidad esperada de cajas",
};

const inp: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.7rem",
  fontSize: 12, fontFamily: "var(--mono)", outline: "none", background: "var(--surface)", color: "var(--text)",
};

export default function CargueGourmetPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [debugTable, setDebugTable] = useState(false);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [estado, setEstado] = useState<EstadoPedidoGourmet | "">("");
  const [tipoOrden, setTipoOrden] = useState<"" | "OVDM" | "TSDM">("");
  const [showCrear, setShowCrear] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useListDetailScroll(selectedId !== null);
  const [detalle, setDetalle] = useState<PedidoDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState<string | null>(null);

  const [showEditar, setShowEditar] = useState(false);
  const [showUbicacion, setShowUbicacion] = useState(false);

  const [showIniciarConfirm, setShowIniciarConfirm] = useState(false);
  const [iniciandoCargue, setIniciandoCargue] = useState(false);
  const [progresoEscaneo, setProgresoEscaneo] = useState<ProgresoEscaneo | null>(null);
  const [ultimoResultadoEscaneo, setUltimoResultadoEscaneo] = useState<UltimoResultadoEscaneo | null>(null);
  const [enviandoEscaneo, setEnviandoEscaneo] = useState(false);

  const [showFinalizarConfirm, setShowFinalizarConfirm] = useState(false);
  const [finalizandoCargue, setFinalizandoCargue] = useState(false);

  const [showCierreManual, setShowCierreManual] = useState(false);

  const [showEliminarConfirm, setShowEliminarConfirm] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const [showRevertirConfirm, setShowRevertirConfirm] = useState(false);
  const [revirtiendo, setRevirtiendo] = useState(false);

  const [despachoMasivoMode, setDespachoMasivoMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDespachoMasivoConfirm, setShowDespachoMasivoConfirm] = useState(false);
  const [despachandoMasivo, setDespachandoMasivo] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modo debug de tabla: /dashboard/cargue-gourmet?debugTable=1
  useEffect(() => { setDebugTable(new URLSearchParams(window.location.search).get("debugTable") === "1"); }, []);

  // Debounce simple para la búsqueda de texto — no hay otro patrón de
  // debounce en el proyecto, así que se mantiene minimal (un solo setTimeout).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQDebounced(q.trim()), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  const puedeVer = Boolean(role && canSeeModule(role, "cargue-gourmet"));
  const listKey = puedeVer
    ? `/api/cargue-gourmet${buildQuery({ q: qDebounced, ciudad, estado, tipoOrden, page, pageSize: PAGE_SIZE })}`
    : null;
  const { data: listData, isLoading: loading, mutate: mutateList } = useApi<{ data: GourmetPedidoRow[]; total: number }>(listKey, {
    onError: () => toast.error("No se pudo cargar el listado de Cargue Gourmet"),
  });
  const pedidos = listData?.data ?? [];
  const total = listData?.total ?? 0;
  const load = useCallback(() => { void mutateList(); }, [mutateList]);

  // Al cambiar cualquier filtro se vuelve a la página 1 (la key de SWR reacciona).
  useEffect(() => {
    setPage(1);
  }, [qDebounced, ciudad, estado, tipoOrden]);

  const loadDetalle = useCallback(async (id: string) => {
    setDetalleLoading(true);
    setDetalleError(null);
    try {
      const json = await apiGet<{ data: PedidoDetalle | null }>(`/api/cargue-gourmet/${id}`);
      setDetalle(json.data ?? null);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setDetalleError(
        status === 404 ? "Este pedido no existe o fue eliminado." :
        status === 403 ? "No tienes permiso para ver este pedido." :
        "No se pudo cargar el detalle del pedido.",
      );
    } finally {
      setDetalleLoading(false);
    }
  }, []);

  function openDetalle(row: GourmetPedidoRow) {
    abrirDetallePorId(row.id);
  }

  function abrirDetallePorId(id: string) {
    setSelectedId(id);
    setDetalle(null);
    setDetalleError(null);
    setUltimoResultadoEscaneo(null);
    loadDetalle(id);
  }

  // Cuando "Nuevo pedido" detecta que la orden ya existe (ORDEN_DUPLICADA),
  // en vez de dejar que se cree un segundo pedido se abre el existente
  // directamente en modo edición — así se corrige el dato (p. ej. cajas
  // esperadas) sobre el mismo registro en lugar de duplicarlo. Se espera a
  // que cargue el detalle para que el modal de edición abra con los datos
  // reales, no en blanco.
  async function abrirExistenteYEditar(id: string) {
    setSelectedId(id);
    setDetalle(null);
    setDetalleError(null);
    setUltimoResultadoEscaneo(null);
    await loadDetalle(id);
    setShowEditar(true);
  }

  function closeDetalle() {
    setSelectedId(null);
    setDetalle(null);
    setDetalleError(null);
    setProgresoEscaneo(null);
    setUltimoResultadoEscaneo(null);
  }

  // El progreso de escaneo se recalcula desde el cargue activo cada vez que
  // se (re)carga el detalle completo — no se pierde si se abre/cierra el
  // panel ni si se refresca tras otra acción.
  useEffect(() => {
    if (!detalle) { setProgresoEscaneo(null); return; }
    const cargueActivo = detalle.cargues.find((c) => c.estado === "EN_CARGUE");
    setProgresoEscaneo(cargueActivo ? { escaneados: cargueActivo.cantidadEscaneada, esperados: cargueActivo.cantidadEsperada } : null);
  }, [detalle]);

  function refreshAfterAction() {
    if (selectedId) loadDetalle(selectedId);
    load();
  }

  async function confirmarIniciarCargue() {
    if (!detalle || iniciandoCargue) return;
    setIniciandoCargue(true);
    try {
      await apiPost(`/api/cargue-gourmet/${detalle.id}/iniciar-cargue`, { updatedAt: detalle.updatedAt });
      toast.success("Cargue iniciado");
      setShowIniciarConfirm(false);
      refreshAfterAction();
    } catch (e) {
      // 409 puede ser optimistic lock O "ya existe un cargue activo" — en ambos
      // casos se muestra el mensaje real del backend y se refresca el detalle.
      toast.error(getErrorMessage(e, "No se pudo iniciar el cargue"));
      if (e instanceof ApiError && e.status === 409) loadDetalle(detalle.id);
    } finally {
      setIniciandoCargue(false);
    }
  }

  // Por rendimiento, un escaneo individual NO recarga el detalle completo
  // (estibas/cajas/cargues/novedades) — solo actualiza `progresoEscaneo` y
  // `ultimoResultadoEscaneo` con la respuesta puntual de /escanear. El
  // detalle completo solo se refresca al abrir el panel o tras otras
  // acciones (iniciar cargue, enviar, etc.), que sí lo requieren.
  async function handleEscanear(codigo: string): Promise<boolean> {
    if (!selectedId) return false;
    setEnviandoEscaneo(true);
    try {
      const json = await apiPost<{ resultado: ResultadoEscaneo; progreso?: ProgresoEscaneo | null }>(`/api/cargue-gourmet/${selectedId}/escanear`, { codigo });
      const resultado = json.resultado;
      setProgresoEscaneo(json.progreso ?? null);
      setUltimoResultadoEscaneo({ codigo, resultado });
      if (resultado === "VALIDO") {
        toast.success("Caja válida");
      } else {
        toast.error(RESULTADO_TOAST_ERROR[resultado] || "Revisa el resultado del escaneo");
      }
      return true;
    } catch (e) {
      // 409 aquí significa que el pedido ya no está EN_CARGUE o no hay cargue
      // activo — no es optimistic lock (este endpoint no lo usa).
      toast.error(getErrorMessage(e, "No se pudo registrar el escaneo"));
      if (e instanceof ApiError && e.status === 409) loadDetalle(selectedId);
      return false;
    } finally {
      setEnviandoEscaneo(false);
    }
  }

  async function confirmarFinalizarCargue() {
    if (!detalle || finalizandoCargue) return;
    setFinalizandoCargue(true);
    try {
      await apiPost(`/api/cargue-gourmet/${detalle.id}/finalizar`, { updatedAt: detalle.updatedAt });
      toast.success("Cargue finalizado");
      setShowFinalizarConfirm(false);
      refreshAfterAction();
    } catch (e) {
      // 409 aquí puede ser: cantidad no coincide, novedades abiertas, el pedido
      // ya no está EN_CARGUE, o updatedAt desactualizado — no se asume cuál; se
      // muestra siempre el mensaje real del backend y se refresca el detalle.
      toast.error(getErrorMessage(e, "No se pudo finalizar el cargue"));
      if (e instanceof ApiError && e.status === 409) loadDetalle(detalle.id);
    } finally {
      setFinalizandoCargue(false);
    }
  }

  async function confirmarEliminar() {
    if (!detalle || eliminando) return;
    setEliminando(true);
    try {
      await apiDelete(`/api/cargue-gourmet/${detalle.id}`);
      toast.success("Pedido eliminado");
      setShowEliminarConfirm(false);
      closeDetalle();
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo eliminar el pedido"));
    } finally {
      setEliminando(false);
    }
  }

  async function confirmarRevertirCargue() {
    if (!detalle || revirtiendo) return;
    setRevirtiendo(true);
    try {
      await apiPost(`/api/cargue-gourmet/${detalle.id}/revertir-cargue`, { updatedAt: detalle.updatedAt });
      toast.success("Cargue revertido");
      setShowRevertirConfirm(false);
      refreshAfterAction();
    } catch (e) {
      // 409 aquí puede ser: el pedido ya no está EN_CARGUE, no hay cargue
      // activo, o updatedAt desactualizado — se muestra el mensaje real del
      // backend y se refresca el detalle.
      toast.error(getErrorMessage(e, "No se pudo revertir el cargue"));
      if (e instanceof ApiError && e.status === 409) loadDetalle(detalle.id);
    } finally {
      setRevirtiendo(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => {
      const todasSeleccionadas = ids.length > 0 && ids.every((id) => prev.has(id));
      return todasSeleccionadas ? new Set() : new Set(ids);
    });
  }

  function cancelarDespachoMasivo() {
    setDespachoMasivoMode(false);
    setSelectedIds(new Set());
  }

  async function confirmarDespachoMasivo() {
    if (selectedIds.size === 0 || despachandoMasivo) return;
    setDespachandoMasivo(true);
    try {
      const json = await apiPost<{ data: { actualizados: string[]; omitidos: { id: string; motivo: string }[] } }>(
        "/api/cargue-gourmet/despacho-masivo",
        { ids: Array.from(selectedIds) },
      );
      const { actualizados, omitidos } = json.data;
      if (actualizados.length > 0) toast.success(`${actualizados.length} pedido${actualizados.length !== 1 ? "s" : ""} despachado${actualizados.length !== 1 ? "s" : ""} sin verificación`);
      if (omitidos.length > 0) toast.error(`${omitidos.length} pedido${omitidos.length !== 1 ? "s" : ""} no se pudo${omitidos.length !== 1 ? "ron" : ""} despachar`);
      setShowDespachoMasivoConfirm(false);
      cancelarDespachoMasivo();
      load();
    } catch (e) {
      toast.error(getErrorMessage(e, "No se pudo completar el despacho masivo"));
    } finally {
      setDespachandoMasivo(false);
    }
  }

  if (role && !canSeeModule(role, "cargue-gourmet")) {
    return (
      <div className="g-panel g-empty animate-fade-in">
        <h3>Acceso restringido</h3>
        <p>No tienes permiso para ver el módulo Cargue Gourmet.</p>
      </div>
    );
  }

  const hasFilters = q || ciudad || estado || tipoOrden;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const puedeCrear = !!role && ROLES_CREAN.includes(role);
  const puedeGourmet = !!role && ROLES_GOURMET.includes(role);
  const puedeTransporte = !!role && ROLES_TRANSPORTE.includes(role);
  const puedeCierreManual = !!role && ROLES_CIERRE_MANUAL.includes(role);
  const puedeEliminar = !!role && ROLES_ADMIN_GERENTE.includes(role);
  const puedeRevertirCargue = puedeEliminar;
  const puedeDespachoMasivo = role === "ADMIN";
  // La vista de detalle a ancho completo reemplaza al listado (todos los
  // tamaños de pantalla) — ya no hay overlay/SlidePanel.
  const showDetailView = selectedId !== null;

  async function exportarExcel() {
    if (exporting) return;
    setExporting(true);
    try {
      const qs = buildQuery({ q: qDebounced || undefined, ciudad: ciudad || undefined, estado: estado || undefined, tipoOrden: tipoOrden || undefined });
      const res = await fetch(`/api/cargue-gourmet/export${qs}`);
      if (!res.ok) throw new Error("No se pudo exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cargue-gourmet-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo exportar a Excel");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="animate-fade-in" style={getModuleCssVars("cargue-gourmet") as React.CSSProperties}>
      <ModuleHero
        moduleKey="cargue-gourmet"
        kicker="Gourmet · Transporte"
        title="Cargue Gourmet"
        description={`${total} pedido${total !== 1 ? "s" : ""} · ubicación y cargue verificado de pedidos Gourmet.`}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {!showDetailView && (
              <button
                onClick={exportarExcel}
                disabled={exporting}
                className="g-btn g-btn-secondary"
                data-testid="btn-exportar-excel"
              >
                <Download size={14} />{exporting ? "Exportando…" : "Exportar Excel"}
              </button>
            )}
            {puedeDespachoMasivo && !showDetailView && (
              <button
                onClick={() => despachoMasivoMode ? cancelarDespachoMasivo() : setDespachoMasivoMode(true)}
                className={despachoMasivoMode ? "g-btn g-btn-secondary" : "g-btn g-btn-secondary"}
                data-testid="btn-toggle-despacho-masivo"
              >
                {despachoMasivoMode ? "Cancelar despacho masivo" : "Despacho masivo"}
              </button>
            )}
            {puedeCrear && (
              <button onClick={() => setShowCrear(true)} className="g-btn g-btn-primary">
                <Plus size={14} />Nuevo pedido
              </button>
            )}
          </div>
        }
      />

      <CrearPedidoModal
        open={showCrear}
        onClose={() => setShowCrear(false)}
        onCreated={() => { setPage(1); load(); }}
        onVerExistente={abrirExistenteYEditar}
      />

      {showDetailView ? (
        <PedidoDetalleView
          onBack={closeDetalle}
          loading={detalleLoading}
          error={detalleError}
          pedido={detalle}
          onRetry={() => selectedId && loadDetalle(selectedId)}
          puedeGourmet={puedeGourmet}
          onEditar={() => setShowEditar(true)}
          onAsignarUbicacion={() => setShowUbicacion(true)}
          puedeTransporte={puedeTransporte}
          onIniciarCargue={() => setShowIniciarConfirm(true)}
          iniciandoCargue={iniciandoCargue}
          progresoEscaneo={progresoEscaneo}
          ultimoResultadoEscaneo={ultimoResultadoEscaneo}
          enviandoEscaneo={enviandoEscaneo}
          onEscanear={handleEscanear}
          onFinalizarCargue={() => setShowFinalizarConfirm(true)}
          finalizandoCargue={finalizandoCargue}
          puedeCierreManual={puedeCierreManual}
          onCierreManual={() => setShowCierreManual(true)}
          puedeEliminar={puedeEliminar}
          onEliminar={() => setShowEliminarConfirm(true)}
          puedeRevertirCargue={puedeRevertirCargue}
          onRevertirCargue={() => setShowRevertirConfirm(true)}
        />
      ) : (
        <>
          {/* Filtros */}
          <div className="g-panel" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por orden, tienda o código…"
              style={{ ...inp, flex: 1, minWidth: 180 }}
            />
            <input
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              placeholder="Ciudad"
              style={{ ...inp, width: 140 }}
            />
            <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoPedidoGourmet | "")} style={inp}>
              <option value="">Todos los estados</option>
              {ESTADOS_PEDIDO_GOURMET.map((e) => (
                <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
              ))}
            </select>
            <select value={tipoOrden} onChange={(e) => setTipoOrden(e.target.value as "" | "OVDM" | "TSDM")} style={inp}>
              <option value="">Todos los tipos</option>
              <option value="OVDM">OVDM</option>
              <option value="TSDM">TSDM</option>
            </select>
            {hasFilters && (
              <button
                onClick={() => { setQ(""); setCiudad(""); setEstado(""); setTipoOrden(""); }}
                style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}
              >
                Limpiar
              </button>
            )}
          </div>

          {despachoMasivoMode && (
            <div className="g-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1rem", marginBottom: "0.75rem", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {selectedIds.size} pedido{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""} — se marcarán como despachados sin verificación de cajas.
              </span>
              <button
                type="button"
                onClick={() => setShowDespachoMasivoConfirm(true)}
                disabled={selectedIds.size === 0}
                className="g-btn g-btn-danger g-btn-sm"
                data-testid="btn-confirmar-despacho-masivo"
              >
                Despachar seleccionados
              </button>
            </div>
          )}

          <CargueGourmetTable
            rows={pedidos}
            loading={loading}
            debug={debugTable}
            onView={despachoMasivoMode ? undefined : openDetalle}
            selectable={despachoMasivoMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />

          {/* Paginación */}
          {!loading && pedidos.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1rem", fontSize: 12, color: "var(--muted)" }}>
              <span>Página {page} de {totalPages} · {total} pedido{total !== 1 ? "s" : ""}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="g-btn g-btn-secondary g-btn-sm">Anterior</button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="g-btn g-btn-secondary g-btn-sm">Siguiente</button>
              </div>
            </div>
          )}
        </>
      )}

      <EditarPedidoModal
        open={showEditar}
        pedido={detalle}
        onClose={() => setShowEditar(false)}
        onUpdated={refreshAfterAction}
      />

      <AsignarUbicacionModal
        open={showUbicacion}
        pedido={detalle}
        onClose={() => setShowUbicacion(false)}
        onSaved={refreshAfterAction}
      />

      <ConfirmModal
        open={showIniciarConfirm}
        onClose={() => { if (!iniciandoCargue) setShowIniciarConfirm(false); }}
        onConfirm={confirmarIniciarCargue}
        title="Iniciar cargue"
        message="¿Confirmas iniciar el cargue de este pedido? Se creará el registro de cargue para escanear las cajas."
        confirmLabel={iniciandoCargue ? "Iniciando…" : "Iniciar cargue"}
        tone="primary"
        loading={iniciandoCargue}
      />

      <ConfirmModal
        open={showFinalizarConfirm}
        onClose={() => { if (!finalizandoCargue) setShowFinalizarConfirm(false); }}
        onConfirm={confirmarFinalizarCargue}
        title="Finalizar cargue"
        message="¿Confirmas finalizar este cargue? Solo debe hacerse cuando todas las cajas estén correctamente escaneadas y no existan novedades abiertas."
        confirmLabel={finalizandoCargue ? "Finalizando…" : "Finalizar cargue"}
        tone="primary"
        loading={finalizandoCargue}
      />

      <CierreManualModal
        open={showCierreManual}
        pedido={detalle}
        onClose={() => setShowCierreManual(false)}
        onClosed={refreshAfterAction}
      />

      <ConfirmModal
        open={showEliminarConfirm}
        onClose={() => { if (!eliminando) setShowEliminarConfirm(false); }}
        onConfirm={confirmarEliminar}
        title="Eliminar pedido"
        message="¿Confirmas eliminar este pedido? Se borrarán también sus ubicaciones, cajas y cargues asociados. Esta acción no se puede deshacer."
        confirmLabel={eliminando ? "Eliminando…" : "Eliminar"}
        tone="danger"
        loading={eliminando}
      />

      <ConfirmModal
        open={showDespachoMasivoConfirm}
        onClose={() => { if (!despachandoMasivo) setShowDespachoMasivoConfirm(false); }}
        onConfirm={confirmarDespachoMasivo}
        title="Despacho masivo sin verificación"
        message={`¿Confirmas marcar ${selectedIds.size} pedido${selectedIds.size !== 1 ? "s" : ""} como despachado${selectedIds.size !== 1 ? "s" : ""}? Esta acción salta el escaneo de cajas y no se puede deshacer.`}
        confirmLabel={despachandoMasivo ? "Despachando…" : "Despachar seleccionados"}
        tone="danger"
        loading={despachandoMasivo}
      />

      <ConfirmModal
        open={showRevertirConfirm}
        onClose={() => { if (!revirtiendo) setShowRevertirConfirm(false); }}
        onConfirm={confirmarRevertirCargue}
        title="Revertir cargue"
        message="¿Confirmas revertir este cargue? Se descartará cualquier escaneo registrado y el pedido volverá a su estado anterior."
        confirmLabel={revirtiendo ? "Revirtiendo…" : "Revertir cargue"}
        tone="danger"
        loading={revirtiendo}
      />
    </div>
  );
}
