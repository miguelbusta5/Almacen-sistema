// Fechas y parar en resurtido, resurtido por operario en indicadores y el
// patinador que apoya a un montacarguista en tareas generales.
//
// Los archivos de Nuxt se leen como TEXTO: en CI no esta .nuxt.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resumirResurtidoPorOperario } from "@/lib/indicadores";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const h = (hhmm: string, dia = "2026-09-10") => new Date(`${dia}T${hhmm}:00-05:00`);

describe("resurtido por operario", () => {
  it("PLU por hora, por dia y tiempo por PLU", () => {
    const filas = resumirResurtidoPorOperario(
      [
        { id: "a", nombre: "Ana", porTipo: { resurtido: 7200 } },
        { id: "b", nombre: "Beto", porTipo: { resurtido: 0 } },
      ],
      [
        { usuarioId: "a", cuando: h("08:00") },
        { usuarioId: "a", cuando: h("09:00") },
        { usuarioId: "a", cuando: h("10:00", "2026-09-11") },
        { usuarioId: "a", cuando: h("11:00", "2026-09-11") },
      ],
    );
    expect(filas).toHaveLength(1); // Beto sin PLU ni tiempo no sale
    expect(filas[0]).toMatchObject({
      id: "a", plus: 4, dias: 2, segundos: 7200, plusPorHora: 2, plusPorDia: 2, segundosPorPlu: 1800,
    });
  });

  it("sin tiempo medido no inventa ritmo", () => {
    const [f] = resumirResurtidoPorOperario(
      [{ id: "a", nombre: "Ana", porTipo: { resurtido: 0 } }],
      [{ usuarioId: "a", cuando: h("08:00") }],
    );
    expect(f.plusPorHora).toBeNull();
    expect(f.segundosPorPlu).toBeNull();
    expect(f.plusPorDia).toBe(1);
  });

  it("la copia de Nitro trae la funcion y el endpoint la devuelve", () => {
    expect(leer("nuxt-app/server/utils/indicadoresCalc.ts")).toContain("export function resumirResurtidoPorOperario");
    const api = leer("nuxt-app/server/api/indicadores/index.get.ts");
    expect(api).toContain("resurtido: resumirResurtidoPorOperario(");
    expect(leer("nuxt-app/app/components/indicadores/Module.vue")).toContain("Resurtido por operario");
  });
});

describe("resurtido — parar y fechas", () => {
  it("parar exige el permiso de montar y solo detiene lo sin empezar", () => {
    const api = leer("nuxt-app/server/api/montaje-resurtido/[id]/parar.post.ts");
    expect(api).toContain("assertPuedeMontar(actor.id)");
    expect(api).toContain("estado: 'PENDIENTE'");
    expect(api).toContain("detenidoAt: now");
  });

  it("una tarea detenida no se puede iniciar, pero la en curso sigue", () => {
    const api = leer("nuxt-app/server/api/resurtido-tareas/[id]/iniciar.post.ts");
    expect(api).toMatch(/tarea\.montaje\.detenidoAt && !tarea\.horaInicio/);
  });

  it("el operario deja de ver lo sin empezar de un resurtido parado", () => {
    const api = leer("nuxt-app/server/api/resurtido-tareas/index.get.ts");
    expect(api).toContain("t.estado !== 'PENDIENTE'");
  });

  it("reasignar retoma el resurtido parado", () => {
    const api = leer("nuxt-app/server/api/montaje-resurtido/[id]/reasignar.post.ts");
    expect(api).toContain("detenidoAt: null");
  });

  it("montaje filtra por fecha y muestra fecha y hora", () => {
    expect(leer("nuxt-app/server/api/montaje-resurtido/index.get.ts")).toContain("montadoAt: { gte: rango.inicio, lte: rango.fin }");
    const ui = leer("nuxt-app/app/components/montaje/Module.vue");
    expect(ui).toContain("Montado {{ fmtFechaHora(m.montadoAt) }}");
    expect(ui).toContain("@click=\"parar(m)\"");
  });

  it("la migracion es aditiva", () => {
    const sql = leer("prisma/migrate-resurtido-parar-apoyo.sql");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS detenido_at");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS apoya_a_id");
    expect(sql).not.toMatch(/DROP|DELETE/i);
  });
});

describe("tareas generales — patinador apoyando a un montacarguista", () => {
  it("un operario o un montacarguista apoya, y solo a un montacarguista activo", () => {
    const api = leer("nuxt-app/server/api/tareas-generales/index.post.ts");
    expect(api).toContain("['OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'].includes(rolDe.get(p)");
    expect(api).toContain("role: 'MONTACARGAS'");
    expect(api).toContain("apoyaAId: apoyaA.get(u.id)");
  });

  it("el tiempo del patinador le suma tambien al montacarguista", () => {
    const api = leer("nuxt-app/server/api/indicadores/index.get.ts");
    expect(api).toContain("apoyaAId");
    expect(api).toMatch(/\[a\.usuarioId, a\.apoyaAId\]/);
  });

  it("la tarjeta dice a quien apoya", () => {
    const ui = leer("nuxt-app/app/components/tareas-generales/Module.vue");
    expect(ui).toContain("apoya a {{ a.apoyaA.nombre }}");
    expect(leer("nuxt-app/server/utils/tareasGenerales.ts")).toContain("apoyaA: { select: { id: true, name: true } }");
  });
});
