import { describe, expect, it } from "vitest";
import {
  clasificarPorDescripcion,
  derivarTipoOrden,
  duracionInspeccionNetaMinutos,
  duracionMinutos,
  normalizarRotulo,
  ordenInspeccionCompleta,
  pluDesdeEanAmbiente,
  puedeInspeccionar,
  puedePickear,
  resumenOrden,
  puedeCerrarOrden,
  quienCierra,
  totalesLinea,
  validarAgregarPlu,
  volumenOrden,
  validarCodigoOrden,
  validarPasoAInspeccion,
  type EstadoLinea,
} from "@/lib/pickingMuebles";

const linea = (estado: EstadoLinea, plu = "1001") => ({ plu, estado });

describe("codigo de orden", () => {
  it("deriva el tipo del prefijo", () => {
    expect(derivarTipoOrden("TSDM123456")).toBe("TSDM");
    expect(derivarTipoOrden("ovdm998877")).toBe("OVDM");
  });

  it("acepta los dos prefijos, con y sin guion", () => {
    expect(validarCodigoOrden("TSDM123456")).toBeNull();
    expect(validarCodigoOrden("  ovdm-99887  ")).toBeNull();
  });

  it("rechaza lo que no es una orden de NetSuite", () => {
    expect(validarCodigoOrden("")).toMatch(/Escribe/);
    expect(validarCodigoOrden("123456")).toMatch(/TSDM u OVDM/);
    expect(validarCodigoOrden("TSDM")).toMatch(/TSDM u OVDM/);
    // Menos de 3 digitos es casi siempre un escaneo a medias.
    expect(validarCodigoOrden("TSDM12")).toMatch(/TSDM u OVDM/);
  });
});

describe("rotulo", () => {
  it("normaliza sin imponer formato: el patron real aun no esta cerrado", () => {
    expect(normalizarRotulo("  m123134 ")).toBe("M123134");
    expect(normalizarRotulo("M 123 134")).toBe("M123134");
  });
});

describe("permisos", () => {
  it("el operario de picking no entra a inspeccion y viceversa", () => {
    expect(puedePickear("PICKING_MUEBLES")).toBe(true);
    expect(puedeInspeccionar("PICKING_MUEBLES")).toBe(false);
    expect(puedeInspeccionar("INSPECCION_MUEBLES")).toBe(true);
    expect(puedePickear("INSPECCION_MUEBLES")).toBe(false);
  });

  it("gestion entra a los dos", () => {
    for (const role of ["ADMIN", "GERENTE", "SUPERVISOR_ALMACENAMIENTO"]) {
      expect(puedePickear(role)).toBe(true);
      expect(puedeInspeccionar(role)).toBe(true);
    }
  });

  it("un rol ajeno no entra", () => {
    expect(puedePickear("MONTACARGAS")).toBe(false);
    expect(puedeInspeccionar(null)).toBe(false);
  });
});

describe("duraciones", () => {
  it("redondea a minutos y nunca da negativo", () => {
    expect(duracionMinutos("2026-09-12T10:00:00Z", "2026-09-12T10:30:00Z")).toBe(30);
    expect(duracionMinutos("2026-09-12T10:30:00Z", "2026-09-12T10:00:00Z")).toBe(0);
  });

  it("sin fin, no hay duracion (registro en curso)", () => {
    expect(duracionMinutos("2026-09-12T10:00:00Z", null)).toBeNull();
  });

  it("la inspeccion descuenta la ventana de ebanisteria", () => {
    const neta = duracionInspeccionNetaMinutos({
      inspHoraInicio: "2026-09-12T10:00:00Z",
      inspHoraFin: "2026-09-12T11:00:00Z",
      ebanisteriaInicio: "2026-09-12T10:10:00Z",
      ebanisteriaFin: "2026-09-12T10:50:00Z",
    });
    expect(neta).toBe(20);
  });

  it("sin paso por ebanisteria, la neta es la bruta", () => {
    expect(
      duracionInspeccionNetaMinutos({
        inspHoraInicio: "2026-09-12T10:00:00Z",
        inspHoraFin: "2026-09-12T10:25:00Z",
      }),
    ).toBe(25);
  });

  it("con el mueble todavia en el taller la ventana no se descuenta a medias", () => {
    // ebanisteriaFin null → la orden no puede estar cerrada; la neta = bruta.
    expect(
      duracionInspeccionNetaMinutos({
        inspHoraInicio: "2026-09-12T10:00:00Z",
        inspHoraFin: "2026-09-12T10:40:00Z",
        ebanisteriaInicio: "2026-09-12T10:10:00Z",
        ebanisteriaFin: null,
      }),
    ).toBe(40);
  });
});

describe("totales de linea", () => {
  it("multiplica por unidades", () => {
    expect(totalesLinea(3, 0.25, 12.5)).toEqual({ volumenTotalM3: 0.75, pesoTotalKg: 37.5 });
  });

  it("sin medida en el maestro deja null, no cero", () => {
    // Un cero diria que el mueble no ocupa nada y falsearia la capacidad.
    expect(totalesLinea(4, null, null)).toEqual({ volumenTotalM3: null, pesoTotalKg: null });
  });

  it("unidades invalidas cuentan como cero", () => {
    expect(totalesLinea(-2, 0.5, 1).volumenTotalM3).toBe(0);
    expect(totalesLinea(Number.NaN, 0.5, 1).volumenTotalM3).toBe(0);
  });
});

describe("volumen de la orden", () => {
  const cerrada = (v: number | null, p: number | null = null) => ({
    volumenTotalM3: v,
    pesoTotalKg: p,
    horaFin: "2026-09-12T10:00:00Z",
  });

  it("suma solo las lineas cerradas", () => {
    const vol = volumenOrden([
      cerrada(0.5),
      cerrada(0.25),
      { volumenTotalM3: 9, pesoTotalKg: null, horaFin: null },
    ]);
    expect(vol.m3).toBe(0.75);
  });

  it("no inventa un total cuando el PLU no esta medido", () => {
    const vol = volumenOrden([cerrada(0.5), cerrada(null)]);
    expect(vol.m3).toBe(0.5);
    expect(vol.lineasSinMedida).toBe(1);
  });

  it("suma el peso aunque falte el volumen", () => {
    expect(volumenOrden([cerrada(null, 30), cerrada(0.4, 12)]).kg).toBe(42);
  });

  it("una orden recien pasada a inspeccion queda en cero", () => {
    expect(volumenOrden([])).toEqual({ m3: 0, kg: 0, lineasSinMedida: 0 });
  });
});

describe("clasificacion por descripcion", () => {
  it("reconoce los tipos del area", () => {
    expect(clasificarPorDescripcion("SOFA MODULAR 3 PUESTOS")).toBe("SOFA");
    expect(clasificarPorDescripcion("SILLA COMEDOR TAPIZADA")).toBe("SILLA");
    expect(clasificarPorDescripcion("MESA DE CENTRO ROBLE")).toBe("MESA");
    expect(clasificarPorDescripcion("LAMPARA DE PIE TRIPODE")).toBe("LUMINARIA");
    expect(clasificarPorDescripcion("POLTRONA BERGERE LINO")).toBe("POLTRONA");
  });

  // El orden de las reglas es la mitad de la logica: un sofa reclinable es un
  // reclinable, y una poltrona no es una silla.
  it("reclinable gana a sofa", () => {
    expect(clasificarPorDescripcion("SOFA RECLINABLE 3P CUERO")).toBe("RECLINABLE");
  });

  // "COMEDOR" nombra la habitacion: la silla del comedor sigue siendo una silla,
  // pero un "COMEDOR 6 PUESTOS" sin mas es el juego de mesa.
  it("silla gana a comedor, y comedor a secas es mesa", () => {
    expect(clasificarPorDescripcion("SILLA COMEDOR TAPIZADA")).toBe("SILLA");
    expect(clasificarPorDescripcion("COMEDOR 6 PUESTOS NOGAL")).toBe("MESA");
    expect(clasificarPorDescripcion("MESA COMEDOR EXTENSIBLE")).toBe("MESA");
  });

  it("poltrona gana a silla", () => {
    expect(clasificarPorDescripcion("POLTRONA SILLA DE LECTURA")).toBe("POLTRONA");
  });

  it("ignora tildes y minusculas", () => {
    expect(clasificarPorDescripcion("lámpara colgante")).toBe("LUMINARIA");
    expect(clasificarPorDescripcion("Sofá cama")).toBe("SOFA");
  });

  it("lo que no calza cae en OTRO, no se lo inventa", () => {
    expect(clasificarPorDescripcion("PORTARRETRATO 10X15")).toBe("OTRO");
    expect(clasificarPorDescripcion(null)).toBe("OTRO");
    expect(clasificarPorDescripcion("")).toBe("OTRO");
  });
});

describe("quien cierra una orden compartida", () => {
  const p = (usuarioId: string, esCreador: boolean, seUnioAt: string) => ({ usuarioId, esCreador, seUnioAt });

  it("con un solo operario, cierra el creador", () => {
    const solo = [p("a", true, "2026-09-12T08:00:00Z")];
    expect(quienCierra(solo)).toBe("a");
    expect(puedeCerrarOrden(solo, "a", "PICKING_MUEBLES")).toBe(true);
  });

  it("con reasignacion, cierra el que se unio (el que termina)", () => {
    const dos = [p("a", true, "2026-09-12T08:00:00Z"), p("b", false, "2026-09-12T09:30:00Z")];
    expect(quienCierra(dos)).toBe("b");
    expect(puedeCerrarOrden(dos, "b", "PICKING_MUEBLES")).toBe(true);
    expect(puedeCerrarOrden(dos, "a", "PICKING_MUEBLES")).toBe(false);
  });

  it("gestion puede siempre: si el que se unio sale de turno, la orden no se queda abierta", () => {
    const dos = [p("a", true, "2026-09-12T08:00:00Z"), p("b", false, "2026-09-12T09:30:00Z")];
    for (const role of ["ADMIN", "GERENTE", "SUPERVISOR_ALMACENAMIENTO"]) {
      expect(puedeCerrarOrden(dos, "supervisor", role)).toBe(true);
    }
  });

  it("sin participantes no cierra nadie", () => {
    expect(quienCierra([])).toBeNull();
  });
});

describe("transiciones de la orden", () => {
  it("no pasa a inspeccion con un PLU a medias", () => {
    expect(validarPasoAInspeccion([linea("PICKEADA"), linea("EN_PICKING", "1002")]))
      .toMatch(/Termina el PLU en curso/);
  });

  it("no pasa a inspeccion una orden vacia", () => {
    expect(validarPasoAInspeccion([])).toMatch(/al menos un PLU/);
  });

  it("pasa con todos los PLU cerrados", () => {
    expect(validarPasoAInspeccion([linea("PICKEADA"), linea("PICKEADA", "1002")])).toBeNull();
  });

  it("no cierra la inspeccion con un PLU todavia en ebanisteria", () => {
    expect(ordenInspeccionCompleta([linea("LISTO"), linea("EN_EBANISTERIA", "1002")])).toBe(false);
    expect(ordenInspeccionCompleta([linea("LISTO"), linea("LISTO", "1002")])).toBe(true);
  });

  it("una orden sin lineas no cuenta como inspeccionada", () => {
    expect(ordenInspeccionCompleta([])).toBe(false);
  });
});

describe("agregar PLU", () => {
  const linea = (estado: EstadoLinea, plu: string, operarioId: string) => ({ plu, estado, operarioId });

  it("rechaza el duplicado: un PLU es una sola linea por orden", () => {
    expect(validarAgregarPlu([linea("PICKEADA", "1001", "a")], "1001", "a"))
      .toMatch(/ya esta en esta orden/);
  });

  it("rechaza el duplicado aunque lo haya pickeado el companero", () => {
    expect(validarAgregarPlu([linea("PICKEADA", "1001", "b")], "1001", "a"))
      .toMatch(/ya esta en esta orden/);
  });

  it("rechaza escanear otro PLU con uno propio en curso", () => {
    expect(validarAgregarPlu([linea("EN_PICKING", "1001", "a")], "1002", "a"))
      .toMatch(/PLU en curso/);
  });

  // El caso de la reasignacion: dos operarios en la misma orden. Que el otro
  // tenga un PLU abierto no puede bloquearte.
  it("NO bloquea si el PLU en curso es del otro operario", () => {
    expect(validarAgregarPlu([linea("EN_PICKING", "1001", "b")], "1002", "a")).toBeNull();
  });

  it("acepta un PLU nuevo sin nada propio en curso", () => {
    expect(validarAgregarPlu([linea("PICKEADA", "1001", "a")], "1002", "a")).toBeNull();
  });
});

describe("resumen de la orden", () => {
  it("cuenta el progreso de inspeccion", () => {
    const r = resumenOrden([
      linea("LISTO", "1"),
      linea("EN_EBANISTERIA", "2"),
      linea("PICKEADA", "3"),
      linea("EN_INSPECCION", "4"),
    ]);
    expect(r).toMatchObject({
      total: 4,
      inspeccionadas: 1,
      enEbanisteria: 1,
      pendientesInspeccion: 2,
      progreso: 25,
    });
  });

  it("orden vacia no divide por cero", () => {
    expect(resumenOrden([]).progreso).toBe(0);
  });
});

// La pistola lee el codigo de barras de la etiqueta, no el PLU. El 16-09 quedaron
// 18 PLU de la TSDM104386/104387 sin descripcion por eso.
describe("codigo de barras de Ambiente", () => {
  it("saca el PLU del EAN: 770 3596 PLU control", () => {
    expect(pluDesdeEanAmbiente("7703596220243")).toBe("22024");
    expect(pluDesdeEanAmbiente("7703596295036")).toBe("29503");
  });

  it("no inventa un PLU de lo que no es un EAN de Ambiente", () => {
    expect(pluDesdeEanAmbiente("22024")).toBeNull();
    expect(pluDesdeEanAmbiente("7701234220243")).toBeNull();
    expect(pluDesdeEanAmbiente("05-J-12-04-01")).toBeNull();
  });
});

// La pistola lee igual la etiqueta del rack que la del mueble.
describe("una ubicacion no entra como PLU", () => {
  it("detecta ubicaciones del CEDI, completas o a medias", async () => {
    const { pareceUbicacion } = await import("@/lib/pickingMuebles");
    expect(pareceUbicacion("05-J-12-04-01")).toBe(true);
    expect(pareceUbicacion("04-g3-12-01-01")).toBe(true);
    expect(pareceUbicacion(" 02-D-08 ")).toBe(true);
  });

  it("no confunde PLU ni codigos de barras", async () => {
    const { pareceUbicacion } = await import("@/lib/pickingMuebles");
    expect(pareceUbicacion("10072")).toBe(false);
    expect(pareceUbicacion("7703596220243")).toBe(false);
    expect(pareceUbicacion("BONO100")).toBe(false);
  });
});

// Errores de picking: los PLU con error pueden quedar sin revisar; los demas no.
describe("terminar una orden con errores de picking", () => {
  it("exige al menos un error marcado", async () => {
    const { validarTerminarConErrores } = await import("@/lib/pickingMuebles");
    expect(validarTerminarConErrores([{ plu: "1", estado: "LISTO", tieneError: false }])).toMatch(/al menos un error/);
  });

  it("los PLU con error pueden quedar sin revisar", async () => {
    const { validarTerminarConErrores } = await import("@/lib/pickingMuebles");
    expect(validarTerminarConErrores([
      { plu: "1", estado: "LISTO", tieneError: false },
      { plu: "2", estado: "PICKEADA", tieneError: true },
      { plu: "3", estado: "EN_INSPECCION", tieneError: true },
    ])).toBeNull();
  });

  it("los demas tienen que estar inspeccionados", async () => {
    const { validarTerminarConErrores } = await import("@/lib/pickingMuebles");
    expect(validarTerminarConErrores([
      { plu: "1", estado: "PICKEADA", tieneError: false },
      { plu: "2", estado: "PICKEADA", tieneError: true },
    ])).toMatch(/Faltan por inspeccionar 1 PLU sin error \(1\)/);
  });
});
