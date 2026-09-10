import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guardia de drift: el layout de Nuxt no se puede importar desde un test de
// node sin arrastrar medio framework, así que se lee el archivo.
const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const layout = leer("nuxt-app/app/layouts/default.vue");

// La barra superior tenía tres controles pintados que no hacían nada: la lupa,
// la campana (con un punto rojo permanente) y el avatar. Sin menú de usuario no
// había forma de cerrar sesión desde ningún módulo Nuxt.
describe("barra superior — controles funcionales", () => {
  it("el avatar abre un menú con cierre de sesión", () => {
    expect(layout).toContain("cerrarSesion");
    expect(layout).toContain("Cerrar sesion");
    expect(layout).toContain("Cambiar contrasena");
  });

  // Nuxt vive detrás de un rewrite: Auth.js está en la app Next.js, y su signOut
  // pide primero un csrfToken.
  it("el cierre de sesión habla con Auth.js como lo hace next-auth", () => {
    expect(layout).toContain("/api/auth/csrf");
    expect(layout).toContain("/api/auth/signout");
    expect(layout).toContain("csrfToken");
  });

  // El $fetch de Nuxt antepone el baseURL '/dashboard/'. Con él, /api/auth/csrf
  // acabaría en la propia app Nuxt en vez de en Auth.js, así que estas dos
  // llamadas —y solo estas— van con fetch nativo.
  it("las llamadas a Auth.js no pasan por el $fetch de Nuxt", () => {
    expect(layout).toContain("await fetch('/api/auth/csrf'");
    expect(layout).toContain("await fetch('/api/auth/signout'");
    expect(layout).not.toContain("$fetch('/api/auth/");
    // Y al revés: lo que sí es de Nuxt va sin el prefijo, que ya lo pone él.
    expect(layout).toContain("$fetch<{ data: Record<string, number> }>('/api/montacargas/mis-pendientes')");
    expect(layout).not.toContain("'/dashboard/api/");
  });

  it("el buscador solo ofrece módulos que el usuario puede ver", () => {
    // visibleGroups ya está filtrado por canSeeModule; buscar sobre NAV_GROUPS
    // ofrecería módulos que llevan a una pantalla de "sin permiso".
    expect(layout).toContain("visibleGroups.value.flat()");
    expect(layout).not.toContain("NAV_GROUPS.flat()");
  });

  // Un punto rojo permanente no avisa de nada: acaba significando "siempre hay
  // algo", que es lo mismo que nada.
  it("la campana solo se enciende cuando hay trabajo pendiente", () => {
    expect(layout).toContain('v-if="totalPendiente > 0" class="dot"');
    expect(layout).toContain("mis-pendientes");
  });
});

// Firma de autoría al pie de la barra lateral.
describe("firma", () => {
  it("aparece el Powered by en el layout", () => {
    expect(layout).toContain("Powered by");
    expect(layout).toContain("GreenFox");
  });
});

// Los códigos de ubicación (05-J-14-05-01) y las horas se partían en tres
// líneas y la fila crecía a 100px de alto.
describe("tablas de montacargas — una línea por fila", () => {
  const tablas = [
    "nuxt-app/app/components/montacargas/Tabla.vue",
    "nuxt-app/app/components/montacargas/Indicadores.vue",
  ];

  it.each(tablas)("%s no deja que las celdas se partan", (rel) => {
    const src = leer(rel);
    const td = src.slice(src.indexOf(".table td {"));
    expect(td.slice(0, 200)).toContain("white-space: nowrap");
  });

  it.each(tablas)("%s alinea los números a la derecha", (rel) => {
    const src = leer(rel);
    expect(src).toContain(".table th.num { text-align: right; }");
    expect(src).toContain(".table td.tnum { text-align: right; }");
  });

  it("la cabecera se queda fija al desplazar la tabla", () => {
    expect(leer("nuxt-app/app/components/montacargas/Tabla.vue"))
      .toContain(".table thead th { position: sticky; top: 0;");
  });

  // La descripción es lo único que puede recortarse: el resto son cifras y
  // códigos que pierden su sentido a medias.
  it("solo la descripción se recorta con puntos suspensivos", () => {
    expect(leer("nuxt-app/app/components/montacargas/Tabla.vue"))
      .toContain(".desc { max-width: 260px; overflow: hidden; text-overflow: ellipsis; }");
  });
});
