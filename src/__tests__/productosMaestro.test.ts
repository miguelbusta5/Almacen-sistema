import { describe, expect, it } from "vitest";
import {
  columnasPresentes,
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
  ean: "7703596000012",
  unidadesPorCaja: 24,
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
      ean: null,
      unidadesPorCaja: null,
    });
  });

  // La planilla de montacargas trae su catálogo en la hoja "MAESTRO REF", con
  // encabezados propios: EAN y "Und Emp" (que en el archivo real lleva un salto
  // de línea dentro de la celda).
  it("mapea una fila de la hoja MAESTRO REF con EAN y unidades por caja", () => {
    expect(mapExcelProductoRow({
      PLU: 3,
      "Nombre para mostrar": "PLATO SIMPLE 25CM",
      EAN: "7703596000036",
      "Und Emp": 24,
    })).toEqual({
      plu: "3",
      descripcion: "PLATO SIMPLE 25CM",
      fabricante: null,
      precio: null,
      marca: null,
      ean: "7703596000036",
      unidadesPorCaja: 24,
    });
  });

  it("tolera el salto de linea dentro del encabezado Und Emp", () => {
    const fila = { PLU: "5", "Nombre para mostrar": "PLATO S.RECT.MED.", ["Und\nEmp"]: 24 };
    expect(mapExcelProductoRow(fila)?.unidadesPorCaja).toBe(24);
  });

  // 13.373 de 18.852 productos del maestro no traen "Und Emp": deben entrar como
  // null para que el módulo Estibas pida el dato al operario en vez de bloquear.
  it("deja unidades por caja en null cuando el maestro no las trae", () => {
    expect(mapExcelProductoRow({
      PLU: "26403",
      "Nombre para mostrar": "SOFA PLAYA EXTERIOR 58X220X86",
      EAN: "7703596264039",
    })?.unidadesPorCaja).toBeNull();
  });

  // El 0 del maestro son filas sin diligenciar, no cajas de cero unidades.
  it("trata el 0 de unidades por caja como sin dato", () => {
    expect(mapExcelProductoRow({ PLU: "1", "Und Emp": 0 })?.unidadesPorCaja).toBeNull();
  });

  it("normaliza el EAN que Excel entrega como número", () => {
    expect(mapExcelProductoRow({ PLU: "3", EAN: 7703596000036 })?.ean).toBe("7703596000036");
  });

  it("descarta un EAN que no parece un código de barras", () => {
    expect(mapExcelProductoRow({ PLU: "3", EAN: "123" })?.ean).toBeNull();
    expect(mapExcelProductoRow({ PLU: "3", EAN: "" })?.ean).toBeNull();
  });

  it("acepta PLUs no numéricos del maestro (BONO, BONO100)", () => {
    expect(mapExcelProductoRow({ PLU: "bono100", "Nombre para mostrar": "BONO REGALO" })?.plu)
      .toBe("BONO100");
  });

  it("ignora filas sin PLU", () => {
    expect(mapExcelProductoRow({ DESCRIPCION: "Sin codigo" })).toBeNull();
  });

  it("mapea fila del export real ResultadosMaestrodeproductosPV", () => {
    expect(mapExcelProductoRow({
      "Referencia Original": 10005,
      "Nombre para mostrar": "LOUNGE CHARLESTON SET X5",
      Fabricante: "Z MUEBLES EX TZ",
      "Precio unitario": 6780000,
      MARCAS: "Ambiente Living",
    })).toEqual({
      plu: "10005",
      descripcion: "LOUNGE CHARLESTON SET X5",
      fabricante: "Z MUEBLES EX TZ",
      precio: 6780000,
      marca: "Ambiente Living",
      ean: null,
      unidadesPorCaja: null,
    });
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

// Regresión: dos archivos distintos alimentan productos_maestro (el maestro de
// precios y la planilla de montacargas). El importador solo puede sobrescribir
// las columnas que el archivo trae; si no, importar uno vacía las del otro en
// los ~19k productos existentes — y `precio` alimenta el costo de Novedades.
describe("columnas presentes en el archivo importado", () => {
  it("la planilla de montacargas solo declara descripcion, ean y unidades", () => {
    const columnas = columnasPresentes([
      { PLU: 3, "Nombre para mostrar": "PLATO SIMPLE 25CM", EAN: "7703596000036", ["Und\nEmp"]: 24 },
    ]);
    expect(columnas.sort()).toEqual(["descripcion", "ean", "unidades_por_caja"]);
    expect(columnas).not.toContain("precio");
    expect(columnas).not.toContain("fabricante");
    expect(columnas).not.toContain("marca");
  });

  it("el export del maestro declara todas sus columnas, así que puede vaciarlas", () => {
    const columnas = columnasPresentes([
      { PLU: "1", DESCRIPCION: "X", Fabricante: "Y", PRECIO: 1, MARCAS: "Z", EAN: "", ["Und Emp"]: "" },
    ]);
    expect(columnas.sort()).toEqual([
      "descripcion", "ean", "fabricante", "marca", "precio", "unidades_por_caja",
    ]);
  });

  // Mira los ENCABEZADOS, no los valores: una columna presente pero vacía en
  // todas las filas debe poder vaciar el campo (es como se borra a propósito).
  it("una columna vacía en todas las filas sigue contando como presente", () => {
    expect(columnasPresentes([{ PLU: "1", PRECIO: null }])).toContain("precio");
  });

  it("un archivo sin ninguna columna reconocida no declara ninguna", () => {
    expect(columnasPresentes([{ PLU: "1" }])).toEqual([]);
  });
});
