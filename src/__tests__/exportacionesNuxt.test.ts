// Guarda de sincronía del port de Exportaciones a nuxt-app.
//
// Por qué se lee el archivo como TEXTO en vez de importarlo: `nuxt-app/` vive bajo
// su propio tsconfig, que referencia `./.nuxt/*` — un directorio que genera
// `nuxt prepare` y que está gitignorado. En CI las dependencias de nuxt-app no se
// instalan, así que ese directorio no existe y cualquier import cruzado revienta el
// transform con TSCONFIG_ERROR (falla solo en CI: en local pasa porque `.nuxt`
// quedó de algún build). Leer con `fs` no involucra al transform.
//
// Lo que estos tests protegen es el drift: la lógica está duplicada a propósito
// entre src/lib (Next), nuxt-app/app/utils (cliente) y nuxt-app/server/utils
// (Nitro), y comparten la MISMA tabla. Si una copia se desvía, los registros de un
// stack dejan de verse en el otro.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  puedeUsarExportaciones,
  puedeGestionarExportaciones,
  todayBogota,
  calcularDuracionMinutos,
} from "@/lib/exportaciones";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

const utilsCliente = leer("nuxt-app/app/utils/exportaciones.ts");
const utilsServidor = leer("nuxt-app/server/utils/exportaciones.ts");
const calcServidor = leer("nuxt-app/server/utils/exportacionesCalc.ts");
const handlers = leer("nuxt-app/server/utils/exportacionesHandlers.ts");
const mapRow = leer("nuxt-app/server/utils/mapRow.ts");
const layout = leer("nuxt-app/app/layouts/default.vue");

// ── Comportamiento (fuente de verdad: src/lib, que el port copia literal) ──
describe("exportaciones — zona horaria", () => {
  // 03:00 UTC son las 22:00 del día anterior en Bogotá (UTC-5).
  it("todayBogota devuelve el día colombiano, no el UTC", () => {
    expect(todayBogota(new Date("2026-07-24T03:00:00Z")).toISOString()).toBe("2026-07-23T00:00:00.000Z");
  });

  it("todayBogota no se adelanta durante la jornada", () => {
    expect(todayBogota(new Date("2026-07-24T16:00:00Z")).toISOString()).toBe("2026-07-24T00:00:00.000Z");
  });

  it("calcularDuracionMinutos redondea y nunca es negativo", () => {
    expect(calcularDuracionMinutos("2026-07-24T10:00:00Z", "2026-07-24T10:07:20Z")).toBe(7);
    expect(calcularDuracionMinutos("2026-07-24T10:00:00Z", null)).toBeNull();
    expect(calcularDuracionMinutos("2026-07-24T10:10:00Z", "2026-07-24T10:00:00Z")).toBe(0);
  });
});

describe("exportaciones — roles", () => {
  it("ETIQUETADO usa pero no gestiona", () => {
    expect(puedeUsarExportaciones("ETIQUETADO")).toBe(true);
    expect(puedeGestionarExportaciones("ETIQUETADO")).toBe(false);
  });
  it("los gestores son ADMIN, GERENTE y SUPERVISOR_ALMACENAMIENTO", () => {
    for (const r of ["ADMIN", "GERENTE", "SUPERVISOR_ALMACENAMIENTO"]) {
      expect(puedeGestionarExportaciones(r)).toBe(true);
    }
    expect(puedeGestionarExportaciones("TIENDA")).toBe(false);
  });
});

// ── Sincronía del port ────────────────────────────────────────────────
describe("port Nuxt — la zona horaria no se reescribió", () => {
  it("el servidor construye la fecha con el Intl de Bogotá y el sufijo Z", () => {
    // Si esto se reescribe con dayjs o con `new Date(fecha)` sin la Z, el día se
    // desplaza y los registros creados desde Next no aparecen en Nuxt.
    expect(calcServidor).toContain("timeZone: 'America/Bogota'");
    expect(calcServidor).toContain("T00:00:00.000Z");
  });

  it("el cliente usa el mismo Intl que el servidor", () => {
    expect(utilsCliente).toContain("timeZone: 'America/Bogota'");
  });

  it("ningún archivo del módulo importa dayjs", () => {
    for (const src of [utilsCliente, utilsServidor, calcServidor, handlers]) {
      expect(src).not.toMatch(/from ['"]dayjs['"]/);
    }
  });
});

describe("port Nuxt — mapRow no arrastra Prisma", () => {
  // mapRow lo importan los handlers de TODOS los módulos migrados. Si sus imports
  // encadenan hasta el cliente de Prisma, un fallo de resolución ahí tumba el build
  // entero de nuxt-app, no solo exportaciones (precedente: BUG-004, que solo se
  // manifestaba en el bundle de Vercel).
  it("mapRow importa los helpers puros, no el módulo con el delegate", () => {
    expect(mapRow).toContain("from './exportacionesCalc'");
    expect(mapRow).not.toMatch(/from '\.\/exportaciones'/);
  });

  it("exportacionesCalc no importa Prisma ni h3", () => {
    expect(calcServidor).not.toMatch(/from '\.\/prisma'/);
    expect(calcServidor).not.toMatch(/from ['"]h3['"]/);
    expect(calcServidor).not.toMatch(/@prisma/);
  });
});

describe("port Nuxt — las listas de roles no se desviaron", () => {
  const gestores = ["ADMIN", "GERENTE", "SUPERVISOR_ALMACENAMIENTO"];
  it.each(["cliente", "servidor"] as const)("%s declara los mismos gestores y añade ETIQUETADO", (cual) => {
    const src = cual === "cliente" ? utilsCliente : utilsServidor;
    const linea = src.match(/GESTORES_EXPORTACIONES\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    for (const r of gestores) expect(linea).toContain(r);
    expect(src).toMatch(/USUARIOS_EXPORTACIONES\s*=\s*\['ETIQUETADO'/);
  });
});

describe("port Nuxt — la transacción de captura sigue en forma de array", () => {
  // Con `$transaction(async tx => ...)` y un delegate mal reconstruido desde `tx`,
  // el updateMany corre fuera de la transacción y el operario acaba con DOS
  // registros abiertos a la vez: el banner y el cálculo de duración dejan de servir.
  it("usa prisma.$transaction([...]) y no la forma de callback", () => {
    expect(handlers).toContain("await prisma.$transaction([");
    // Sin comentarios: el propio código lleva una nota que menciona la forma de
    // callback justo para advertir de que no se use.
    const codigo = handlers.replace(/\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/\$transaction\(\s*async/);
  });

  it("cierra el registro abierto del propio actor antes de crear", () => {
    expect(handlers).toMatch(/updateMany\(\{\s*where:\s*\{\s*creadoPorId:\s*actor\.id,\s*horaFinalizacion:\s*null/);
  });
});

describe("port Nuxt — el filtro de dueño para ETIQUETADO existe", () => {
  it("whereScope acota por creadoPorId cuando no es gestor", () => {
    // Olvidarlo filtra los registros de todos los operarios a un ETIQUETADO.
    expect(utilsServidor).toMatch(/if \(!isGestor\) return \{ creadoPorId: actor\.id \}/);
  });
  it("el listado y los conteos pasan por whereScope", () => {
    expect(handlers).toContain("buildExportWhere");
    expect(handlers).toContain("whereScope(actor)");
  });
  it("stats, operarios y export exigen gestor", () => {
    const gestorGates = handlers.match(/assertGestor\(actor\.role/g) ?? [];
    expect(gestorGates.length).toBeGreaterThanOrEqual(4); // operarios, stats, export, delete
  });
});

describe("port Nuxt — sidebar y rutas por país", () => {
  const PAISES = [
    { route: "exportaciones", api: "/api/exportaciones" },
    { route: "exportaciones-mexico", api: "/api/exportaciones-mexico" },
    { route: "exportaciones-eeuu", api: "/api/exportaciones-eeuu" },
  ];

  it("existe una página por país, y su nombre de archivo es el route.name", () => {
    for (const p of PAISES) {
      expect(() => leer(`nuxt-app/app/pages/${p.route}.vue`)).not.toThrow();
    }
  });

  it("cada país apunta a su propio apiBase", () => {
    for (const p of PAISES) expect(utilsCliente).toContain(`apiBase: '${p.api}'`);
  });

  it("el sidebar usa igualdad exacta, no startsWith", () => {
    // Con startsWith, la clave 'exportaciones' matchea también 'exportaciones-mexico'
    // y '-eeuu': estando en México se resaltaban dos ítems a la vez.
    expect(layout).toContain("route.name?.toString() === key");
    expect(layout).not.toContain("route.name?.toString().startsWith(key)");
  });

  it("los tres ítems del sidebar tienen key, si no nunca se resaltan", () => {
    for (const p of PAISES) {
      expect(layout).toMatch(new RegExp(`href: '/dashboard/${p.route}'[^}]*key: '${p.route}'`));
    }
  });
});

describe("port Nuxt — rewrite de Next", () => {
  const nextConfig = leer("next.config.ts");
  it("la variable entra en la cadena de SHARED_NUXT_URL", () => {
    // Sin esto, si fuera la única definida no se emitirían las reglas de
    // /dashboard/api/* ni /dashboard/_nuxt/* y la página cargaría en blanco.
    expect(nextConfig).toMatch(/SHARED_NUXT_URL\s*=[^;]*NUXT_PILOT_EXPORT_URL/);
  });
  it("una sola variable activa los tres países", () => {
    expect(nextConfig).toMatch(/if \(NUXT_PILOT_EXPORT_URL\)/);
    for (const m of ["exportaciones", "exportaciones-mexico", "exportaciones-eeuu"]) {
      expect(nextConfig).toContain(`"${m}"`);
    }
  });
});

// ── Reporte consolidado (5 hojas + gráficas nativas) ──────────────────
//
// El helper de gráficas y las agregaciones están duplicados literalmente entre
// src/lib y nuxt-app/server/utils. Un drift ahí no rompe el build de ninguno de
// los dos stacks: simplemente el reporte sale distinto según quién lo genere, o
// peor, Excel pide "reparar" solo en uno. De ahí la comparación normalizada.
describe("port Nuxt — reporte consolidado", () => {
  /**
   * Deja solo la lógica, ignorando lo que separa a los dos stacks: comentarios,
   * rutas de import, comillas simples vs dobles, punto y coma y el formato de
   * Prettier (que rompe las líneas en sitios distintos en cada repo).
   */
  const normalizar = (src: string) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/^import[\s\S]*?from\s+['"][^'"]*['"];?\s*$/gm, "")
      .replace(/\\"/g, '"')
      .replace(/'/g, '"')
      .replace(/;/g, "")
      .replace(/,(\s*[)\]}])/g, "$1")
      .replace(/\s+/g, " ")
      .replace(/\s*([(){}[\],:])\s*/g, "$1")
      .trim();

  it("excelCharts es idéntico en los dos stacks", () => {
    expect(normalizar(leer("nuxt-app/server/utils/excelCharts.ts"))).toBe(
      normalizar(leer("src/lib/excelCharts.ts")),
    );
  });

  it("las agregaciones son idénticas en los dos stacks", () => {
    expect(normalizar(leer("nuxt-app/server/utils/exportacionesReporteCalc.ts"))).toBe(
      normalizar(leer("src/lib/exportaciones/reporteCalc.ts")),
    );
  });

  it("ambos libros tienen las mismas 5 hojas y las mismas gráficas", () => {
    const hojas = ["Registros", "Tiempos por usuario", "Unidades por día", "Registros por día", "Promedios mensuales"];
    const titulos = [
      "Promedio de minutos por caja, por usuario",
      "Minutos totales por usuario (apilado por país)",
      "Promedio de minutos por caja, por mes",
      "Unidades por mes y país",
    ];
    for (const rel of [
      "src/lib/exportaciones/reporteWorkbook.ts",
      "nuxt-app/server/utils/exportacionesReporteWorkbook.ts",
    ]) {
      const src = leer(rel);
      // Comillas simples o dobles según el stack, de ahí la clase de caracteres.
      for (const hoja of hojas) expect(src).toMatch(new RegExp(`['"]${hoja}['"]`));
      for (const titulo of titulos) expect(src).toContain(titulo);
    }
  });

  it("el endpoint es gestor-only y lee todo el histórico de los tres países", () => {
    for (const rel of ["src/lib/exportaciones/reporte.ts", "nuxt-app/server/utils/exportacionesReporte.ts"]) {
      const src = leer(rel);
      expect(src).toContain("puedeGestionarExportaciones");
      expect(src).toContain("Sin permiso para exportar");
      expect(src).toContain("deletedAt: null");
      expect(src).toContain("MAX_POR_PAIS");
      // Sin filtros de pantalla a propósito: las hojas de tendencia los necesitan.
      expect(src).not.toContain("buildExportWhere");
    }
  });

  it("el botón del reporte existe en los dos frontends y es gestor-only", () => {
    const vue = leer("nuxt-app/app/components/exportaciones/Module.vue");
    expect(vue).toContain("descargarReporte");
    expect(vue).toMatch(/v-if="canManage"[\s\S]{0,200}descargarReporte/);
    expect(vue).toContain("/api/exportaciones/reporte");

    const react = leer("src/components/exportaciones/ExportacionesModule.tsx");
    expect(react).toContain("descargarReporte");
    expect(react).toMatch(/canManage && \([\s\S]{0,200}descargarReporte/);
    expect(react).toContain("/api/exportaciones/reporte");
  });
});
