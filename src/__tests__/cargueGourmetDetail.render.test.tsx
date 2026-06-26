import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PedidoDetalleView } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/PedidoDetalleView";
import type { PedidoDetalle } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/PedidoDetalleTypes";

// Nota de alcance: la vista de detalle (`PedidoDetalleView`) usa el marco
// compartido `ModuleDetailView` (no `SlidePanel`/`createPortal`), así que
// `renderToStaticMarkup` pinta todo su markup y permite verificar el contenido
// estático del detalle, sin simular clics/cierre real (requeriría jsdom).

const mockPedido: PedidoDetalle = {
  id: "p1",
  orden: "TSDM98761",
  tipoOrden: "TSDM",
  estado: "EN_CARGUE",
  codigoTienda: "T001",
  nombreTienda: "Tienda Centro",
  ciudadDestino: "Bogotá",
  cajasEsperadas: 5,
  estibasEsperadas: 2,
  creadoPorNombre: "Maria Gourmet",
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T10:00:00.000Z",
  ubicacionAsignadaAt: "2026-06-24T09:30:00.000Z",
  enviadoTransporteAt: "2026-06-24T09:45:00.000Z",
  cargueIniciadoAt: "2026-06-24T10:00:00.000Z",
  cargueCompletadoAt: null,
  estibas: [
    { id: "e1", secuencia: 1, ubicacion: "A1", observacion: null },
    { id: "e2", secuencia: 2, ubicacion: "A2", observacion: "Cerca a la puerta" },
  ],
  cajas: [
    { id: "c1", numeroSecuencia: 1, codigoCaja: "TSDM98761-CAJA-01" },
  ],
  cargues: [
    {
      id: "cg1",
      estado: "EN_CARGUE",
      cantidadEsperada: 5,
      cantidadEscaneada: 1,
      tipoCierre: null,
      iniciadoPorId: "u_transporte",
      iniciadoAt: "2026-06-24T10:00:00.000Z",
      finalizadoPorId: null,
      finalizadoAt: null,
      escaneos: [
        { id: "s1", codigoEscaneado: "TSDM98761-CAJA-01", resultado: "VALIDO", escaneadoPorId: "u_transporte", createdAt: "2026-06-24T10:05:00.000Z" },
      ],
    },
  ],
  novedades: [
    {
      id: "n1",
      tipo: "CAJA_AJENA",
      estado: "ABIERTA",
      descripcion: "Esta caja no pertenece a este pedido.",
      registradaPorId: "u_transporte",
      resueltaPorId: null,
      resueltaAt: null,
      createdAt: "2026-06-24T10:06:00.000Z",
    },
  ],
};

function renderPanel(overrides: Partial<{
  loading: boolean; error: string | null; pedido: PedidoDetalle | null;
}> = {}) {
  return renderToStaticMarkup(
    <PedidoDetalleView
      onBack={() => {}}
      onRetry={() => {}}
      loading={overrides.loading ?? false}
      error={overrides.error ?? null}
      pedido={overrides.pedido === undefined ? mockPedido : overrides.pedido}
    />
  );
}

describe("PedidoDetallePanel — resumen del pedido", () => {
  it("renderiza los datos principales del resumen", () => {
    const html = renderPanel();
    expect(html).toContain("TSDM98761");
    expect(html).toContain("Tienda Centro");
    expect(html).toContain("Bogotá");
    expect(html).toContain("Maria Gourmet");
  });
});

describe("PedidoDetallePanel — estibas", () => {
  it("renderiza las estibas ordenadas con ubicación y observación", () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="estiba-e1"');
    expect(html).toContain('data-testid="estiba-e2"');
    expect(html).toContain("Cerca a la puerta");
  });

  it("muestra EmptyState cuando no hay estibas", () => {
    const html = renderPanel({ pedido: { ...mockPedido, estibas: [] } });
    expect(html).toContain("Sin estibas registradas");
  });
});

describe("PedidoDetallePanel — cajas", () => {
  it("renderiza las cajas con secuencia y código", () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="caja-c1"');
    expect(html).toContain("TSDM98761-CAJA-01");
  });

  it("muestra EmptyState cuando no hay cajas", () => {
    const html = renderPanel({ pedido: { ...mockPedido, cajas: [] } });
    expect(html).toContain("Sin cajas registradas");
  });
});

describe("PedidoDetallePanel — cargues", () => {
  it("renderiza el cargue con estado, cantidades y usuarios", () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="cargue-cg1"');
    expect(html).toContain("u_transporte");
  });

  it("muestra EmptyState cuando no hay cargues", () => {
    const html = renderPanel({ pedido: { ...mockPedido, cargues: [] } });
    expect(html).toContain("Sin cargues registrados");
  });
});

describe("PedidoDetallePanel — escaneos", () => {
  it("renderiza los escaneos de los cargues", () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="escaneos-list"');
    expect(html).toContain("TSDM98761-CAJA-01");
  });

  it("muestra EmptyState cuando no hay escaneos en ningún cargue", () => {
    const html = renderPanel({ pedido: { ...mockPedido, cargues: [{ ...mockPedido.cargues[0], escaneos: [] }] } });
    expect(html).toContain("Sin escaneos registrados");
  });
});

describe("PedidoDetallePanel — novedades", () => {
  it("renderiza las novedades con tipo, estado y descripción", () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="novedad-n1"');
    expect(html).toContain("Caja ajena");
    expect(html).toContain("Esta caja no pertenece a este pedido.");
  });

  it("muestra EmptyState cuando no hay novedades", () => {
    const html = renderPanel({ pedido: { ...mockPedido, novedades: [] } });
    expect(html).toContain("Sin novedades registradas");
  });
});

describe("PedidoDetallePanel — estados de carga y error", () => {
  it("muestra skeleton de carga", () => {
    const html = renderPanel({ loading: true, pedido: null });
    expect(html).toContain('data-testid="detalle-loading"');
  });

  it("muestra mensaje de error con acción de reintentar", () => {
    const html = renderPanel({ error: "No se pudo cargar el detalle del pedido.", pedido: null });
    expect(html).toContain("No se pudo cargar el detalle del pedido.");
    expect(html).toContain("Reintentar");
  });
});

describe("PedidoDetallePanel — sin acciones operativas", () => {
  it("no renderiza ningún botón de editar/ubicación/enviar/iniciar/escanear/finalizar/cierre manual", () => {
    const html = renderPanel();
    for (const texto of ["Editar pedido", "Guardar ubicación", "Enviar a Transporte", "Iniciar cargue", "Escanear caja", "Finalizar cargue", "Cierre manual"]) {
      expect(html).not.toContain(texto);
    }
  });
});
