import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HistorialPreoperacionalTable } from "@/app/(dashboard)/dashboard/preoperacional/_components";
import type { HistorialRow } from "@/app/(dashboard)/dashboard/preoperacional/_components";

const mockRow: HistorialRow = {
  id: "insp-1",
  fecha: "2026-06-24",
  kilometraje: 125430,
  estado: "BLOQUEADA",
  conductor: { id: "cond-1", nombre: "Maria Fernanda Restrepo Gutierrez del Departamento", telefono: null },
  vehiculo: { id: "veh-1", placa: "ABC-123", tipo: "CAMION" },
  itemsCount: 12,
  noConformes: 2,
  criticos: 1,
};

function renderTable(role: string, deletingId: string | null = null) {
  return renderToStaticMarkup(
    <HistorialPreoperacionalTable
      rows={[mockRow]}
      role={role}
      loading={false}
      deletingId={deletingId}
      onRowClick={() => {}}
      onDeleteStart={() => {}}
      onDeleteConfirm={() => {}}
      onDeleteCancel={() => {}}
    />,
  );
}

function cellHtml(testId: string, row: string): string {
  const m = row.match(new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}
const text = (html: string, testId: string) => cellHtml(testId, html).replace(/<[^>]*>/g, "").trim();

describe("HistorialPreoperacionalTable — rol ADMIN (7 columnas)", () => {
  const html = renderTable("ADMIN");
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>").find((r) => r.includes("<td")) ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("th.length === td.length === col.length === 7", () => {
    expect(thCount).toBe(7);
    expect(tdCount).toBe(7);
    expect(colCount).toBe(7);
  });

  it("existe data-testid='acciones-cell'", () => {
    expect(firstRow).toContain('data-testid="acciones-cell"');
  });

  it("eliminar aparece con confirmación inline de 2 pasos cuando deletingId coincide", () => {
    const htmlConfirm = renderTable("ADMIN", "insp-1");
    const tbodyConfirm = htmlConfirm.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    expect(tbodyConfirm).toContain("Sí, eliminar");
    expect(tbodyConfirm).toContain("Cancelar");
  });

  it("sin deletingId solo se ve el botón de iniciar borrado (ícono), no la confirmación", () => {
    expect(cellHtml("acciones-cell", firstRow)).toContain("<button");
    expect(firstRow).not.toContain("Sí, eliminar");
  });
});

describe("HistorialPreoperacionalTable — rol no ADMIN (6 columnas)", () => {
  const html = renderTable("SUPERVISOR_TRANSPORTE");
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>").find((r) => r.includes("<td")) ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;

  it("th.length === td.length === 6", () => {
    expect(thCount).toBe(6);
    expect(tdCount).toBe(6);
  });

  it("no existe data-testid='acciones-cell'", () => {
    expect(firstRow).not.toContain('data-testid="acciones-cell"');
  });

  it("no existe ningún botón de eliminar", () => {
    expect(firstRow).not.toContain("Eliminar inspección");
    expect(firstRow).not.toContain("Sí, eliminar");
  });
});

describe("HistorialPreoperacionalTable — mapeo de columnas (general)", () => {
  const html = renderTable("GERENTE");
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>").find((r) => r.includes("<td")) ?? "";

  it("Fecha aparece en fecha-cell", () => {
    expect(text(firstRow, "fecha-cell")).toBe("2026-06-24");
  });

  it("Conductor aparece en conductor-cell", () => {
    expect(text(firstRow, "conductor-cell")).toContain("Maria Fernanda");
  });

  it("Vehículo aparece en vehiculo-cell", () => {
    expect(text(firstRow, "vehiculo-cell")).toContain("ABC-123");
  });

  it("Km aparece en km-cell", () => {
    expect(text(firstRow, "km-cell")).toBe((125430).toLocaleString());
  });

  it("Estado aparece en estado-cell como Badge", () => {
    expect(cellHtml("estado-cell", firstRow)).toContain("ds-badge");
    expect(text(firstRow, "estado-cell")).toBe("Bloqueada");
  });

  it("Ítems aparece en items-cell", () => {
    expect(text(firstRow, "items-cell")).toContain("12 ítems");
  });

  it("el estado no aparece en conductor-cell ni en vehiculo-cell", () => {
    expect(text(firstRow, "conductor-cell")).not.toContain("Bloqueada");
    expect(text(firstRow, "vehiculo-cell")).not.toContain("Bloqueada");
  });

  it("no existe celda extra para rail", () => {
    const thead = html.split("</thead>")[0] ?? "";
    const thCount = (thead.match(/<th[ >]/g) ?? []).length;
    expect((firstRow.match(/<td[ >]/g) ?? []).length).toBe(thCount);
  });

  it("no usa tr::before ni tr::after en el markup generado", () => {
    expect(html).not.toMatch(/tr::before/i);
    expect(html).not.toMatch(/tr::after/i);
  });

  it("textos largos no rompen la estructura (conductor truncado con title)", () => {
    expect(cellHtml("conductor-cell", firstRow)).toContain("title=");
  });
});
