"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus } from "lucide-react";
import { ModuleHero } from "@/components/ui";
import { useToast } from "@/contexts/ToastContext";
import { canSeeModule } from "@/lib/modulePermissions";
import { getModuleCssVars } from "@/lib/moduleTheme";
import { useListDetailScroll } from "@/hooks/useListDetailScroll";
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
// Roles para iniciar cargue y escanear — coincide con ROLES_PERMITIDOS de
// /iniciar-cargue y /escanear.
const ROLES_TRANSPORTE = ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "ADMIN", "GERENTE"];
// Roles para cierre manual — coincide con ROLES_PERMITIDOS de
// /cierre-manual (deliberadamente sin TRANSPORTE, decisión cerrada en G3A).
const ROLES_CIERRE_MANUAL = ["SUPERVISOR_TRANSPORTE", "ADMIN", "GERENTE"];

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

  const [pedidos, setPedidos] = useState<GourmetPedidoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async (toPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (qDebounced) params.set("q", qDebounced);
      if (ciudad) params.set("ciudad", ciudad);
      if (estado) params.set("estado", estado);
      if (tipoOrden) params.set("tipoOrden", tipoOrden);
      params.set("page", String(toPage));
      params.set("pageSize", String(PAGE_SIZE));

      const res = await fetch(`/api/cargue-gourmet?${params.toString()}`);
      if (!res.ok) {
        toast.error("No se pudo cargar el listado de Cargue Gourmet");
        return;
      }
      const json = await res.json();
      setPedidos(json.data ?? []);
      setTotal(json.total ?? 0);
      setPage(json.page ?? toPage);
    } catch {
      toast.error("Error de red al cargar pedidos — verifica tu conexión");
    } finally {
      setLoading(false);
    }
  }, [qDebounced, ciudad, estado, tipoOrden, page, toast]);

  useEffect(() => {
    if (!role || !canSeeModule(role, "cargue-gourmet")) return;
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, ciudad, estado, tipoOrden, role]);

  const loadDetalle = useCallback(async (id: string) => {
    setDetalleLoading(true);
    setDetalleError(null);
    try {
      const res = await fetch(`/api/cargue-gourmet/${id}`);
      if (res.status === 404) {
        setDetalleError("Este pedido no existe o fue eliminado.");
        return;
      }
      if (res.status === 403) {
        setDetalleError("No tienes permiso para ver este pedido.");
        return;
      }
      if (!res.ok) {
        setDetalleError("No se pudo cargar el detalle del pedido.");
        return;
      }
      const json = await res.json();
      setDetalle(json.data ?? null);
    } catch {
      setDetalleError("Error de red — verifica tu conexión e intenta de nuevo.");
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
    load(page);
  }

  async function confirmarEnviarTransporte() {
    if (!detalle || enviando) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/cargue-gourmet/${detalle.id}/enviar-transporte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updatedAt: detalle.updatedAt }),
      });
      const json = await res.json();
      if (!res.ok) {
        // 409 no siempre es optimistic lock — puede ser regla de negocio
        // (sin estibas, transición inválida, etc.) — se muestra el mensaje
        // real del backend y se refresca el detalle para que el usuario vea
        // el estado actual antes de reintentar.
        toast.error(json.error ?? "No se pudo enviar el pedido a Transporte");
        if (res.status === 409) loadDetalle(detalle.id);
        return;
      }
      toast.success("Pedido enviado a Transporte");
      setShowEnviarConfirm(false);
      refreshAfterAction();
    } catch {
      toast.error("Error de red al enviar a Transporte — verifica tu conexión");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarIniciarCargue() {
    if (!detalle || iniciandoCargue) return;
    setIniciandoCargue(true);
    try {
      const res = await fetch(`/api/cargue-gourmet/${detalle.id}/iniciar-cargue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updatedAt: detalle.updatedAt }),
      });
      const json = await res.json();
      if (!res.ok) {
        // 409 puede ser optimistic lock O "ya existe un cargue activo" — en
        // ambos casos se muestra el mensaje real del backend y se refresca
        // el detalle para que el usuario vea el estado actual.
        toast.error(json.error ?? "No se pudo iniciar el cargue");
        if (res.status === 409) loadDetalle(detalle.id);
        return;
      }
      toast.success("Cargue iniciado");
      setShowIniciarConfirm(false);
      refreshAfterAction();
    } catch {
      toast.error("Error de red al iniciar el cargue — verifica tu conexión");
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
      const res = await fetch(`/api/cargue-gourmet/${selectedId}/escanear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const json = await res.json();
      if (!res.ok) {
        // 409 aquí significa que el pedido ya no está EN_CARGUE o no hay
        // cargue activo — no es optimistic lock (este endpoint no lo usa).
        toast.error(json.error ?? "No se pudo registrar el escaneo");
        if (res.status === 409) loadDetalle(selectedId);
        return false;
      }
      const resultado = json.resultado as ResultadoEscaneo;
      setProgresoEscaneo(json.progreso ?? null);
      setUltimoResultadoEscaneo({ codigo, resultado });
      if (resultado === "VALIDO") {
        toast.success("Caja válida");
      } else {
        toast.error(RESULTADO_TOAST_ERROR[resultado] || "Revisa el resultado del escaneo");
      }
      return true;
    } catch {
      toast.error("Error de red al registrar el escaneo — verifica tu conexión");
      return false;
    } finally {
      setEnviandoEscaneo(false);
    }
  }

  async function confirmarFinalizarCargue() {
    if (!detalle || finalizandoCargue) return;
    setFinalizandoCargue(true);
    try {
      const res = await fetch(`/api/cargue-gourmet/${detalle.id}/finalizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updatedAt: detalle.updatedAt }),
      });
      const json = await res.json();
      if (!res.ok) {
        // 409 aquí puede ser: cantidad no coincide, novedades abiertas,
        // el pedido ya no está EN_CARGUE, o updatedAt desactualizado — no se
        // asume cuál; se muestra siempre el mensaje real del backend y se
        // refresca el detalle para que el usuario vea el estado actual.
        toast.error(json.error ?? "No se pudo finalizar el cargue");
        if (res.status === 409) loadDetalle(detalle.id);
        return;
      }
      toast.success("Cargue finalizado");
      setShowFinalizarConfirm(false);
      refreshAfterAction();
    } catch {
      toast.error("Error de red al finalizar el cargue — verifica tu conexión");
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
        onCreated={() => load(1)}
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
                <button disabled={page <= 1} onClick={() => load(page - 1)} className="g-btn g-btn-secondary g-btn-sm">Anterior</button>
                <button disabled={page >= totalPages} onClick={() => load(page + 1)} className="g-btn g-btn-secondary g-btn-sm">Siguiente</button>
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
