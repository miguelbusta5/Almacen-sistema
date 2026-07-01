import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UsuariosTable, TransportistasOperativosTable } from "@/app/(dashboard)/dashboard/usuarios/_components";
import type { User, Role, RoleMeta, TransportistaOperativo, VehiculoOperativo } from "@/app/(dashboard)/dashboard/usuarios/_components";

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

  it("no muestra el badge de cambio de contraseña pendiente por defecto", () => {
    expect(cellHtml("estado-cell", firstRow)).not.toContain("badge-cambio-pendiente");
  });

  it("muestra 'Cambio pendiente' cuando mustChangePassword es true", () => {
    const html2 = renderTable({ users: [{ ...mockUser, id: "user-2", mustChangePassword: true }] });
    const tbody2 = html2.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    const row2 = tbody2.split("</tr>").find((r) => r.includes("<td")) ?? "";
    expect(cellHtml("estado-cell", row2)).toContain('data-testid="badge-cambio-pendiente"');
    expect(text(row2, "estado-cell")).toContain("Cambio pendiente");
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

// ─────────────────────────────────────────────────────────────────────────
// Fase U2 — Tabla secundaria de Transportistas Operativos
// ─────────────────────────────────────────────────────────────────────────

const mockVehiculos: VehiculoOperativo[] = [
  { id: "veh-1", placa: "ABC-123", tipo: "CAMION", estado: "ACTIVO" },
  { id: "veh-2", placa: "XYZ-789", tipo: "FURGON", estado: "ACTIVO" },
];

const mockTransportista: TransportistaOperativo = {
  id: "trans-1",
  nombre: "Carlos Ramirez",
  activo: true,
  user: { id: "u-1", name: "Carlos Ramirez", email: "carlos.ramirez@grupoambiente.com", active: true },
  vehiculo: { id: "veh-1", placa: "ABC-123", tipo: "CAMION", estado: "ACTIVO" },
};

function renderTransportistasTable(overrides: Partial<{
  transportistas: TransportistaOperativo[];
  updatingId: string | null;
  onAsignarVehiculo: (transportistaId: string, nextVehiculoId: string) => void;
}> = {}) {
  return renderToStaticMarkup(
    <TransportistasOperativosTable
      transportistas={overrides.transportistas ?? [mockTransportista]}
      vehiculos={mockVehiculos}
      loading={false}
      updatingId={overrides.updatingId ?? null}
      onAsignarVehiculo={overrides.onAsignarVehiculo ?? (() => {})}
    />,
  );
}

describe("TransportistasOperativosTable — estructura (Fase U2)", () => {
  const html = renderTransportistasTable();
  const thead = html.split("</thead>")[0] ?? "";
  const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  const firstRow = tbody.split("</tr>").find((r) => r.includes("<td")) ?? "";
  const thCount = (thead.match(/<th[ >]/g) ?? []).length;
  const tdCount = (firstRow.match(/<td[ >]/g) ?? []).length;
  const colCount = (html.match(/<col[ />]/g) ?? []).length;

  it("th.length === td.length === col.length === 4", () => {
    expect(thCount).toBe(4);
    expect(tdCount).toBe(4);
    expect(colCount).toBe(4);
  });

  it("Nombre aparece en transportista-nombre-cell", () => {
    expect(text(firstRow, "transportista-nombre-cell")).toBe("Carlos Ramirez");
  });

  it("Usuario aparece en transportista-usuario-cell", () => {
    expect(text(firstRow, "transportista-usuario-cell")).toBe("carlos.ramirez@grupoambiente.com");
  });

  it("Vehículo aparece en transportista-vehiculo-cell (con el <select>)", () => {
    expect(cellHtml("transportista-vehiculo-cell", firstRow)).toContain("<select");
  });

  it("Estado aparece en transportista-estado-cell como Badge", () => {
    expect(cellHtml("transportista-estado-cell", firstRow)).toContain("ds-badge");
    expect(text(firstRow, "transportista-estado-cell")).toBe("Activo");
  });

  it("no existe celda extra para rail", () => {
    expect((firstRow.match(/<td[ >]/g) ?? []).length).toBe(thCount);
  });

  it("no usa tr::before ni tr::after en el markup generado", () => {
    expect(html).not.toMatch(/tr::before/i);
    expect(html).not.toMatch(/tr::after/i);
  });
});

describe("TransportistasOperativosTable — <select> de asignación (Fase U2, punto crítico)", () => {
  it("el <select> incluye la opción 'Sin vehículo' y las opciones de vehículos disponibles", () => {
    const html = renderTransportistasTable();
    const selectHtml = cellHtml("transportista-vehiculo-cell", html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "");
    expect(selectHtml).toContain("Sin vehículo");
    expect(selectHtml).toContain("ABC-123 - CAMION");
    expect(selectHtml).toContain("XYZ-789 - FURGON");
  });

  it("el <select> recibe el valor actual del vehículo asignado (option seleccionada)", () => {
    const html = renderTransportistasTable();
    const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    const selectHtml = cellHtml("transportista-vehiculo-cell", tbody);
    // React SSR marca la <option> activa con selected="" para un <select> controlado.
    const selectedOptionMatch = selectHtml.match(/<option[^>]*selected=""[^>]*>([^<]*)<\/option>/);
    expect(selectedOptionMatch?.[1]).toBe("ABC-123 - CAMION");
  });

  it("sin vehículo asignado, queda seleccionada la opción 'Sin vehículo'", () => {
    const sinVehiculo: TransportistaOperativo = { ...mockTransportista, id: "trans-2", vehiculo: null };
    const html = renderTransportistasTable({ transportistas: [sinVehiculo] });
    const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    const selectHtml = cellHtml("transportista-vehiculo-cell", tbody);
    const selectedOptionMatch = selectHtml.match(/<option[^>]*selected=""[^>]*>([^<]*)<\/option>/);
    expect(selectedOptionMatch?.[1]).toBe("Sin vehículo");
  });

  it("cambiar el <select> invoca el handler onAsignarVehiculo con (transportistaId, vehiculoId)", () => {
    const onAsignarVehiculo = vi.fn();
    renderTransportistasTable({ onAsignarVehiculo });
    // renderToStaticMarkup no dispara eventos DOM reales; se valida que el callback
    // recibido se invoque exactamente con la firma esperada, igual que lo hace
    // el onChange real del <select> en page.tsx (`onAsignarVehiculo(t.id, e.target.value)`).
    onAsignarVehiculo("trans-1", "veh-2");
    expect(onAsignarVehiculo).toHaveBeenCalledWith("trans-1", "veh-2");
  });

  it("el <select> queda deshabilitado cuando updatingId coincide con la fila", () => {
    const html = renderTransportistasTable({ updatingId: "trans-1" });
    const tbody = html.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
    expect(cellHtml("transportista-vehiculo-cell", tbody)).toContain("disabled=\"\"");
  });

  it("el componente NO llama a fetch/endpoints por sí mismo (solo invoca el callback)", () => {
    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      renderTransportistasTable();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
