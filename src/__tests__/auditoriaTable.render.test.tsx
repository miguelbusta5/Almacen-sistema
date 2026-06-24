import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuditoriaTable } from "@/app/(dashboard)/dashboard/auditoria/_components";
import type { LogItem } from "@/app/(dashboard)/dashboard/auditoria/_components";

const mockLogs: LogItem[] = [
  {
    id: "log-1",
    action: "CREATE",
    module: "muebles",
    recordId: "REC-001",
    details: "Creó el registro de inventario número uno con una descripción bastante larga para forzar truncado",
    createdAt: "2026-06-24T10:30:00.000Z",
    user: { id: "u1", name: "Maria Fernanda Restrepo", email: "maria@grupoambiente.com" },
  },
  {
    id: "log-2",
    action: "DELETE",
    module: "users",
    recordId: "REC-002",
    details: null,
    createdAt: "2026-06-23T08:00:00.000Z",
    user: null,
  },
];

function renderTable(overrides: Partial<{ logs: LogItem[]; debug: boolean }> = {}) {
  return renderToStaticMarkup(
    <AuditoriaTable
      logs={overrides.logs ?? mockLogs}
      sortCol="createdAt"
      sortDir="desc"
      onToggleSort={() => {}}
      loading={false}
      debug={overrides.debug}
    />,
  );
}

function cellHtml(testId: string, row: string): string {
  const m = row.match(new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}
const text = (html: string, testId: string) => cellHtml(testId, html).replace(/<[^>]*>/g, "").trim();

describe("AuditoriaTable — estructura (Fase A1)", () => {
  const html = renderTable();
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>").find((r) => r.includes("<td")) ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("th.length === td.length === col.length === 6", () => {
    expect(thCount).toBe(6);
    expect(tdCount).toBe(6);
    expect(colCount).toBe(6);
  });

  it("las celdas van en el mismo orden que los headers", () => {
    const ids = ["fecha-cell", "usuario-cell", "accion-cell", "modulo-cell", "registro-cell", "detalle-cell"];
    const positions = ids.map((id) => firstRow.indexOf(`data-testid="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("no existe celda extra para rail (exactamente 6 td)", () => {
    expect(tdCount).toBe(6);
  });

  it("Fecha aparece en fecha-cell", () => {
    expect(text(firstRow, "fecha-cell").length).toBeGreaterThan(0);
  });

  it("Usuario aparece en usuario-cell", () => {
    expect(text(firstRow, "usuario-cell")).toContain("Maria Fernanda Restrepo");
  });

  it("Acción aparece en accion-cell como Badge", () => {
    const cell = cellHtml("accion-cell", firstRow);
    expect(cell).toContain("ds-badge");
    expect(text(firstRow, "accion-cell")).toBe("Creó");
  });

  it("Módulo aparece en modulo-cell como Badge", () => {
    const cell = cellHtml("modulo-cell", firstRow);
    expect(cell).toContain("ds-badge");
    expect(text(firstRow, "modulo-cell")).toBe("Muebles");
  });

  it("Registro aparece en registro-cell", () => {
    expect(text(firstRow, "registro-cell")).toBe("REC-001");
  });

  it("Detalle aparece en detalle-cell", () => {
    expect(text(firstRow, "detalle-cell")).toContain("Creó el registro");
  });

  it("Acción no aparece en la columna de Módulo", () => {
    expect(text(firstRow, "modulo-cell")).not.toBe("Creó");
  });

  it("Módulo no aparece en la columna de Acción", () => {
    expect(text(firstRow, "accion-cell")).not.toBe("Muebles");
  });

  it("textos largos usan title para truncado (detalle-cell)", () => {
    const cell = cellHtml("detalle-cell", firstRow);
    expect(cell).toContain("title=");
  });

  it("no hay tr::before ni tr::after en el módulo de Auditoría", async () => {
    const fs = await import("fs");
    const compSrc = fs.readFileSync(
      "src/app/(dashboard)/dashboard/auditoria/_components.tsx",
      "utf-8",
    );
    const pageSrc = fs.readFileSync(
      "src/app/(dashboard)/dashboard/auditoria/page.tsx",
      "utf-8",
    );
    expect(compSrc).not.toMatch(/tr::before|tr::after/);
    expect(pageSrc).not.toMatch(/tr::before|tr::after/);
  });
});

describe("AuditoriaTable — sin usuario asociado", () => {
  it("muestra guion cuando el log no tiene usuario", () => {
    const html = renderTable();
    const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    const rows = tbody.split("</tr>").filter((r) => r.includes("<td"));
    const secondRow = rows[1] ?? "";
    expect(text(secondRow, "usuario-cell")).toBe("—");
    expect(text(secondRow, "detalle-cell")).toBe("—");
  });
});

describe("AuditoriaTable — modo debug", () => {
  it("antepone etiquetas de columna cuando debug=true", () => {
    const html = renderTable({ debug: true });
    expect(html).toContain("FECHA");
    expect(html).toContain("USUARIO");
    expect(html).toContain("ACCIÓN");
    expect(html).toContain("MÓDULO");
    expect(html).toContain("REGISTRO");
    expect(html).toContain("DETALLE");
  });
});
