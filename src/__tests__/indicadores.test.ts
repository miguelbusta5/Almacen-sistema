import { describe, expect, it } from "vitest";
import { parseNumber, rowsToIndicadores } from "@/lib/indicadores";

describe("indicadores CEDI", () => {
  it("convierte numeros con formato colombiano", () => {
    expect(parseNumber("$1.234,56")).toBe(1234.56);
    expect(parseNumber("42")).toBe(42);
    expect(parseNumber("")).toBeNull();
  });

  it("parsea filas validas de Google Sheets", () => {
    const rows = [
      ["Proceso", "Indicador", "Periodo", "Valor", "Meta", "Unidad"],
      ["Transporte", "Entregas a tiempo", "2026-06", "94", "90", "%"],
      ["Inventario", "Exactitud", "2026-06", "88", "95", "%"],
      ["", "", "", "", "", ""],
    ];

    const result = rowsToIndicadores(rows, "fuente-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      proceso: "Transporte",
      indicador: "Entregas a tiempo",
      periodo: "2026-06",
      valor: 94,
      meta: 90,
      unidad: "%",
      estado: "EN_META",
    });
    expect(result[1].estado).toBe("ALERTA");
  });

  it("respeta estado explicito si viene desde Sheets", () => {
    const rows = [
      ["Área", "KPI", "Mes", "Resultado", "Objetivo", "Semáforo"],
      ["CEDI", "Pendientes críticos", "Junio", "12", "0", "CRITICO"],
    ];

    expect(rowsToIndicadores(rows, "fuente-2")[0].estado).toBe("CRITICO");
  });
});
