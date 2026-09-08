// Lógica pura de Control Montacargas y Resurtido. La fuente de verdad es
// src/lib/montacargas.ts; el port a Nitro (nuxt-app/server/utils/montacargasCalc.ts)
// y la copia cliente (nuxt-app/app/utils/montacargas.ts) los cubre
// montacargasNuxt.test.ts.
import { describe, it, expect } from "vitest";
import {
  admiteVariosAbiertos,
  calcularCantidadTotal,
  esAyudante,
  esTipoMovimiento,
  esUbicacionCanonica,
  minutosPorUsuario,
  minutosTrabajados,
  normalizarCodigoProducto,
  normalizarUbicacion,
  novedadEsperada,
  pareceEan,
  puedeCrearMovimiento,
  puedeGestionarMontacargas,
  puedeUsarMontacargas,
  requiereUbicacionInicial,
  validarApertura,
  validarCantidades,
  validarUbicacion,
} from "@/lib/montacargas";

describe("montacargas — cantidad total", () => {
  // CAJAS × UNIDADES X CAJA de la planilla, más el reguero (unidades sueltas
  // que no vienen en caja master).
  it("suma las cajas completas y las unidades sueltas", () => {
    expect(calcularCantidadTotal(2, 24)).toBe(48);
    expect(calcularCantidadTotal(2, 24, 5)).toBe(53);
  });

  it("permite un registro que es solo reguero", () => {
    expect(calcularCantidadTotal(0, 24, 7)).toBe(7);
  });

  it("nunca devuelve negativo ni NaN", () => {
    expect(calcularCantidadTotal(-3, 24)).toBe(0);
    expect(calcularCantidadTotal(Number.NaN, 24)).toBe(0);
    expect(calcularCantidadTotal(1, 10, -5)).toBe(10);
  });
});

describe("montacargas — tipos de registro", () => {
  it("reconoce los tres tipos", () => {
    expect(esTipoMovimiento("RECEPCION")).toBe(true);
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

  // En resurtido el operario baja varios PLUs de una pasada y cada uno corre su
  // propio reloj; en recepción y movimientos se trabaja una estiba a la vez.
  it("solo resurtido admite varios registros abiertos", () => {
    expect(admiteVariosAbiertos("RESURTIDO")).toBe(true);
    expect(admiteVariosAbiertos("RECEPCION")).toBe(false);
    expect(admiteVariosAbiertos("MOVIMIENTO")).toBe(false);
  });

  // En recepción no hay ubicación de origen que revisar: lo que puede no cuadrar
  // son las unidades de la estiba.
  it("la novedad esperada depende del tipo", () => {
    expect(novedadEsperada("RECEPCION")).toBe("UNIDADES");
    expect(novedadEsperada("MOVIMIENTO")).toBe("UBICACION_INICIAL");
    expect(novedadEsperada("RESURTIDO")).toBe("UBICACION_INICIAL");
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
  it("reconoce un EAN por ser largo y numérico", () => {
    expect(pareceEan("7703596000036")).toBe(true);
    expect(pareceEan("77035960")).toBe(true);
  });

  it("no confunde un PLU con un EAN", () => {
    expect(pareceEan("26403")).toBe(false);
    expect(pareceEan("BONO100")).toBe(false);
  });
});

describe("montacargas — ubicación", () => {
  it("exige que no esté vacía y usa la etiqueta que se le pase", () => {
    expect(validarUbicacion("")).toMatch(/final.*obligatoria/i);
    expect(validarUbicacion("", "La ubicación inicial")).toMatch(/inicial/i);
    expect(validarUbicacion("05-B-25-03-01")).toBeNull();
  });

  // El histórico tiene 2.406 ubicaciones distintas e incluye texto libre
  // (INSPECCION, MUEBLES, ECUADOR). Se aceptan: bloquearlas pararía la operación.
  it("acepta ubicaciones fuera del formato canónico", () => {
    expect(validarUbicacion("INSPECCION")).toBeNull();
    expect(esUbicacionCanonica("05-B-25-03-01")).toBe(true);
    expect(esUbicacionCanonica("04-G1-12-01-24")).toBe(true);
    expect(esUbicacionCanonica("INSPECCION")).toBe(false);
  });
});

describe("montacargas — apertura del registro", () => {
  // El reloj arranca al digitar el PLU: al abrir solo se tiene eso y, si el tipo
  // lo pide, de dónde sale la mercancía. Las cantidades llegan después.
  it("acepta una recepción solo con el PLU", () => {
    expect(validarApertura({ tipo: "RECEPCION", codigo: "26403" })).toBeNull();
  });

  it("no exige cantidades al abrir", () => {
    expect(validarApertura({ tipo: "RESURTIDO", codigo: "3", ubicacionInicial: "05-B-25-03-01" }))
      .toBeNull();
  });

  it("exige ubicación de origen en movimiento y resurtido", () => {
    expect(validarApertura({ tipo: "MOVIMIENTO", codigo: "3" })).toMatch(/inicial/i);
    expect(validarApertura({ tipo: "RESURTIDO", codigo: "3", ubicacionInicial: " " }))
      .toMatch(/inicial/i);
  });

  it("ignora la ubicación de origen en una recepción", () => {
    expect(validarApertura({ tipo: "RECEPCION", codigo: "3", ubicacionInicial: "" })).toBeNull();
  });

  it("rechaza tipo desconocido o código vacío", () => {
    expect(validarApertura({ tipo: "OTRO", codigo: "3" })).toMatch(/tipo/i);
    expect(validarApertura({ tipo: "RECEPCION", codigo: "  " })).toMatch(/PLU|código/i);
  });
});

describe("montacargas — cantidades", () => {
  const base = { cajas: 2, unidadesPorCaja: 24, hayReguero: false, unidadesSueltas: 0 };

  it("acepta cantidades completas", () => {
    expect(validarCantidades(base)).toBeNull();
  });

  it("exige unidades por caja enteras y positivas", () => {
    expect(validarCantidades({ ...base, unidadesPorCaja: 0 })).toMatch(/unidades por caja/i);
  });

  // Un registro tiene que mover algo: o cajas completas o unidades sueltas.
  it("rechaza un registro vacío", () => {
    expect(validarCantidades({ ...base, cajas: 0 })).toMatch(/al menos una caja/i);
  });

  it("acepta cero cajas cuando el registro es solo reguero", () => {
    expect(validarCantidades({ ...base, cajas: 0, hayReguero: true, unidadesSueltas: 7 }))
      .toBeNull();
  });

  // Marcar reguero sin decir cuánto deja el registro sin el dato que justifica
  // haberlo marcado; y al revés, sueltas sin check son un dato huérfano.
  it("exige coherencia entre el check de reguero y la cantidad", () => {
    expect(validarCantidades({ ...base, hayReguero: true, unidadesSueltas: 0 }))
      .toMatch(/cuántas unidades sueltas/i);
    expect(validarCantidades({ ...base, hayReguero: false, unidadesSueltas: 4 }))
      .toMatch(/marca el reguero/i);
  });
});

describe("montacargas — tiempo por tramos", () => {
  const t = (min: number) => new Date(Date.UTC(2026, 8, 8, 10, min)).toISOString();

  // No es `fin - inicio` del registro: entre medias puede haber una novedad, y
  // verificar no se cronometra.
  it("suma solo los tramos cerrados", () => {
    expect(minutosTrabajados([
      { usuarioId: "a", inicio: t(0), fin: t(10) },
      { usuarioId: "b", inicio: t(30), fin: t(35) },
    ])).toBe(15);
  });

  it("ignora el tramo todavía abierto", () => {
    expect(minutosTrabajados([
      { usuarioId: "a", inicio: t(0), fin: t(10) },
      { usuarioId: "b", inicio: t(30), fin: null },
    ])).toBe(10);
  });

  // La ventana entre el fin de un tramo y el inicio del siguiente (una novedad)
  // queda fuera: es exactamente lo que se quiere no cronometrar.
  it("excluye la ventana de la novedad", () => {
    const total = minutosTrabajados([
      { usuarioId: "a", inicio: t(0), fin: t(5) },
      { usuarioId: "a", inicio: t(60), fin: t(65) },
    ]);
    expect(total).toBe(10);
    expect(total).toBeLessThan(65);
  });

  it("reparte el tiempo por persona, sin cargárselo todo a quien empezó", () => {
    expect(minutosPorUsuario([
      { usuarioId: "operario", inicio: t(0), fin: t(4) },
      { usuarioId: "ayudante", inicio: t(4), fin: t(20) },
    ])).toEqual({ operario: 4, ayudante: 16 });
  });

  it("no cuenta tramos abiertos por usuario", () => {
    expect(minutosPorUsuario([{ usuarioId: "a", inicio: t(0), fin: null }])).toEqual({});
  });
});

describe("montacargas — permisos", () => {
  it("el montacarguista crea y usa, pero no gestiona", () => {
    expect(puedeUsarMontacargas("MONTACARGAS")).toBe(true);
    expect(puedeCrearMovimiento("MONTACARGAS")).toBe(true);
    expect(puedeGestionarMontacargas("MONTACARGAS")).toBe(false);
  });

  // El ayudante entra al módulo (ve su bandeja) pero no inicia registros: los
  // recibe.
  it("el ayudante entra pero no crea", () => {
    expect(puedeUsarMontacargas("OPERARIO_ALMACENAMIENTO")).toBe(true);
    expect(puedeCrearMovimiento("OPERARIO_ALMACENAMIENTO")).toBe(false);
    expect(puedeGestionarMontacargas("OPERARIO_ALMACENAMIENTO")).toBe(false);
    expect(esAyudante("OPERARIO_ALMACENAMIENTO")).toBe(true);
    expect(esAyudante("MONTACARGAS")).toBe(false);
  });

  it("almacenamiento y dirección gestionan", () => {
    for (const rol of ["SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"]) {
      expect(puedeUsarMontacargas(rol)).toBe(true);
      expect(puedeCrearMovimiento(rol)).toBe(true);
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
  });
});
