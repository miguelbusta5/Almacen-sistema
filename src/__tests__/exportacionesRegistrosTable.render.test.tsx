import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RegistrosTable } from "@/app/(dashboard)/dashboard/exportaciones/_components";
import type { Exportacion } from "@/app/(dashboard)/dashboard/exportaciones/_components";

// Fila mock con datos reales similares a producción (incluye textos largos).
const mockRowEnCurso: Exportacion = {
  id: "exp-1",
  numeroCaja: "CJ-00123",
  plu: "PLU-7788",
  descripcion: "Silla ejecutiva reclinable con apoyabrazos ajustables linea premium",
  unidadEmpaque: 6,
  fecha: "2026-06-23",
  horaInicio: "2026-06-23T08:00:00.000Z",
  horaFinalizacion: null,
  duracionMinutos: null,
  creadoPorId: "user-1",
  creadoPorNombre: "Maria Fernanda Restrepo Gutierrez",
};

const mockRowFinalizado: Exportacion = {
  ...mockRowEnCurso,
  id: "exp-2",
  horaFinalizacion: "2026-06-23T08:12:00.000Z",
  duracionMinutos: 12,
};

const html = renderToStaticMarkup(
  <RegistrosTable
    loading={false}
    items={[mockRowEnCurso, mockRowFinalizado]}
    canManage={true}
    userId="user-1"
    onEdit={() => {}}
    onDelete={() => {}}
  />,
);

function cellHtml(testId: string, row: string): string {
  const m = row.match(new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}
const text = (html: string, testId: string) => cellHtml(testId, html).replace(/<[^>]*>/g, "").trim();

describe("RegistrosTable (Exportaciones) — estructura y mapeo (render)", () => {
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const rows = tbody.split("</tr>").filter((r) => r.includes("<td"));
  const firstRow = rows[0] ?? "";
  const secondRow = rows[1] ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("ESTRUCTURA: th === td === col (sin celda extra de rail)", () => {
    expect(thCount).toBe(tdCount);
    expect(colCount).toBe(thCount);
  });

  it("ESTRUCTURA: la primera celda corresponde al primer header (Fecha)", () => {
    const beforeFirstTd = firstRow.slice(0, firstRow.indexOf("<td"));
    expect(beforeFirstTd).not.toContain("<td");
    expect(firstRow.indexOf('data-testid="fecha-cell"')).toBeLessThan(
      firstRow.indexOf('data-testid="usuario-cell"'),
    );
  });

  it("ESTRUCTURA: las celdas van en el mismo orden que los headers", () => {
    const ids = [
      "fecha-cell", "usuario-cell", "caja-cell", "plu-cell", "descripcion-cell",
      "empaque-cell", "inicio-cell", "fin-cell", "duracion-cell", "acciones-cell",
    ];
    const positions = ids.map((id) => firstRow.indexOf(`data-testid="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("CONTENIDO: plu-cell muestra el PLU", () => {
    expect(text(firstRow, "plu-cell")).toBe("PLU-7788");
  });

  it("CONTENIDO: descripcion-cell muestra la descripción (no el PLU ni la caja)", () => {
    expect(text(firstRow, "descripcion-cell")).toContain("Silla ejecutiva reclinable");
    expect(text(firstRow, "descripcion-cell")).not.toContain("PLU-7788");
    expect(text(firstRow, "descripcion-cell")).not.toContain("CJ-00123");
  });

  it("CONTENIDO: estado 'En curso' se muestra como Badge en fin-cell", () => {
    expect(cellHtml("fin-cell", firstRow)).toContain("ds-badge");
    expect(text(firstRow, "fin-cell")).toBe("En curso");
  });

  it("CONTENIDO: estado 'Finalizado' se muestra como Badge en fin-cell", () => {
    expect(cellHtml("fin-cell", secondRow)).toContain("ds-badge");
    expect(text(secondRow, "fin-cell")).toContain("Finalizado");
  });

  it("CONTENIDO: las acciones aparecen en acciones-cell", () => {
    expect(cellHtml("acciones-cell", firstRow)).toContain("<button");
  });

  it("ESTRUCTURA: no existe rail como celda extra; el rail va en --row-color del <tr>", () => {
    expect(tdCount).toBe(thCount);
  });

  it("RENDER: textos largos no rompen la estructura de la tabla", () => {
    expect(text(firstRow, "usuario-cell")).toContain("Maria Fernanda");
    expect(thCount).toBe(tdCount);
  });

  it("GUARD: no usa tr::before ni tr::after en el markup generado", () => {
    expect(html).not.toMatch(/tr::before/i);
    expect(html).not.toMatch(/tr::after/i);
  });
});
