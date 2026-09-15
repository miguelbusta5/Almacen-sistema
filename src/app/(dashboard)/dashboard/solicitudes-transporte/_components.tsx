"use client";

import { FileText, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { SlidePanel, DetailSection, DetailGrid } from "@/components/ui/SlidePanel";

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

export const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface2)",
  color: "var(--text)",
  padding: "0 10px",
  fontSize: 13,
  outline: "none",
};

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--muted2)" }}>
      {label}
      {children}
    </label>
  );
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

export interface GestionForm {
  documentoNetSuite: string;
  stellaEstado: string;
  transportadora: string;
  numeroGuia: string;
  fechaProgramacion: string;
  observacionTransporte: string;
}

export function SolicitudDetailPanel({
  selected,
  isGestor,
  canEdit,
  canDelete,
  gestion,
  setGestion,
  rejectText,
  setRejectText,
  transportadoras,
  moduleColor,
  onClose,
  onEdit,
  onDelete,
  onReenviar,
  onSaveGestion,
  onRechazar,
}: {
  selected: Solicitud | null;
  isGestor: boolean;
  canEdit: boolean;
  canDelete: boolean;
  gestion: GestionForm;
  setGestion: (updater: (g: GestionForm) => GestionForm) => void;
  rejectText: string;
  setRejectText: (value: string) => void;
  transportadoras: string[];
  moduleColor: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReenviar: () => void;
  onSaveGestion: () => void;
  onRechazar: () => void;
}) {
  return (
    <SlidePanel
      open={!!selected}
      onClose={onClose}
      title={selected?.numeroPedido || "Solicitud transporte"}
      subtitle={selected ? `${selected.ciudadOrigen} -> ${selected.ciudadEntrega}` : undefined}
      moduleColor={selected ? ESTADO_COLOR[selected.estado] : undefined}
      badge={selected && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <EstadoBadge estado={selected.estado} />
          <SemaforoBadge semaforo={selected.semaforo} color={ESTADO_COLOR[selected.estado]} />
        </div>
      )}
      primaryAction={selected && !isGestor && selected.estado === "RECHAZADA" ? (
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          <button data-testid="panel-corregir" onClick={onEdit} style={{ flex: 1, height: 36, border: "none", borderRadius: 8, background: moduleColor, color: "white", fontWeight: 700, cursor: "pointer" }}>Corregir</button>
          <button data-testid="panel-reenviar" onClick={onReenviar} style={{ flex: 1, height: 36, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontWeight: 700, cursor: "pointer" }}>Reenviar</button>
        </div>
      ) : undefined}
      secondaryActions={selected && (
        <div style={{ display: "flex", gap: 8 }}>
          {canEdit && (
            <button data-testid="panel-editar" className="ds-btn ds-btn-secondary ds-btn-sm" onClick={onEdit}>
              <Pencil size={13} /> Editar
            </button>
          )}
          {canDelete && (
            <button data-testid="panel-borrar" className="ds-btn ds-btn-ghost ds-btn-sm" style={{ color: "var(--error)" }} onClick={onDelete}>
              <Trash2 size={13} /> Borrar
            </button>
          )}
        </div>
      )}
    >
      {selected && (
        <>
          {selected.motivoRechazo && (
            <div data-testid="panel-motivo-rechazo" style={{ padding: 12, borderRadius: 10, background: "var(--error-tint)", color: "var(--error)", fontSize: 13, marginBottom: 14 }}>
              <strong>Motivo de rechazo:</strong> {selected.motivoRechazo}
            </div>
          )}

          <DetailSection title="Información general" color={moduleColor}>
            <DetailGrid items={[
              { label: "Fecha solicitud", value: selected.fechaSolicitud },
              { label: "Area", value: selected.areaSolicitante === "Otro" ? selected.areaOtro : selected.areaSolicitante },
              { label: "Solicitante", value: selected.solicitanteNombre },
              { label: "Correo", value: selected.solicitanteCorreo },
              { label: "Contacto", value: selected.solicitanteTelefono },
            ]} />
          </DetailSection>

          <DetailSection title="Pedido y mercancía" color={ESTADO_COLOR.PENDIENTE}>
            <DetailGrid items={[
              { label: "Tipo venta", value: selected.tipoVenta },
              { label: "Pedido / orden", value: selected.numeroPedido },
              { label: "Factura integracion", value: selected.facturaIntegracion },
              { label: "Cantidad cajas", value: selected.cantidadCajas ?? selected.unidades },
              { label: "Volumen", value: selected.volumenEstimado },
              { label: "Tipo mercancía", value: selected.tipoMercancia },
              { label: "Flete", value: selected.cobroFlete ? `Si - $${selected.valorFlete ?? 0}` : "No" },
            ]} />
          </DetailSection>

          <DetailSection title="PLUs" color={ESTADO_COLOR.REENVIADA}>
            {selected.plines?.length ? (
              <div style={{ display: "grid", gap: 6 }}>
                {selected.plines.map((p, i) => (
                  <div key={p.id ?? i} style={{ display: "grid", gridTemplateColumns: "90px 1fr 70px", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--surface2)", fontSize: 13, color: "var(--text)" }}>
                    <strong>{p.plu}</strong>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.descripcion}>{p.descripcion}</span>
                    <span>{p.unidades} und.</span>
                  </div>
                ))}
              </div>
            ) : <span style={{ color: "var(--muted)", fontSize: 13 }}>Sin PLUs registrados</span>}
          </DetailSection>

          <DetailSection title="Origen y destino" color={moduleColor}>
            <DetailGrid items={[
              { label: "Ciudad origen", value: selected.ciudadOrigen },
              { label: "Zona recogida", value: selected.zonaRecogida },
              { label: "Direccion recogida", value: selected.direccionRecogida },
              { label: "Punto recogida", value: selected.puntoRecogida === "Otros" ? selected.puntoRecogidaOtro : selected.puntoRecogida },
              { label: "Ciudad entrega", value: selected.ciudadEntrega },
              { label: "Direccion entrega", value: selected.direccionEntrega },
              { label: "Zona entrega", value: selected.zonaEntrega },
            ]} />
          </DetailSection>

          <DetailSection title="Programacion y servicio" color={SEMAFORO_COLOR.ALERTA}>
            <DetailGrid items={[
              { label: "Fecha promesa", value: selected.fechaPromesaEntrega },
              { label: "Ventana", value: selected.ventanaEntrega },
              { label: "Restriccion", value: selected.restriccionHoraria ? selected.descripcionRestriccion : "No" },
              { label: "Tipo servicio", value: selected.tipoServicio === "Otro" ? selected.tipoServicioOtro : selected.tipoServicio },
            ]} />
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, marginTop: 10 }}>{selected.observacionesSolicitante}</p>
          </DetailSection>

          {isGestor && (
            <DetailSection title="Gestión transporte" color={ESTADO_COLOR.PROGRAMADA}>
              <Field label="Stella / estado gestion">
                <select value={gestion.stellaEstado} onChange={(e) => setGestion((g) => ({ ...g, stellaEstado: e.target.value }))} style={inputStyle}>
                  {["PENDIENTE", "PROGRAMADO", "EFECTUADO", "CANCELADO"].map((e) => <option key={e}>{e}</option>)}
                </select>
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                <Field label="Documento NetSuite"><input value={gestion.documentoNetSuite} onChange={(e) => setGestion((g) => ({ ...g, documentoNetSuite: e.target.value }))} style={inputStyle} /></Field>
                <Field label="Fecha programación"><input type="date" value={gestion.fechaProgramacion} onChange={(e) => setGestion((g) => ({ ...g, fechaProgramacion: e.target.value }))} style={inputStyle} /></Field>
                <Field label="Transportadora">
                  <select required value={gestion.transportadora} onChange={(e) => setGestion((g) => ({ ...g, transportadora: e.target.value }))} style={inputStyle}>
                    <option value="">Seleccionar</option>
                    {transportadoras.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Número guía"><input value={gestion.numeroGuia} onChange={(e) => setGestion((g) => ({ ...g, numeroGuia: e.target.value }))} style={inputStyle} /></Field>
              </div>
              <div style={{ marginTop: 10 }}>
                <Field label="Observacion transporte">
                  <textarea value={gestion.observacionTransporte} onChange={(e) => setGestion((g) => ({ ...g, observacionTransporte: e.target.value }))} rows={3} style={{ ...inputStyle, height: "auto", padding: 10 }} />
                </Field>
              </div>
              <button data-testid="panel-guardar-gestion" onClick={onSaveGestion} style={{ marginTop: 10, height: 36, width: "100%", border: "none", borderRadius: 8, background: moduleColor, color: "white", fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: 7 }}><CheckCircle2 size={15} /> Guardar gestión</button>

              {!["EFECTUADA", "CANCELADA"].includes(selected.estado) && (
                <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 14 }}>
                  <Field label="Motivo rechazo">
                    <textarea value={rejectText} onChange={(e) => setRejectText(e.target.value)} rows={2} style={{ ...inputStyle, height: "auto", padding: 10 }} />
                  </Field>
                  <button data-testid="panel-rechazar" onClick={onRechazar} style={{ height: 36, border: "1px solid rgba(220,38,38,.35)", borderRadius: 8, background: "var(--error-tint)", color: "var(--error)", fontWeight: 700, cursor: "pointer" }}>Rechazar solicitud</button>
                </div>
              )}
            </DetailSection>
          )}
        </>
      )}
    </SlidePanel>
  );
}
