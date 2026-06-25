"use client";

import { Badge, EmptyState, TimelineItem } from "@/components/ui";
import { SlidePanel, DetailSection, DetailGrid } from "@/components/ui/SlidePanel";
import { PackageSearch } from "lucide-react";
import { ESTADO_COLOR, ESTADO_LABEL, estadoVariant, fmtFechaHora, type EstadoPedidoGourmet } from "../_components";
import { GourmetAccionesBar } from "./GourmetAccionesBar";

export interface EstibaDetalle {
  id: string;
  secuencia: number;
  ubicacion: string;
  observacion: string | null;
}

export interface CajaDetalle {
  id: string;
  numeroSecuencia: number | null;
  codigoCaja: string | null;
}

export interface EscaneoDetalle {
  id: string;
  codigoEscaneado: string;
  resultado: string;
  escaneadoPorId?: string;
  createdAt: string;
}

export interface CargueDetalle {
  id: string;
  estado: string;
  cantidadEsperada: number;
  cantidadEscaneada: number;
  tipoCierre: string | null;
  iniciadoPorId: string;
  iniciadoAt: string;
  finalizadoPorId: string | null;
  finalizadoAt: string | null;
  escaneos: EscaneoDetalle[];
}

export interface NovedadDetalle {
  id: string;
  tipo: string;
  estado: string;
  descripcion: string;
  registradaPorId: string;
  resueltaPorId: string | null;
  resueltaAt: string | null;
  createdAt: string;
}

export interface PedidoDetalle {
  id: string;
  orden: string;
  tipoOrden: string;
  estado: EstadoPedidoGourmet;
  codigoTienda: string;
  nombreTienda: string;
  ciudadDestino: string;
  cajasEsperadas: number;
  estibasEsperadas: number;
  creadoPorNombre: string | null;
  createdAt: string;
  updatedAt: string;
  ubicacionAsignadaAt: string | null;
  enviadoTransporteAt: string | null;
  cargueIniciadoAt: string | null;
  cargueCompletadoAt: string | null;
  estibas: EstibaDetalle[];
  cajas: CajaDetalle[];
  cargues: CargueDetalle[];
  novedades: NovedadDetalle[];
}

const RESULTADO_DOT: Record<string, "default" | "success" | "error" | "warning"> = {
  VALIDO: "success",
  DUPLICADO: "warning",
  CAJA_AJENA: "error",
  FORMATO_INVALIDO: "default",
  EXCEDE_CANTIDAD: "warning",
};

const NOVEDAD_TIPO_LABEL: Record<string, string> = {
  CAJA_FALTANTE: "Caja faltante",
  CAJA_DUPLICADA: "Caja duplicada",
  CAJA_AJENA: "Caja ajena",
  CIERRE_MANUAL: "Cierre manual",
  DIFERENCIA_CANTIDAD: "Diferencia de cantidad",
  OTRA: "Otra",
};

export function PedidoDetallePanel({
  open,
  onClose,
  loading,
  error,
  pedido,
  onRetry,
  puedeGourmet = false,
  onEditar,
  onAsignarUbicacion,
  onEnviarTransporte,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  pedido: PedidoDetalle | null;
  onRetry: () => void;
  puedeGourmet?: boolean;
  onEditar?: () => void;
  onAsignarUbicacion?: () => void;
  onEnviarTransporte?: () => void;
}) {
  const badge = pedido ? (
    <Badge label={ESTADO_LABEL[pedido.estado]} variant={estadoVariant(pedido.estado)} color={ESTADO_COLOR[pedido.estado]} />
  ) : undefined;

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={pedido ? `${pedido.tipoOrden} ${pedido.orden}` : "Detalle del pedido"}
      subtitle={pedido ? `${pedido.nombreTienda} — ${pedido.ciudadDestino}` : undefined}
      badge={badge}
      width={460}
    >
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="detalle-loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 16, borderRadius: 4 }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <EmptyState
          icon={<PackageSearch size={28} />}
          title="No se pudo cargar el pedido"
          description={error}
          action={{ label: "Reintentar", onClick: onRetry }}
        />
      )}

      {!loading && !error && pedido && (
        <>
          <GourmetAccionesBar
            estado={pedido.estado}
            puedeGourmet={puedeGourmet}
            onEditar={() => onEditar?.()}
            onAsignarUbicacion={() => onAsignarUbicacion?.()}
            onEnviarTransporte={() => onEnviarTransporte?.()}
          />

          <DetailSection title="Resumen del pedido">
            <DetailGrid
              items={[
                { label: "Orden", value: pedido.orden },
                { label: "Tipo de orden", value: pedido.tipoOrden },
                { label: "Estado", value: ESTADO_LABEL[pedido.estado] },
                { label: "Código tienda", value: pedido.codigoTienda },
                { label: "Nombre tienda", value: pedido.nombreTienda },
                { label: "Ciudad", value: pedido.ciudadDestino },
                { label: "Cajas esperadas", value: pedido.cajasEsperadas },
                { label: "Estibas esperadas", value: pedido.estibasEsperadas },
                { label: "Creado por", value: pedido.creadoPorNombre ?? "—" },
                { label: "Creado", value: fmtFechaHora(pedido.createdAt) },
                { label: "Ubicación asignada", value: fmtFechaHora(pedido.ubicacionAsignadaAt) },
                { label: "Enviado a Transporte", value: fmtFechaHora(pedido.enviadoTransporteAt) },
                { label: "Cargue iniciado", value: fmtFechaHora(pedido.cargueIniciadoAt) },
                { label: "Cargue completado", value: fmtFechaHora(pedido.cargueCompletadoAt) },
              ]}
            />
          </DetailSection>

          <DetailSection title="Ubicación / Estibas">
            {pedido.estibas.length === 0 ? (
              <EmptyState icon={<PackageSearch size={22} />} title="Sin estibas registradas" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="estibas-list">
                {pedido.estibas
                  .slice()
                  .sort((a, b) => a.secuencia - b.secuencia)
                  .map((e) => (
                    <div key={e.id} style={{ fontSize: 13, color: "var(--text)" }} data-testid={`estiba-${e.id}`}>
                      <strong>#{e.secuencia}</strong> — {e.ubicacion}
                      {e.observacion && <span style={{ color: "var(--muted)" }}> ({e.observacion})</span>}
                    </div>
                  ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Cajas registradas">
            {pedido.cajas.length === 0 ? (
              <EmptyState icon={<PackageSearch size={22} />} title="Sin cajas registradas" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-testid="cajas-list">
                {pedido.cajas.map((c) => (
                  <div key={c.id} style={{ fontSize: 13, color: "var(--text)" }} data-testid={`caja-${c.id}`}>
                    {c.numeroSecuencia != null && <strong>#{c.numeroSecuencia}</strong>}
                    {c.codigoCaja && <span style={{ fontFamily: "var(--mono)", marginLeft: 6 }}>{c.codigoCaja}</span>}
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Cargues">
            {pedido.cargues.length === 0 ? (
              <EmptyState icon={<PackageSearch size={22} />} title="Sin cargues registrados" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="cargues-list">
                {pedido.cargues.map((c) => (
                  <div key={c.id} data-testid={`cargue-${c.id}`}>
                    <DetailGrid
                      items={[
                        { label: "Estado", value: c.estado },
                        { label: "Cantidad esperada", value: c.cantidadEsperada },
                        { label: "Cantidad escaneada", value: c.cantidadEscaneada },
                        { label: "Tipo cierre", value: c.tipoCierre ?? "—" },
                        { label: "Iniciado por", value: c.iniciadoPorId },
                        { label: "Finalizado por", value: c.finalizadoPorId ?? "—" },
                        { label: "Iniciado", value: fmtFechaHora(c.iniciadoAt) },
                        { label: "Finalizado", value: fmtFechaHora(c.finalizadoAt) },
                      ]}
                    />
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Escaneos recientes">
            {pedido.cargues.flatMap((c) => c.escaneos).length === 0 ? (
              <EmptyState icon={<PackageSearch size={22} />} title="Sin escaneos registrados" />
            ) : (
              <div data-testid="escaneos-list">
                {pedido.cargues.flatMap((c) => c.escaneos).map((e) => (
                  <TimelineItem
                    key={e.id}
                    title={e.codigoEscaneado}
                    meta={`${e.resultado}${e.escaneadoPorId ? ` · ${e.escaneadoPorId}` : ""}`}
                    time={fmtFechaHora(e.createdAt)}
                    dot={RESULTADO_DOT[e.resultado] ?? "default"}
                  />
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Novedades">
            {pedido.novedades.length === 0 ? (
              <EmptyState icon={<PackageSearch size={22} />} title="Sin novedades registradas" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="novedades-list">
                {pedido.novedades.map((n) => (
                  <div key={n.id} data-testid={`novedad-${n.id}`}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Badge
                        label={NOVEDAD_TIPO_LABEL[n.tipo] ?? n.tipo}
                        variant={n.estado === "ABIERTA" ? "error" : "success"}
                      />
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{n.estado}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text)", margin: "0 0 4px" }}>{n.descripcion}</p>
                    <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
                      Registrada por {n.registradaPorId} · {fmtFechaHora(n.createdAt)}
                      {n.resueltaPorId && ` · Resuelta por ${n.resueltaPorId}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>
        </>
      )}
    </SlidePanel>
  );
}
