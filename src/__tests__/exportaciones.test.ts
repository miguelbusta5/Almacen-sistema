import { describe, expect, it } from "vitest";
import {
  calcularDuracionMinutos,
  normalizePlu,
  puedeGestionarExportaciones,
  puedeUsarExportaciones,
  validarCapturaExportacion,
  validarRegueroExportacion,
} from "@/lib/exportaciones";

describe("exportaciones", () => {
  it("limita uso a etiquetado y gestores", () => {
    expect(puedeUsarExportaciones("ETIQUETADO")).toBe(true);
    expect(puedeUsarExportaciones("SUPERVISOR_ALMACENAMIENTO")).toBe(true);
    expect(puedeUsarExportaciones("ADMIN")).toBe(true);
    expect(puedeUsarExportaciones("GERENTE")).toBe(true);
    expect(puedeUsarExportaciones("TRANSPORTE")).toBe(false);
  });

  it("limita gestion a supervisor almacenamiento, admin y gerente", () => {
    expect(puedeGestionarExportaciones("SUPERVISOR_ALMACENAMIENTO")).toBe(true);
    expect(puedeGestionarExportaciones("ADMIN")).toBe(true);
    expect(puedeGestionarExportaciones("GERENTE")).toBe(true);
    expect(puedeGestionarExportaciones("ETIQUETADO")).toBe(false);
  });

  it("normaliza PLU", () => {
    expect(normalizePlu("  abc-123 ")).toBe("ABC-123");
  });

  it("valida captura obligatoria", () => {
    expect(validarCapturaExportacion({ numeroCaja: "", plu: "A", unidadEmpaque: 1 })).toBe("Numero de caja es obligatorio");
    expect(validarCapturaExportacion({ numeroCaja: "C1", plu: "", unidadEmpaque: 1 })).toBe("PLU es obligatorio");
    expect(validarCapturaExportacion({ numeroCaja: "C1", plu: "A", unidadEmpaque: 0 })).toBe("Unidad de empaque debe ser un entero mayor a cero");
    expect(validarCapturaExportacion({ numeroCaja: "C1", plu: "A", unidadEmpaque: 12 })).toBeNull();
  });

  it("calcula duracion en minutos", () => {
    expect(calcularDuracionMinutos("2026-06-16T10:00:00.000Z", "2026-06-16T10:17:00.000Z")).toBe(17);
    expect(calcularDuracionMinutos("2026-06-16T10:00:00.000Z", null)).toBeNull();
  });
});

describe("validarRegueroExportacion", () => {
  it("pasa cuando hayReguero es false, null o undefined", () => {
    expect(validarRegueroExportacion({ hayReguero: false })).toBeNull();
    expect(validarRegueroExportacion({ hayReguero: null })).toBeNull();
    expect(validarRegueroExportacion({})).toBeNull();
  });

  it("falla cuando hayReguero=true y cantidad es null o cero", () => {
    expect(validarRegueroExportacion({ hayReguero: true, cantidadReguero: null })).not.toBeNull();
    expect(validarRegueroExportacion({ hayReguero: true, cantidadReguero: 0 })).not.toBeNull();
    expect(validarRegueroExportacion({ hayReguero: true })).not.toBeNull();
  });

  it("acepta cantidad >= 1 cuando hayReguero=true", () => {
    expect(validarRegueroExportacion({ hayReguero: true, cantidadReguero: 1 })).toBeNull();
    expect(validarRegueroExportacion({ hayReguero: true, cantidadReguero: 50 })).toBeNull();
  });
});
