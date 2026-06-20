import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacturasTable } from "@/app/(dashboard)/dashboard/tienda/_components";
import type { DespachoTienda } from "@/lib/tienda";

// Fila mock con datos reales similares a producción (caso reportado por el usuario).
const mockRow = {
  id: "row-1",
  fechaCreacion: "2026-06-19",
  centroCostos: "138-LIVING TESORO",
  numeroDocumento: "36008",
  consecutivo: "0",
  clienteNombre: "ALIMENTOS SALUDABLES FIT JUICE SAS",
  clienteDocumento: "9011218257",
  clienteTelefono: "3137918413",
  estado: "CREADO_TIENDA",
  createdAt: "2026-06-19T10:00:00.000Z",
  updatedAt: "2026-06-19T10:00:00.000Z",
} as unknown as DespachoTienda;

const html = renderToStaticMarkup(
  <FacturasTable
    loading={false}
    items={[mockRow]}
    allCount={1}
    selectedId={null}
    onOpen={() => {}}
    onClearFilters={() => {}}
  />,
);

// Extrae el HTML interno de la celda con el data-testid dado (no hay <td> anidados).
function cellHtml(testId: string): string {
  const m = html.match(new RegExp(`data-testid="${testId}"[^>]*>(.*?)</td>`));
  return m ? m[1] : "";
}
const text = (testId: string) => cellHtml(testId).replace(/<[^>]*>/g, "").trim();

describe("FacturasTable — mapeo real de columnas (render)", () => {
  it("mapeo completo de celdas (regresión: cada columna muestra su campo)", () => {
    expect(text("centro-cell")).toBe("138-LIVING TESORO");
    expect(text("doc-cell")).toBe("36008#0");
    expect(text("cliente-cell")).toBe("ALIMENTOS SALUDABLES FIT JUICE SAS9011218257 · 3137918413");
    expect(text("estado-cell")).toBe("Creado en tienda");
    expect(text("fecha-cell")).toContain("19/06/2026");
  });

  it("las 5 celdas existen y están en orden", () => {
    const order = ["fecha-cell", "centro-cell", "doc-cell", "cliente-cell", "estado-cell"];
    const positions = order.map((t) => html.indexOf(`data-testid="${t}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });

  it("CLIENTE contiene el nombre del cliente", () => {
    expect(text("cliente-cell")).toContain("ALIMENTOS SALUDABLES FIT JUICE SAS");
  });

  it("CLIENTE no muestra solo el documento como valor principal", () => {
    expect(text("cliente-cell").startsWith("ALIMENTOS")).toBe(true);
  });

  it("DOC contiene el número de documento", () => {
    expect(text("doc-cell")).toContain("36008");
  });

  it("ESTADO contiene un badge de estado con la etiqueta del estado", () => {
    expect(cellHtml("estado-cell")).toContain("ds-badge");
    expect(text("estado-cell")).toContain("Creado en tienda");
  });

  it("ESTADO NO contiene el nombre del cliente", () => {
    expect(text("estado-cell")).not.toContain("ALIMENTOS");
  });
});
