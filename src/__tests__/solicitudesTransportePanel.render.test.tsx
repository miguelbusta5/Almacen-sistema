import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SolicitudDetailPanel } from "@/app/(dashboard)/dashboard/solicitudes-transporte/_components";
import type { Solicitud } from "@/app/(dashboard)/dashboard/solicitudes-transporte/_components";

const baseRow: Solicitud = {
  id: "sol-1",
  fechaSolicitud: "2026-06-01",
  areaSolicitante: "Despachos",
  solicitanteNombre: "Maria Fernanda Restrepo",
  solicitanteCorreo: "maria@grupoambiente.com",
  solicitanteTelefono: "3001234567",
  tipoVenta: "N/A",
  numeroPedido: "PED-99887766",
  facturaIntegracion: "FAC-001",
  cobroFlete: false,
  cantidadCajas: 12,
  volumenEstimado: "Mediano",
  tipoMercancia: "Mixto",
  ciudadOrigen: "Bogota D.C.",
  zonaRecogida: "Urbana",
  direccionRecogida: "Calle 1 # 2-3",
  puntoRecogida: "90 Cedi",
  ciudadEntrega: "Medellin",
  direccionEntrega: "Calle 4 # 5-6",
  zonaEntrega: "Urbana",
  fechaPromesaEntrega: "2026-06-10",
  ventanaEntrega: "Horario A.M",
  restriccionHoraria: false,
  tipoServicio: "Entrega directa",
  observacionesSolicitante: "Sin observaciones",
  estado: "PENDIENTE",
  stellaEstado: "PENDIENTE",
  semaforo: "NORMAL",
  creadoPorId: "user-1",
  plines: [{ plu: "PLU1", descripcion: "Producto 1", unidades: 3 }],
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const gestion = {
  documentoNetSuite: "",
  stellaEstado: "PENDIENTE",
  transportadora: "",
  numeroGuia: "",
  fechaProgramacion: "",
  observacionTransporte: "",
};

function renderPanel(overrides: Partial<Solicitud> = {}, extra: Partial<{ isGestor: boolean; canEdit: boolean; canDelete: boolean }> = {}) {
  const selected = { ...baseRow, ...overrides };
  return renderToStaticMarkup(
    <SolicitudDetailPanel
      selected={selected}
      isGestor={extra.isGestor ?? false}
      canEdit={extra.canEdit ?? true}
      canDelete={extra.canDelete ?? true}
      gestion={gestion}
      setGestion={() => {}}
      rejectText=""
      setRejectText={() => {}}
      transportadoras={["Transportadora XYZ"]}
      moduleColor="#14DBA0"
      onClose={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onReenviar={() => {}}
      onSaveGestion={() => {}}
      onRechazar={() => {}}
    />,
  );
}

describe("SolicitudDetailPanel — render (vista a ancho completo / ModuleDetailView)", () => {
  it("renderiza la vista de detalle cuando hay solicitud seleccionada", () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="solicitud-detalle-view"');
  });

  it("muestra el número de pedido/solicitud en el título", () => {
    const html = renderPanel();
    expect(html).toContain("PED-99887766");
  });

  it("muestra origen y destino en el subtítulo", () => {
    const html = renderPanel();
    expect(html).toContain("Bogota D.C.");
    expect(html).toContain("Medellin");
  });

  it("muestra el Estado como badge", () => {
    const html = renderPanel({ estado: "PROGRAMADA" });
    expect(html).toContain("ds-badge");
    expect(html).toContain("PROGRAMADA");
  });

  it("muestra el Semáforo como badge", () => {
    const html = renderPanel({ semaforo: "ALERTA" });
    expect(html).toContain("ALERTA");
  });

  it("muestra acciones Editar/Borrar cuando los permisos lo permiten", () => {
    const html = renderPanel({}, { canEdit: true, canDelete: true });
    expect(html).toContain('data-testid="panel-editar"');
    expect(html).toContain('data-testid="panel-borrar"');
  });

  it("oculta Editar/Borrar cuando no hay permiso", () => {
    const html = renderPanel({}, { canEdit: false, canDelete: false });
    expect(html).not.toContain('data-testid="panel-editar"');
    expect(html).not.toContain('data-testid="panel-borrar"');
  });

  it("muestra Corregir/Reenviar solo si NO es gestor y el estado es RECHAZADA", () => {
    const htmlRechazada = renderPanel({ estado: "RECHAZADA" }, { isGestor: false });
    expect(htmlRechazada).toContain('data-testid="panel-corregir"');
    expect(htmlRechazada).toContain('data-testid="panel-reenviar"');

    const htmlPendiente = renderPanel({ estado: "PENDIENTE" }, { isGestor: false });
    expect(htmlPendiente).not.toContain('data-testid="panel-corregir"');
  });

  it("muestra la sección de Gestión transporte solo si isGestor=true", () => {
    const htmlGestor = renderPanel({}, { isGestor: true });
    expect(htmlGestor).toContain("Gestión transporte");
    expect(htmlGestor).toContain('data-testid="panel-guardar-gestion"');

    const htmlNoGestor = renderPanel({}, { isGestor: false });
    expect(htmlNoGestor).not.toContain("Gestión transporte");
  });

  it("no desaparecen las secciones críticas del detalle", () => {
    const html = renderPanel();
    expect(html).toContain("Información general");
    expect(html).toContain("Pedido y mercancía");
    expect(html).toContain("PLUs");
    expect(html).toContain("Origen y destino");
    expect(html).toContain("Programacion y servicio");
  });

  it("renderiza el botón de volver al listado (header)", () => {
    const onClose = vi.fn();
    const html = renderToStaticMarkup(
      <SolicitudDetailPanel
        selected={baseRow}
        isGestor={false}
        canEdit={false}
        canDelete={false}
        gestion={gestion}
        setGestion={() => {}}
        rejectText=""
        setRejectText={() => {}}
        transportadoras={[]}
        moduleColor="#14DBA0"
        onClose={onClose}
        onEdit={() => {}}
        onDelete={() => {}}
        onReenviar={() => {}}
        onSaveGestion={() => {}}
        onRechazar={() => {}}
      />,
    );
    // ModuleDetailView renderiza el botón "Volver al listado" en el header,
    // cableado (vía onBack) a la prop onClose recibida del padre.
    expect(html).toContain('data-testid="volver-listado-btn"');
    expect((html.match(/<button/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it("no usa tr::before ni tr::after (el panel no contiene tablas)", () => {
    const html = renderPanel();
    expect(html).not.toMatch(/tr::before/i);
    expect(html).not.toMatch(/tr::after/i);
  });
});
