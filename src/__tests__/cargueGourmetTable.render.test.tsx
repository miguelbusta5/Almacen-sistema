import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CargueGourmetTable } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components";
import type { GourmetPedidoRow } from "@/app/(dashboard)/dashboard/cargue-gourmet/_components";

const mockRows: GourmetPedidoRow[] = [
  {
    id: "p1",
    orden: "TSDM98761",
    tipoOrden: "TSDM",
    codigoTienda: "T001",
    nombreTienda: "Tienda Centro Bogotá con nombre bastante largo",
    ciudadDestino: "Bogotá",
    cajasEsperadas: 5,
    estibasEsperadas: 2,
    estado: "EN_CARGUE",
    updatedAt: "2026-06-24T10:30:00.000Z",
  },
  {
    id: "p2",
    orden: "OVDM00002",
    tipoOrden: "OVDM",
    codigoTienda: "T002",
    nombreTienda: "Tienda Norte",
    ciudadDestino: "Medellín",
    cajasEsperadas: 3,
    estibasEsperadas: 1,
    estado: "CARGUE_COMPLETO_MANUAL",
    updatedAt: "2026-06-24T11:00:00.000Z",
  },
];

function renderTable(overrides: Partial<{ rows: GourmetPedidoRow[]; debug: boolean }> = {}) {
  return renderToStaticMarkup(
    <CargueGourmetTable rows={overrides.rows ?? mockRows} loading={false} debug={overrides.debug} />
  );
}

function cellHtml(testId: string, row: string): string {
  const m = row.match(new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}
const text = (html: string, testId: string) => cellHtml(testId, html).replace(/<[^>]*>/g, "").trim();

describe("CargueGourmetTable — estructura (Fase G3C1)", () => {
  const html = renderTable();
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>").find((r) => r.includes("<td")) ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("th.length === td.length === col.length === 9", () => {
    expect(thCount).toBe(9);
    expect(tdCount).toBe(9);
    expect(colCount).toBe(9);
  });

  it("las celdas van en el mismo orden que los headers", () => {
    const ids = ["orden-cell", "tipo-cell", "tienda-cell", "ciudad-cell", "cajas-cell", "estibas-cell", "estado-cell", "actualizado-cell", "acciones-cell"];
    const positions = ids.map((id) => firstRow.indexOf(`data-testid="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("la acción 'Ver' aparece en acciones-cell y no es ninguna acción operativa prohibida", () => {
    const cell = cellHtml("acciones-cell", firstRow);
    expect(cell).toContain("Ver");
    for (const prohibido of ["Editar", "Asignar ubicación", "Enviar a Transporte", "Iniciar cargue", "Escanear", "Finalizar", "Cierre manual"]) {
      expect(cell).not.toContain(prohibido);
    }
  });

  it("Orden aparece en orden-cell", () => {
    expect(text(firstRow, "orden-cell")).toBe("TSDM98761");
  });

  it("Tipo aparece en tipo-cell", () => {
    expect(text(firstRow, "tipo-cell")).toBe("TSDM");
  });

  it("Ciudad aparece en ciudad-cell", () => {
    expect(text(firstRow, "ciudad-cell")).toBe("Bogotá");
  });

  it("Cajas y Estibas aparecen en sus columnas correctas", () => {
    expect(text(firstRow, "cajas-cell")).toBe("5");
    expect(text(firstRow, "estibas-cell")).toBe("2");
  });

  it("Estado EN_CARGUE se muestra como Badge con label amigable", () => {
    const cell = cellHtml("estado-cell", firstRow);
    expect(cell).toContain("ds-badge");
    expect(text(firstRow, "estado-cell")).toBe("En cargue");
  });

  it("Estado CARGUE_COMPLETO_MANUAL incluye indicador visual de advertencia", () => {
    const tbody2 = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    const rows = tbody2.split("</tr>").filter((r) => r.includes("<td"));
    const secondRow = rows[1] ?? "";
    expect(text(secondRow, "estado-cell")).toContain("Cerrado manualmente");
    expect(cellHtml("estado-cell", secondRow)).toContain("⚠");
  });

  it("textos largos de tienda usan truncado", () => {
    const cell = cellHtml("tienda-cell", firstRow);
    expect(cell).toContain("text-overflow");
  });

  it("no hay tr::before ni tr::after en el módulo", async () => {
    const fs = await import("fs");
    const compSrc = fs.readFileSync(
      "src/app/(dashboard)/dashboard/cargue-gourmet/_components.tsx",
      "utf-8",
    );
    const pageSrc = fs.readFileSync(
      "src/app/(dashboard)/dashboard/cargue-gourmet/page.tsx",
      "utf-8",
    );
    expect(compSrc).not.toMatch(/tr::before|tr::after/);
    expect(pageSrc).not.toMatch(/tr::before|tr::after/);
  });
});

describe("CargueGourmetTable — estado vacío", () => {
  it("muestra EmptyState cuando no hay pedidos", () => {
    const html = renderTable({ rows: [] });
    expect(html).toContain("Sin pedidos");
  });
});

describe("CargueGourmetTable — modo debug", () => {
  it("antepone etiquetas de columna cuando debug=true", () => {
    const html = renderTable({ debug: true });
    expect(html).toContain("ORDEN");
    expect(html).toContain("TIPO");
    expect(html).toContain("TIENDA");
    expect(html).toContain("CIUDAD");
    expect(html).toContain("CAJAS");
    expect(html).toContain("ESTIBAS");
    expect(html).toContain("ESTADO");
    expect(html).toContain("ACTUALIZADO");
    expect(html).toContain("ACCIONES");
  });
});
