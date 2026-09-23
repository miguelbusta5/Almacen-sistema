// Analítica de muebles (23-09): completadas, ciudades, PLU, proyección del
// turno, cuellos de botella, horas pico, calidad y mezcla.
//
// El cálculo vive en nuxt-app y no tiene gemelo en src/lib: se carga con
// cargarNuxt (nunca import de nuxt-app, ver apoyo/nuxt.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as indicadores from "@/lib/indicadores";
import { cargarNuxt } from "./apoyo/nuxt";

const calc = cargarNuxt("utils/mueblesAnaliticaCalc.ts", { "./indicadoresCalc": indicadores });
const { analiticaMuebles, capacidadTurno, diaSemanaIso, medianaMuebles, medirOrden } = calc;

// Hora de Bogotá → Date (UTC-5).
const t = (dia: string, hora: number, min = 0) =>
  new Date(`${dia}T${String(hora + 5).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`);

let n = 0;
function linea(ordenId: string, o: Partial<any> = {}) {
  return {
    ordenId, plu: "100", descripcion: "SILLA", unidades: 1, operarioId: "op1",
    horaInicio: t("2026-09-22", 8), horaFin: t("2026-09-22", 8, 5), pausaSegundos: 0,
    inspectorId: "in1", inspHoraInicio: t("2026-09-22", 10), inspHoraFin: t("2026-09-22", 10, 20),
    inspMin: 20, ebanisteriaInicio: null, averiado: false, volumenTotalM3: 1, pesoTotalKg: 10, ...o,
  };
}
function orden(o: Partial<any> = {}) {
  const id = o.id ?? `o${++n}`;
  return {
    id, codigo: `OVDM${n}`, tipoOrden: "OVDM", estado: "ENTREGADA_TRANSPORTE",
    horaInicio: t("2026-09-22", 8), horaPasoInspeccion: t("2026-09-22", 8, 10),
    horaFinInspeccion: t("2026-09-22", 10, 20), entregadaTransporteAt: t("2026-09-22", 11),
    ciudadEnvio: "MEDELLIN", pausaSegundos: 0, errores: 0, pendientes: 0,
    lineas: [linea(id)], ...o,
  };
}
const correr = (ordenes: any[], extra: Partial<any> = {}) => analiticaMuebles({
  ordenes, lineasPeriodo: ordenes.flatMap((o) => o.lineas), desde: "2026-09-21", hasta: "2026-09-23", ...extra,
});

describe("utilidades", () => {
  it("día ISO de la semana", () => {
    expect(diaSemanaIso("2026-09-21")).toBe(1); // lunes
    expect(diaSemanaIso("2026-09-25")).toBe(5); // viernes
    expect(diaSemanaIso("2026-09-27")).toBe(7); // domingo
  });
  it("mediana", () => {
    expect(medianaMuebles([])).toBeNull();
    expect(medianaMuebles([5, 1, 3])).toBe(3);
    expect(medianaMuebles([1, 2, 3, 100])).toBe(2.5);
  });
});

describe("cada orden, por etapa", () => {
  it("picking sin pausa, espera, inspección de reloj y de trabajo, espera a entrega y lead time", () => {
    const o = orden({ pausaSegundos: 120, lineas: [
      linea("x", { inspHoraInicio: t("2026-09-22", 9), inspHoraFin: t("2026-09-22", 9, 30), inspMin: 12 }),
      linea("x", { plu: "200", inspHoraInicio: t("2026-09-22", 9, 40), inspHoraFin: t("2026-09-22", 10, 20), inspMin: 8 }),
    ] });
    const m = medirOrden(o);
    expect(m.pickingMin).toBe(8); // 10 min - 2 de pausa
    expect(m.esperaInspeccionMin).toBe(50); // 8:10 → 9:00
    expect(m.inspeccionRelojMin).toBe(80); // 9:00 → 10:20
    expect(m.inspeccionTrabajoMin).toBe(20); // 12 + 8: lo que cuenta para capacidad
    expect(m.esperaEntregaMin).toBe(40);
    expect(m.leadTimeMin).toBe(180);
    expect(m.plus).toBe(2);
  });
});

describe("completadas: inspeccionadas y entregadas, cada una en su día", () => {
  it("cuenta por el día de su evento y promedia por día con actividad", () => {
    const a = correr([
      orden(),
      orden({ horaFinInspeccion: t("2026-09-22", 17), entregadaTransporteAt: t("2026-09-23", 7) }),
      orden({ estado: "INSPECCIONADA", entregadaTransporteAt: null }),
    ]);
    const d = Object.fromEntries(a.dias.map((x: any) => [x.dia, x]));
    expect(d["2026-09-22"]).toMatchObject({ inspeccionadas: 3, entregadas: 1 });
    expect(d["2026-09-23"]).toMatchObject({ inspeccionadas: 0, entregadas: 1 });
    expect(d["2026-09-21"]).toMatchObject({ inspeccionadas: 0, entregadas: 0 });
    // 21-09 sin nada no baja el promedio.
    expect(a.resumen).toMatchObject({ inspeccionadas: 3, entregadas: 2, diasActivos: 2, inspeccionadasDia: 3, entregadasDia: 1 });
    expect(a.ordenes).toHaveLength(3);
  });

  it("lo que salió antes del rango no cuenta", () => {
    const vieja = orden({ horaFinInspeccion: t("2026-09-18", 10), entregadaTransporteAt: t("2026-09-18", 11) });
    expect(correr([vieja]).resumen).toMatchObject({ inspeccionadas: 0, entregadas: 0 });
  });
});

describe("ciudades", () => {
  it("total, promedio por día con entregas y parte del total", () => {
    const a = correr([
      orden(), orden(), orden({ ciudadEnvio: "BOGOTA" }),
      orden({ entregadaTransporteAt: t("2026-09-23", 9) }),
      orden({ ciudadEnvio: null }),
    ]);
    const med = a.ciudades.find((c: any) => c.ciudad === "MEDELLIN");
    expect(med).toMatchObject({ ordenes: 3, promedioDia: 1.5, porcentaje: 60 });
    expect(a.ciudades.map((c: any) => c.ciudad)).toContain("SIN CIUDAD");
    expect(a.ciudades[0].ciudad).toBe("MEDELLIN");
  });
});

describe("PLU más pickeados", () => {
  it("por veces, con órdenes distintas y unidades", () => {
    const o1 = orden({ id: "a", lineas: [linea("a", { plu: "5972", unidades: 4 })] });
    const o2 = orden({ id: "b", lineas: [linea("b", { plu: "5972", unidades: 6 }), linea("b", { plu: "1" })] });
    const a = correr([o1, o2]);
    expect(a.topPlus[0]).toMatchObject({ plu: "5972", veces: 2, ordenes: 2, unidades: 10, promedioPickingMin: 5 });
  });
});

describe("proyección del turno", () => {
  it("capacidad = personas × minutos del turno / minutos por orden; manda la etapa más lenta", () => {
    expect(capacidadTurno({ horas: 9, operarios: 2, inspectores: 4, pickingMin: 9, inspeccionMin: 54 }))
      .toEqual({ picking: 120, inspeccion: 40, capacidad: 40 });
    expect(capacidadTurno({ horas: 8, operarios: 2, inspectores: 4, pickingMin: 9, inspeccionMin: 54 }).capacidad).toBe(35);
    expect(capacidadTurno({ horas: 9, operarios: null, inspectores: 4, pickingMin: 9, inspeccionMin: 54 }).capacidad).toBe(40);
    expect(capacidadTurno({ horas: 9, operarios: null, inspectores: null, pickingMin: 9, inspeccionMin: 54 }).capacidad).toBeNull();
  });

  it("9 h de lunes a jueves, 8 h el viernes y la semana; separa por tipo", () => {
    const ords = [
      ...Array.from({ length: 4 }, () => orden()),
      orden({ tipoOrden: "TSDM", horaPasoInspeccion: t("2026-09-22", 8, 30),
        lineas: [linea("t", { inspMin: 60 }), linea("t", { plu: "2", inspMin: 60 })] }),
    ];
    const p = correr(ords).proyeccion;
    // Picking: (4×10 + 30)/5 = 14 min. Inspección: (4×20 + 120)/5 = 40 min. 1 operario, 1 inspector.
    expect(p).toMatchObject({ operariosDia: 1, inspectoresDia: 1, pickingMinMezcla: 14, inspeccionMinMezcla: 40, cuello: "inspeccion" });
    expect(p.jornadas.map((j: any) => [j.etiqueta, j.horas, j.capacidad])).toEqual([["Lunes a jueves", 9, 13], ["Viernes", 8, 12]]);
    expect(p.semana).toBe(13 * 4 + 12);
    const tsdm = p.porTipo.find((x: any) => x.tipoOrden === "TSDM");
    expect(tsdm).toMatchObject({ muestra: 1, porcentajeMezcla: 20, plusPorOrden: 2, pickingMin: 30, inspeccionMin: 120, capacidad9h: 4 });
    expect(p.realDia).toBe(5);
  });

  it("la ocupación compara lo medido con las horas del turno de ese día", () => {
    // Un inspector, 20 min de inspección un martes (9 h) → 20 / 540.
    const p = correr([orden()]).proyeccion;
    expect(p.ocupacionInspeccion).toBe(3.7);
  });
});

describe("horas pico, calidad y mezcla", () => {
  it("heatmap por día de la semana y hora de Bogotá", () => {
    const a = correr([orden(), orden({ lineas: [linea("z", { horaInicio: t("2026-09-22", 8, 40) })] })]);
    const celda = a.horasPico.celdas.find((c: any) => c.diaSemana === 2 && c.hora === 8);
    expect(celda.plus).toBe(2);
    expect(a.horasPico.maximo).toBe(2);
    expect(a.horasPico.porDiaSemana.find((d: any) => d.diaSemana === 2)).toMatchObject({ plus: 2, ordenes: 2, dias: 1 });
  });

  it("órdenes perfectas y con novedad, sobre las inspeccionadas", () => {
    const a = correr([
      orden(), orden({ errores: 1 }), orden({ pendientes: 2 }),
      orden({ lineas: [linea("e", { ebanisteriaInicio: t("2026-09-22", 9) })] }),
      orden({ lineas: [linea("v", { averiado: true })] }),
    ]);
    expect(a.calidad).toEqual({ ordenes: 5, conError: 1, conEbanisteria: 1, conAveria: 1, conPendientes: 1, perfectas: 1 });
  });

  it("mezcla por tipo con PLU por orden y m³", () => {
    const a = correr([orden(), orden(), orden({ tipoOrden: "TSDM", lineas: [linea("t"), linea("t", { plu: "2" }), linea("t", { plu: "3" })] })]);
    const tsdm = a.mezcla.find((m: any) => m.tipoOrden === "TSDM");
    expect(tsdm).toMatchObject({ ordenes: 1, plusPorOrden: 3, m3: 3 });
    expect(a.mezcla.reduce((s: number, m: any) => s + m.porcentaje, 0)).toBeCloseTo(100, 0);
  });
});

describe("endpoint y pantalla", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  const api = leer("nuxt-app/server/api/indicadores-muebles/analitica.get.ts");
  const vista = leer("nuxt-app/app/components/indicadores-muebles/Analitica.vue");
  const modulo = leer("nuxt-app/app/components/indicadores-muebles/Module.vue");

  it("solo supervisión, rango acotado y la inspección repartida", () => {
    expect(api).toContain("if (!esGestionMuebles(actor.role))");
    expect(api).toContain("MAX_DIAS");
    expect(api).toContain("inspeccionRepartida(todas)");
    expect(api).toContain("erroresPicking: { where: { deletedAt: null } }");
  });

  it("la pestaña Analítica carga su endpoint solo al abrirse", () => {
    expect(modulo).toContain("<IndicadoresMueblesAnalitica");
    expect(modulo).toContain("API_ANALITICA_MUEBLES");
    expect(modulo).toMatch(/watch\(pestana,/);
  });

  it("la pantalla usa las piezas del sistema y explica la proyección", () => {
    for (const x of ["IndicadoresTarjeta", "IndicadoresBarrasH", "IndicadoresTabla", "IndicadoresLineaDiaria"]) expect(vista).toContain(x);
    expect(vista).toContain("es el techo, no la meta");
    expect(vista).toContain("Cuello de botella");
    expect(vista).not.toMatch(/#[0-9a-fA-F]{6}/); // todo color sale de tokens
  });
});
