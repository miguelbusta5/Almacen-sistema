import { describe, expect, it } from "vitest";
import {
  capacidadEquipo,
  derivarTipoOrden,
  duracionInspeccionNetaMinutos,
  duracionMinutos,
  normalizarRotulo,
  ordenInspeccionCompleta,
  puedeInspeccionar,
  puedePickear,
  resumenOrden,
  totalesLinea,
  validarAgregarPlu,
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

describe("capacidad del equipo", () => {
  const cerrada = (v: number | null, p: number | null = null) => ({
    volumenTotalM3: v,
    pesoTotalKg: p,
    horaFin: "2026-09-12T10:00:00Z",
  });

  it("suma solo las lineas cerradas", () => {
    const cap = capacidadEquipo(
      [cerrada(0.5), cerrada(0.25), { volumenTotalM3: 9, pesoTotalKg: null, horaFin: null }],
      3,
    );
    expect(cap.ocupadoM3).toBe(0.75);
    expect(cap.porcentaje).toBe(25);
    expect(cap.tono).toBe("ok");
  });

  it("sin capacidad medida muestra m3 pero no porcentaje", () => {
    // Es el estado real hasta que se midan el Order Picker y el Genie.
    const cap = capacidadEquipo([cerrada(1.2)], null);
    expect(cap.ocupadoM3).toBe(1.2);
    expect(cap.porcentaje).toBeNull();
    expect(cap.tono).toBe("ok");
  });

  it("avisa al 80% y marca critico al pasarse", () => {
    expect(capacidadEquipo([cerrada(8)], 10).tono).toBe("aviso");
    expect(capacidadEquipo([cerrada(10)], 10).tono).toBe("critico");
    const excedido = capacidadEquipo([cerrada(12)], 10);
    expect(excedido.porcentaje).toBe(120);
    expect(excedido.tono).toBe("critico");
  });

  it("cuenta las lineas sin medida para poder avisar que el % va corto", () => {
    const cap = capacidadEquipo([cerrada(0.5), cerrada(null)], 2);
    expect(cap.ocupadoM3).toBe(0.5);
    expect(cap.lineasSinMedida).toBe(1);
  });

  it("una orden recien pasada a inspeccion deja el equipo en cero", () => {
    expect(capacidadEquipo([], 5)).toMatchObject({ ocupadoM3: 0, porcentaje: 0, tono: "ok" });
  });

  it("suma el peso aunque falte el volumen", () => {
    expect(capacidadEquipo([cerrada(null, 30), cerrada(0.4, 12)], 4).pesoKg).toBe(42);
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
  it("rechaza el duplicado: un PLU es una sola linea por orden", () => {
    expect(validarAgregarPlu([linea("PICKEADA", "1001")], "1001")).toMatch(/ya esta en esta orden/);
  });

  it("rechaza escanear otro PLU con uno en curso", () => {
    expect(validarAgregarPlu([linea("EN_PICKING", "1001")], "1002")).toMatch(/PLU en curso/);
  });

  it("acepta un PLU nuevo sin nada en curso", () => {
    expect(validarAgregarPlu([linea("PICKEADA", "1001")], "1002")).toBeNull();
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
