import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GourmetAccionesBar } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/GourmetAccionesBar";
import { EditarPedidoModal } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/EditarPedidoModal";
import { AsignarUbicacionModal } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components/AsignarUbicacionModal";
import type { EstadoPedidoGourmet } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components";

// Nota de alcance (Fase G3C4): igual que en G3C2/G3C3, `EditarPedidoModal` y
// `AsignarUbicacionModal` están envueltos en `Modal` (createPortal), que en
// este entorno Vitest (node, sin jsdom) siempre devuelve null. Por eso esos
// dos componentes solo tienen tests de "no lanza error" (contrato mínimo).
// `GourmetAccionesBar`, en cambio, es un componente puro sin portal — tiene
// cobertura completa real, incluida en este archivo.

function renderBar(estado: EstadoPedidoGourmet, puedeGourmet = true) {
  return renderToStaticMarkup(
    <GourmetAccionesBar
      estado={estado}
      puedeGourmet={puedeGourmet}
      onEditar={() => {}}
      onAsignarUbicacion={() => {}}
    />
  );
}

describe("GourmetAccionesBar — visibilidad por rol", () => {
  it("aparece para OPERACIONES_GOURMET (puedeGourmet=true) en BORRADOR", () => {
    const html = renderBar("BORRADOR", true);
    expect(html).toContain("Acciones Gourmet");
    expect(html).toContain('data-testid="btn-editar-pedido"');
  });

  it("no aparece para TRANSPORTE (puedeGourmet=false)", () => {
    const html = renderBar("BORRADOR", false);
    expect(html).toBe("");
  });
});

describe("GourmetAccionesBar — 'Editar pedido' por estado", () => {
  it.each(["BORRADOR", "UBICACION_ASIGNADA", "CON_NOVEDAD"] as EstadoPedidoGourmet[])(
    "aparece en %s",
    (estado) => expect(renderBar(estado)).toContain('data-testid="btn-editar-pedido"')
  );

  it.each(["ENVIADO_A_TRANSPORTE", "EN_CARGUE", "CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CANCELADO"] as EstadoPedidoGourmet[])(
    "NO aparece en %s",
    (estado) => expect(renderBar(estado)).not.toContain('data-testid="btn-editar-pedido"')
  );
});

describe("GourmetAccionesBar — 'Asignar ubicación' por estado", () => {
  it.each(["BORRADOR", "UBICACION_ASIGNADA"] as EstadoPedidoGourmet[])(
    "aparece en %s",
    (estado) => expect(renderBar(estado)).toContain('data-testid="btn-asignar-ubicacion"')
  );

  it.each(["ENVIADO_A_TRANSPORTE", "EN_CARGUE", "CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CON_NOVEDAD", "CANCELADO"] as EstadoPedidoGourmet[])(
    "NO aparece en %s",
    (estado) => expect(renderBar(estado)).not.toContain('data-testid="btn-asignar-ubicacion"')
  );
});

describe("GourmetAccionesBar — ya no existe 'Enviar a Transporte'", () => {
  it.each(["BORRADOR", "UBICACION_ASIGNADA", "ENVIADO_A_TRANSPORTE", "EN_CARGUE", "CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CON_NOVEDAD", "CANCELADO"] as EstadoPedidoGourmet[])(
    "NO aparece el botón enviar-transporte en %s",
    (estado) => expect(renderBar(estado)).not.toContain('data-testid="btn-enviar-transporte"')
  );
});

describe("GourmetAccionesBar — estados sin ninguna acción Gourmet", () => {
  it.each(["ENVIADO_A_TRANSPORTE", "EN_CARGUE", "CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CANCELADO"] as EstadoPedidoGourmet[])(
    "no renderiza nada en %s (todas las acciones Gourmet fuera de alcance)",
    (estado) => expect(renderBar(estado)).toBe("")
  );
});

describe("GourmetAccionesBar — nunca incluye acciones de Transporte/cierre", () => {
  it("no renderiza botones de iniciar cargue, escanear, finalizar o cierre manual en ningún estado", () => {
    const estados: EstadoPedidoGourmet[] = ["BORRADOR", "UBICACION_ASIGNADA", "ENVIADO_A_TRANSPORTE", "EN_CARGUE", "CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CON_NOVEDAD", "CANCELADO"];
    for (const estado of estados) {
      const html = renderBar(estado);
      for (const prohibido of ["Iniciar cargue", "Escanear", "Finalizar", "Cierre manual"]) {
        expect(html).not.toContain(prohibido);
      }
    }
  });
});

describe("EditarPedidoModal / AsignarUbicacionModal — contrato mínimo (Modal con portal, ver nota de alcance)", () => {
  it("EditarPedidoModal no lanza error al renderizar abierto o cerrado", () => {
    expect(() =>
      renderToStaticMarkup(<EditarPedidoModal open={false} pedido={null} onClose={() => {}} onUpdated={() => {}} />)
    ).not.toThrow();
    expect(() =>
      renderToStaticMarkup(<EditarPedidoModal open={true} pedido={null} onClose={() => {}} onUpdated={() => {}} />)
    ).not.toThrow();
  });

  it("AsignarUbicacionModal no lanza error al renderizar abierto o cerrado", () => {
    expect(() =>
      renderToStaticMarkup(<AsignarUbicacionModal open={false} pedido={null} onClose={() => {}} onSaved={() => {}} />)
    ).not.toThrow();
    expect(() =>
      renderToStaticMarkup(<AsignarUbicacionModal open={true} pedido={null} onClose={() => {}} onSaved={() => {}} />)
    ).not.toThrow();
  });

  it.todo("EditarPedidoModal precarga orden/tipo/tienda/cajas/estibas del pedido (requiere jsdom)");
  it.todo("AsignarUbicacionModal permite agregar/quitar filas de estibas y cajas (requiere jsdom)");
  it.todo("AsignarUbicacionModal rechaza secuencias de estiba duplicadas antes de enviar (requiere jsdom)");
});
