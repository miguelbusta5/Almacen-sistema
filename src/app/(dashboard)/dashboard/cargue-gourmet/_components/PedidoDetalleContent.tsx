"use client";

import { Badge, EmptyState, TimelineItem } from "@/components/ui";
import { DetailSection, DetailGrid } from "@/components/ui/SlidePanel";
import { PackageSearch } from "lucide-react";
import { ESTADO_LABEL, fmtFechaHora } from "../_components";
import { GourmetAccionesBar } from "./GourmetAccionesBar";
import { TransporteAccionesBar } from "./TransporteAccionesBar";
import { EscaneoCajasPanel, type ProgresoEscaneo, type UltimoResultadoEscaneo } from "./EscaneoCajasPanel";
import { decodeEstibaObservacion } from "./AsignarUbicacionModal";
import type { PedidoDetalle } from "./PedidoDetalleTypes";

// Respiración consistente entre secciones del detalle, dentro de la vista a
// ancho completo (`PedidoDetalleView` → `ModuleDetailView`).
function PanelBlock({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        paddingBottom: 20,
        marginBottom: 20,
        borderBottom: last ? "none" : "1px solid var(--border)",
      }}
    >
      {children}
    </div>
  );
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

export interface PedidoDetalleContentProps {
  loading: boolean;
  error: string | null;
  pedido: PedidoDetalle | null;
  onRetry: () => void;
  puedeGourmet?: boolean;
  onEditar?: () => void;
  onAsignarUbicacion?: () => void;
  puedeTransporte?: boolean;
  onIniciarCargue?: () => void;
  iniciandoCargue?: boolean;
  progresoEscaneo?: ProgresoEscaneo | null;
  ultimoResultadoEscaneo?: UltimoResultadoEscaneo | null;
  enviandoEscaneo?: boolean;
  onEscanear?: (codigo: string) => Promise<boolean>;
  onFinalizarCargue?: () => void;
  finalizandoCargue?: boolean;
  puedeCierreManual?: boolean;
  onCierreManual?: () => void;
  puedeEliminar?: boolean;
  onEliminar?: () => void;
  puedeRevertirCargue?: boolean;
  onRevertirCargue?: () => void;
}

export function PedidoDetalleContent({
  loading,
  error,
  pedido,
  onRetry,
  puedeGourmet = false,
  onEditar,
  onAsignarUbicacion,
  puedeTransporte = false,
  onIniciarCargue,
  iniciandoCargue = false,
  progresoEscaneo = null,
  ultimoResultadoEscaneo = null,
  enviandoEscaneo = false,
  onEscanear,
  onFinalizarCargue,
  finalizandoCargue = false,
  puedeCierreManual = false,
  onCierreManual,
  puedeEliminar = false,
  onEliminar,
  puedeRevertirCargue = false,
  onRevertirCargue,
}: PedidoDetalleContentProps) {
  return (
    <>
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
          <PanelBlock>
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
          </PanelBlock>

          <PanelBlock>
            <GourmetAccionesBar
              estado={pedido.estado}
              puedeGourmet={puedeGourmet}
              onEditar={() => onEditar?.()}
              onAsignarUbicacion={() => onAsignarUbicacion?.()}
              puedeEliminar={puedeEliminar}
              onEliminar={() => onEliminar?.()}
            />

            <TransporteAccionesBar
              estado={pedido.estado}
              puedeTransporte={puedeTransporte}
              onIniciarCargue={() => onIniciarCargue?.()}
              iniciando={iniciandoCargue}
              progreso={progresoEscaneo}
              onFinalizarCargue={() => onFinalizarCargue?.()}
              finalizando={finalizandoCargue}
              puedeCierreManual={puedeCierreManual}
              onCierreManual={() => onCierreManual?.()}
              puedeRevertirCargue={puedeRevertirCargue}
              onRevertirCargue={() => onRevertirCargue?.()}
            />

            <EscaneoCajasPanel
              estado={pedido.estado}
              puedeTransporte={puedeTransporte}
              progreso={progresoEscaneo}
              ultimoResultado={ultimoResultadoEscaneo}
              enviando={enviandoEscaneo}
              onEscanear={onEscanear ?? (async () => false)}
            />
          </PanelBlock>

          <PanelBlock>
            <DetailSection title="Ubicación / Estibas">
              {pedido.estibas.length === 0 ? (
                <EmptyState icon={<PackageSearch size={22} />} title="Sin estibas registradas" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="estibas-list">
                  {pedido.estibas
                    .slice()
                    .sort((a, b) => a.secuencia - b.secuencia)
                    .map((e) => {
                      const { cantidadCajas, observacion } = decodeEstibaObservacion(e.observacion);
                      return (
                        <div
                          key={e.id}
                          data-testid={`estiba-${e.id}`}
                          style={{
                            display: "flex", alignItems: "baseline", justifyContent: "space-between",
                            gap: 10, fontSize: 13, color: "var(--text)",
                            padding: "8px 10px", borderRadius: 8, background: "var(--surface2)",
                          }}
                        >
                          <span>
                            <strong>Estiba {e.secuencia}</strong> — {e.ubicacion}
                            {observacion && <span style={{ color: "var(--muted)" }}> ({observacion})</span>}
                          </span>
                          {cantidadCajas != null && (
                            <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{cantidadCajas} cajas</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </DetailSection>
          </PanelBlock>

          <PanelBlock>
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
          </PanelBlock>

          <PanelBlock>
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
          </PanelBlock>

          <PanelBlock>
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
          </PanelBlock>

          <PanelBlock last>
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
          </PanelBlock>
        </>
      )}
    </>
  );
}
