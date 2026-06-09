import { describe, expect, it } from "vitest";
import { canSeeModule, getVisibleModules } from "@/lib/modulePermissions";

describe("canSeeModule — Sprint 8", () => {

  // ── TRANSPORTISTA: solo Preoperacional ───────────────
  describe("TRANSPORTISTA", () => {
    it("ve preoperacional", () => expect(canSeeModule("TRANSPORTISTA", "preoperacional")).toBe(true));
    it("NO ve inventario",  () => expect(canSeeModule("TRANSPORTISTA", "inventario")).toBe(false));
    it("NO ve transporte",  () => expect(canSeeModule("TRANSPORTISTA", "transporte")).toBe(false));
    it("NO ve tienda",      () => expect(canSeeModule("TRANSPORTISTA", "tienda")).toBe(false));
    it("NO ve usuarios",    () => expect(canSeeModule("TRANSPORTISTA", "usuarios")).toBe(false));
    it("NO ve auditoria",   () => expect(canSeeModule("TRANSPORTISTA", "auditoria")).toBe(false));
    it("NO ve centro-control", () => expect(canSeeModule("TRANSPORTISTA", "centro-control")).toBe(false));
    it("solo tiene acceso a 1 módulo", () =>
      expect(getVisibleModules("TRANSPORTISTA")).toEqual(["preoperacional"])
    );
  });

  // ── ADMIN: ve todo ────────────────────────────────────
  describe("ADMIN", () => {
    it("ve inventario",      () => expect(canSeeModule("ADMIN", "inventario")).toBe(true));
    it("ve transporte",      () => expect(canSeeModule("ADMIN", "transporte")).toBe(true));
    it("ve tienda",          () => expect(canSeeModule("ADMIN", "tienda")).toBe(true));
    it("ve usuarios",        () => expect(canSeeModule("ADMIN", "usuarios")).toBe(true));
    it("ve auditoria",       () => expect(canSeeModule("ADMIN", "auditoria")).toBe(true));
    it("ve centro-control",  () => expect(canSeeModule("ADMIN", "centro-control")).toBe(true));
    it("NO ve preoperacional", () => expect(canSeeModule("ADMIN", "preoperacional")).toBe(false));
  });

  // ── TIENDA: solo su módulo ───────────────────────────
  describe("TIENDA", () => {
    it("ve tienda",         () => expect(canSeeModule("TIENDA", "tienda")).toBe(true));
    it("NO ve inventario",  () => expect(canSeeModule("TIENDA", "inventario")).toBe(false));
    it("NO ve transporte",  () => expect(canSeeModule("TIENDA", "transporte")).toBe(false));
    it("NO ve usuarios",    () => expect(canSeeModule("TIENDA", "usuarios")).toBe(false));
    it("NO ve preoperacional", () => expect(canSeeModule("TIENDA", "preoperacional")).toBe(false));
  });

  // ── Roles sin acceso a usuarios ───────────────────────
  it.each(["GERENTE", "OPERADOR", "INVENTARIO", "TRANSPORTE", "TIENDA", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA", "TRANSPORTISTA"] as const)(
    "%s NO ve usuarios", (role) => expect(canSeeModule(role, "usuarios")).toBe(false)
  );

  // ── Roles sin acceso a preoperacional ────────────────
  it.each(["ADMIN", "GERENTE", "OPERADOR", "INVENTARIO", "TRANSPORTE", "TIENDA", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE"] as const)(
    "%s NO ve preoperacional", (role) => expect(canSeeModule(role, "preoperacional")).toBe(false)
  );

  // ── Guardias de edge cases ────────────────────────────
  it("role undefined → false", () => expect(canSeeModule(undefined, "inventario")).toBe(false));
  it("role null → false",      () => expect(canSeeModule(null, "inventario")).toBe(false));
  it("role desconocido → false", () => expect(canSeeModule("SUPERADMIN", "inventario")).toBe(false));
});
