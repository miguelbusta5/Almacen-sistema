// Lógica pura del módulo Estibas (montacargas). La fuente de verdad es
// src/lib/estibas.ts; el port a Nitro (nuxt-app/server/utils/estibasCalc.ts) y la
// copia cliente (nuxt-app/app/utils/estibas.ts) los cubre estibasNuxt.test.ts.
import { describe, it, expect } from "vitest";
import {
  calcularCantidadTotal,
  esUbicacionCanonica,
  estadoEstiba,
  normalizarCodigoProducto,
  normalizarPedido,
  normalizarUbicacion,
  pareceEan,
  puedeGestionarEstibas,
  puedeUsarEstibas,
  validarCapturaEstiba,
  validarPedido,
  validarUbicacion,
} from "@/lib/estibas";

describe("estibas — cantidad total", () => {
  // La columna CANTIDAD TOTAL de la planilla: CAJAS × UNIDADES X CAJA.
  it("multiplica cajas por unidades por caja", () => {
    expect(calcularCantidadTotal(2, 24)).toBe(48);
    expect(calcularCantidadTotal(1, 1)).toBe(1);
    expect(calcularCantidadTotal(13, 144)).toBe(1872);
  });

  it("nunca devuelve negativo ni NaN", () => {
    expect(calcularCantidadTotal(-3, 24)).toBe(0);
    expect(calcularCantidadTotal(Number.NaN, 24)).toBe(0);
    expect(calcularCantidadTotal(2, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("estibas — normalización", () => {
  it("el pedido queda en mayúsculas y sin espacios", () => {
    expect(normalizarPedido(" peddm11887 ")).toBe("PEDDM11887");
    expect(normalizarPedido("ped dm 11887")).toBe("PEDDM11887");
  });

  it("la ubicación conserva un espacio interno pero se pone en mayúsculas", () => {
    expect(normalizarUbicacion(" 05-b-25-03-01 ")).toBe("05-B-25-03-01");
    expect(normalizarUbicacion("zona  de  inspeccion")).toBe("ZONA DE INSPECCION");
  });

  it("el código de producto pierde todos los espacios", () => {
    expect(normalizarCodigoProducto(" 7703596000036 ")).toBe("7703596000036");
    expect(normalizarCodigoProducto("bono 100")).toBe("BONO100");
  });
});

describe("estibas — PLU vs EAN", () => {
  // El escáner lee el EAN (13 dígitos); el PLU histórico puede ser corto o
  // alfanumérico (BONO, BONO100), así que el discriminador es la forma.
  it("reconoce un EAN por ser largo y numérico", () => {
    expect(pareceEan("7703596000036")).toBe(true);
    expect(pareceEan("77035960")).toBe(true);
  });

  it("no confunde un PLU con un EAN", () => {
    expect(pareceEan("26403")).toBe(false);
    expect(pareceEan("3")).toBe(false);
    expect(pareceEan("BONO100")).toBe(false);
  });
});

describe("estibas — validación del pedido", () => {
  it("acepta la nomenclatura real de la empresa", () => {
    expect(validarPedido("PEDDM11887")).toBeNull();
    expect(validarPedido("OVDM4021")).toBeNull();
  });

  it("rechaza formatos que no son pedido", () => {
    expect(validarPedido("")).toMatch(/obligatorio/i);
    expect(validarPedido("11887")).toMatch(/formato/i);
    expect(validarPedido("PEDDM")).toMatch(/formato/i);
    expect(validarPedido("PEDIDODEMUEBLES11887")).toMatch(/formato|largo/i);
  });
});

describe("estibas — validación de la ubicación", () => {
  it("exige que no esté vacía", () => {
    expect(validarUbicacion("")).toMatch(/obligatoria/i);
    expect(validarUbicacion("05-B-25-03-01")).toBeNull();
  });

  // El histórico tiene 2.406 ubicaciones distintas e incluye texto libre
  // (INSPECCION, MUEBLES, ECUADOR). Se aceptan: bloquearlas pararía la operación.
  it("acepta ubicaciones fuera del formato canónico", () => {
    expect(validarUbicacion("INSPECCION")).toBeNull();
    expect(validarUbicacion("MUEBLES")).toBeNull();
  });

  it("distingue la ubicación canónica de la libre para poder marcarla", () => {
    expect(esUbicacionCanonica("05-B-25-03-01")).toBe(true);
    expect(esUbicacionCanonica("04-G1-12-01-24")).toBe(true);
    expect(esUbicacionCanonica("INSPECCION")).toBe(false);
    expect(esUbicacionCanonica("05-B-25-03")).toBe(false);
  });
});

describe("estibas — validación de la captura", () => {
  const base = { pedido: "PEDDM11887", codigo: "26403", cajas: 2, unidadesPorCaja: 24 };

  it("acepta una captura completa", () => {
    expect(validarCapturaEstiba(base)).toBeNull();
  });

  it("normaliza el pedido antes de validarlo", () => {
    expect(validarCapturaEstiba({ ...base, pedido: " peddm11887 " })).toBeNull();
  });

  it("exige cajas y unidades enteras y positivas", () => {
    expect(validarCapturaEstiba({ ...base, cajas: 0 })).toMatch(/cajas/i);
    expect(validarCapturaEstiba({ ...base, cajas: 1.5 })).toMatch(/cajas/i);
    expect(validarCapturaEstiba({ ...base, unidadesPorCaja: 0 })).toMatch(/unidades/i);
  });

  it("exige el código del producto", () => {
    expect(validarCapturaEstiba({ ...base, codigo: "  " })).toMatch(/PLU|código/i);
  });
});

describe("estibas — estado derivado", () => {
  // El estado no es una columna: asignar la ubicación es lo que cierra la estiba.
  it("sin hora de finalización está en curso", () => {
    expect(estadoEstiba(null)).toBe("EN_CURSO");
    expect(estadoEstiba(undefined)).toBe("EN_CURSO");
  });

  it("con hora de finalización está cerrada", () => {
    expect(estadoEstiba(new Date())).toBe("CERRADA");
    expect(estadoEstiba("2026-09-04T14:00:00.000Z")).toBe("CERRADA");
  });
});

describe("estibas — permisos", () => {
  it("el montacarguista usa el módulo pero no lo gestiona", () => {
    expect(puedeUsarEstibas("MONTACARGAS")).toBe(true);
    expect(puedeGestionarEstibas("MONTACARGAS")).toBe(false);
  });

  it("supervisión y dirección gestionan", () => {
    for (const rol of ["SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"]) {
      expect(puedeUsarEstibas(rol)).toBe(true);
      expect(puedeGestionarEstibas(rol)).toBe(true);
    }
  });

  it("los roles ajenos al CEDI quedan fuera", () => {
    for (const rol of [
      "TIENDA", "ETIQUETADO", "OPERACIONES_GOURMET", "TRANSPORTISTA",
      // Supervisión de inventario y de transporte quedan fuera a propósito:
      // el armado de estibas de contenedor no es su área.
      "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE",
      "",
    ]) {
      expect(puedeUsarEstibas(rol)).toBe(false);
    }
    expect(puedeUsarEstibas(null)).toBe(false);
    expect(puedeUsarEstibas(undefined)).toBe(false);
  });
});
