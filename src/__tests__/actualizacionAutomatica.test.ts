// Que todo fluya sin recargar: versiones nuevas y datos de otras personas.
//
// Se lee como TEXTO (no se importa): nuxt-app vive bajo su propio tsconfig y en
// CI no estan sus dependencias.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("versiones nuevas sin recargar a mano", () => {
  const config = leer("nuxt-app/nuxt.config.ts");
  const plugin = leer("nuxt-app/app/plugins/version.client.ts");
  const api = leer("nuxt-app/server/api/version.get.ts");
  const layout = leer("nuxt-app/app/layouts/default.vue");

  it("la version va horneada en el navegador y en el servidor", () => {
    expect(config).toContain("runtimeConfig: { buildId: BUILD_ID }");
    expect(config).toContain("__BUILD_ID__: JSON.stringify(BUILD_ID)");
    expect(api).toContain("useRuntimeConfig().buildId");
    expect(api).toContain("no-store");
  });

  it("con version nueva recarga sola, salvo trabajo a medias, y avisa", () => {
    expect(plugin).toContain("res.buildId === actual");
    expect(plugin).toContain("if (!hayEdicionEnCurso()) recargar()");
    expect(layout).toContain("Hay una versión nueva de la app.");
  });

  it("cambiar de modulo con version nueva entra ya con la nueva", () => {
    expect(plugin).toContain("window.location.href = router.resolve(to).href");
  });

  it("un archivo de la version vieja no deja la pantalla en blanco, sin bucles", () => {
    expect(plugin).toContain("app:chunkError");
    expect(plugin).toContain("vite:preloadError");
    expect(plugin).toContain("Date.now() - antes < 30_000");
  });
});

describe("refresco automatico de datos", () => {
  const comp = leer("nuxt-app/app/composables/useAutoRefresh.ts");
  const toast = leer("nuxt-app/app/composables/useToast.ts");
  const layout = leer("nuxt-app/app/layouts/default.vue");

  it("cada 20 s, al volver a la pestana y cuando llega un aviso nuevo", () => {
    expect(comp).toContain("opts.intervalMs ?? 20_000");
    expect(comp).toContain("visibilitychange");
    expect(comp).toContain("window.addEventListener('focus'");
    expect(comp).toContain("EVENTO_DATOS_CAMBIARON");
    expect(layout).toContain("avisarDatosCambiaron()");
  });

  it("no refresca con trabajo a medias, pero un campo de escaneo vacio no bloquea", () => {
    expect(comp).toContain("if (hayEdicionEnCurso()) return");
    expect(comp).toContain("el.value.trim() !== ''");
    expect(comp).toContain('[role="dialog"], .overlay');
  });

  it("refresca en silencio: sin esqueleto ni errores de red que nadie pidio", () => {
    expect(toast).toContain("if (err && enRefrescoSilencioso()) return");
  });

  it.each([
    "nuxt-app/app/components/pendientes/Module.vue",
    "nuxt-app/app/components/montaje/Module.vue",
    "nuxt-app/app/components/resurtido/Tareas.vue",
    "nuxt-app/app/components/resurtido/PendientesTareas.vue",
    "nuxt-app/app/components/picking-muebles/Module.vue",
    "nuxt-app/app/components/inspeccion-muebles/Module.vue",
    "nuxt-app/app/components/entrega-muebles/Module.vue",
    "nuxt-app/app/components/tareas-generales/Module.vue",
    "nuxt-app/app/components/historial-muebles/Module.vue",
    "nuxt-app/app/components/admin-muebles/Pendientes.vue",
    "nuxt-app/app/components/indicadores-muebles/Module.vue",
  ])("%s se refresca sola y sin parpadear", (rel) => {
    const src = leer(rel);
    expect(src).toContain("useAutoRefresh(");
    expect(src).toContain("if (!enRefrescoSilencioso())");
  });

  it.each([
    "nuxt-app/app/components/montacargas/Module.vue",
    "nuxt-app/app/components/exportaciones/Module.vue",
    "nuxt-app/app/components/recepcion/Module.vue",
    "nuxt-app/app/pages/integracion.vue",
    "nuxt-app/app/pages/cargue-gourmet.vue",
    "nuxt-app/app/pages/tienda.vue",
    "nuxt-app/app/pages/transporte.vue",
  ])("%s se refresca sola", (rel) => {
    expect(leer(rel)).toContain("useAutoRefresh(");
  });

  it("un refresco sin red no cambia los datos reales por los de ejemplo", () => {
    expect(leer("nuxt-app/app/pages/tienda.vue")).toContain("if (enRefrescoSilencioso()) return");
    expect(leer("nuxt-app/app/pages/transporte.vue")).toContain("if (enRefrescoSilencioso()) return");
  });
});
