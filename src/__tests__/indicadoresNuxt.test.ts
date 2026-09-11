// Modulo de Indicadores en nuxt-app: se lee como TEXTO por la misma razon que
// el resto de tests *Nuxt (nuxt-app tiene su propio node_modules y un import
// cruzado revienta el transform).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MOTIVO_TIEMPO_MUERTO_LABEL,
  MOTIVOS_TIEMPO_MUERTO,
  TIPO_TAREA_LABEL,
  TIPOS_TAREA,
} from "@/lib/indicadores";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8").replace(/\r\n/g, "\n");
const existe = (rel: string) => existsSync(path.join(process.cwd(), rel));

describe("indicadores — la copia de Nitro es la fuente sin punto y coma", () => {
  // La copia se genera: cabecera propia + el cuerpo de la fuente sin los ";" de
  // final de linea. Comparar el cuerpo entero caza cualquier cambio que se haga
  // en un lado y no en el otro, no solo que existan las mismas funciones.
  it("el cuerpo es identico", () => {
    const cuerpo = (src: string) => src.split("\n\n").slice(1).join("\n\n").replace(/;\n/g, "\n");
    expect(cuerpo(leer("nuxt-app/server/utils/indicadoresCalc.ts"))).toBe(cuerpo(leer("src/lib/indicadores.ts")));
  });
});

describe("indicadores — el cliente usa los mismos tipos y colores", () => {
  const cliente = leer("nuxt-app/app/utils/indicadores.ts");

  it("mismos tipos, en el mismo orden y con las mismas etiquetas", () => {
    const bloque = cliente.slice(cliente.indexOf("export const TIPOS_TAREA"));
    const orden = [...bloque.slice(0, bloque.indexOf("] as const")).matchAll(/'(\w+)',/g)].map((m) => m[1]);
    expect(orden).toEqual([...TIPOS_TAREA]);
    for (const t of TIPOS_TAREA) expect(cliente).toContain(`${t}: '${TIPO_TAREA_LABEL[t]}'`);
  });

  // El color sigue a la tarea: recepcion es la ranura 1 en todos los graficos,
  // tenga o no datos, para que un filtro no la repinte.
  it("cada tipo tiene su ranura fija de la paleta validada", () => {
    TIPOS_TAREA.forEach((t, i) => expect(cliente).toContain(`${t}: 'var(--viz-${i + 1})'`));
    const tokens = leer("nuxt-app/app/assets/tokens.css");
    for (const hex of ["#2A78D6", "#EB6834", "#1BAF7A", "#EDA100", "#E87BA4"]) expect(tokens).toContain(hex);
    expect(tokens).toContain("--viz-medida:");
  });
});

describe("indicadores — el endpoint", () => {
  const api = leer("nuxt-app/server/api/indicadores/index.get.ts");

  it("es solo para gestion", () => {
    expect(api).toContain("assertGestorMontacargas(actor.role");
  });

  // La cuenta vive en la funcion pura (con tests); el endpoint solo junta filas.
  it("la cuenta la hace agregarIndicadores", () => {
    expect(api).toContain("agregarIndicadores({ personas, tiempos, unidades, desde, hasta })");
    expect(api).not.toContain("repartirTiempo(");
  });

  // Lo abierto se lee (evita tiempos muertos falsos), pero no es tiempo
  // laborado hasta que se cierra.
  it("solo cuenta como laborado lo cerrado, y nunca registros borrados", () => {
    expect(api).toContain("OR: [{ fin: { gt: ini } }, { fin: null }]");
    expect(api).toContain("if (t.fin) tiempos.push(");
    expect(api).toContain("else enCurso.push(");
    expect(api).toContain("movimiento: { deletedAt: null }");
    // Hay mas de mil tareas de montajes de prueba borrados.
    expect(api).toContain("montaje: { deletedAt: null }");
  });

  // Un pendiente sumado a una tarea de resurtido ya esta dentro de esa tarea:
  // contarlo aparte duplicaria su tiempo y sus unidades.
  it("los pendientes sumados a una tarea no cuentan dos veces", () => {
    expect(api).toContain("tareaResurtidoId: null");
  });

  it("el contenedor cuenta tiempo para todos los que descargan, pero no es un PLU", () => {
    expect(api).toContain("r.descargadores.map((d) => d.usuarioId)");
    expect(api).toContain("tipo: 'contenedor' as const, registro: null");
  });
});

describe("indicadores — ya no hay pestañas de indicadores en los modulos", () => {
  it("se borraron las pestañas y sus endpoints", () => {
    for (const rel of [
      "nuxt-app/app/components/montacargas/Indicadores.vue",
      "nuxt-app/app/components/recepcion/Indicadores.vue",
      "nuxt-app/server/api/montacargas/indicadores.get.ts",
      "nuxt-app/server/api/recepcion-contenedores/indicadores.get.ts",
    ]) {
      expect(existe(rel)).toBe(false);
    }
    expect(leer("nuxt-app/app/components/recepcion/Module.vue")).not.toContain("RecepcionIndicadores");
    expect(leer("nuxt-app/app/components/montacargas/Module.vue")).not.toContain("MontacargasIndicadores");
  });
});

describe("indicadores — el modulo esta registrado en todas partes", () => {
  it("las tres copias de modulePermissions lo dan solo a gestion", () => {
    for (const rel of [
      "src/lib/modulePermissions.ts",
      "nuxt-app/app/utils/modulePermissions.ts",
      "nuxt-app/server/utils/modulePermissions.ts",
    ]) {
      const linea = leer(rel).split("\n").find((l) => /^\s+indicadores: \[/.test(l)) ?? "";
      expect(linea).toContain("SUPERVISOR_ALMACENAMIENTO");
      expect(linea).toContain("GERENTE");
      expect(linea).toContain("ADMIN");
      // Los medidos no ven los numeros con los que se les evalua.
      expect(linea).not.toContain("MONTACARGAS");
      expect(linea).not.toContain("OPERARIO_ALMACENAMIENTO");
    }
  });

  it("el proxy de Next enruta el modulo", () => {
    expect(leer("next.config.ts")).toMatch(/for \(const modulo of \[[\s\S]*?"indicadores"[\s\S]*?\]\)/);
  });

  it("aparece en la navegacion de los dos stacks y en el inicio", () => {
    expect(leer("nuxt-app/app/layouts/default.vue")).toContain("/dashboard/indicadores");
    expect(leer("src/components/common/Sidebar.tsx")).toContain("/dashboard/indicadores");
    expect(leer("src/app/(dashboard)/dashboard/page.tsx")).toContain('indicadores: "/dashboard/indicadores"');
  });

  it("existe la pagina de Nuxt", () => {
    expect(leer("nuxt-app/app/pages/indicadores.vue")).toContain("<IndicadoresModule />");
  });
});

describe("indicadores — los graficos", () => {
  const modulo = leer("nuxt-app/app/components/indicadores/Module.vue");

  // Cada grafico tiene su tabla: es donde se leen las cifras sin depender del
  // color, y los colores claros de la paleta lo exigen.
  it("todos los graficos tienen vista de tabla", () => {
    expect(leer("nuxt-app/app/components/indicadores/Tarjeta.vue")).toContain('<slot name="tabla" />');
    const tarjetas = (modulo.match(/<IndicadoresTarjeta\b/g) ?? []).length;
    const tablas = (modulo.match(/<template #tabla>/g) ?? []).length;
    expect(tablas).toBe(tarjetas);
    expect(leer("nuxt-app/app/components/indicadores/TiempoPersonas.vue")).toContain("<template #tabla>");
  });

  // Tiempo y unidades tienen escalas distintas: dos graficos, nunca dos ejes.
  it("la evolucion va en dos graficos de una serie", () => {
    expect((modulo.match(/<IndicadoresLineaDiaria\b/g) ?? []).length).toBe(2);
  });

  it("los nombres llegan como texto, nunca como HTML", () => {
    for (const rel of [
      "nuxt-app/app/components/indicadores/Module.vue",
      "nuxt-app/app/components/indicadores/TiempoPersonas.vue",
      "nuxt-app/app/components/indicadores/BarrasH.vue",
      "nuxt-app/app/components/indicadores/LineaDiaria.vue",
      "nuxt-app/app/components/indicadores/Tooltip.vue",
      "nuxt-app/app/components/indicadores/Tabla.vue",
    ]) {
      expect(leer(rel)).not.toContain("v-html");
    }
  });
});

describe("tiempos muertos — cliente y servidor hablan de lo mismo", () => {
  const cliente = leer("nuxt-app/app/utils/indicadores.ts");

  it("mismos motivos, en el mismo orden y con las mismas etiquetas", () => {
    const bloque = cliente.slice(cliente.indexOf("export const MOTIVOS_TIEMPO_MUERTO"));
    const orden = [...bloque.slice(0, bloque.indexOf("] as const")).matchAll(/'(\w+)',/g)].map((m) => m[1]);
    expect(orden).toEqual([...MOTIVOS_TIEMPO_MUERTO]);
    for (const m of MOTIVOS_TIEMPO_MUERTO) expect(cliente).toContain(`${m}: '${MOTIVO_TIEMPO_MUERTO_LABEL[m]}'`);
  });

  // Rojo y verde pegados en una barra no se distinguen con daltonismo: el
  // orden validado es rojo, ambar, verde.
  it("los estados van en el orden de la paleta validada", () => {
    const bloque = cliente.slice(cliente.indexOf("export const ESTADOS_TIEMPO_MUERTO"));
    const orden = [...bloque.slice(0, bloque.indexOf("]\n")).matchAll(/key: '(\w+)'/g)].map((m) => m[1]);
    expect(orden).toEqual(["sin_justificacion", "pendiente", "justificado"]);
    const tokens = leer("nuxt-app/app/assets/tokens.css");
    for (const t of ["--viz-sin-justificar: #D03B3B", "--viz-por-justificar: #E9A100", "--viz-justificado:    #0CA30C"]) {
      expect(tokens).toContain(t);
    }
  });
});

describe("tiempos muertos — el endpoint de indicadores", () => {
  const api = leer("nuxt-app/server/api/indicadores/index.get.ts");

  // Lo que sigue en curso no es tiempo laborado, pero tampoco tiempo muerto.
  it("lo abierto solo sirve para no inventar huecos", () => {
    expect(api).toContain("data: agregarIndicadores({ personas, tiempos, unidades, desde, hasta })");
    expect(api).toContain("tiempos: [...tiempos, ...enCurso]");
  });

  // Un reloj olvidado desde ayer taparia todos los huecos de hoy.
  it("un reloj abierto cuenta como mucho hasta el final de su dia", () => {
    expect(api).toContain("Math.min(ahora.getTime(), finDelDiaBogota(inicio).getTime())");
  });

  it("solo lee justificaciones vigentes", () => {
    expect(api).toMatch(/justificacionTiempoMuerto\.findMany\(\{\s*where: \{\s*deletedAt: null/);
  });
});

describe("tiempos muertos — justificar y quitar", () => {
  const post = leer("nuxt-app/server/api/indicadores/tiempos-muertos/index.post.ts");
  const del = leer("nuxt-app/server/api/indicadores/tiempos-muertos/[id].delete.ts");

  it("solo supervision justifica, y con las reglas de la funcion pura", () => {
    expect(post).toContain("assertGestorMontacargas(actor.role");
    expect(post).toContain("validarJustificacion({");
    expect(del).toContain("assertGestorMontacargas(actor.role");
  });

  it("solo se justifica el tiempo de montacarguistas y operarios", () => {
    expect(post).toContain("role: { in: [...MEDIDOS] }");
    expect(post).toContain("validos !== ids.length");
  });

  // Corregir no borra: la nueva manda y la vieja queda como historia.
  it("justificar otra vez no borra la anterior", () => {
    expect(post).toContain("createManyAndReturn");
    expect(post).not.toMatch(/updateMany|deleteMany|\.delete\(/);
  });

  it("quitar es un borrado logico", () => {
    expect(del).toContain("data: { deletedAt: new Date() }");
    expect(del).not.toMatch(/\.delete\(|deleteMany/);
  });

  it("queda en auditoria", () => {
    expect(post).toContain("activityLog.create");
    expect(del).toContain("activityLog.create");
  });
});

describe("tiempos muertos — base de datos", () => {
  it("la tabla esta en los dos schemas y en un script aditivo", () => {
    for (const rel of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      expect(leer(rel)).toContain("model JustificacionTiempoMuerto {");
      expect(leer(rel)).toContain('@@map("justificaciones_tiempo_muerto")');
    }
    const sql = leer("prisma/migrate-tiempos-muertos.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS justificaciones_tiempo_muerto");
    expect(sql).not.toMatch(/DROP |ALTER TABLE users/);
  });

  // La API publica de Supabase no debe poder leerla con la clave anonima.
  it("la tabla nace con RLS", () => {
    expect(leer("prisma/migrate-tiempos-muertos.sql"))
      .toContain("ALTER TABLE justificaciones_tiempo_muerto ENABLE ROW LEVEL SECURITY");
  });
});

describe("tiempos muertos — la pantalla", () => {
  const modulo = leer("nuxt-app/app/components/indicadores/Module.vue");
  const vista = leer("nuxt-app/app/components/indicadores/TiemposMuertos.vue");

  it("es una pestaña de Indicadores, con lo que falta por justificar a la vista", () => {
    expect(modulo).toContain("<IndicadoresTiemposMuertos");
    expect(modulo).toContain('class="badge-tab">{{ porJustificar }}');
  });

  it("se justifican varios a la vez", () => {
    expect(vista).toContain("Justificar seleccionados");
    expect(leer("nuxt-app/app/components/indicadores/JustificarModal.vue"))
      .toContain("tramos: props.tramos.map((t) => ({ usuarioId: t.usuarioId, inicio: t.inicio, fin: t.fin }))");
  });

  it("sus graficos tambien tienen tabla", () => {
    const tarjetas = (vista.match(/<IndicadoresTarjeta\b/g) ?? []).length;
    expect(tarjetas).toBe(2);
    expect((vista.match(/<template #tabla>/g) ?? []).length).toBe(tarjetas);
  });

  it("los textos llegan como texto, nunca como HTML", () => {
    for (const rel of [
      "nuxt-app/app/components/indicadores/TiemposMuertos.vue",
      "nuxt-app/app/components/indicadores/JustificarModal.vue",
      "nuxt-app/app/components/indicadores/BarrasApiladas.vue",
    ]) {
      expect(leer(rel)).not.toContain("v-html");
    }
  });
});
