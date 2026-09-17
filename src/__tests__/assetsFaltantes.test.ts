// Un /_nuxt inexistente no puede responder la pagina con 200: el CDN la guardaria
// como el script y la app quedaria en blanco (17-09).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("assets faltantes de Nuxt", () => {
  it("responden 404 sin cache", () => {
    const f = readFileSync("nuxt-app/server/middleware/assets-faltantes.ts", "utf8");
    expect(f).toContain("ruta.startsWith('/dashboard/_nuxt/')");
    expect(f).toContain("'no-store, max-age=0'");
    expect(f).toContain("statusCode: 404");
  });
});
