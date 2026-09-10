import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

const fuente = leer("src/lib/resurtidoTareas.ts");
const calcServidor = leer("nuxt-app/server/utils/resurtidoCalc.ts");
const calcCliente = leer("nuxt-app/app/utils/resurtidoTareas.ts");

describe("resurtido por tareas — las tres copias de la logica", () => {
  const funciones = [
    "columnasResurtido",
    "mapFilaResurtido",
    "ordenarPorPosicion",
    "compararUbicaciones",
    "validarEscaneoPosicion",
    "validarEscaneoPlu",
    "validarCierreTarea",
    "progresoMontaje",
    "validarSolicitudPendiente",
    "validarCierrePendiente",
    "segundosEntre",
    "colorPendiente",
    "compararPorPrioridad",
    "devuelveASolicitante",
    "puedeAsignarPendiente",
  ];

  it.each(funciones)("%s existe en las tres", (fn) => {
    for (const src of [fuente, calcServidor, calcCliente]) {
      expect(src).toContain(`export function ${fn}`);
    }
  });
});

// El reloj de cada flujo arranca en un sitio distinto y eso es la mitad de lo
// que mide el modulo.
describe("resurtido por tareas — donde arranca el reloj", () => {
  const iniciarTarea = leer("nuxt-app/server/api/resurtido-tareas/[id]/iniciar.post.ts");
  const completarTarea = leer("nuxt-app/server/api/resurtido-tareas/[id]/completar.post.ts");
  const iniciarPend = leer("nuxt-app/server/api/pendientes/[id]/iniciar.post.ts");

  // En resurtido arranca al ESCANEAR LA POSICION: asi mide caminar y bajar la
  // mercancia, no el rato que la tarea estuvo abierta en la pantalla.
  it("la tarea de resurtido arranca escaneando la ubicacion", () => {
    expect(iniciarTarea).toContain("validarEscaneoPosicion");
    expect(iniciarTarea).toContain("horaInicio: new Date()");
  });

  // En un pendiente arranca con el PLU, igual que un movimiento de deposito.
  it("el pendiente arranca escaneando el PLU", () => {
    expect(iniciarPend).toContain("validarEscaneoPlu");
    expect(iniciarPend).toContain("horaInicio: new Date()");
  });

  // Volver a escanear no puede borrar el tiempo que ya llevaba.
  it("volver a escanear no reinicia el reloj", () => {
    expect(iniciarTarea).toContain("tarea.horaInicio ? {} : { horaInicio: new Date() }");
    expect(iniciarPend).toContain("p.horaInicio ? {} : { horaInicio: new Date() }");
  });

  it("no se puede cerrar una tarea que nunca se inicio", () => {
    expect(completarTarea).toContain("if (!tarea.horaInicio)");
    expect(completarTarea).toContain("es lo que arranca el reloj");
  });
});

describe("montaje de resurtido", () => {
  const post = leer("nuxt-app/server/api/montaje-resurtido/index.post.ts");

  // Montar reparte trabajo; no lo hace. Lo que se cronometra es cada tarea.
  it("subir el archivo no arranca ningun reloj", () => {
    expect(post).not.toContain("horaInicio");
    expect(post).toContain("montadoAt: now");
  });

  // El NOMBRE del archivo puede venir de una exportacion vieja y mandaria al
  // operario a coger un producto distinto del que dice la etiqueta.
  it("la descripcion sale del maestro, no de la columna NOMBRE", () => {
    expect(post).toContain("prisma.productoMaestro.findMany");
    expect(post).toContain("no de la columna NOMBRE del archivo");
    // Y si un PLU no esta en el maestro, se rechaza el archivo entero en vez de
    // montar tareas que el operario no va a poder identificar.
    expect(post).toContain("no estan en el maestro");
  });

  it("las tareas se guardan ordenadas por posicion", () => {
    expect(post).toContain("ordenarPorPosicion");
    expect(post).toContain("orden: i + 1");
  });

  // Permiso POR PERSONA, igual que el de cerrar novedades.
  it("montar es un permiso por persona, no por rol", () => {
    expect(post).toContain("assertPuedeMontar");
    const utils = leer("nuxt-app/server/utils/resurtido.ts");
    expect(utils).toContain("puedeMontarResurtido");
    expect(utils).toContain("no por rol");
    // Se lee de la base, no del token: concederlo o quitarlo tiene efecto sin
    // volver a iniciar sesion.
    expect(utils).toContain("prisma.user.findUnique");
  });
});

describe("pendientes de gourmet", () => {
  const post = leer("nuxt-app/server/api/pendientes/index.post.ts");
  const asignar = leer("nuxt-app/server/api/pendientes/[id]/asignar.post.ts");
  const completar = leer("nuxt-app/server/api/pendientes/[id]/completar.post.ts");

  it("solo gourmet solicita", () => {
    expect(post).toContain("esSolicitante(actor.role)");
  });

  // Repartir no es hacer: a quien asigna no se le mide tiempo.
  it("asignar no arranca ningun reloj", () => {
    expect(asignar).not.toContain("horaInicio");
    expect(asignar).toContain("asignadoAt: now");
  });

  // Es justo el dato que estaban esperando.
  it("al ubicarlo avisa a quien lo pidio y a quien lo repartio", () => {
    expect(completar).toContain("p.solicitadoPorId");
    expect(completar).toContain("p.asignadoPorId");
    expect(completar).toContain("idsAlmacenamiento");
    expect(completar).toContain("PENDIENTE_COMPLETADO");
  });
});

// Un aviso que se pierde al recargar no sirve para enterarse de algo que paso
// mientras no mirabas.
describe("avisos — persisten hasta que se ven", () => {
  const layout = leer("nuxt-app/app/layouts/default.vue");

  it("la campana trae los avisos guardados, no solo el trabajo del momento", () => {
    expect(layout).toContain("/api/notificaciones");
    expect(layout).toContain("const sinLeer = computed(");
  });

  it("hay una alerta visual que permanece hasta abrir la campana", () => {
    expect(layout).toContain('v-if="sinLeer > 0" class="alerta"');
    expect(layout).toContain("marcarVistos");
    // Abrir el panel ES verlos.
    expect(layout).toContain("if (panel.value === 'avisos') void marcarVistos()");
  });
});

describe("resurtido — las tres pestanas", () => {
  const pagina = leer("nuxt-app/app/pages/resurtido.vue");

  it("separa resurtido, movimientos y pendientes", () => {
    expect(pagina).toContain("ResurtidoTareas");
    expect(pagina).toContain("MontacargasModule");
    expect(pagina).toContain("ResurtidoPendientesTareas");
    expect(pagina).toContain("FLUJOS.MOVIMIENTO");
  });

  // Dos cabeceras seguidas se leen como dos modulos distintos.
  it("el modulo embebido no pinta su propia cabecera", () => {
    expect(pagina).toContain("sin-hero");
    expect(leer("nuxt-app/app/components/montacargas/Module.vue"))
      .toContain('<section v-if="!sinHero" class="hero fade-in">');
  });

  // Movimientos esta en los DOS sitios a proposito: es el mismo flujo y los
  // mismos registros, pero el montacarguista lo busca en Control Montacargas y
  // el operario lo tiene junto al resto de sus tareas en Resurtido. Quitarlo de
  // Control Montacargas le escondio la pantalla a quien mas la usa.
  it("control montacargas conserva recepcion y movimientos", () => {
    const cm = leer("nuxt-app/app/pages/control-montacargas.vue");
    expect(cm).toContain("FLUJOS_MONTACARGAS");
    expect(leer("nuxt-app/app/utils/montacargas.ts"))
      .toContain("export const FLUJOS_MONTACARGAS: FlujoConfig[] = [FLUJOS.RECEPCION, FLUJOS.MOVIMIENTO]");
  });
});

describe("los modulos nuevos estan registrados", () => {
  it("las tres copias de modulePermissions los conocen", () => {
    for (const rel of [
      "src/lib/modulePermissions.ts",
      "nuxt-app/app/utils/modulePermissions.ts",
      "nuxt-app/server/utils/modulePermissions.ts",
    ]) {
      const src = leer(rel);
      expect(src).toContain("montaje-resurtido");
      expect(src).toContain("pendientes");
    }
  });

  it("el proxy de Next los enruta", () => {
    const cfg = leer("next.config.ts");
    expect(cfg).toContain('"montaje-resurtido"');
    expect(cfg).toContain('"pendientes"');
  });

  it("aparecen en la navegacion de los dos stacks", () => {
    for (const rel of ["nuxt-app/app/layouts/default.vue", "src/components/common/Sidebar.tsx"]) {
      const src = leer(rel);
      expect(src).toContain("/dashboard/montaje-resurtido");
      expect(src).toContain("/dashboard/pendientes");
    }
  });
});

describe("pendientes — correccion", () => {
  const patch = leer("nuxt-app/server/api/pendientes/[id]/index.patch.ts");

  it("solo quien lo pidio lo corrige, y solo si no se ubico", () => {
    expect(patch).toContain("p.solicitadoPorId !== actor.id");
    expect(patch).toContain("puedeEditarPendiente(p.estado)");
  });

  // El operario puede estar caminando hacia el sitio con la cifra vieja.
  it("si ya tenia operario, el cambio le avisa", () => {
    expect(patch).toContain("PENDIENTE_CORREGIDO");
  });
});

describe("pendientes — novedades del operario", () => {
  const novedad = leer("nuxt-app/server/api/pendientes/[id]/novedad.post.ts");

  // Muebles vuelve a quien lo pidio; el resto se queda en almacenamiento.
  it("muebles se devuelve y el resto queda con novedad", () => {
    expect(novedad).toContain("devuelveASolicitante(tipo)");
    expect(novedad).toContain("estado: 'DEVUELTO'");
    expect(novedad).toContain("estado: 'NOVEDAD'");
  });

  // No pudo hacerlo: contarle tiempo por eso seria medirle algo que no hizo.
  it("en los dos casos el reloj se descarta", () => {
    expect(novedad.match(/horaInicio: null/g)?.length).toBe(2);
  });

  it("la devolucion vieja se retiro", () => {
    const { existsSync } = require("node:fs") as typeof import("node:fs");
    expect(existsSync(path.join(process.cwd(), "nuxt-app/server/api/pendientes/[id]/devolver.post.ts")))
      .toBe(false);
  });

  it("la pantalla del operario ofrece las cuatro novedades", () => {
    const vue = leer("nuxt-app/app/components/resurtido/PendientesTareas.vue");
    expect(vue).toContain("NOVEDADES_PENDIENTE");
    expect(vue).toContain("Reportar novedad");
  });
});

describe("pendientes — pasar a un ayudante", () => {
  const traspasar = leer("nuxt-app/server/api/pendientes/[id]/traspasar.post.ts");

  it("existe y avisa al ayudante", () => {
    expect(traspasar).toContain("pasadoPorId: actor.id");
    expect(traspasar).toContain("operarioId: ayudante.id");
  });

  // El reloj es de quien lo termina.
  it("el reloj arranca de cero para el ayudante", () => {
    expect(traspasar).toContain("horaInicio: null");
  });

  // Uno sumado a un resurtido va con esa tarea: pasarlo suelto la partiria.
  it("no se pasa suelto uno que va dentro de un resurtido", () => {
    expect(traspasar).toContain("if (p.tareaResurtidoId)");
  });
});

// Un pendiente es alguien esperando en la tienda: va antes que la rutina.
describe("pendientes — prioridad sobre el resurtido", () => {
  const asignar = leer("nuxt-app/server/api/pendientes/[id]/asignar.post.ts");
  const completar = leer("nuxt-app/server/api/resurtido-tareas/[id]/completar.post.ts");
  const lista = leer("nuxt-app/server/api/resurtido-tareas/index.get.ts");

  // Si el PLU ya esta en su resurtido, no es una tarea aparte.
  it("si el PLU ya esta en el resurtido, se suma a esa tarea", () => {
    expect(asignar).toContain("plu: p.plu");
    expect(asignar).toContain("prioridad: true");
    expect(asignar).toContain("unidadesPendientes: tarea.unidadesPendientes + p.unidadesSolicitadas");
    expect(asignar).toContain("tareaResurtidoId: tarea.id");
  });

  // Completar la tarea ES ubicar el pendiente que iba dentro.
  it("completar la tarea ubica y avisa los pendientes que llevaba", () => {
    expect(completar).toContain("tareaResurtidoId: id");
    expect(completar).toContain("estado: 'COMPLETADO'");
    expect(completar).toContain("PENDIENTE_COMPLETADO");
  });

  it("los pendientes sueltos salen delante en la lista del operario", () => {
    expect(lista).toContain("prioritarios: pendientes.map(mapPendiente)");
    // Los sumados a una tarea no salen sueltos.
    expect(lista).toContain("tareaResurtidoId: null");
  });

  it("quien lo pidio tambien puede asignarlo", () => {
    expect(asignar).toContain("esQuienLoPidio: p.solicitadoPorId === actor.id");
  });

  it("reasignar limpia la novedad", () => {
    expect(asignar).toContain("tipoNovedad: null");
  });
});

describe("pendientes — color de la vineta", () => {
  it("la vineta toma su color del estado", () => {
    const vue = leer("nuxt-app/app/components/pendientes/Module.vue");
    expect(vue).toContain("colorPendiente(p.estado)");
    expect(vue).toContain(".vin.c-rojo");
    expect(vue).toContain(".vin.c-amarillo");
    expect(vue).toContain(".vin.c-verde");
  });
});

// La caja invitaba a escanear con la bandeja vacia y respondia "ese PLU no esta
// en tu bandeja" a todo, que es lo que estaba pasando en el CEDI.
describe("bandeja — no invitar a escanear sin nada que escanear", () => {
  const modulo = leer("nuxt-app/app/components/montacargas/Module.vue");

  it("la caja de escaneo solo sale si hay PLUs en la bandeja", () => {
    expect(modulo).toContain('v-if="mios.length > 0" class="escaneo card bloque"');
    expect(modulo).not.toContain('v-if="ayudante || recibidos.length > 0" class="escaneo');
  });

  it("el error dice que PLUs tiene, no solo que ese no es", () => {
    expect(modulo).toContain("No tienes ningún PLU asignado");
    expect(modulo).toContain("no es tuyo. Tienes:");
  });
});
