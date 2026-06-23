import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductividadTable, calcularTotalProductividad } from "@/app/(dashboard)/dashboard/exportaciones/_components";
import type { UserStat } from "@/app/(dashboard)/dashboard/exportaciones/_components";

const statsMock: UserStat[] = [
  {
    id: "user-1",
    nombre: "Maria Fernanda Restrepo Gutierrez del Departamento de Etiquetado",
    cajas: 10,
    plusDistintos: 4,
    totalUnidades: 60,
    finalizadas: 9,
    duracionTotalMin: 90,
    promedioPorCajaMin: 10,
  },
  {
    id: "user-2",
    nombre: "Carlos Ramirez",
    cajas: 5,
    plusDistintos: 2,
    totalUnidades: 30,
    finalizadas: 5,
    duracionTotalMin: 20,
    promedioPorCajaMin: 4,
  },
];

const html = renderToStaticMarkup(<ProductividadTable stats={statsMock} />);

function cellHtml(testId: string, row: string): string {
  const m = row.match(new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}
const text = (html: string, testId: string) => cellHtml(testId, html).replace(/<[^>]*>/g, "").trim();

describe("ProductividadTable (Exportaciones) — estructura, mapeo y fila Total (render)", () => {
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const rows = tbody.split("</tr>").filter((r) => r.includes("<td"));
  const firstRow = rows[0] ?? "";
  const totalRow = rows[rows.length - 1] ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("ESTRUCTURA: th === td === col (sin celda extra de rail)", () => {
    expect(thCount).toBe(tdCount);
    expect(colCount).toBe(thCount);
    expect((totalRow.match(/<td[ >]/g) ?? []).length).toBe(thCount);
  });

  it("ESTRUCTURA: la primera celda corresponde al primer header (Operario)", () => {
    const beforeFirstTd = firstRow.slice(0, firstRow.indexOf("<td"));
    expect(beforeFirstTd).not.toContain("<td");
    expect(firstRow.indexOf('data-testid="operario-cell"')).toBeLessThan(
      firstRow.indexOf('data-testid="cajas-cell"'),
    );
  });

  it("CONTENIDO: se renderizan los datos de un operario", () => {
    expect(text(firstRow, "operario-cell")).toContain("Maria Fernanda");
    expect(text(firstRow, "cajas-cell")).toBe("10");
    expect(text(firstRow, "plu-cell")).toBe("4");
    expect(text(firstRow, "unidades-cell")).toBe("60");
    expect(text(firstRow, "finalizadas-cell")).toBe("9");
  });

  it("CONTENIDO: se renderiza la fila Total", () => {
    expect(text(totalRow, "operario-cell")).toBe("Total");
  });

  it("CÁLCULO: la fila Total conserva el cálculo correcto (suma de cajas/unidades/finalizadas/tiempo, promedio recalculado)", () => {
    const expected = calcularTotalProductividad(statsMock);
    expect(expected.cajas).toBe(15); // 10 + 5
    expect(expected.totalUnidades).toBe(90); // 60 + 30
    expect(expected.finalizadas).toBe(14); // 9 + 5
    expect(expected.duracionTotalMin).toBe(110); // 90 + 20
    expect(expected.promedioPorCajaMin).toBe(7.9); // round(110/14 * 10) / 10

    expect(text(totalRow, "cajas-cell")).toBe("15");
    expect(text(totalRow, "unidades-cell")).toBe("90");
    expect(text(totalRow, "finalizadas-cell")).toBe("14");
    expect(text(totalRow, "tiempo-cell")).toBe("110 min");
    expect(text(totalRow, "promedio-cell")).toBe("7.9 min");
  });

  it("CONTENIDO: la fila Total muestra '—' en PLU (no es una suma, igual que el original)", () => {
    expect(text(totalRow, "plu-cell")).toBe("—");
  });

  it("ESTRUCTURA: no existe celda extra para rail", () => {
    expect(tdCount).toBe(thCount);
  });

  it("RENDER: textos largos no rompen la estructura de la tabla", () => {
    expect(text(firstRow, "operario-cell")).toContain("Departamento de Etiquetado");
    expect(thCount).toBe(tdCount);
  });

  it("GUARD: no usa tr::before ni tr::after en el markup generado", () => {
    expect(html).not.toMatch(/tr::before/i);
    expect(html).not.toMatch(/tr::after/i);
  });
});
