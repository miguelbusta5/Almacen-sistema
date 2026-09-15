import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GuardadosTable } from "@/app/(dashboard)/dashboard/transporte/_components";
import type { Guardado } from "@/lib/transporte";

// Fila mock con datos reales similares a producción.
const mockRow = {
  id: 1,
  clientId: "client-1",
  fecha: "2026-05-01",
  documento: "GD-7788",
  ubicacion: "BODEGA NORTE - ESTANTE 14 PASILLO B",
  estado: "PENDIENTE DESPACHO",
  tipo: "ECOMMERCE",
  fechaDespacho: null,
  nota: "Entrega 30/06/2026",
  netsuiteId: null,
} as unknown as Guardado;

const html = renderToStaticMarkup(
  <GuardadosTable
    loading={false}
    items={[mockRow]}
    hasFilters={false}
    selectedId={null}
    onOpen={() => {}}
    onClearFilters={() => {}}
    onNew={() => {}}
  />,
);

function cellHtml(testId: string): string {
  const m = html.match(new RegExp(`data-testid="${testId}"[^>]*>(.*?)</td>`));
  return m ? m[1] : "";
}
const text = (testId: string) => cellHtml(testId).replace(/<[^>]*>/g, "").trim();

describe("GuardadosTable — estructura y mapeo (render)", () => {
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>")[0] ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("ESTRUCTURA: th === td === col === 6 (sin celda extra de rail)", () => {
    expect(thCount).toBe(6);
    expect(tdCount).toBe(6);
    expect(colCount).toBe(6);
    expect(thCount).toBe(tdCount);
    expect(colCount).toBe(thCount);
  });

  it("ESTRUCTURA: las celdas van en el mismo orden que los headers (fecha→almacenaje)", () => {
    const ids = ["fecha-cell", "doc-cell", "ubicacion-cell", "tipo-cell", "estado-cell", "almacenaje-cell"];
    const positions = ids.map((id) => firstRow.indexOf(`data-testid="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("ESTRUCTURA: la primera celda es fecha-cell (el rail no es una celda)", () => {
    const beforeFirstTd = firstRow.slice(0, firstRow.indexOf("<td"));
    expect(beforeFirstTd).not.toContain("<td");
    expect(firstRow.indexOf('data-testid="fecha-cell"')).toBeLessThan(
      firstRow.indexOf('data-testid="doc-cell"'),
    );
  });

  it("CONTENIDO: doc-cell = documento; ubicacion-cell = ubicación", () => {
    expect(text("doc-cell")).toContain("GD-7788");
    expect(text("ubicacion-cell")).toContain("BODEGA NORTE - ESTANTE 14 PASILLO B");
  });

  it("CONTENIDO: estado-cell = badge de estado (no documento ni ubicación)", () => {
    expect(cellHtml("estado-cell")).toContain("ds-badge");
    expect(text("estado-cell")).toBe("Pendiente");
    expect(text("estado-cell")).not.toContain("GD-7788");
    expect(text("estado-cell")).not.toContain("BODEGA");
  });
});
