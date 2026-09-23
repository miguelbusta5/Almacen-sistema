// Lo que se agregó a muebles quedó con estilo propio o sin estilo: una tabla con
// una clase que no existe (`tabla`), `style=` incrustado y una lista de checkbox
// sin buscador. Esto fija que esos bloques usen el sistema de diseño.
//
// Se lee como TEXTO: en CI no se puede importar de nuxt-app (ver apoyo/nuxt.ts).
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const raiz = path.join(process.cwd(), "nuxt-app/app/components");
const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

function vues(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? vues(p) : p.endsWith(".vue") ? [p] : [];
  });
}

describe("las pantallas usan el diseño del sistema", () => {
  // `.tabla` no está en tokens.css: cada componente que la usa la define en su
  // propio <style scoped>. Usarla sin definirla deja la tabla sin ningún estilo,
  // que es justo lo que pasaba en indicadores-muebles.
  it("nadie usa `class=\"tabla\"` sin definirla en su propio estilo", () => {
    const culpables = vues(raiz).filter((p) => {
      const txt = readFileSync(p, "utf8");
      // Clase exacta: `tj-tabla` o `tabla-scroll` son otras clases, no esta.
      const usa = [...txt.matchAll(/class="([^"]*)"/g)]
        .some((m) => m[1]!.split(/\s+/).includes("tabla"));
      return usa && !/^\s*\.tabla[\s,{]/m.test(txt);
    });
    expect(culpables.map((p) => path.relative(raiz, p))).toEqual([]);
  });
});

describe("indicadores de muebles: Genie / Order Picker", () => {
  const mod = leer("nuxt-app/app/components/indicadores-muebles/Module.vue");

  it("es una tarjeta del sistema con barras y tabla, no una tabla desnuda", () => {
    expect(mod).toContain('titulo="Genie / Order Picker"');
    expect(mod).toContain("IndicadoresBarrasH");
    expect(mod).toContain(":columnas=\"colsEquipos\"");
    expect(mod).not.toContain('style="overflow-x:auto"');
  });

  it("va debajo de las cifras del módulo, no encima", () => {
    expect(mod.indexOf('class="tiles"')).toBeLessThan(mod.indexOf('titulo="Genie / Order Picker"'));
  });
});

describe("picking de muebles: pasar la orden", () => {
  const mod = leer("nuxt-app/app/components/picking-muebles/Module.vue");

  it("es una tarjeta con título, campo y botones del sistema", () => {
    expect(mod).toContain('class="card reasignar"');
    expect(mod).toContain('class="r-titulo"');
    expect(mod).toContain('<select v-model="nuevoOperario" class="field">');
    expect(mod).toContain("btn btn-primary");
  });

  it("avisa si no hay a quién pasarla y no deja el botón colgado", () => {
    expect(mod).toContain("No hay otro operario de picking disponible");
    expect(mod).toContain("buscandoOperarios");
  });
});

describe("montaje: repartir tareas a un ayudante", () => {
  const mod = leer("nuxt-app/app/components/montaje/Module.vue");

  it("tiene buscador, contador y selección masiva", () => {
    expect(mod).toContain("const repartiblesVisibles = computed");
    expect(mod).toContain("t.plu.includes(q) || t.altura.toUpperCase().includes(q)");
    expect(mod).toContain("function marcarVisibles()");
    expect(mod).toContain("'seleccionada' : 'seleccionadas'");
  });

  it("no ofrece al titular como su propio ayudante", () => {
    expect(mod).toContain("const ayudantesPosibles = computed");
    expect(mod).toContain("o.id !== detalle.value?.operarioId");
  });

  it("solo reparte lo que nadie empezó y no usa estilos incrustados", () => {
    expect(mod).toContain("t.estado === 'PENDIENTE' && !t.horaInicio");
    expect(mod).not.toContain('style="display:block"');
  });
});
