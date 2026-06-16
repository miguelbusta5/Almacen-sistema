import { describe, expect, it } from "vitest";
import { validateTransportistaBinding, isTransportistaDisponible } from "@/lib/userValidation";

describe("validateTransportistaBinding", () => {

  // ── TRANSPORTISTA exige transportistaId ──────────────
  it("TRANSPORTISTA sin transportistaId → error", () =>
    expect(validateTransportistaBinding("TRANSPORTISTA", null)).toBe("Selecciona el transportista a vincular")
  );
  it("TRANSPORTISTA con transportistaId vacío → error", () =>
    expect(validateTransportistaBinding("TRANSPORTISTA", "")).toBe("Selecciona el transportista a vincular")
  );
  it("TRANSPORTISTA con transportistaId válido → null", () =>
    expect(validateTransportistaBinding("TRANSPORTISTA", "tid_123")).toBeNull()
  );

  // ── Otros roles rechazan transportistaId ─────────────
  it.each(["ADMIN", "GERENTE", "OPERADOR", "INVENTARIO", "TRANSPORTE", "TIENDA", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA", "ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO"] as const)(
    "%s con transportistaId → error",
    (role) => expect(validateTransportistaBinding(role, "tid_123")).toBe("Solo el rol Transportista puede vincularse a un conductor")
  );

  it.each(["ADMIN", "GERENTE", "INVENTARIO", "TRANSPORTE", "ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO"] as const)(
    "%s sin transportistaId → null (OK)",
    (role) => expect(validateTransportistaBinding(role, null)).toBeNull()
  );
});

describe("isTransportistaDisponible", () => {
  const base = { activo: true, userId: null, vehiculoId: "v_1" };

  it("activo, sin usuario, con vehiculo → disponible", () =>
    expect(isTransportistaDisponible(base)).toBe(true)
  );
  it("inactivo → no disponible", () =>
    expect(isTransportistaDisponible({ ...base, activo: false })).toBe(false)
  );
  it("ya tiene usuario → no disponible", () =>
    expect(isTransportistaDisponible({ ...base, userId: "u_1" })).toBe(false)
  );
  it("sin vehiculo → no disponible", () =>
    expect(isTransportistaDisponible({ ...base, vehiculoId: null })).toBe(false)
  );
  it("inactivo + sin vehiculo → no disponible", () =>
    expect(isTransportistaDisponible({ activo: false, userId: null, vehiculoId: null })).toBe(false)
  );
});
