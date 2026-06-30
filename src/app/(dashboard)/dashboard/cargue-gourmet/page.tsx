"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { ModuleHero } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { canSeeModule } from "@/lib/modulePermissions";
import { getModuleCssVars } from "@/lib/moduleTheme";
import { useListDetailScroll } from "@/hooks/useListDetailScroll";
import { useApi } from "@/hooks/useApi";
import { apiGet, apiPost, buildQuery, ApiError } from "@/lib/apiClient";
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
// Mismo set de roles para todas las acciones del lado Gourmet (crear, editar,
// asignar ubicación, enviar a Transporte) — coincide con ROLES_PERMITIDOS de
// los endpoints PUT/[id], POST/ubicacion y POST/enviar-transporte.
const ROLES_GOURMET = ROLES_CREAN;
// Roles que operan el cargue del camión (iniciar, escanear, finalizar) — ambas
// áreas: Transporte y Gourmet. Coincide con ROLES_PERMITIDOS de /iniciar-cargue,
// /escanear y /finalizar.
const ROLES_TRANSPORTE = ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"];
// Roles para cierre manual — coincide con ROLES_PERMITIDOS de /cierre-manual.
// Incluye Gourmet (decisión 2026-06-30); TRANSPORTE sigue sin cierre manual.
const ROLES_CIERRE_MANUAL = ["SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"];

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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useListDetailScroll(selectedId !== null);
  const [detalle, setDetalle] = useState<PedidoDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState<string | null>(null);

  const [showEditar, setShowEditar] = useState(false);
  const [showUbicacion, setShowUbicacion] = useState(false);
  const [showEnviarConfirm, setShowEnviarConfirm] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [showIniciarConfirm, setShowIniciarConfirm] = useState(false);
  const [iniciandoCargue, setIniciandoCargue] = useState(false);
  const [progresoEscaneo, setProgresoEscaneo] = useState<ProgresoEscaneo | null>(null);
  const [ultimoResultadoEscaneo, setUltimoResultadoEscaneo] = useState<UltimoResultadoEscaneo | null>(null);
  const [enviandoEscaneo, setEnviandoEscaneo] = useState(false);

  const [showFinalizarConfirm, setShowFinalizarConfirm] = useState(false);
  const [finalizandoCargue, setFinalizandoCargue] = useState(false);

  const [showCierreManual, setShowCierreManual] = useState(false);

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
    setSelectedId(row.id);
    setDetalle(null);
    setDetalleError(null);
    setUltimoResultadoEscaneo(null);
    loadDetalle(row.id);
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

  async function confirmarEnviarTransporte() {
    if (!detalle || enviando) return;
    setEnviando(true);
    try {
      await apiPost(`/api/cargue-gourmet/${detalle.id}/enviar-transporte`, { updatedAt: detalle.updatedAt });
      toast.success("Pedido enviado a Transporte");
      setShowEnviarConfirm(false);
      refreshAfterAction();
    } catch (e) {
      // 409 no siempre es optimistic lock — puede ser regla de negocio (sin
      // estibas, transición inválida, etc.) — se muestra el mensaje real del
      // backend y se refresca el detalle para que el usuario vea el estado
      // actual antes de reintentar.
      toast.error(getErrorMessage(e, "No se pudo enviar el pedido a Transporte"));
      if (e instanceof ApiError && e.status === 409) loadDetalle(detalle.id);
    } finally {
      setEnviando(false);
    }
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
  // La vista de detalle a ancho completo reemplaza al listado (todos los
  // tamaños de pantalla) — ya no hay overlay/SlidePanel.
  const showDetailView = selectedId !== null;

  return (
    <div className="animate-fade-in" style={getModuleCssVars("cargue-gourmet") as React.CSSProperties}>
      <ModuleHero
        moduleKey="cargue-gourmet"
        kicker="Gourmet · Transporte"
        title="Cargue Gourmet"
        description={`${total} pedido${total !== 1 ? "s" : ""} · ubicación y cargue verificado de pedidos Gourmet.`}
        actions={
          puedeCrear && (
            <button onClick={() => setShowCrear(true)} className="g-btn g-btn-primary">
              <Plus size={14} />Nuevo pedido
            </button>
          )
        }
      />

      <CrearPedidoModal
        open={showCrear}
        onClose={() => setShowCrear(false)}
        onCreated={() => { setPage(1); load(); }}
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
          onEnviarTransporte={() => setShowEnviarConfirm(true)}
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

          <CargueGourmetTable rows={pedidos} loading={loading} debug={debugTable} onView={openDetalle} />

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
        open={showEnviarConfirm}
        onClose={() => { if (!enviando) setShowEnviarConfirm(false); }}
        onConfirm={confirmarEnviarTransporte}
        title="Enviar a Transporte"
        message="¿Confirmas enviar este pedido a Transporte? Después de enviarlo ya no podrás editarlo desde Gourmet."
        confirmLabel={enviando ? "Enviando…" : "Enviar a Transporte"}
        tone="primary"
        loading={enviando}
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
    </div>
  );
}
