import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";

describe("can() — matriz de permisos", () => {
  describe("create", () => {
    it("OPERADOR puede crear", () => expect(can("OPERADOR", "create")).toBe(true));
    it("GERENTE puede crear", () => expect(can("GERENTE", "create")).toBe(true));
    it("ADMIN puede crear", () => expect(can("ADMIN", "create")).toBe(true));
  });

  describe("edit", () => {
    it("OPERADOR no puede editar", () => expect(can("OPERADOR", "edit")).toBe(false));
    it("GERENTE puede editar", () => expect(can("GERENTE", "edit")).toBe(true));
    it("ADMIN puede editar", () => expect(can("ADMIN", "edit")).toBe(true));
  });

  describe("delete", () => {
    it("OPERADOR no puede eliminar", () => expect(can("OPERADOR", "delete")).toBe(false));
    it("GERENTE no puede eliminar", () => expect(can("GERENTE", "delete")).toBe(false));
    it("ADMIN puede eliminar", () => expect(can("ADMIN", "delete")).toBe(true));
  });

  describe("manageUsers / viewAudit — solo ADMIN", () => {
    it.each(["OPERADOR", "GERENTE"] as const)("%s no gestiona usuarios", (r) =>
      expect(can(r, "manageUsers")).toBe(false)
    );
    it("ADMIN gestiona usuarios", () => expect(can("ADMIN", "manageUsers")).toBe(true));

    it.each(["OPERADOR", "GERENTE"] as const)("%s no ve auditoría", (r) =>
      expect(can(r, "viewAudit")).toBe(false)
    );
    it("ADMIN ve auditoría", () => expect(can("ADMIN", "viewAudit")).toBe(true));
  });

  it("rol undefined → false", () => expect(can(undefined, "create")).toBe(false));
  it("rol null → false", () => expect(can(null, "create")).toBe(false));
  it("rol desconocido → false", () => expect(can("SUPERADMIN", "create")).toBe(false));
});
