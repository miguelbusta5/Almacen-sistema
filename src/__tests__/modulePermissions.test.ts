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
    it("NO ve solicitudes-transporte", () => expect(canSeeModule("TRANSPORTISTA", "solicitudes-transporte")).toBe(false));
    it("solo tiene acceso a 1 módulo", () =>
      expect(getVisibleModules("TRANSPORTISTA")).toEqual(["preoperacional"])
    );
  });

  describe("ETIQUETADO", () => {
    it("solo ve exportaciones (Ecuador/México/EE.UU)", () => {
      expect(getVisibleModules("ETIQUETADO")).toEqual(["exportaciones", "exportaciones-mexico", "exportaciones-eeuu"]);
    });
    it("NO ve otros modulos operativos", () => {
      expect(canSeeModule("ETIQUETADO", "inventario")).toBe(false);
      expect(canSeeModule("ETIQUETADO", "transporte")).toBe(false);
      expect(canSeeModule("ETIQUETADO", "solicitudes-transporte")).toBe(false);
      expect(canSeeModule("ETIQUETADO", "preoperacional")).toBe(false);
    });
  });

  // ── ADMIN: ve todo incluido preoperacional (vista supervisor) ──
  describe("ADMIN", () => {
    it("ve inventario",      () => expect(canSeeModule("ADMIN", "inventario")).toBe(true));
    it("ve transporte",      () => expect(canSeeModule("ADMIN", "transporte")).toBe(true));
    it("ve tienda",          () => expect(canSeeModule("ADMIN", "tienda")).toBe(true));
    it("ve usuarios",        () => expect(canSeeModule("ADMIN", "usuarios")).toBe(true));
    it("ve auditoria",       () => expect(canSeeModule("ADMIN", "auditoria")).toBe(true));
    it("ve centro-control",  () => expect(canSeeModule("ADMIN", "centro-control")).toBe(true));
    it("ve solicitudes-transporte", () => expect(canSeeModule("ADMIN", "solicitudes-transporte")).toBe(true));
    it("ve exportaciones", () => expect(canSeeModule("ADMIN", "exportaciones")).toBe(true));
    it("ve preoperacional (vista supervisor)", () => expect(canSeeModule("ADMIN", "preoperacional")).toBe(true));
  });

  it.each(["ADMIN", "GERENTE", "SUPERVISOR_ALMACENAMIENTO"] as const)(
    "%s ve exportaciones como gestion", (role) => expect(canSeeModule(role, "exportaciones")).toBe(true)
  );

  // ── TIENDA: solo su módulo ───────────────────────────
  describe("TIENDA", () => {
    it("ve tienda",         () => expect(canSeeModule("TIENDA", "tienda")).toBe(true));
    it("ve solicitudes-transporte", () => expect(canSeeModule("TIENDA", "solicitudes-transporte")).toBe(true));
    it("NO ve inventario",  () => expect(canSeeModule("TIENDA", "inventario")).toBe(false));
    it("NO ve transporte",  () => expect(canSeeModule("TIENDA", "transporte")).toBe(false));
    it("NO ve usuarios",    () => expect(canSeeModule("TIENDA", "usuarios")).toBe(false));
    it("NO ve preoperacional", () => expect(canSeeModule("TIENDA", "preoperacional")).toBe(false));
  });

  // ── Roles sin acceso a usuarios ───────────────────────
  it.each(["GERENTE", "OPERADOR", "INVENTARIO", "TRANSPORTE", "TIENDA", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA", "TRANSPORTISTA"] as const)(
    "%s NO ve usuarios", (role) => expect(canSeeModule(role, "usuarios")).toBe(false)
  );

  // ── Supervisores que VEN preoperacional (vista supervisor) ───
  it.each(["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE"] as const)(
    "%s ve preoperacional (supervisor)", (role) => expect(canSeeModule(role, "preoperacional")).toBe(true)
  );

  // ── Roles sin acceso a preoperacional ────────────────
  it.each(["OPERADOR", "INVENTARIO", "TRANSPORTE", "TIENDA", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TIENDA"] as const)(
    "%s NO ve preoperacional", (role) => expect(canSeeModule(role, "preoperacional")).toBe(false)
  );

  // ── Módulo integración ────────────────────────────────
  describe("integracion — OPERACIONES_MUEBLES", () => {
    it("ve integracion",      () => expect(canSeeModule("OPERACIONES_MUEBLES", "integracion")).toBe(true));
    it("NO ve inventario",    () => expect(canSeeModule("OPERACIONES_MUEBLES", "inventario")).toBe(false));
    it("NO ve transporte",    () => expect(canSeeModule("OPERACIONES_MUEBLES", "transporte")).toBe(false));
    it("NO ve tienda",        () => expect(canSeeModule("OPERACIONES_MUEBLES", "tienda")).toBe(false));
    it("NO ve usuarios",      () => expect(canSeeModule("OPERACIONES_MUEBLES", "usuarios")).toBe(false));
    it("NO ve preoperacional",() => expect(canSeeModule("OPERACIONES_MUEBLES", "preoperacional")).toBe(false));
    it("NO ve auditoria",     () => expect(canSeeModule("OPERACIONES_MUEBLES", "auditoria")).toBe(false));
    it("NO ve centro-control",() => expect(canSeeModule("OPERACIONES_MUEBLES", "centro-control")).toBe(false));
  });

  describe("integracion — OPERACIONES_GOURMET", () => {
    it("ve integracion",      () => expect(canSeeModule("OPERACIONES_GOURMET", "integracion")).toBe(true));
    it("NO ve inventario",    () => expect(canSeeModule("OPERACIONES_GOURMET", "inventario")).toBe(false));
    it("NO ve transporte",    () => expect(canSeeModule("OPERACIONES_GOURMET", "transporte")).toBe(false));
    it("NO ve tienda",        () => expect(canSeeModule("OPERACIONES_GOURMET", "tienda")).toBe(false));
    it("NO ve usuarios",      () => expect(canSeeModule("OPERACIONES_GOURMET", "usuarios")).toBe(false));
    it("NO ve auditoria",     () => expect(canSeeModule("OPERACIONES_GOURMET", "auditoria")).toBe(false));
  });

  it.each(["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE", "TRANSPORTE"] as const)(
    "%s ve integracion", (role) => expect(canSeeModule(role, "integracion")).toBe(true)
  );

  it.each(["TIENDA", "SUPERVISOR_TIENDA", "INVENTARIO", "SUPERVISOR_INVENTARIO", "TRANSPORTISTA", "OPERADOR"] as const)(
    "%s NO ve integracion", (role) => expect(canSeeModule(role, "integracion")).toBe(false)
  );

  it.each(["ADMIN", "GERENTE", "OPERADOR", "INVENTARIO", "TRANSPORTE", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "TIENDA", "SUPERVISOR_TIENDA", "OPERACIONES_MUEBLES", "OPERACIONES_GOURMET"] as const)(
    "%s ve solicitudes-transporte", (role) => expect(canSeeModule(role, "solicitudes-transporte")).toBe(true)
  );

  // ── Módulo cargue-gourmet ─────────────────────────────
  describe("cargue-gourmet", () => {
    it.each(["ADMIN", "GERENTE", "OPERACIONES_GOURMET", "TRANSPORTE", "SUPERVISOR_TRANSPORTE"] as const)(
      "%s ve cargue-gourmet", (role) => expect(canSeeModule(role, "cargue-gourmet")).toBe(true)
    );
    it.each([
      "OPERADOR", "INVENTARIO", "SUPERVISOR_INVENTARIO", "TIENDA", "SUPERVISOR_TIENDA",
      "TRANSPORTISTA", "OPERACIONES_MUEBLES", "ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO",
    ] as const)(
      "%s NO ve cargue-gourmet", (role) => expect(canSeeModule(role, "cargue-gourmet")).toBe(false)
    );
  });

  // ── Guardias de edge cases ────────────────────────────
  it("role undefined → false", () => expect(canSeeModule(undefined, "inventario")).toBe(false));
  it("role null → false",      () => expect(canSeeModule(null, "inventario")).toBe(false));
  it("role desconocido → false", () => expect(canSeeModule("SUPERADMIN", "inventario")).toBe(false));
});
