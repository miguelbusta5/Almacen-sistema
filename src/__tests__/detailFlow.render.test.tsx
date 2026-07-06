import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailFlow } from "@/app/(dashboard)/dashboard/tienda/_components";
import type { DespachoTienda } from "@/lib/tienda";

// Fase 5 (mejora UX Facturas Contado): DetailFlow recibe el despacho completo
// y muestra la hora real de cada hito bajo el paso ("—" si aún no ocurre).

function mkDespacho(overrides: Partial<DespachoTienda>): DespachoTienda {
  return {
    id: "d-1",
    estado: "CREADO_TIENDA",
    createdAt: "2026-06-19T10:32:00.000Z",
    recibidoAt: null,
    entregadoCediAt: null,
    despachadoAt: null,
    ...overrides,
  } as unknown as DespachoTienda;
}

describe("DetailFlow — flujo con timestamps por hito", () => {
  it("renderiza los 3 pasos del flujo lineal (Pendiente → En CEDI → Enviado)", () => {
    const html = renderToStaticMarkup(<DetailFlow despacho={mkDespacho({})} />);
    // Cada paso muestra la primera palabra de su label.
    expect(html).toContain("Pendiente"); // Pendiente recogida
    expect(html).toContain("En");        // En CEDI
    expect(html).toContain("Enviado");   // Enviado al cliente
  });

  it("paso pendiente muestra em dash en vez de hora", () => {
    const html = renderToStaticMarkup(<DetailFlow despacho={mkDespacho({})} />);
    // En CEDI / Enviado aún sin timestamp → 2 em dash (Pendiente sí tiene createdAt).
    expect((html.match(/—/g) ?? []).length).toBe(2);
  });

  it("muestra la hora del hito cuando el timestamp existe", () => {
    const html = renderToStaticMarkup(
      <DetailFlow
        despacho={mkDespacho({
          estado: "RECOGIDO_TIENDA",
          recibidoAt: "2026-06-20T14:05:00.000Z",
        } as Partial<DespachoTienda>)}
      />,
    );
    // Formato es-CO corto: contiene día y "jun" del hito de recogida.
    expect(html).toContain("jun");
    expect((html.match(/—/g) ?? []).length).toBe(2);
  });

  it("no rompe con estados fuera del flujo lineal (RECHAZADO)", () => {
    const html = renderToStaticMarkup(
      <DetailFlow despacho={mkDespacho({ estado: "RECHAZADO" } as Partial<DespachoTienda>)} />,
    );
    expect(html).toContain("Pendiente");
  });
});
