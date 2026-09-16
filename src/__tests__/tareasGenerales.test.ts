// Tareas generales: lo que manda supervision y no cabe en ningun modulo.
//
// La copia de Nitro se lee como TEXTO (no se importa) por la misma razon que en
// el resto de modulos: nuxt-app vive bajo su propio tsconfig y en CI no estan
// sus dependencias.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  esAsignable,
  puedeMandarTarea,
  puedeVerTareas,
  segundosAsignado,
  tareaTerminada,
  validarTarea,
} from "@/lib/tareasGenerales";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("quien manda y quien recibe", () => {
  it("solo supervision de almacenamiento y el admin asignan", () => {
    expect(puedeMandarTarea("SUPERVISOR_ALMACENAMIENTO")).toBe(true); // Felipe Ossa, Eduardo
    expect(puedeMandarTarea("ADMIN")).toBe(true);
    expect(puedeMandarTarea("GERENTE")).toBe(false);
    expect(puedeMandarTarea("MONTACARGAS")).toBe(false);
  });

  it("gerencia mira pero no toca", () => {
    expect(puedeVerTareas("GERENTE")).toBe(true);
    expect(puedeMandarTarea("GERENTE")).toBe(false);
  });

  // Solo operarios de almacenamiento: el resto de roles esta amarrado a su
  // propio modulo y sacarlos de ahi rompe la medicion de su area.
  it("se asigna solo a operarios de almacenamiento", () => {
    expect(esAsignable("OPERARIO_ALMACENAMIENTO")).toBe(true);
    expect(esAsignable("PICKING_MUEBLES")).toBe(false);
    expect(esAsignable("MONTACARGAS")).toBe(false);
    expect(esAsignable("TIENDA")).toBe(false);
  });
});

describe("validarTarea", () => {
  it("exige texto y al menos un operario", () => {
    expect(validarTarea({ descripcion: "  ", usuarioIds: ["a"] })).toMatch(/que hay que hacer/i);
    expect(validarTarea({ descripcion: "Organizar el pasillo 4", usuarioIds: [] })).toMatch(/operario/i);
    expect(validarTarea({ descripcion: "Organizar", usuarioIds: ["a", "a"] })).toMatch(/repetido/i);
    expect(validarTarea({ descripcion: "Organizar", usuarioIds: ["a", "b"] })).toBeNull();
  });
});

describe("reloj de cada persona", () => {
  const t0 = new Date("2026-09-15T13:00:00Z");

  it("una abierta cuenta contra ahora; una cerrada, contra su fin", () => {
    const ahora = new Date("2026-09-15T13:30:00Z").getTime();
    expect(segundosAsignado({ horaInicio: t0, horaFin: null }, ahora)).toBe(1800);
    expect(segundosAsignado({ horaInicio: t0, horaFin: new Date("2026-09-15T13:10:00Z") }, ahora)).toBe(600);
  });

  it("la tarea termina solo cuando nadie la tiene abierta", () => {
    expect(tareaTerminada([{ horaFin: t0 }, { horaFin: null }])).toBe(false);
    expect(tareaTerminada([{ horaFin: t0 }, { horaFin: t0 }])).toBe(true);
    expect(tareaTerminada([])).toBe(false);
  });
});

describe("la copia de Nitro no se desvia", () => {
  const fuente = leer("src/lib/tareasGenerales.ts");
  const copia = leer("nuxt-app/server/utils/tareasGeneralesCalc.ts");

  it("tiene las mismas funciones y las mismas listas de roles", () => {
    for (const nombre of [
      "puedeMandarTarea", "puedeVerTareas", "esAsignable", "validarTarea",
      "segundosAsignado", "tareaTerminada", "ROLES_ASIGNABLES", "MAX_DESCRIPCION",
    ]) {
      expect(fuente).toContain(nombre);
      expect(copia).toContain(nombre);
    }
  });

  it("solo se diferencian en los punto y coma y la cabecera", () => {
    const limpiar = (s: string) => s
      .replace(/^(\/\/.*\n)+/, "")
      .replace(/;$/gm, "")
      .trim();
    expect(limpiar(copia)).toBe(limpiar(fuente));
  });
});

describe("los endpoints", () => {
  const get = leer("nuxt-app/server/api/tareas-generales/index.get.ts");
  const post = leer("nuxt-app/server/api/tareas-generales/index.post.ts");
  const finalizar = leer("nuxt-app/server/api/tareas-generales/[id]/finalizar.post.ts");
  const ui = leer("nuxt-app/app/components/tareas-generales/Module.vue");

  it("el operario solo ve lo suyo", () => {
    expect(get).toContain("asignados: { some: { usuarioId: actor.id } }");
    expect(get).toContain("puedeMandar: puedeMandarTarea(actor.role)");
  });

  it("crear y cerrar exigen ser supervision, en el servidor", () => {
    expect(post).toContain("assertPuedeMandarTarea(actor.role)");
    expect(finalizar).toContain("assertPuedeMandarTarea(actor.role)");
  });

  it("el reloj de cada persona arranca al asignar", () => {
    expect(post).toContain("usuarioId: u.id, horaInicio: now");
    expect(post).toContain("TAREA_GENERAL_ASIGNADA");
  });

  it("se puede cerrar a una persona o a todas, y la tarea cierra sola al final", () => {
    expect(finalizar).toContain("...(usuarioId ? { usuarioId } : {})");
    expect(finalizar).toContain("tareaTerminada(asignados)");
    expect(finalizar).toContain("estado: 'FINALIZADA'");
    expect(ui).toContain("Finalizar para todos");
  });

  it("el tiempo entra en Indicadores como un tipo mas", () => {
    const api = leer("nuxt-app/server/api/indicadores/index.get.ts");
    expect(api).toContain("prisma.asignadoTareaGeneral.findMany");
    expect(api).toContain("tipo: 'tarea' as const");
    for (const rel of [
      "src/lib/indicadores.ts",
      "nuxt-app/server/utils/indicadoresCalc.ts",
      "nuxt-app/app/utils/indicadores.ts",
    ]) {
      expect(leer(rel)).toContain("tarea");
    }
  });
});
