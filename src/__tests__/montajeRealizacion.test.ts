// Realización de un montaje por persona (fase 5, 23-09).
//
// Lo que el CEDI no entendía: los porcentajes no sumaban 100 y la tarea que
// Juan empezó y Pedro terminó no se sabía de quién era.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cargarNuxt } from "./apoyo/nuxt";

const { avancePersonas, quienCerro, repartirDecimas } = cargarNuxt("utils/resurtidoAvance.ts");
const NOMBRES: Record<string, { name: string }> = { a: { name: "Keiner" }, b: { name: "Juan" }, c: { name: "Pedro" } };
const A = NOMBRES.a, B = NOMBRES.b;
const hecha = (...ids: string[]) => ({
  estado: "COMPLETADA",
  tramos: ids.map((usuarioId, i) => ({ usuarioId, orden: i + 1, usuario: NOMBRES[usuarioId] })),
});
const por = (r: any[], id: string) => r.find((p) => p.id === id);
const suma = (r: any[], k: string) => r.reduce((s: number, p: any) => s + p[k], 0);

describe("quién cerró", () => {
  it("es el dueño del último tramo por orden, aunque lleguen desordenados", () => {
    expect(quienCerro([{ usuarioId: "c", orden: 3 }, { usuarioId: "a", orden: 1 }, { usuarioId: "b", orden: 2 }])?.usuarioId).toBe("c");
    expect(quienCerro([])).toBeNull();
    expect(quienCerro(undefined)).toBeNull();
  });
});

describe("realización por persona", () => {
  it("el porcentaje es sobre lo cerrado y suma 100", () => {
    const r = avancePersonas({
      operarioId: "a", operario: A,
      tareas: [hecha("a"), hecha("a"), hecha("a"), hecha("b"), { estado: "PENDIENTE" }, { estado: "EN_CURSO", tramos: [{ usuarioId: "b", orden: 1 }] }],
    });
    expect(por(r, "a")).toMatchObject({ completadas: 3, porcentaje: 75 });
    expect(por(r, "b")).toMatchObject({ completadas: 1, porcentaje: 25, participadas: 2 });
    expect(suma(r, "porcentaje")).toBe(100);
  });

  it("Juan empieza y Pedro cierra: la cerrada es de Pedro, Juan participó", () => {
    const r = avancePersonas({ operarioId: "a", operario: A, tareas: [hecha("b", "c")] });
    expect(por(r, "c")).toMatchObject({ nombre: "Pedro", completadas: 1, porcentaje: 100, participadas: 1 });
    expect(por(r, "b")).toMatchObject({ nombre: "Juan", completadas: 0, porcentaje: 0, participadas: 1 });
    // El total no se infla: una tarea, una cerrada.
    expect(suma(r, "completadas")).toBe(1);
  });

  it("quien vuelve a la tarea varias veces participa una sola vez", () => {
    const r = avancePersonas({ operarioId: "a", operario: A, tareas: [hecha("a", "b", "a")] });
    expect(por(r, "a")).toMatchObject({ completadas: 1, participadas: 1 });
    expect(por(r, "b")).toMatchObject({ completadas: 0, participadas: 1 });
  });

  it("tareas viejas sin tramos: responsable y, si no hay, el titular", () => {
    const r = avancePersonas({
      operarioId: "a", operario: A,
      tareas: [{ estado: "COMPLETADA", responsableId: "b", responsable: B }, { estado: "COMPLETADA" }],
    });
    expect(por(r, "b")).toMatchObject({ completadas: 1, porcentaje: 50 });
    expect(por(r, "a")).toMatchObject({ completadas: 1, porcentaje: 50 });
  });

  it("sin nada cerrado todos van en 0 % y el titular aparece igual", () => {
    const r = avancePersonas({ operarioId: "a", operario: A, tareas: [{ estado: "PENDIENTE" }] });
    expect(r).toEqual([{ id: "a", nombre: "Keiner", completadas: 0, participadas: 0, porcentaje: 0 }]);
  });

  it("con tercios también suma 100 exacto (datos reales daban 99,9 y 100,1)", () => {
    const r = avancePersonas({ operarioId: "a", operario: A, tareas: [hecha("a"), hecha("b"), hecha("c")] });
    expect(r.reduce((s: number, p: any) => s + Math.round(p.porcentaje * 10), 0)).toBe(1000);
    expect(r.map((p: any) => p.porcentaje).sort()).toEqual([33.3, 33.3, 33.4]);
    expect(repartirDecimas([37, 3, 1, 0], 41).reduce((s: number, n: number) => s + n, 0)).toBe(1000);
    expect(repartirDecimas([0, 0], 0)).toEqual([0, 0]);
  });

  it("ordena por cerradas", () => {
    const r = avancePersonas({ operarioId: "a", operario: A, tareas: [hecha("b"), hecha("b"), hecha("a")] });
    expect(r.map((p: any) => p.id)).toEqual(["b", "a"]);
  });
});

describe("la pantalla lo explica", () => {
  const mod = readFileSync(path.join(process.cwd(), "nuxt-app/app/components/montaje/Module.vue"), "utf8");
  it("tabla del sistema con la regla escrita", () => {
    expect(mod).toContain(':columnas="colsRealizacion"');
    expect(mod).toContain("'% de lo cerrado'");
    expect(mod).toContain("por eso suma 100 %");
    expect(mod).not.toContain("sobre el total del resurtido");
  });
});
