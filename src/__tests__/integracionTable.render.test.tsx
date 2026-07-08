import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { IntegracionTable } from "@/app/(dashboard)/dashboard/integracion/_components";
import type { Integracion } from "@/app/(dashboard)/dashboard/integracion/_components";

// Fila mock con datos reales similares a producción (incluye textos largos).
const mockRow: Integracion = {
  id: "int-1",
  numeroDocumento: "OVDM-99887766",
  tipoDocumento: "OVDM",
  fecha: "2026-06-24",
  estado: "PENDIENTE_AREA2",
  areaIniciadora: "MUEBLES",
  numeroCajasArea1: 8,
  numeroCajasArea2: null,
  creadoPorNombre: "Maria Fernanda Restrepo Gutierrez del Departamento Comercial",
  completadoPorNombre: null,
  creadoAt: "2026-06-24T08:00:00.000Z",
  completadoAt: null,
  entregadoATransporteAt: null,
  marcadoCompletadoAt: null,
  observaciones: null,
  createdAt: "2026-06-24T08:00:00.000Z",
  plines: [],
};

function renderTable(overrides: Partial<Integracion> = {}, extra: Partial<{ canCompleteArea2: boolean; canTransport: boolean; isAdmin: boolean }> = {}) {
  const item = { ...mockRow, ...overrides };
  return renderToStaticMarkup(
    <IntegracionTable
      items={[item]}
      loading={false}
      color="#14DBA0"
      canCompleteArea2={() => extra.canCompleteArea2 ?? false}
      canTransport={extra.canTransport ?? false}
      canEdit={() => false}
      isAdmin={extra.isAdmin ?? false}
      deletingIntId={null}
      onRowClick={() => {}}
      onCompletar={() => {}}
      onRecibido={() => {}}
      onEditar={() => {}}
      onDeleteStart={() => {}}
      onDeleteConfirm={() => {}}
      onDeleteCancel={() => {}}
      hasSearch={false}
      onClearSearch={() => {}}
    />,
  );
}

const html = renderTable({}, { canCompleteArea2: true, isAdmin: true });

function cellHtml(testId: string, row: string): string {
  const m = row.match(new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}
const text = (html: string, testId: string) => cellHtml(testId, html).replace(/<[^>]*>/g, "").trim();

describe("IntegracionTable — estructura y mapeo (render)", () => {
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>").find((r) => r.includes("<td")) ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("ESTRUCTURA: th === td === col === 7 (sin celda extra de rail)", () => {
    expect(thCount).toBe(7);
    expect(tdCount).toBe(7);
    expect(colCount).toBe(7);
    expect(thCount).toBe(tdCount);
    expect(colCount).toBe(thCount);
  });

  it("ESTRUCTURA: la primera celda corresponde al primer header (Documento)", () => {
    const beforeFirstTd = firstRow.slice(0, firstRow.indexOf("<td"));
    expect(beforeFirstTd).not.toContain("<td");
    expect(firstRow.indexOf('data-testid="documento-cell"')).toBeLessThan(
      firstRow.indexOf('data-testid="tipo-cell"'),
    );
  });

  it("ESTRUCTURA: las celdas van en el mismo orden que los headers", () => {
    const ids = ["documento-cell", "tipo-cell", "fecha-cell", "area-cell", "estado-cell", "cajas-cell", "acciones-cell"];
    const positions = ids.map((id) => firstRow.indexOf(`data-testid="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("CONTENIDO: documento-cell muestra el número de documento", () => {
    expect(text(firstRow, "documento-cell")).toBe("OVDM-99887766");
  });

  it("CONTENIDO: estado-cell muestra el badge de estado (no documento ni área)", () => {
    expect(cellHtml("estado-cell", firstRow)).toContain("ds-badge");
    expect(text(firstRow, "estado-cell")).toBe("Pendiente Área 2");
    expect(text(firstRow, "estado-cell")).not.toContain("OVDM-99887766");
    expect(text(firstRow, "estado-cell")).not.toContain("MUEBLES");
  });

  it("CONTENIDO: estado no aparece en area-cell ni documento-cell", () => {
    expect(text(firstRow, "area-cell")).toBe("MUEBLES");
    expect(text(firstRow, "area-cell")).not.toContain("Pendiente");
    expect(text(firstRow, "documento-cell")).not.toContain("Pendiente");
  });

  it("CONTENIDO: las acciones aparecen en acciones-cell (Completar visible, condicionado)", () => {
    expect(cellHtml("acciones-cell", firstRow)).toContain("<button");
    expect(text(firstRow, "acciones-cell")).toContain("Completar");
  });

  it("ESTRUCTURA: no existe rail como celda extra", () => {
    expect(firstRow.match(/<td[ >]/g)?.length).toBe(7);
  });

  it("RENDER: textos largos no rompen la estructura de la tabla", () => {
    const longHtml = renderTable({ numeroDocumento: "TSDM-00011223344556677" });
    const longTbody = longHtml.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    const longFirstRow = longTbody.split("</tr>").find((r) => r.includes("<td")) ?? "";
    expect((longFirstRow.match(/<td[ >]/g) ?? []).length).toBe(7);
    expect(text(longFirstRow, "documento-cell")).toContain("TSDM-0001122");
  });

  it("GUARD: no usa tr::before ni tr::after en el markup generado", () => {
    expect(html).not.toMatch(/tr::before/i);
    expect(html).not.toMatch(/tr::after/i);
  });
});
