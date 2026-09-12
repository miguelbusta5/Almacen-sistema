import { describe, expect, it } from "vitest";
import {
  cruzaMedianoche,
  duracionTurnoMin,
  efectividad,
  emparejarUsuario,
  mapCuadroTurnos,
  parseHora,
  parseRangoTurno,
  ventanaTurno,
} from "@/lib/turnos";

// Filas tal como vienen del cuadro real (HORARIO ALMACENAMIENTO 2026.xlsx).
const CUADRO = [
  ["", "DESDE 13 SEPT HASTA 26 SEPT", "DESDE 13 SEPT HASTA 26 SEPT"],
  ["", "HORARIO ALMACENAMIENTO ", "HORARIO ALMACENAMIENTO "],
  ["", "TURNO # 1", "TURNO # 1"],
  ["", "OPERARIO ", "LUNES ", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"],
  ["", "EDUARDO ZURITA", "6am-3:30pm", "6am-3pm", "6am-3pm", "6am-3pm", "6am-2pm", "DESCANSO"],
  ["", "OSSA OSPINA ANDRES FELIPE", "6am-3:30pm", "6am-3pm", "6am-3pm", "6am-3pm", "6am-2pm", "DESCANSO"],
  ["", "", "", "", "", "", "", ""],
  ["", "HORARIO ALMACENAMIENTO ", "HORARIO ALMACENAMIENTO "],
  ["", "OPERARIO ", "DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"],
  ["", "HERNANDO G", "8:30pm-6am", "9pm-6am", "9pm-6am", "9pm-6am", "10pm-6am", "DESCANSO"],
];

describe("cuadro de turnos — leer el archivo", () => {
  it("saca una fila por persona con sus días", () => {
    const filas = mapCuadroTurnos(CUADRO);
    expect(filas.map((f) => f.nombre)).toEqual([
      "EDUARDO ZURITA",
      "OSSA OSPINA ANDRES FELIPE",
      "HERNANDO G",
    ]);
    // Lunes a viernes: el sábado es descanso y no deja fila.
    expect(filas[0].dias).toHaveLength(5);
    expect(filas[0].dias[0]).toEqual({ diaSemana: 1, inicioMin: 6 * 60, finMin: 15 * 60 + 30 });
  });

  // Las filas de título repiten el mismo texto en toda la fila.
  it("no confunde los títulos con personas", () => {
    const nombres = mapCuadroTurnos(CUADRO).map((f) => f.nombre);
    expect(nombres).not.toContain("HORARIO ALMACENAMIENTO");
    expect(nombres).not.toContain("TURNO # 1");
  });

  // El turno de la noche empieza un día y termina al siguiente.
  it("lee el turno de noche y sabe que cruza la medianoche", () => {
    const noche = mapCuadroTurnos(CUADRO).find((f) => f.nombre === "HERNANDO G")!;
    // El bloque de noche empieza en domingo.
    expect(noche.dias[0]).toEqual({ diaSemana: 0, inicioMin: 20 * 60 + 30, finMin: 6 * 60 });
    expect(cruzaMedianoche(noche.dias[0]!)).toBe(true);
    expect(duracionTurnoMin(noche.dias[0]!)).toBe(9 * 60 + 30);
  });

  it("el miércoles con tilde es el mismo día", () => {
    const noche = mapCuadroTurnos(CUADRO).find((f) => f.nombre === "HERNANDO G")!;
    expect(noche.dias.map((d) => d.diaSemana)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("cuadro de turnos — horas", () => {
  it("entiende las horas como las escribe operación", () => {
    expect(parseHora("6am")).toBe(360);
    expect(parseHora("3:30pm")).toBe(930);
    expect(parseHora("12pm")).toBe(720);
    expect(parseHora("12am")).toBe(0);
    expect(parseHora("mediodia")).toBeNull();
  });

  it("un descanso no es un turno", () => {
    expect(parseRangoTurno("DESCANSO")).toBeNull();
    expect(parseRangoTurno("")).toBeNull();
    expect(parseRangoTurno("6am")).toBeNull();
    expect(parseRangoTurno("7am-12pm")).toEqual({ inicioMin: 420, finMin: 720 });
  });

  // La jornada se compara contra el reloj: tiene que caer en hora de Bogotá.
  it("la ventana del turno está en hora de Bogotá", () => {
    const v = ventanaTurno("2026-09-14", { inicioMin: 6 * 60, finMin: 15 * 60 + 30 });
    expect(v.inicio.toISOString()).toBe("2026-09-14T11:00:00.000Z");
    expect(v.fin.toISOString()).toBe("2026-09-14T20:30:00.000Z");
  });

  it("el turno de noche termina al día siguiente", () => {
    const v = ventanaTurno("2026-09-14", { inicioMin: 21 * 60, finMin: 6 * 60 });
    expect(v.inicio.toISOString()).toBe("2026-09-15T02:00:00.000Z");
    expect(v.fin.toISOString()).toBe("2026-09-15T11:00:00.000Z");
  });
});

describe("cuadro de turnos — a quién corresponde cada nombre", () => {
  const usuarios = [
    { id: "u1", nombre: "Felipe Ossa" },
    { id: "u2", nombre: "JOEL DOMIGUEZ" },
    { id: "u3", nombre: "Hernando" },
    { id: "u4", nombre: "Hernando G" },
    { id: "u5", nombre: "carlos ibarra" },
    { id: "u6", nombre: "CARLOS CAMAÑO" },
  ];

  it("encuentra a la persona aunque el nombre venga completo o al revés", () => {
    expect(emparejarUsuario("OSSA OSPINA ANDRES FELIPE", usuarios)?.id).toBe("u1");
    expect(emparejarUsuario("CARLOS IBARRA", usuarios)?.id).toBe("u5");
  });

  // El sistema tiene la errata "DOMIGUEZ"; el archivo trae "DOMINGUEZ".
  it("aguanta una letra de diferencia", () => {
    expect(emparejarUsuario("JOEL DOMINGUEZ", usuarios)?.id).toBe("u2");
  });

  // "Hernando" y "Hernando G" son dos personas distintas.
  it("distingue dos nombres parecidos", () => {
    expect(emparejarUsuario("HERNANDO G", usuarios)?.id).toBe("u4");
    expect(emparejarUsuario("HERNANDO", usuarios)?.id).toBe("u3");
  });

  // Antes de cargarle el turno a quien no es, mejor no elegir.
  it("si hay empate no elige a nadie", () => {
    expect(emparejarUsuario("CARLOS", usuarios)).toBeNull();
    expect(emparejarUsuario("NADIE CONOCIDO", usuarios)).toBeNull();
  });
});

describe("efectividad del turno", () => {
  it("es lo trabajado sobre la jornada", () => {
    expect(efectividad(6 * 3600, 9 * 3600)).toBe(67);
    expect(efectividad(0, 9 * 3600)).toBe(0);
    expect(efectividad(3600, 0)).toBeNull();
  });
});
