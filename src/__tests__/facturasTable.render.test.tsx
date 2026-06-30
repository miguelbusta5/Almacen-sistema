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
  fechaEntregaComprometida: "2026-06-30",
  ciudad: "Medellin",
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
  // ── ESTRUCTURA (alineación), no solo contenido ──────────────────────────
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>")[0] ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("ESTRUCTURA: th === td === col === 7 (no hay celda extra del rail)", () => {
    expect(thCount).toBe(7);
    expect(tdCount).toBe(7);
    expect(colCount).toBe(7);
    expect(thCount).toBe(tdCount);
    expect(colCount).toBe(thCount);
  });

  it("ESTRUCTURA: las celdas van en el mismo orden que los headers (fecha→estado)", () => {
    const ids = ["fecha-cell", "entrega-cell", "ciudad-cell", "centro-cell", "doc-cell", "cliente-cell", "estado-cell"];
    const positions = ids.map((id) => firstRow.indexOf(`data-testid="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    // estado-cell es la ÚLTIMA celda (debajo del header ESTADO).
    expect(positions[6]).toBe(Math.max(...positions));
  });

  it("ESTRUCTURA: la primera celda del body es fecha-cell (no una celda de rail)", () => {
    expect(firstRow.indexOf('data-testid="fecha-cell"')).toBeLessThan(
      firstRow.indexOf('data-testid="centro-cell"'),
    );
    // El rail NO es una celda: antes de la primera <td> no hay otra <td>.
    const beforeFirstTd = firstRow.slice(0, firstRow.indexOf("<td"));
    expect(beforeFirstTd).not.toContain("<td");
  });

  it("mapeo completo de celdas (regresión: cada columna muestra su campo)", () => {
    expect(text("centro-cell")).toBe("138-LIVING TESORO");
    expect(text("doc-cell")).toBe("36008#0");
    expect(text("cliente-cell")).toBe("ALIMENTOS SALUDABLES FIT JUICE SAS9011218257 · 3137918413");
    expect(text("estado-cell")).toBe("Pendiente recogida");
    expect(text("fecha-cell")).toContain("19/06/2026");
    expect(text("entrega-cell")).toContain("30/06/2026");
    expect(text("ciudad-cell")).toContain("Medellin");
  });

  it("las 7 celdas existen y están en orden", () => {
    const order = ["fecha-cell", "entrega-cell", "ciudad-cell", "centro-cell", "doc-cell", "cliente-cell", "estado-cell"];
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
    expect(text("estado-cell")).toContain("Pendiente recogida");
  });

  it("ESTADO NO contiene el nombre del cliente", () => {
    expect(text("estado-cell")).not.toContain("ALIMENTOS");
  });
});
