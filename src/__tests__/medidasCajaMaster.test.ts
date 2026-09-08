import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mapMedicionRows,
  medicionHeaders,
  tieneColumnasDeMedicion,
  volumenM3,
} from "@/lib/medidasCajaMaster";

// La hoja MEDICION del archivo real, recortada a lo que se importa. Se replican
// las dos filas de cabecera tal cual las entrega ExcelJS: la fila 1 llega
// REPETIDA a lo ancho de cada celda combinada.
const FILA_1 = [
  "PLU", "REF", "DESCRIPCION", "ZONA", "Producto/\nPartes ", "Und\nEmp", "Set", "Sub\nEmp",
  "PARTE 1 PESO CAJA MASTER (KG)", "PARTE 1 PESO CAJA MASTER (KG)",
  "PARTE 1 MEDIDA CAJA MASTER (CM)", "PARTE 1 MEDIDA CAJA MASTER (CM)", "PARTE 1 MEDIDA CAJA MASTER (CM)",
  "PARTE 2 PESO CAJA MASTER (KG)", "PARTE 2 PESO CAJA MASTER (KG)",
  "PARTE 2 MEDIDA CAJA MASTER (CM)", "PARTE 2 MEDIDA CAJA MASTER (CM)", "PARTE 2 MEDIDA CAJA MASTER (CM)",
  "PARTE 3 PESO CAJA MASTER (KG)", "PARTE 3 PESO CAJA MASTER (KG)",
  "PARTE 3 MEDIDA CAJA MASTER (CM)", "PARTE 3 MEDIDA CAJA MASTER (CM)", "PARTE 3 MEDIDA CAJA MASTER (CM)",
  "PRODUCTO CON EMPAQUE", "PRODUCTO CON EMPAQUE", "PRODUCTO CON EMPAQUE",
  "PRODUCTO PIEZA", "PRODUCTO PIEZA", "PRODUCTO PIEZA",
];
const FILA_2 = [
  null, null, null, null, null, null, null, null,
  "PB", "PN", "ALTO", "ANCHO", "PROF",
  "PB", "PN", "ALTO", "ANCHO", "PROF",
  "PB", "PN", "ALTO", "ANCHO", "PROF",
  "ALTO", "ANCHO", "PROF",
  "ALTO", "ANCHO", "PROF",
];
// La fila de subencabezados llega como fila de datos con el PLU en cero.
const FILA_CERO = [0, null, null, null, null, null, null, null, "PB", "PN", "ALTO"];

function fila(campos: Record<number, unknown>, largo = 29): unknown[] {
  const row = new Array(largo).fill(null);
  for (const [i, v] of Object.entries(campos)) row[Number(i)] = v;
  return row;
}

// PLU 1 del archivo real: 1 caja, 24 unidades, 22 x 36 x 49 cm.
const PLATO = fila({
  0: 1, 1: "A1736", 2: "PLATO S.CUAD.PEQ.", 3: "GOURMET", 4: 1, 5: 24, 6: 1, 7: 1,
  8: 6.2, 9: 5.2, 10: 22, 11: 36, 12: 49,
  23: 10, 24: 12, 25: 12, 26: 8, 27: 10, 28: 10,
});

describe("medidas de caja master", () => {
  // Sin combinar las dos filas, "PARTE 1 PESO CAJA MASTER (KG)" nombraria dos
  // columnas distintas (PB y PN) y una pisaria a la otra.
  it("combina las dos filas de cabecera en claves unicas", () => {
    const { nivel1, combinado } = medicionHeaders(FILA_1, FILA_2);
    expect(combinado[8]).toBe("PARTE 1 PESO CAJA MASTER (KG) PB");
    expect(combinado[9]).toBe("PARTE 1 PESO CAJA MASTER (KG) PN");
    expect(combinado[10]).toBe("PARTE 1 MEDIDA CAJA MASTER (CM) ALTO");
    // El salto de linea de "Und\nEmp" se colapsa.
    expect(nivel1[0]).toBe("PLU");
    expect(nivel1[5]).toBe("UND EMP");
    const utiles = combinado.filter(Boolean);
    expect(new Set(utiles).size).toBe(utiles.length);
  });

  // En el archivo real la fila 2 trae un 0 bajo PLU. Si las columnas de
  // identidad se buscaran en la clave combinada, esa seria "PLU 0" y no se
  // encontraria ni el PLU.
  it("las columnas de identidad se leen de la fila 1, con basura debajo", () => {
    const subcabecera = [0, null, null, null, null, null, null, null, "PB", "PN", "ALTO", "ANCHO", "PROF"];
    expect(medicionHeaders(FILA_1, subcabecera).nivel1[0]).toBe("PLU");
    const out = mapMedicionRows([FILA_1, subcabecera, PLATO]);
    expect(out).toHaveLength(1);
    expect(out[0].plu).toBe("1");
  });

  it("lee un producto de una sola caja", () => {
    const [p] = mapMedicionRows([FILA_1, FILA_2, PLATO]);
    expect(p.plu).toBe("1");
    expect(p.descripcion).toBe("PLATO S.CUAD.PEQ.");
    expect(p.zona).toBe("GOURMET");
    expect(p.partes).toBe(1);
    expect(p.unidadesPorCaja).toBe(24);
    expect(p.cajas).toHaveLength(1);
    expect(p.cajas[0]).toMatchObject({
      parte: 1, pesoBrutoKg: 6.2, pesoNetoKg: 5.2, altoCm: 22, anchoCm: 36, profCm: 49,
    });
    // 22 x 36 x 49 = 38.808 cm3, que es justo lo que el propio Excel calcula.
    expect(p.cajas[0].volumenM3).toBeCloseTo(0.038808, 9);
    expect(p.empaque).toEqual({ altoCm: 10, anchoCm: 12, profCm: 12 });
    expect(p.pieza).toEqual({ altoCm: 8, anchoCm: 10, profCm: 10 });
  });

  it("emite una fila por cada parte medida y ninguna por las vacias", () => {
    const tresCajas = fila({
      0: 25161, 2: "MUEBLE GRANDE", 3: "MUEBLES", 4: 3, 5: 1,
      8: 40, 9: 38, 10: 100, 11: 60, 12: 30,
      13: 25, 14: 24, 15: 80, 16: 50, 17: 20,
      18: 10, 19: 9, 20: 40, 21: 30, 22: 10,
    });
    const [p] = mapMedicionRows([FILA_1, FILA_2, tresCajas]);
    expect(p.cajas.map((c) => c.parte)).toEqual([1, 2, 3]);
    // Solo la parte 1 -> una sola fila, aunque existan columnas para 2 y 3.
    const [q] = mapMedicionRows([FILA_1, FILA_2, PLATO]);
    expect(q.cajas).toHaveLength(1);
  });

  // El archivo declara cuantas partes tiene el producto, pero manda lo medido:
  // el PLU 25161 real declara 1 y trae 2.
  it("guarda las partes que trae aunque no cuadren con las declaradas", () => {
    const row = fila({
      0: 25161, 2: "MESA", 4: 1, 5: 1,
      8: 40, 9: 38, 10: 100, 11: 60, 12: 30,
      13: 25, 14: 24, 15: 80, 16: 50, 17: 20,
    });
    const [p] = mapMedicionRows([FILA_1, FILA_2, row]);
    expect(p.partes).toBe(1);
    expect(p.cajas).toHaveLength(2);
  });

  it("una parte con peso pero sin medidas sigue contando", () => {
    const row = fila({ 0: 500, 2: "SOLO PESO", 8: 12.5 });
    const [p] = mapMedicionRows([FILA_1, FILA_2, row]);
    expect(p.cajas).toHaveLength(1);
    expect(p.cajas[0].pesoBrutoKg).toBe(12.5);
    // Sin las tres dimensiones no hay volumen: media caja no es un volumen.
    expect(p.cajas[0].volumenM3).toBeNull();
  });

  it("descarta la fila de subencabezados y las filas marcadoras", () => {
    const marcador = fila({
      0: 8, 2: "PLU no existe en el maestro", 5: 1, 8: 5.9, 10: 16, 11: 87, 12: 22,
    });
    expect(mapMedicionRows([FILA_1, FILA_2, FILA_CERO, marcador, PLATO])).toHaveLength(1);
  });

  // worksheetRows dimensiona cada fila con row.values.length, asi que una fila
  // sin mediciones al final llega mas corta que la cabecera.
  it("no falla con filas mas cortas que la cabecera", () => {
    const corta = [700, "REF", "SIN MEDIDAS", "GOURMET", 1, 6];
    const [p] = mapMedicionRows([FILA_1, FILA_2, corta]);
    expect(p.plu).toBe("700");
    expect(p.cajas).toEqual([]);
    expect(p.empaque).toEqual({ altoCm: null, anchoCm: null, profCm: null });
  });

  it("con el PLU repetido gana la ultima fila", () => {
    const viejo = fila({ 0: 1, 2: "PLATO", 8: 1, 10: 10, 11: 10, 12: 10 });
    const nuevo = fila({ 0: 1, 2: "PLATO CORREGIDO", 8: 2, 10: 20, 11: 20, 12: 20 });
    const out = mapMedicionRows([FILA_1, FILA_2, viejo, nuevo]);
    expect(out).toHaveLength(1);
    expect(out[0].descripcion).toBe("PLATO CORREGIDO");
    expect(out[0].cajas[0].pesoBrutoKg).toBe(2);
  });

  it("acepta la coma como separador decimal", () => {
    const row = fila({ 0: 9, 2: "COMA", 8: "6,25", 10: "10,5", 11: 10, 12: 10 });
    const [p] = mapMedicionRows([FILA_1, FILA_2, row]);
    expect(p.cajas[0].pesoBrutoKg).toBe(6.25);
    expect(p.cajas[0].altoCm).toBe(10.5);
  });

  it("volumenM3 exige las tres dimensiones", () => {
    expect(volumenM3(22, 36, 49)).toBeCloseTo(0.038808, 9);
    expect(volumenM3(22, null, 49)).toBeNull();
  });

  // La guarda que impide que un maestro de precios toque las tablas de medidas.
  it("reconoce si el archivo trae cabecera de mediciones", () => {
    expect(tieneColumnasDeMedicion([FILA_1, FILA_2, PLATO])).toBe(true);
    expect(tieneColumnasDeMedicion([["PLU", "DESCRIPCION", "PRECIO"], [null], [1, "X", 10]])).toBe(false);
    expect(tieneColumnasDeMedicion([])).toBe(false);
  });

  it("sin columna PLU no devuelve nada en vez de inventar filas", () => {
    expect(mapMedicionRows([["REF", "DESCRIPCION"], [null, null], ["A1", "X"]])).toEqual([]);
  });
});

// El importador de productos-maestro es el unico camino por el que estas
// medidas entran desde la UI. Se lee el archivo porque una ruta de Next no se
// puede importar desde un test de node sin arrastrar medio framework.
describe("el importador del maestro carga las mediciones", () => {
  const ruta = path.join(process.cwd(), "src/app/api/productos-maestro/importar/route.ts");
  const route = readFileSync(ruta, "utf8");

  it("lee las filas crudas ademas de los objetos por encabezado", () => {
    // worksheetObjects solo mira la fila 1 y ahi los encabezados de medicion se
    // repiten; sin worksheetRows no hay forma de separar PB de PN.
    expect(route).toContain("worksheetRows");
    expect(route).toContain("mapMedicionRows");
    expect(route).toContain("guardarMediciones");
  });

  it("solo toca las tablas de medidas si el archivo trae esa cabecera", () => {
    expect(route).toContain("tieneColumnasDeMedicion(filasCrudas)");
  });

  it("informa lo cargado en la respuesta y en la auditoria", () => {
    expect(route).toContain("mediciones");
    expect(route).toContain("con medidas");
  });
});

// Una parte que desaparece del archivo (se remidio y ahora son 2 cajas en vez
// de 3) tiene que borrarse, o quedaria una caja fantasma sumando volumen.
describe("guardado de mediciones", () => {
  it("borra las partes que sobran de una medicion anterior", () => {
    const db = readFileSync(path.join(process.cwd(), "src/lib/medidasCajaMasterDb.ts"), "utf8");
    expect(db).toContain("DELETE FROM medidas_caja_master");
    expect(db).toContain("m.parte > v.max_parte");
    // Sin los casts explicitos, en un VALUES los parametros llegan como text y
    // la comparacion revienta con "operator does not exist: integer > text".
    expect(db).toContain("}::text, ");
    expect(db).toContain("}::int)");
    // Y el upsert nunca duplica: la clave es (plu, parte).
    expect(db).toContain("ON CONFLICT (plu, parte) DO UPDATE");
    expect(db).toContain("ON CONFLICT (plu) DO UPDATE");
  });
});
