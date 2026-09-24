// Proyección diaria de resurtido (fase 7, 23-09).
//
// Pedido del CEDI: «por día la cantidad de tareas realizadas, tanto del
// resurtido como de los pendientes, tanto del operario como del ayudante (el
// que comienza y el que termina)», para proyectar cuántas caben en un turno.
// Desde el 24-09 el registro cuenta a TODOS los que lo tuvieron.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as indicadoresLib from "@/lib/indicadores";
import {
  MARGEN_FUERA_TURNO_SEG,
  recortarAlTurno,
  cerradoPor,
  cierresPorDiaYPersona,
  diaDeTurnoDeInstante,
  equipoPorDia,
  iniciadoPor,
  participantesDe,
  proyeccionDiaria,
  type CierreResurtido,
  type VentanaTurno,
} from "@/lib/indicadores";

const personas = [
  { id: "juan", nombre: "Juan" },
  { id: "pedro", nombre: "Pedro" },
];
const rango = { desde: "2026-09-21", hasta: "2026-09-23" };
// 10:00 de Bogotá del día dado.
const a = (dia: string, hora = 15) => new Date(`${dia}T${String(hora).padStart(2, "0")}:00:00Z`);
// `con`: los demás que lo tuvieron (además de quien lo cerró).
const cierre = (usuarioId: string, cuando: Date, tipo: "tarea" | "pendiente" | "movimiento" = "tarea", con: string[] = []): CierreResurtido =>
  ({ usuarioId, participantes: [...con, usuarioId], cuando, tipo });

describe("quién empezó, quién cerró y quiénes la tuvieron", () => {
  const tramos = [{ usuarioId: "pedro", orden: 2 }, { usuarioId: "juan", orden: 1 }, { usuarioId: "juan", orden: 3 }];
  it("por orden de tramo, aunque lleguen desordenados", () => {
    expect(iniciadoPor(tramos)).toBe("juan");
    expect(cerradoPor(tramos, "x")).toBe("juan");
    expect(participantesDe(tramos, "x")).toEqual(["juan", "pedro"]);
  });
  it("sin tramos: el respaldo cierra y es el único que la tuvo", () => {
    expect(cerradoPor([], "responsable")).toBe("responsable");
    expect(iniciadoPor([])).toBeNull();
    expect(participantesDe([], "responsable")).toEqual(["responsable"]);
  });
});

describe("cierres por día y persona", () => {
  it("separa tareas y pendientes, y suma el total", () => {
    const r = cierresPorDiaYPersona({
      personas, turnos: [], ...rango,
      cierres: [cierre("juan", a("2026-09-22")), cierre("juan", a("2026-09-22")), cierre("juan", a("2026-09-22"), "pendiente")],
    });
    expect(r).toEqual([{ dia: "2026-09-22", usuarioId: "juan", nombre: "Juan", tareas: 2, pendientes: 1, movimientos: 0, total: 3, compartidas: 0 }]);
  });

  it("Juan empieza y Pedro cierra: a los dos les suma una; el equipo cuenta una", () => {
    const cierres = [cierre("pedro", a("2026-09-22"), "tarea", ["juan"])];
    const r = cierresPorDiaYPersona({ personas, turnos: [], ...rango, cierres });
    expect(r.find((f) => f.usuarioId === "pedro")).toMatchObject({ tareas: 1, total: 1, compartidas: 1 });
    expect(r.find((f) => f.usuarioId === "juan")).toMatchObject({ tareas: 1, total: 1, compartidas: 1 });
    expect(equipoPorDia({ personas, turnos: [], ...rango, cierres })).toEqual([
      { dia: "2026-09-22", tareas: 1, pendientes: 0, movimientos: 0, total: 1 },
    ]);
  });

  it("si la hizo sola no es compartida", () => {
    const r = cierresPorDiaYPersona({ personas, turnos: [], ...rango, cierres: [cierre("juan", a("2026-09-22"), "pendiente")] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ pendientes: 1, compartidas: 0 });
  });

  it("la madrugada del turno de noche cuenta para el día en que empezó", () => {
    // Turno del 21 de 18:00 a 06:00 (Bogotá) = 23:00Z del 21 a 11:00Z del 22.
    const turnos: VentanaTurno[] = [{ usuarioId: "juan", dia: "2026-09-21", inicio: new Date("2026-09-21T23:00:00Z"), fin: new Date("2026-09-22T11:00:00Z") }];
    const tresAm = new Date("2026-09-22T08:00:00Z"); // 3:00 del 22 en Bogotá
    expect(diaDeTurnoDeInstante(tresAm, turnos, rango.desde, rango.hasta)).toBe("2026-09-21");
    const r = cierresPorDiaYPersona({ personas, turnos, ...rango, cierres: [cierre("juan", tresAm)] });
    expect(r[0]!.dia).toBe("2026-09-21");
    // El turno de otra persona no mueve el día de Juan.
    const ajeno = cierresPorDiaYPersona({ personas, turnos: [{ ...turnos[0]!, usuarioId: "pedro" }], ...rango, cierres: [cierre("juan", tresAm)] });
    expect(ajeno[0]!.dia).toBe("2026-09-22");
  });

  it("solo salen las personas pedidas (respeta el filtro de turno)", () => {
    const soloJuan = [{ id: "juan", nombre: "Juan" }];
    const cierres = [cierre("pedro", a("2026-09-22"), "tarea", ["juan"]), cierre("pedro", a("2026-09-22"))];
    const r = cierresPorDiaYPersona({ personas: soloJuan, turnos: [], ...rango, cierres });
    expect(r).toEqual([{ dia: "2026-09-22", usuarioId: "juan", nombre: "Juan", tareas: 1, pendientes: 0, movimientos: 0, total: 1, compartidas: 1 }]);
    // El equipo del turno: solo los registros en que estuvo alguien del turno.
    expect(equipoPorDia({ personas: soloJuan, turnos: [], ...rango, cierres })[0]!.total).toBe(1);
  });

  it("ordena del día más reciente al más viejo", () => {
    const r = cierresPorDiaYPersona({ personas, turnos: [], ...rango, cierres: [cierre("juan", a("2026-09-21")), cierre("juan", a("2026-09-23"))] });
    expect(r.map((f) => f.dia)).toEqual(["2026-09-23", "2026-09-21"]);
  });
});

describe("movimientos de Control Montacargas", () => {
  it("cuentan en su columna y en el total de todos los que los tuvieron", () => {
    const r = cierresPorDiaYPersona({
      personas, turnos: [], ...rango,
      cierres: [cierre("juan", a("2026-09-22"), "movimiento"), cierre("pedro", a("2026-09-22"), "movimiento", ["juan"]), cierre("juan", a("2026-09-22"))],
    });
    expect(r.find((f) => f.usuarioId === "juan")).toMatchObject({ tareas: 1, movimientos: 2, total: 3, compartidas: 1 });
    expect(r.find((f) => f.usuarioId === "pedro")).toMatchObject({ movimientos: 1, total: 1, compartidas: 1 });
    expect(proyeccionDiaria(r).find((p) => p.usuarioId === "juan")).toMatchObject({ movimientosDia: 2, totalDia: 3 });
  });
});

describe("proyección", () => {
  it("promedia por día trabajado, no por días del rango", () => {
    const filas = cierresPorDiaYPersona({
      personas, turnos: [], ...rango,
      cierres: [
        ...Array.from({ length: 30 }, () => cierre("juan", a("2026-09-21"))),
        ...Array.from({ length: 20 }, () => cierre("juan", a("2026-09-23"))),
        ...Array.from({ length: 5 }, () => cierre("juan", a("2026-09-23"), "pendiente")),
        cierre("pedro", a("2026-09-23"), "tarea", ["juan"]),
      ],
    });
    const [juan, pedro] = proyeccionDiaria(filas);
    // 22-09 no trabajó: el promedio es sobre 2 días, no 3.
    expect(juan).toMatchObject({ nombre: "Juan", dias: 2, tareasDia: 25.5, pendientesDia: 2.5, totalDia: 28, maxTotal: 30, compartidasDia: 0.5 });
    expect(pedro).toMatchObject({ dias: 1, totalDia: 1, compartidasDia: 1 });
  });

  it("vacío sin cierres", () => {
    expect(proyeccionDiaria([])).toEqual([]);
  });
});

describe("unidades: la persona suma todo lo que tuvo, el equipo cada registro una vez", () => {
  it("un registro de dos personas: 10 a cada una y 10 al equipo", () => {
    const personasMedidas = [{ id: "juan", nombre: "Juan", rol: "" }, { id: "pedro", nombre: "Pedro", rol: "" }];
    const cuando = a("2026-09-22");
    const r = indicadoresLib.agregarIndicadores({
      personas: personasMedidas, tiempos: [], ventanas: [], ...rango,
      unidades: [
        { usuarioId: "juan", cuando, unidades: 10, registro: "m:1" },
        { usuarioId: "pedro", cuando, unidades: 10, registro: "m:1" },
        { usuarioId: "pedro", cuando, unidades: 4, registro: "m:2" },
      ],
    });
    expect(r.personas.find((p) => p.id === "juan")!.unidades).toBe(10);
    expect(r.personas.find((p) => p.id === "pedro")!.unidades).toBe(14);
    expect(r.resumen.unidades).toBe(14);
  });
});

describe("el endpoint y la pantalla", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  const api = leer("nuxt-app/server/api/indicadores/index.get.ts");
  const vista = leer("nuxt-app/app/components/indicadores/CierresPorDia.vue");

  it("trae el orden de los tramos e incluye los pendientes", () => {
    expect(api.match(/tramos: \{ select: \{ usuarioId: true, inicio: true, fin: true, orden: true \} \}/g)).toHaveLength(2);
    expect(api).toContain("const cierresPendientes: CierreResurtido[] = pendientes");
    expect(api).toContain("cierres: [...cierresTareas, ...cierresPendientes, ...cierresMovimientos]");
    // Movimientos de Control Montacargas sí; la recepción va por contenedor.
    expect(api).toContain(".filter((m) => m.tipo !== 'RECEPCION' && enRango(m.horaFinalizacion))");
    expect(api).toContain("proyeccion: proyeccionDiaria(cierresDiarios)");
    expect(api).toContain("equipoDiario: equipoPorDia({");
  });

  it("acredita a todos los que lo tuvieron y el equipo no repite", () => {
    expect(api).toContain("participantes: participantesDe(");
    expect(api).not.toContain("iniciadoPorId");
    expect(api).toContain("registro: `m:${m.id}`");
  });

  it("la pantalla usa las piezas del sistema y explica la regla", () => {
    expect(vista).toContain("IndicadoresTarjeta");
    expect(vista).toContain("IndicadoresTabla");
    expect(vista).toContain("'Compartidas'");
    expect(vista).toContain("Un registro cuenta a todos los que lo tuvieron");
    expect(vista).toContain("props.equipo");
    expect(leer("nuxt-app/app/components/indicadores/Module.vue")).toContain(':equipo="equipoDiario"');
  });
});

describe("fuera de turno: se recorta al fin del turno + 1 h", () => {
  // Turno de EYDER: 9:00 a 17:00 (Bogotá) del 22-09.
  const turno: VentanaTurno = { usuarioId: "eyder", dia: "2026-09-22", inicio: new Date("2026-09-22T14:00:00Z"), fin: new Date("2026-09-22T22:00:00Z") };
  const t = (ini: string, fin: string, usuarioId = "eyder") => ({ usuarioId, inicio: new Date(ini), fin: new Date(fin), tipo: "resurtido" });

  it("las tareas que le pasaron a las 14:45 y corrieron hasta las 20:02 cuentan hasta las 18:00", () => {
    expect(MARGEN_FUERA_TURNO_SEG).toBe(3600);
    const r = recortarAlTurno(t("2026-09-22T19:45:00Z", "2026-09-23T01:02:00Z"), [turno]);
    expect(r.fin.toISOString()).toBe("2026-09-22T23:00:00.000Z"); // 18:00 Bogotá
    expect(r.tipo).toBe("resurtido"); // conserva todo lo demás
  });

  it("la tarea general olvidada toda la noche ya no se borra: cuenta hasta la salida + 1 h", () => {
    const olvidada = t("2026-09-22T14:03:00Z", "2026-09-23T11:00:00Z"); // 9:03 → 6:00 del otro día
    expect(indicadoresLib.tramoImposible(olvidada)).toBe(true); // antes se descartaba entera
    const r = recortarAlTurno(olvidada, [turno]);
    expect(r.fin.toISOString()).toBe("2026-09-22T23:00:00.000Z");
    expect(indicadoresLib.tramoImposible(r)).toBe(false);
  });

  it("dentro del turno o del margen no se toca; sin turno tampoco", () => {
    const dentro = t("2026-09-22T15:00:00Z", "2026-09-22T22:40:00Z"); // hasta 17:40
    expect(recortarAlTurno(dentro, [turno])).toBe(dentro);
    const sinTurno = t("2026-09-22T19:45:00Z", "2026-09-23T01:02:00Z", "otro");
    expect(recortarAlTurno(sinTurno, [turno])).toBe(sinTurno);
    // Llegó 30 min antes: es de ese turno.
    const temprano = t("2026-09-22T13:30:00Z", "2026-09-23T02:00:00Z");
    expect(recortarAlTurno(temprano, [turno]).fin.toISOString()).toBe("2026-09-22T23:00:00.000Z");
  });

  it("el endpoint recorta antes de calcular", () => {
    const api = readFileSync(path.join(process.cwd(), "nuxt-app/server/api/indicadores/index.get.ts"), "utf8");
    expect(api).toContain("tiempos.splice(0, tiempos.length, ...tiempos.map((t) => recortarAlTurno(t, ventanas)))");
    expect(api.indexOf("recortarAlTurno(t, ventanas)")).toBeLessThan(api.indexOf("agregarIndicadores({"));
  });
});
