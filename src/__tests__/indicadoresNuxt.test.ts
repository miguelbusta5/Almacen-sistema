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
    expect(api).toContain("agregarIndicadores({ personas: delTurno, tiempos, unidades, ventanas, desde, hasta })");
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
    expect(api).toContain("data: agregarIndicadores({ personas: delTurno, tiempos, unidades, ventanas, desde, hasta })");
    expect(api).toContain("tiempos: [...tiempos, ...enCurso]");
  });

  // Un reloj olvidado desde ayer taparia todos los huecos de hoy.
  // ...salvo que sea de un turno de noche: entonces llega hasta el fin del turno.
  it("un reloj abierto cuenta como mucho hasta el final de su dia o de su turno", () => {
    expect(api).toContain("Math.max(finDelDiaBogota(inicio).getTime(), turno?.fin.getTime() ?? 0)");
    expect(api).toContain("new Date(Math.min(ahora.getTime(), tope))");
  });

  // El turno de noche se mide entero: se trae la madrugada siguiente y el turno
  // de la noche anterior, que se lleva la madrugada del primer dia.
  it("el turno de noche no se corta a medianoche", () => {
    expect(api).toContain("const finConsulta = new Date(fin.getTime() + 24 * 60 * 60 * 1000)");
    expect(api).toContain("for (const dia of diasDelRango(diaAnterior, hasta))");
    expect(api).toContain("inicio: { lt: finConsulta }");
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

describe("cuadro de turnos — la copia de Nitro es la fuente sin punto y coma", () => {
  it("el cuerpo es identico", () => {
    const cuerpo = (src: string) => src.split("\n\n").slice(1).join("\n\n").replace(/;\n/g, "\n");
    expect(cuerpo(leer("nuxt-app/server/utils/turnosCalc.ts")).replace(/from '\.\/excel'/, 'from "./excel"'))
      .toBe(cuerpo(leer("src/lib/turnos.ts")));
  });
});

describe("cuadro de turnos — subirlo y usarlo", () => {
  const post = leer("nuxt-app/server/api/turnos/index.post.ts");
  const api = leer("nuxt-app/server/api/indicadores/index.get.ts");

  it("solo supervision lo sube, y se guarda para un rango de fechas", () => {
    expect(post).toContain("assertGestorMontacargas(actor.role");
    expect(post).toContain("mapCuadroTurnos(worksheetRows(hoja))");
    expect(post).toContain("cuadroTurnos.create");
  });

  // Cargarle el turno a quien no es seria peor que no cargarlo: los nombres que
  // no casan se devuelven para que operacion los revise.
  it("avisa de a quien no pudo identificar", () => {
    expect(post).toContain("emparejarUsuario(fila.nombre, emparejables)");
    expect(post).toContain("sinIdentificar");
    expect(post).toContain("noMedidos");
  });

  // Subir uno corregido no obliga a borrar el anterior.
  it("cada dia usa el cuadro mas reciente que lo cubra", () => {
    expect(api).toContain("orderBy: { createdAt: 'desc' }");
    expect(api).toContain("const cuadro = cuadros.find(");
    expect(api).toContain("ventanaTurno(dia, { inicioMin: t.inicioMin, finMin: t.finMin })");
  });

  it("la jornada y la efectividad van con los indicadores y los tiempos muertos", () => {
    expect(api).toContain("agregarIndicadores({ personas: delTurno, tiempos, unidades, ventanas, desde, hasta })");
    expect(api).toContain("justificaciones, ventanas, desde, hasta");
  });

  it("las tablas estan en los dos schemas, en un script aditivo y con RLS", () => {
    for (const rel of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      expect(leer(rel)).toContain("model CuadroTurnos {");
      expect(leer(rel)).toContain("model TurnoOperario {");
    }
    const sql = leer("prisma/migrate-cuadro-turnos.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS cuadros_turno");
    expect(sql).toContain("ALTER TABLE turnos_operario ENABLE ROW LEVEL SECURITY");
  });
});

describe("indicadores — nada de sumar horas de varias personas", () => {
  const modulo = leer("nuxt-app/app/components/indicadores/Module.vue");

  // La suma de las horas de todos da mas que cualquier turno y no se puede leer.
  it("la cifra grande es la efectividad, o el tiempo de una sola persona", () => {
    expect(modulo).toContain("label: 'Efectividad del turno'");
    expect(modulo).toContain("label: `Tiempo real de ${p.nombre}`");
    expect(modulo).not.toContain("fmtTiempo(resumen!.segundos)");
  });

  it("la evolucion diaria es por persona", () => {
    expect(modulo).toContain("<IndicadoresEvolucionPersonas");
    const evo = leer("nuxt-app/app/components/indicadores/EvolucionPersonas.vue");
    // Mismo tope en todas: si cada una se escala a lo suyo, no se comparan.
    expect(evo).toContain(":maximo=\"tope\"");
    expect(evo).toContain("<template #tabla>");
  });

  // Lo que el usuario pidio ver: efectividad por persona, no del equipo.
  it("hay un grafico de efectividad por persona", () => {
    expect(modulo).toContain('titulo="Efectividad del turno por persona"');
    expect(modulo).toContain(":eje-maximo=\"100\"");
    // Tiempo de movimiento dentro del turno sobre la jornada: si registran
    // tiempos bajos, la efectividad sale baja.
    expect(modulo).toContain("valor: p.efectividad ?? 0");
    expect(modulo).toContain("etiqueta: 'con mercancía en la mano', valor: fmtTiempo(p.segundosEnTurno)");
    expect(modulo).toContain("const sinTurno = computed(");
  });

  // La barra de cada persona se lee contra su jornada.
  it("el tiempo por persona se compara con su turno", () => {
    const tp = leer("nuxt-app/app/components/indicadores/TiempoPersonas.vue");
    expect(tp).toContain("fondo: p.jornadaSegundos || undefined");
    expect(tp).toContain("efectividad del turno");
  });
});

// Turno dia y turno noche se miran por separado: la noche va completa, con su
// madrugada, y no se mezcla con el personal de dia.
describe("indicadores — turno dia / turno noche", () => {
  const api = leer("nuxt-app/server/api/indicadores/index.get.ts");
  const modulo = leer("nuxt-app/app/components/indicadores/Module.vue");

  it("el endpoint clasifica a cada persona y filtra por turno", () => {
    expect(api).toContain("const turno = esJornada(sp.turno) ? sp.turno : null");
    expect(api).toContain("clasificarJornadas({");
    expect(api).toContain("agregarIndicadores({ personas: delTurno, tiempos, unidades, ventanas, desde, hasta })");
    // Los turnos de todo el equipo, para clasificar tambien el selector.
    expect(api).toContain("const medidosIds = new Set(equipo.map((u) => u.id))");
  });

  it("la pantalla tiene el selector, presets de noche y lo recuerda", () => {
    expect(modulo).toContain("Turno noche");
    expect(modulo).toContain("turno: jornada.value");
    expect(modulo).toContain("PRESETS_NOCHE");
    expect(modulo).toContain("localStorage.setItem(CLAVE_JORNADA, j)");
    expect(leer("nuxt-app/app/utils/indicadores.ts"))
      .toContain("if (preset === 'anoche') return { desde: moverDias(hoy, -1), hasta: moverDias(hoy, -1) }");
  });
});
