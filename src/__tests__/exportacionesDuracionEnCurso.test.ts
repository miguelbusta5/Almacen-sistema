// Guarda del cronómetro/barra de progreso en curso (columna Dur. de Exportaciones).
// Mismo motivo que exportacionesNuxt.test.ts para leer como TEXTO: nuxt-app/ vive
// bajo su propio tsconfig (referencia ./.nuxt/*, gitignorado/inexistente en CI).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

const handlers = leer("nuxt-app/server/utils/exportacionesHandlers.ts");
const utilsCliente = leer("nuxt-app/app/utils/exportaciones.ts");
const tabla = leer("nuxt-app/app/components/exportaciones/Tabla.vue");
const duracionEnCurso = leer("nuxt-app/app/components/exportaciones/DuracionEnCurso.vue");
const moduleVue = leer("nuxt-app/app/components/exportaciones/Module.vue");

function extraerFuncion(src: string, nombre: string): string {
  const inicio = src.indexOf(`export function ${nombre}`);
  expect(inicio).toBeGreaterThan(-1);
  const siguiente = src.indexOf("\nexport function", inicio + 1);
  return siguiente === -1 ? src.slice(inicio) : src.slice(inicio, siguiente);
}

describe("port Nuxt — promedios-plu: wiring de los 3 países", () => {
  it.each([
    ["nuxt-app/server/api/exportaciones/promedios-plu.get.ts", "PAISES_EXPORT_SRV.ecuador"],
    ["nuxt-app/server/api/exportaciones-mexico/promedios-plu.get.ts", "PAISES_EXPORT_SRV.mexico"],
    ["nuxt-app/server/api/exportaciones-eeuu/promedios-plu.get.ts", "PAISES_EXPORT_SRV.eeuu"],
  ])("%s apunta a %s", (archivo, esperado) => {
    const src = leer(archivo);
    expect(src).toContain("makePromediosPluHandler");
    expect(src).toContain(esperado);
  });
});

describe("port Nuxt — makePromediosPluHandler", () => {
  const fn = extraerFuncion(handlers, "makePromediosPluHandler");

  it("exige sesión de cualquier usuario del módulo, no solo gestores", () => {
    expect(fn).toContain("assertUsuario(actor.role)");
    expect(fn).not.toContain("assertGestor");
  });

  it("el promedio es compartido: no filtra por dueño (whereScope)", () => {
    expect(fn).not.toContain("whereScope");
  });

  it("agrega en memoria (duracionMinutos no es columna): nada de .groupBy()/_avg:", () => {
    expect(fn).not.toMatch(/\.groupBy\(/);
    expect(fn).not.toMatch(/_avg:/);
    expect(fn).toContain("calcularDuracionMinutos(");
  });

  it("acota la consulta histórica igual que makeExportHandler", () => {
    expect(fn).toContain("take: 5000");
    expect(fn).toContain("orderBy: [{ horaInicio: 'desc' }]");
  });

  it("global queda en null solo cuando no hay ningún registro finalizado", () => {
    expect(fn).toMatch(/countGlobal > 0 \? [^:]+ : null/);
  });
});

describe("port Nuxt — objetivoPlu: cadena de fallback PLU → global → constante", () => {
  it("existe la constante de respaldo fija", () => {
    expect(utilsCliente).toContain("DURACION_OBJETIVO_FALLBACK_MIN = 5");
  });

  it("revisa primero el PLU, luego el global, y al final la constante (en ese orden)", () => {
    const fn = extraerFuncion(utilsCliente, "objetivoPlu");
    const cuerpo = fn.slice(fn.indexOf("{") + 1);
    const iPlu = cuerpo.indexOf("porPlu = promediosPlu");
    const iGlobal = cuerpo.indexOf("if (promedioGlobal");
    const iConst = cuerpo.indexOf("return DURACION_OBJETIVO_FALLBACK_MIN");
    expect(iPlu).toBeGreaterThan(-1);
    expect(iGlobal).toBeGreaterThan(iPlu);
    expect(iConst).toBeGreaterThan(iGlobal);
  });
});

describe("port Nuxt — Tabla.vue: reloj compartido (no un timer por fila)", () => {
  it("hay exactamente un setInterval en todo el archivo", () => {
    const matches = tabla.match(/setInterval\(/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("limpia el interval al desmontar", () => {
    expect(tabla).toContain("onBeforeUnmount");
    expect(tabla).toContain("clearInterval(tick)");
  });

  it("el interval arranca/para según haya filas en curso, no siempre", () => {
    expect(tabla).toContain("hayEnCurso");
    expect(tabla).toMatch(/duracionMinutos == null/);
    expect(tabla).toMatch(/watch\(\s*hayEnCurso/);
  });

  it("pasa objetivoPlu() y el reloj compartido al componente del cronómetro", () => {
    expect(tabla).toContain("ExportacionesDuracionEnCurso");
    expect(tabla).toContain("objetivoPlu(item.plu, promediosPlu, promedioGlobal)");
    expect(tabla).toContain(':ahora="ahora"');
  });
});

describe("port Nuxt — DuracionEnCurso.vue: blindajes contra errores", () => {
  it("el tiempo transcurrido nunca es negativo (desfase de reloj)", () => {
    expect(duracionEnCurso).toContain("Math.max(0,");
  });

  it("el ancho de la barra nunca desborda el 100%", () => {
    expect(duracionEnCurso).toContain("Math.min(100,");
  });

  it("no divide por cero si el objetivo llegara en 0", () => {
    expect(duracionEnCurso).toContain("objetivoMin > 0 ?");
  });
});

describe("port Nuxt — Module.vue: carga de promedios", () => {
  it("loadPromedios se llama al montar, junto al resto de datos iniciales", () => {
    const onMounted = moduleVue.slice(
      moduleVue.indexOf("onMounted(async () => {"),
      moduleVue.indexOf("})", moduleVue.indexOf("onMounted(async () => {")),
    );
    expect(onMounted).toContain("loadPromedios()");
  });

  it("pasa los promedios a la tabla", () => {
    expect(moduleVue).toContain(':promedios-plu="promediosPlu"');
    expect(moduleVue).toContain(':promedio-global="promedioGlobal"');
  });

  it("no se refresca en cada tick del auto-refresh (es una referencia de cambio lento)", () => {
    const bloque = moduleVue.slice(
      moduleVue.indexOf("useAutoRefresh({"),
      moduleVue.indexOf("})", moduleVue.indexOf("useAutoRefresh({")),
    );
    expect(bloque).not.toContain("loadPromedios");
  });
});
