import { describe, expect, it } from "vitest";
import {
  deriveNovedadFromMaestro,
  derivePlinFromMaestro,
  mapExcelProductoRow,
  normalizePlu,
  parsePrecio,
} from "@/lib/productosMaestro";

const producto = {
  plu: "ABC123",
  descripcion: "SILLA COMEDOR",
  fabricante: "FABRICANTE SAS",
  precio: 125000,
  marca: "Ambiente",
};

describe("productos maestro", () => {
  it("normaliza PLU", () => {
    expect(normalizePlu(" abc123 ")).toBe("ABC123");
  });

  it("convierte precio desde numero o texto", () => {
    expect(parsePrecio(125000)).toBe(125000);
    expect(parsePrecio("$125.000,50")).toBe(125000.5);
    expect(parsePrecio("")).toBeNull();
  });

  it("mapea fila del Excel maestro", () => {
    expect(mapExcelProductoRow({
      PLU: " abc123 ",
      DESCRIPCION: "Silla comedor",
      Fabricante: "Fabricante SAS",
      PRECIO: "125000",
      MARCAS: "Ambiente",
    })).toEqual({
      plu: "ABC123",
      descripcion: "Silla comedor",
      fabricante: "Fabricante SAS",
      precio: 125000,
      marca: "Ambiente",
    });
  });

  it("ignora filas sin PLU", () => {
    expect(mapExcelProductoRow({ DESCRIPCION: "Sin codigo" })).toBeNull();
  });

  it("no-admin usa datos del maestro en novedades", () => {
    expect(deriveNovedadFromMaestro({
      descripcion: "Manual",
      fabricante: "Manual",
      costoUnitario: 1,
    }, producto, false)).toEqual({
      descripcion: "SILLA COMEDOR",
      fabricante: "FABRICANTE SAS",
      costoUnitario: 125000,
    });
  });

  it("ADMIN conserva override manual en novedades", () => {
    expect(deriveNovedadFromMaestro({
      descripcion: "Manual",
      fabricante: "Manual",
      costoUnitario: 1,
    }, producto, true)).toEqual({
      descripcion: "Manual",
      fabricante: "Manual",
      costoUnitario: 1,
    });
  });

  it("despachos tienda toman descripcion del maestro para no-admin", () => {
    expect(derivePlinFromMaestro({ descripcion: "Manual" }, producto, false))
      .toEqual({ descripcion: "SILLA COMEDOR" });
  });
});
