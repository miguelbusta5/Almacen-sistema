import { describe, expect, it } from "vitest";
import { parseNumber, parseBaseGeneral, parseRotacionPLU } from "@/lib/indicadores";

describe("parseNumber", () => {
  it("convierte números con formato colombiano", () => {
    expect(parseNumber("$1.234,56")).toBe(1234.56);
    expect(parseNumber("5.973.905")).toBe(5973905);
    expect(parseNumber("42")).toBe(42);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });
});

describe("parseBaseGeneral", () => {
  const headers = ["Tipo", "Tipo de orden", "Estado", "Número de documento",
    "Fecha", "Mes de Fecha", "Cantidad de líneas", "Cantidad orden",
    "Cantidad completada", "Diferencia cantidad", "Fecha de envío real",
    "TIPO E INVENTARIO WMS", "Causales", "Mes", "Año"];

  it("agrupa órdenes por mes, grupo y tipoMov", () => {
    const rows = [
      headers,
      ["Orden de venta ECOMMERCE", "ECOMMERCE", "Facturada", "OV-001", "2026-01-15",
        "1", "5", "10", "10", "0", "2026-01-16", "AMBIENTE GOURMET", "", "enero", "2026"],
      ["Orden de venta ECOMMERCE", "ECOMMERCE", "Facturada", "OV-002", "2026-01-20",
        "1", "3", "6", "6", "0", "2026-01-21", "AMBIENTE GOURMET", "", "enero", "2026"],
      ["Orden de traslado", "TRASLADO", "Cerrada", "TR-001", "2026-01-10",
        "1", "2", "4", "4", "0", "2026-01-11", "MUEBLES", "", "enero", "2026"],
    ];

    const { resumen, tipoOrden } = parseBaseGeneral(rows);

    const agOvdm = resumen.find((r) => r.grupo === "AG" && r.tipoMov === "OVDM" && r.mes === 1 && r.anio === 2026);
    expect(agOvdm?.ordenes).toBe(2);
    expect(agOvdm?.unidades).toBe(16);
    expect(agOvdm?.lineas).toBe(8);

    const mueTsdm = resumen.find((r) => r.grupo === "MUEBLES" && r.tipoMov === "TSDM");
    expect(mueTsdm?.ordenes).toBe(1);

    // tipoOrden TODOS
    const ecTodos = tipoOrden.find((t) => t.tipoOrden === "ECOMMERCE" && t.grupo === "TODOS");
    expect(ecTodos?.ordenes).toBe(2);
  });

  it("omite filas sin año o mes válido", () => {
    const rows = [
      headers,
      ["Orden de venta", "ECOMMERCE", "", "", "", "", "", "", "5", "", "", "AMBIENTE GOURMET", "", "", ""],
    ];
    const { resumen } = parseBaseGeneral(rows);
    expect(resumen).toHaveLength(0);
  });

  it("acepta mes como nombre en español", () => {
    const rows = [
      headers,
      ["Orden de traslado", "TRASLADO", "Cerrada", "TR-002", "2025-06-01",
        "6", "1", "2", "2", "0", "2025-06-02", "MUEBLES", "", "junio", "2025"],
    ];
    const { resumen } = parseBaseGeneral(rows);
    expect(resumen[0]?.mes).toBe(6);
    expect(resumen[0]?.mesNombre).toBe("junio");
  });
});

describe("parseRotacionPLU", () => {
  const headers = ["Artículo", "Descripcion", "Enviados 2024", "Unidades 2024",
    "Enviados 2025", "Unidades 2025", "Enviados 2026", "Unidades 2026", "Grupo"];

  it("extrae filas por año", () => {
    const rows = [
      headers,
      ["329", "BATIDOR DE CAFE", "3004", "11444", "3043", "10763", "1084", "5404", "MESA"],
    ];
    const plus = parseRotacionPLU(rows);
    expect(plus).toHaveLength(3); // 3 años
    const p2024 = plus.find((p) => p.anio === 2024);
    expect(p2024?.plu).toBe("329");
    expect(p2024?.enviados).toBe(3004);
    expect(p2024?.unidades).toBe(11444);
    expect(p2024?.grupo).toBe("MESA");
  });

  it("omite filas sin PLU", () => {
    const rows = [headers, ["", "SIN PLU", "1", "2", "3", "4", "5", "6", "COCINA"]];
    expect(parseRotacionPLU(rows)).toHaveLength(0);
  });

  it("omite años sin datos", () => {
    const rows = [
      headers,
      ["6002", "MUG M", "2302", "5836", "", "", "776", "2548", "MESA"],
    ];
    const plus = parseRotacionPLU(rows);
    // 2025 no tiene datos → solo 2 años
    expect(plus).toHaveLength(2);
    expect(plus.some((p) => p.anio === 2025)).toBe(false);
  });
});
