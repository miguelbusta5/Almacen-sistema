// Lógica pura de Control Montacargas y Resurtido. La fuente de verdad es
// src/lib/montacargas.ts; el port a Nitro (nuxt-app/server/utils/montacargasCalc.ts)
// y la copia cliente (nuxt-app/app/utils/montacargas.ts) los cubre
// montacargasNuxt.test.ts.
import { describe, it, expect } from "vitest";
import {
  calcularCantidadTotal,
  esTipoMovimiento,
  esUbicacionCanonica,
  estadoMovimiento,
  normalizarCodigoProducto,
  normalizarUbicacion,
  pareceEan,
  puedeGestionarMontacargas,
  puedeUsarMontacargas,
  requiereUbicacionInicial,
  validarCaptura,
  validarUbicacion,
} from "@/lib/montacargas";

describe("montacargas — cantidad total", () => {
  // CAJAS × UNIDADES X CAJA de la planilla, más el reguero (unidades sueltas
  // que no vienen en caja master).
  it("suma las cajas completas y las unidades sueltas", () => {
    expect(calcularCantidadTotal(2, 24)).toBe(48);
    expect(calcularCantidadTotal(2, 24, 5)).toBe(53);
    expect(calcularCantidadTotal(13, 144, 0)).toBe(1872);
  });

  it("permite un registro que es solo reguero", () => {
    expect(calcularCantidadTotal(0, 24, 7)).toBe(7);
  });

  it("nunca devuelve negativo ni NaN", () => {
    expect(calcularCantidadTotal(-3, 24)).toBe(0);
    expect(calcularCantidadTotal(Number.NaN, 24)).toBe(0);
    expect(calcularCantidadTotal(2, Number.POSITIVE_INFINITY)).toBe(0);
    expect(calcularCantidadTotal(1, 10, -5)).toBe(10);
  });
});

describe("montacargas — tipos de registro", () => {
  it("reconoce los tres tipos", () => {
    expect(esTipoMovimiento("RECEPCION")).toBe(true);
    expect(esTipoMovimiento("MOVIMIENTO")).toBe(true);
    expect(esTipoMovimiento("RESURTIDO")).toBe(true);
    expect(esTipoMovimiento("OTRO")).toBe(false);
    expect(esTipoMovimiento(undefined)).toBe(false);
  });

  // El contenedor llega sin ubicación previa; un movimiento y un resurtido
  // salen de algún sitio y ese dato es lo que da sentido al registro.
  it("solo movimiento y resurtido exigen ubicación de origen", () => {
    expect(requiereUbicacionInicial("RECEPCION")).toBe(false);
    expect(requiereUbicacionInicial("MOVIMIENTO")).toBe(true);
    expect(requiereUbicacionInicial("RESURTIDO")).toBe(true);
  });
});

describe("montacargas — normalización", () => {
  it("la ubicación conserva un espacio interno pero se pone en mayúsculas", () => {
    expect(normalizarUbicacion(" 05-b-25-03-01 ")).toBe("05-B-25-03-01");
    expect(normalizarUbicacion("zona  de  inspeccion")).toBe("ZONA DE INSPECCION");
  });

  it("el código de producto pierde todos los espacios", () => {
    expect(normalizarCodigoProducto(" 7703596000036 ")).toBe("7703596000036");
    expect(normalizarCodigoProducto("bono 100")).toBe("BONO100");
  });
});

describe("montacargas — PLU vs EAN", () => {
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

describe("montacargas — validación de la ubicación", () => {
  it("exige que no esté vacía", () => {
    expect(validarUbicacion("")).toMatch(/obligatoria/i);
    expect(validarUbicacion("05-B-25-03-01")).toBeNull();
  });

  it("usa la etiqueta que se le pase, para poder hablar del origen", () => {
    expect(validarUbicacion("", "La ubicación inicial")).toMatch(/inicial/i);
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

describe("montacargas — validación de la captura", () => {
  const recepcion = {
    tipo: "RECEPCION" as const,
    codigo: "26403",
    cajas: 2,
    unidadesPorCaja: 24,
    hayReguero: false,
    unidadesSueltas: 0,
  };
  const movimiento = { ...recepcion, tipo: "MOVIMIENTO" as const, ubicacionInicial: "05-B-25-03-01" };

  it("acepta una recepción completa", () => {
    expect(validarCaptura(recepcion)).toBeNull();
  });

  it("acepta un movimiento con ubicación de origen", () => {
    expect(validarCaptura(movimiento)).toBeNull();
  });

  it("rechaza un movimiento sin ubicación de origen", () => {
    expect(validarCaptura({ ...movimiento, ubicacionInicial: "" })).toMatch(/inicial/i);
  });

  it("ignora la ubicación de origen en una recepción", () => {
    expect(validarCaptura({ ...recepcion, ubicacionInicial: "" })).toBeNull();
  });

  it("rechaza un tipo desconocido", () => {
    expect(validarCaptura({ ...recepcion, tipo: "OTRO" })).toMatch(/tipo/i);
  });

  it("exige el código del producto", () => {
    expect(validarCaptura({ ...recepcion, codigo: "  " })).toMatch(/PLU|código/i);
  });

  it("exige unidades por caja enteras y positivas", () => {
    expect(validarCaptura({ ...recepcion, unidadesPorCaja: 0 })).toMatch(/unidades por caja/i);
  });

  // Un registro tiene que mover algo: o cajas completas o unidades sueltas.
  it("rechaza un registro vacío", () => {
    expect(validarCaptura({ ...recepcion, cajas: 0 })).toMatch(/al menos una caja/i);
  });

  it("acepta cero cajas cuando el registro es solo reguero", () => {
    expect(
      validarCaptura({ ...recepcion, cajas: 0, hayReguero: true, unidadesSueltas: 7 }),
    ).toBeNull();
  });

  // Marcar reguero sin decir cuánto deja el registro sin el dato que justifica
  // haberlo marcado.
  it("exige la cantidad cuando se marca reguero", () => {
    expect(validarCaptura({ ...recepcion, hayReguero: true, unidadesSueltas: 0 }))
      .toMatch(/cuántas unidades sueltas/i);
  });

  // Y al revés: unidades sueltas sin el check serían un dato huérfano que no
  // aparece en ningún reporte de reguero.
  it("exige el check cuando se ponen unidades sueltas", () => {
    expect(validarCaptura({ ...recepcion, hayReguero: false, unidadesSueltas: 4 }))
      .toMatch(/marca el reguero/i);
  });

  it("rechaza cantidades no enteras o negativas", () => {
    expect(validarCaptura({ ...recepcion, cajas: -1 })).toMatch(/cajas/i);
    expect(validarCaptura({ ...recepcion, hayReguero: true, unidadesSueltas: -2 }))
      .toMatch(/sueltas/i);
  });
});

describe("montacargas — estado derivado", () => {
  // El estado no es una columna: asignar la ubicación final es lo que cierra.
  it("sin hora de finalización está en curso", () => {
    expect(estadoMovimiento(null)).toBe("EN_CURSO");
    expect(estadoMovimiento(undefined)).toBe("EN_CURSO");
  });

  it("con hora de finalización está cerrado", () => {
    expect(estadoMovimiento(new Date())).toBe("CERRADO");
    expect(estadoMovimiento("2026-09-07T14:00:00.000Z")).toBe("CERRADO");
  });
});

describe("montacargas — permisos", () => {
  it("el montacarguista usa los módulos pero no los gestiona", () => {
    expect(puedeUsarMontacargas("MONTACARGAS")).toBe(true);
    expect(puedeGestionarMontacargas("MONTACARGAS")).toBe(false);
  });

  it("almacenamiento y dirección gestionan", () => {
    for (const rol of ["SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"]) {
      expect(puedeUsarMontacargas(rol)).toBe(true);
      expect(puedeGestionarMontacargas(rol)).toBe(true);
    }
  });

  it("los roles ajenos quedan fuera", () => {
    for (const rol of [
      "TIENDA", "ETIQUETADO", "OPERACIONES_GOURMET", "TRANSPORTISTA",
      // Supervisión de inventario y de transporte quedan fuera a propósito:
      // el trabajo de montacargas no es su área.
      "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE",
      "",
    ]) {
      expect(puedeUsarMontacargas(rol)).toBe(false);
    }
    expect(puedeUsarMontacargas(null)).toBe(false);
    expect(puedeUsarMontacargas(undefined)).toBe(false);
  });
});
