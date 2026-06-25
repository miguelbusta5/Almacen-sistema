import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import {
  validateColumns,
  validateRow,
  processRows,
  normalizeRowKeys,
} from "../../scripts/lib/maestroTiendasCsv.mjs";

describe("validateColumns", () => {
  it("ok=true si están las 3 columnas requeridas", () => {
    expect(validateColumns(["codigo", "tienda", "ciudad"])).toEqual({ ok: true, missing: [] });
  });

  it("ok=true si además viene 'activo' (opcional)", () => {
    expect(validateColumns(["codigo", "tienda", "ciudad", "activo"]).ok).toBe(true);
  });

  it("ok=true si hay columnas extra no declaradas (se ignoran)", () => {
    expect(validateColumns(["codigo", "tienda", "ciudad", "telefono"]).ok).toBe(true);
  });

  it("ok=false y lista las columnas faltantes", () => {
    const r = validateColumns(["codigo", "tienda"]);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["ciudad"]);
  });

  it("es insensible a mayúsculas/espacios en los nombres de columna", () => {
    expect(validateColumns([" CODIGO ", "Tienda", "CIUDAD"]).ok).toBe(true);
  });
});

describe("validateRow", () => {
  it("acepta una fila válida con activo=true explícito", () => {
    const r = validateRow({ codigo: "144", tienda: "Tienda X", ciudad: "Bogotá", activo: "true" }, 2);
    expect(r.ok).toBe(true);
    expect(r.row).toEqual({ codigo: "144", tienda: "Tienda X", ciudad: "Bogotá", activo: true });
  });

  it("activo vacío/ausente se interpreta como true por defecto", () => {
    const r1 = validateRow({ codigo: "144", tienda: "Tienda X", ciudad: "Bogotá", activo: "" }, 2);
    const r2 = validateRow({ codigo: "144", tienda: "Tienda X", ciudad: "Bogotá" }, 2);
    expect(r1.ok && r1.row?.activo).toBe(true);
    expect(r2.ok && r2.row?.activo).toBe(true);
  });

  it("acepta variantes de activo=false", () => {
    for (const v of ["false", "0", "no", "FALSE"]) {
      const r = validateRow({ codigo: "1", tienda: "T", ciudad: "C", activo: v }, 2);
      expect(r.ok && r.row?.activo).toBe(false);
    }
  });

  it("hace trim de todos los campos", () => {
    const r = validateRow({ codigo: "  144  ", tienda: "  Tienda X  ", ciudad: "  Bogotá  ", activo: " true " }, 2);
    expect(r.ok && r.row).toEqual({ codigo: "144", tienda: "Tienda X", ciudad: "Bogotá", activo: true });
  });

  it("trata codigo como string — no pierde ceros a la izquierda", () => {
    const r = validateRow({ codigo: "0044", tienda: "Tienda X", ciudad: "Bogotá" }, 2);
    expect(r.ok && r.row?.codigo).toBe("0044");
  });

  it("rechaza codigo vacío", () => {
    const r = validateRow({ codigo: "  ", tienda: "Tienda X", ciudad: "Bogotá" }, 2);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/codigo/);
  });

  it("rechaza tienda vacía", () => {
    const r = validateRow({ codigo: "144", tienda: "", ciudad: "Bogotá" }, 2);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/tienda/);
  });

  it("rechaza ciudad vacía", () => {
    const r = validateRow({ codigo: "144", tienda: "Tienda X", ciudad: "" }, 2);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ciudad/);
  });

  it("rechaza un valor de activo no reconocible", () => {
    const r = validateRow({ codigo: "144", tienda: "Tienda X", ciudad: "Bogotá", activo: "tal_vez" }, 2);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/activo/);
  });
});

describe("processRows", () => {
  it("clasifica filas válidas e inválidas correctamente", () => {
    const result = processRows([
      { codigo: "144", tienda: "Tienda A", ciudad: "Bogotá", activo: "true" },
      { codigo: "", tienda: "Tienda B", ciudad: "Cali" }, // inválida: sin codigo
      { codigo: "200", tienda: "Tienda C", ciudad: "Medellín", activo: "false" },
    ]);
    expect(result.totalRows).toBe(3);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(1);
    expect(result.invalid[0].rowNumber).toBe(3); // fila 1 = encabezado, fila 3 = segunda fila de datos
  });

  it("detecta códigos duplicados dentro del mismo CSV", () => {
    const result = processRows([
      { codigo: "144", tienda: "Tienda A", ciudad: "Bogotá" },
      { codigo: "144", tienda: "Tienda A (corregida)", ciudad: "Bogotá" },
    ]);
    expect(result.duplicateCodigos).toEqual(["144"]);
    // upsertPlan se queda con la última fila válida del duplicado
    expect(result.upsertPlan).toHaveLength(1);
    expect(result.upsertPlan[0].tienda).toBe("Tienda A (corregida)");
  });

  it("no produce upsertPlan a partir de filas inválidas", () => {
    const result = processRows([{ codigo: "", tienda: "X", ciudad: "Y" }]);
    expect(result.upsertPlan).toEqual([]);
  });

  it("upsertPlan sin duplicados conserva todas las filas válidas", () => {
    const result = processRows([
      { codigo: "1", tienda: "A", ciudad: "X" },
      { codigo: "2", tienda: "B", ciudad: "Y" },
      { codigo: "3", tienda: "C", ciudad: "Z" },
    ]);
    expect(result.upsertPlan).toHaveLength(3);
    expect(result.duplicateCodigos).toEqual([]);
  });
});

describe("normalizeRowKeys", () => {
  it("convierte claves a minúscula y hace trim", () => {
    expect(normalizeRowKeys({ CODIGO: "144", " Tienda ": "X", CIUDAD: "Bogotá" })).toEqual({
      codigo: "144",
      tienda: "X",
      ciudad: "Bogotá",
    });
  });
});

describe("validateRow — cabeceras reales del CSV de Centros de Costos (caso reportado en QA)", () => {
  it("CSV con cabeceras en mayúscula (CODIGO;TIENDA;CIUDAD) valida correctamente", () => {
    const parsed = Papa.parse("CODIGO;TIENDA;CIUDAD\n144;AG Viva Barranquilla;BARRANQUILLA", { header: true });
    const r = validateRow(parsed.data[0], 2);
    expect(r.ok).toBe(true);
    expect(r.row).toEqual({ codigo: "144", tienda: "AG Viva Barranquilla", ciudad: "BARRANQUILLA", activo: true });
  });

  it("CSV con cabeceras mixtas (Codigo;Tienda;Ciudad;Activo) valida correctamente", () => {
    const parsed = Papa.parse("Codigo;Tienda;Ciudad;Activo\n144;Tienda X;Bogotá;true", { header: true });
    const r = validateRow(parsed.data[0], 2);
    expect(r.ok).toBe(true);
    expect(r.row).toEqual({ codigo: "144", tienda: "Tienda X", ciudad: "Bogotá", activo: true });
  });

  it("código '00144' conserva los ceros a la izquierda con cabecera en mayúscula", () => {
    const parsed = Papa.parse("CODIGO;TIENDA;CIUDAD\n00144;Tienda X;Bogotá", { header: true });
    const r = validateRow(parsed.data[0], 2);
    expect(r.ok && r.row?.codigo).toBe("00144");
  });

  it("CSV sin columna ACTIVO (mayúscula) sigue usando default true", () => {
    const parsed = Papa.parse("CODIGO;TIENDA;CIUDAD\n144;Tienda X;Bogotá", { header: true });
    const r = validateRow(parsed.data[0], 2);
    expect(r.ok && r.row?.activo).toBe(true);
  });

  it("fila completamente vacía (;;) sigue siendo inválida", () => {
    const parsed = Papa.parse("CODIGO;TIENDA;CIUDAD\n;;", { header: true });
    const r = validateRow(parsed.data[0], 2);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/codigo/);
  });

  it("caso real mínimo reportado en QA: '144;AG Viva Barranquilla;BARRANQUILLA' es válido", () => {
    const parsed = Papa.parse("CODIGO;TIENDA;CIUDAD\n144;AG Viva Barranquilla;BARRANQUILLA", { header: true });
    const result = processRows(parsed.data);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.upsertPlan[0].codigo).toBe("144");
  });
});
