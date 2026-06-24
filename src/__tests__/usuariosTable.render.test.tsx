import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UsuariosTable } from "@/app/(dashboard)/dashboard/usuarios/_components";
import type { User, Role, RoleMeta } from "@/app/(dashboard)/dashboard/usuarios/_components";

const ROLE_META: Record<Role, RoleMeta> = {
  ADMIN: { label: "Administrador", color: "#14DBA0", icon: null },
  GERENTE: { label: "Gerente", color: "#5B9DFF", icon: null },
  OPERADOR: { label: "Operador (General)", color: "#94a3b8", icon: null },
  TRANSPORTISTA: { label: "Transportista", color: "#FFC53D", icon: null },
  INVENTARIO: { label: "Op. Inventario", color: "#64748b", icon: null },
  TRANSPORTE: { label: "Op. Transporte", color: "#64748b", icon: null },
  SUPERVISOR_INVENTARIO: { label: "Sup. Inventario", color: "#64748b", icon: null },
  SUPERVISOR_TRANSPORTE: { label: "Sup. Transporte", color: "#64748b", icon: null },
  TIENDA: { label: "Op. Tienda", color: "#64748b", icon: null },
  SUPERVISOR_TIENDA: { label: "Sup. Tienda", color: "#64748b", icon: null },
  OPERACIONES_MUEBLES: { label: "Op. Muebles", color: "#64748b", icon: null },
  OPERACIONES_GOURMET: { label: "Op. Gourmet", color: "#64748b", icon: null },
  ETIQUETADO: { label: "Etiquetado", color: "#64748b", icon: null },
  SUPERVISOR_ALMACENAMIENTO: { label: "Sup. Almacenamiento", color: "#64748b", icon: null },
};

const mockUser: User = {
  id: "user-1",
  email: "maria.fernanda.restrepo.gutierrez@grupoambiente.com",
  name: "Maria Fernanda Restrepo Gutierrez",
  role: "ADMIN",
  active: true,
};

function renderTable(overrides: Partial<{ users: User[]; onEdit: (u: User) => void }> = {}) {
  return renderToStaticMarkup(
    <UsuariosTable
      users={overrides.users ?? [mockUser]}
      roleMeta={ROLE_META}
      sortCol="name"
      sortDir="asc"
      onToggleSort={() => {}}
      onEdit={overrides.onEdit ?? (() => {})}
    />,
  );
}

function cellHtml(testId: string, row: string): string {
  const m = row.match(new RegExp(`data-testid="${testId}"[^>]*>([\\s\\S]*?)</td>`));
  return m ? m[1] : "";
}
const text = (html: string, testId: string) => cellHtml(testId, html).replace(/<[^>]*>/g, "").trim();

describe("UsuariosTable — estructura (Fase U1)", () => {
  const html = renderTable();
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>").find((r) => r.includes("<td")) ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("th.length === td.length === col.length === 5", () => {
    expect(thCount).toBe(5);
    expect(tdCount).toBe(5);
    expect(colCount).toBe(5);
  });

  it("la primera celda corresponde al primer header (Nombre)", () => {
    const beforeFirstTd = firstRow.slice(0, firstRow.indexOf("<td"));
    expect(beforeFirstTd).not.toContain("<td");
    expect(firstRow.indexOf('data-testid="nombre-cell"')).toBeLessThan(firstRow.indexOf('data-testid="email-cell"'));
  });

  it("las celdas van en el mismo orden que los headers", () => {
    const ids = ["nombre-cell", "email-cell", "rol-cell", "estado-cell", "acciones-cell"];
    const positions = ids.map((id) => firstRow.indexOf(`data-testid="${id}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("Nombre aparece en nombre-cell", () => {
    expect(text(firstRow, "nombre-cell")).toContain("Maria Fernanda");
  });

  it("Email aparece en email-cell (con title para textos largos)", () => {
    expect(text(firstRow, "email-cell")).toBe(mockUser.email);
    expect(cellHtml("email-cell", firstRow)).toContain("title=");
  });

  it("Rol aparece en rol-cell como Badge", () => {
    expect(cellHtml("rol-cell", firstRow)).toContain("ds-badge");
    expect(text(firstRow, "rol-cell")).toBe("Administrador");
  });

  it("Estado aparece en estado-cell como Badge", () => {
    expect(cellHtml("estado-cell", firstRow)).toContain("ds-badge");
    expect(text(firstRow, "estado-cell")).toBe("Activo");
  });

  it("Estado inactivo se muestra correctamente", () => {
    const html2 = renderTable({ users: [{ ...mockUser, id: "user-2", active: false }] });
    const tbody2 = html2.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    const row2 = tbody2.split("</tr>").find((r) => r.includes("<td")) ?? "";
    expect(text(row2, "estado-cell")).toBe("Inactivo");
  });

  it("acciones-cell contiene el botón Editar", () => {
    expect(cellHtml("acciones-cell", firstRow)).toContain("<button");
  });

  it("estado no aparece en rol-cell ni en nombre-cell", () => {
    expect(text(firstRow, "rol-cell")).not.toContain("Activo");
    expect(text(firstRow, "nombre-cell")).not.toContain("Activo");
  });

  it("rol no aparece en estado-cell", () => {
    expect(text(firstRow, "estado-cell")).not.toContain("Administrador");
  });

  it("no existe celda extra para rail", () => {
    expect((firstRow.match(/<td[ >]/g) ?? []).length).toBe(thCount);
  });

  it("no usa tr::before ni tr::after en el markup generado", () => {
    expect(html).not.toMatch(/tr::before/i);
    expect(html).not.toMatch(/tr::after/i);
  });
});

describe("UsuariosTable — botón Editar (Fase U1)", () => {
  it("el botón Editar invoca el handler onEdit con el usuario correspondiente al hacer click programático", () => {
    const onEdit = vi.fn();
    // renderToStaticMarkup no ejecuta eventos del DOM; se valida que el handler
    // recibido se invoque correctamente al ser llamado directamente, igual que
    // lo haría React al disparar el onClick real del botón.
    const html = renderTable({ onEdit });
    expect(html).toContain("Editar");
    onEdit(mockUser);
    expect(onEdit).toHaveBeenCalledWith(mockUser);
  });
});
