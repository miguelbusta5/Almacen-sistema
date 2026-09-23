// Proyección diaria de resurtido (fase 7, 23-09).
//
// Pedido del CEDI: «por día la cantidad de tareas realizadas, tanto del
// resurtido como de los pendientes, tanto del operario como del ayudante (el
// que comienza y el que termina)», para proyectar cuántas caben en un turno.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cerradoPor,
  cierresPorDiaYPersona,
  diaDeTurnoDeInstante,
  iniciadoPor,
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
const cierre = (usuarioId: string, cuando: Date, tipo: "tarea" | "pendiente" = "tarea", iniciadoPorId: string | null = null): CierreResurtido =>
  ({ usuarioId, cuando, tipo, iniciadoPorId });

describe("quién empezó y quién cerró", () => {
  const tramos = [{ usuarioId: "pedro", orden: 2 }, { usuarioId: "juan", orden: 1 }];
  it("por orden de tramo, aunque lleguen desordenados", () => {
    expect(iniciadoPor(tramos)).toBe("juan");
    expect(cerradoPor(tramos, "x")).toBe("pedro");
  });
  it("sin tramos: el respaldo cierra y nadie más la empezó", () => {
    expect(cerradoPor([], "responsable")).toBe("responsable");
    expect(iniciadoPor([])).toBeNull();
  });
});

describe("cierres por día y persona", () => {
  it("separa tareas y pendientes, y suma el total", () => {
    const r = cierresPorDiaYPersona({
      personas, turnos: [], ...rango,
      cierres: [cierre("juan", a("2026-09-22")), cierre("juan", a("2026-09-22")), cierre("juan", a("2026-09-22"), "pendiente")],
    });
    expect(r).toEqual([{ dia: "2026-09-22", usuarioId: "juan", nombre: "Juan", tareas: 2, pendientes: 1, total: 3, pasadas: 0 }]);
  });

  it("Juan empieza y Pedro cierra: Pedro +1 cerrada, Juan +1 pasada, total del día 1", () => {
    const r = cierresPorDiaYPersona({
      personas, turnos: [], ...rango,
      cierres: [cierre("pedro", a("2026-09-22"), "tarea", "juan")],
    });
    const pedro = r.find((f) => f.usuarioId === "pedro")!;
    const juan = r.find((f) => f.usuarioId === "juan")!;
    expect(pedro).toMatchObject({ tareas: 1, total: 1, pasadas: 0 });
    expect(juan).toMatchObject({ tareas: 0, total: 0, pasadas: 1 });
    expect(r.reduce((s, f) => s + f.total, 0)).toBe(1);
  });

  it("si la empezó y la cerró la misma persona no hay pasada", () => {
    const r = cierresPorDiaYPersona({ personas, turnos: [], ...rango, cierres: [cierre("juan", a("2026-09-22"), "pendiente", "juan")] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ pendientes: 1, pasadas: 0 });
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
    const r = cierresPorDiaYPersona({
      personas: [{ id: "juan", nombre: "Juan" }], turnos: [], ...rango,
      cierres: [cierre("pedro", a("2026-09-22"), "tarea", "juan"), cierre("pedro", a("2026-09-22"))],
    });
    expect(r).toEqual([{ dia: "2026-09-22", usuarioId: "juan", nombre: "Juan", tareas: 0, pendientes: 0, total: 0, pasadas: 1 }]);
  });

  it("ordena del día más reciente al más viejo", () => {
    const r = cierresPorDiaYPersona({ personas, turnos: [], ...rango, cierres: [cierre("juan", a("2026-09-21")), cierre("juan", a("2026-09-23"))] });
    expect(r.map((f) => f.dia)).toEqual(["2026-09-23", "2026-09-21"]);
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
        cierre("pedro", a("2026-09-23"), "tarea", "juan"),
      ],
    });
    const [juan, pedro] = proyeccionDiaria(filas);
    // 22-09 no trabajó: el promedio es sobre 2 días, no 3.
    expect(juan).toMatchObject({ nombre: "Juan", dias: 2, tareasDia: 25, pendientesDia: 2.5, totalDia: 27.5, maxTotal: 30, pasadasDia: 0.5 });
    expect(pedro).toMatchObject({ dias: 1, totalDia: 1, pasadasDia: 0 });
  });

  it("vacío sin cierres", () => {
    expect(proyeccionDiaria([])).toEqual([]);
  });
});

describe("el endpoint y la pantalla", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  const api = leer("nuxt-app/server/api/indicadores/index.get.ts");
  const vista = leer("nuxt-app/app/components/indicadores/CierresPorDia.vue");

  it("trae el orden de los tramos e incluye los pendientes", () => {
    expect(api.match(/tramos: \{ select: \{ usuarioId: true, inicio: true, fin: true, orden: true \} \}/g)).toHaveLength(2);
    expect(api).toContain("const cierresPendientes: CierreResurtido[] = pendientes");
    expect(api).toContain("cierres: [...cierresTareas, ...cierresPendientes]");
    expect(api).toContain("proyeccion: proyeccionDiaria(cierresDiarios)");
  });

  it("la pantalla usa las piezas del sistema y explica la regla", () => {
    expect(vista).toContain("IndicadoresTarjeta");
    expect(vista).toContain("IndicadoresTabla");
    expect(vista).toContain("'Iniciadas y pasadas'");
    expect(vista).toContain("que no entra en el total");
    expect(leer("nuxt-app/app/components/indicadores/Module.vue")).toContain("<IndicadoresCierresPorDia");
  });
});
