"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";

export type Estado = "PENDIENTE" | "RECHAZADA" | "REENVIADA" | "PROGRAMADA" | "EFECTUADA" | "CANCELADA";

export interface PluLinea {
  id?: string;
  plu: string;
  descripcion: string;
  unidades: number;
}

export interface Solicitud {
  id: string;
  fechaSolicitud: string;
  areaSolicitante: string;
  areaOtro?: string | null;
  solicitanteNombre: string;
  solicitanteCorreo: string;
  solicitanteTelefono: string;
  tipoVenta: string;
  numeroPedido: string;
  facturaIntegracion: string;
  cobroFlete: boolean;
  valorFlete?: number | null;
  cantidadCajas?: number | null;
  unidades?: number | null;
  volumenEstimado: string;
  tipoMercancia: string;
  ciudadOrigen: string;
  zonaRecogida: string;
  direccionRecogida: string;
  puntoRecogida: string;
  puntoRecogidaOtro?: string | null;
  ciudadEntrega: string;
  direccionEntrega: string;
  zonaEntrega: string;
  fechaPromesaEntrega: string;
  ventanaEntrega: string;
  restriccionHoraria: boolean;
  descripcionRestriccion?: string | null;
  tipoServicio: string;
  tipoServicioOtro?: string | null;
  observacionesSolicitante: string;
  estado: Estado;
  stellaEstado: "PENDIENTE" | "PROGRAMADO" | "EFECTUADO" | "CANCELADO";
  documentoNetSuite?: string | null;
  transportadora?: string | null;
  numeroGuia?: string | null;
  fechaProgramacion?: string | null;
  observacionTransporte?: string | null;
  prioridad?: "ALTO" | "MEDIO" | "BAJO" | null;
  semaforo: string;
  motivoRechazo?: string | null;
  creadoPorId: string;
  creadoPorNombre?: string | null;
  gestionadoPorNombre?: string | null;
  deletedAt?: string | null;
  plines: PluLinea[];
  updatedAt: string;
}

export const ESTADO_COLOR: Record<Estado, string> = {
  PENDIENTE: "var(--state-created, #FFC53D)",
  REENVIADA: "var(--info, #34D9F0)",
  PROGRAMADA: "var(--state-sent, #5B9DFF)",
  EFECTUADA: "var(--success, #2EE6A6)",
  RECHAZADA: "var(--error, #FF6B6B)",
  CANCELADA: "var(--muted, #8B9398)",
};

export const SEMAFORO_COLOR: Record<string, string> = {
  VENCIDO: "var(--error, #FF6B6B)",
  ALERTA: "var(--warning, #FFC53D)",
  NORMAL: "var(--success, #2EE6A6)",
  EFECTUADO: "var(--success, #2EE6A6)",
  CANCELADO: "var(--muted, #8B9398)",
  SIN_FECHA: "var(--info, #34D9F0)",
};

type BadgeVariant = "default" | "info" | "success" | "warning" | "error";

export function estadoVariant(estado: Estado): BadgeVariant {
  if (estado === "RECHAZADA" || estado === "CANCELADA") return "error";
  if (estado === "EFECTUADA") return "success";
  if (estado === "PROGRAMADA") return "info";
  return "default";
}

export function semaforoVariant(semaforo: string): BadgeVariant {
  if (semaforo === "VENCIDO" || semaforo === "CANCELADO") return "error";
  if (semaforo === "ALERTA") return "warning";
  if (semaforo === "EFECTUADO" || semaforo === "NORMAL") return "success";
  return "default";
}

export function EstadoBadge({ estado }: { estado: Estado }) {
  return <Badge label={estado} variant={estadoVariant(estado)} dot={false} color={ESTADO_COLOR[estado]} />;
}

export function SemaforoBadge({ semaforo, color }: { semaforo: string; color: string }) {
  return <Badge label={semaforo} variant={semaforoVariant(semaforo)} color={SEMAFORO_COLOR[semaforo] ?? color} />;
}

export function SolicitudesTable({
  loading,
  rows,
  onOpen,
  debug = false,
}: {
  loading: boolean;
  rows: Solicitud[];
  onOpen: (r: Solicitud) => void;
  debug?: boolean;
}) {
  const columns: Column<Solicitud>[] = [
    {
      key: "solicitud",
      header: "Solicitud",
      width: "20%",
      testId: "solicitud-cell",
      debugLabel: "Solicitud",
      render: (r) => (
        <>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.numeroPedido || "Sin pedido"}>
            {r.numeroPedido || "Sin pedido"}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${r.solicitanteNombre} - ${r.areaSolicitante}`}>
            {r.solicitanteNombre} - {r.areaSolicitante}
          </div>
        </>
      ),
    },
    {
      key: "origen",
      header: "Origen",
      width: "13%",
      testId: "origen-cell",
      debugLabel: "Origen",
      truncate: true,
      render: (r) => <span style={{ color: "var(--text)", fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.ciudadOrigen}>{r.ciudadOrigen}</span>,
    },
    {
      key: "destino",
      header: "Destino",
      width: "13%",
      testId: "destino-cell",
      debugLabel: "Destino",
      render: (r) => <span style={{ color: "var(--text)", fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.ciudadEntrega}>{r.ciudadEntrega}</span>,
    },
    {
      key: "cajas",
      header: "Cajas",
      width: "8%",
      testId: "cajas-cell",
      debugLabel: "Cajas",
      render: (r) => <span style={{ color: "var(--text)", fontSize: 13 }}>{r.cantidadCajas ?? r.unidades ?? "N/A"}</span>,
    },
    {
      key: "promesa",
      header: "Promesa",
      width: "12%",
      testId: "promesa-cell",
      debugLabel: "Promesa",
      render: (r) => <span style={{ color: "var(--muted)", fontSize: 13 }}>{r.fechaPromesaEntrega ?? "Sin fecha"}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      width: "12%",
      testId: "estado-cell",
      debugLabel: "Estado",
      render: (r) => <EstadoBadge estado={r.estado} />,
    },
    {
      key: "semaforo",
      header: "Semáforo",
      width: "11%",
      testId: "semaforo-cell",
      debugLabel: "Semáforo",
      render: (r) => <SemaforoBadge semaforo={r.semaforo} color={ESTADO_COLOR[r.estado]} />,
    },
    {
      key: "gestion",
      header: "Gestión",
      width: "11%",
      testId: "gestion-cell",
      debugLabel: "Gestión",
      render: (r) => <span style={{ color: "var(--muted)", fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.transportadora || r.gestionadoPorNombre || "Pendiente"}>{r.transportadora || r.gestionadoPorNombre || "Pendiente"}</span>,
    },
  ];

  return (
    <DataTable<Solicitud>
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      loading={loading}
      onRowClick={onOpen}
      getRowColor={(r) => ESTADO_COLOR[r.estado]}
      tableLayout="fixed"
      minWidth={980}
      debug={debug}
      ariaLabel="Solicitudes de transporte"
      empty={{
        icon: <FileText size={28} />,
        title: "Sin solicitudes",
        description: "Crea la primera solicitud de transporte interna.",
      }}
    />
  );
}
