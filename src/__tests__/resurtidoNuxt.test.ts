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
    "puedeBorrarPendiente",
    "exigeMotivoBorrado",
    "validarMotivoBorrado",
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
    expect(iniciarTarea).toContain("horaInicio: now");
  });

  // En un pendiente arranca con el PLU y la ubicacion inicial, igual que un
  // movimiento de deposito, y abre el tramo de quien lo empieza.
  it("el pendiente arranca escaneando el PLU y la ubicacion inicial", () => {
    expect(iniciarPend).toContain("validarEscaneoPlu");
    expect(iniciarPend).toContain("validarUbicacion(ubicacionInicial, 'La ubicación inicial')");
    expect(iniciarPend).toContain("data: { estado: 'EN_CURSO', horaInicio: now, ubicacionInicial }");
    expect(iniciarPend).toContain("abrirTramoPendiente(tx, id, actor.id, now)");
  });

  // Volver a escanear no puede borrar el tiempo que ya llevaba.
  it("volver a escanear no reinicia el reloj", () => {
    expect(iniciarTarea).toContain("tarea.horaInicio ? {} : { horaInicio: now }");
    // Si ya corre, solo se confirma el estado: no se toca horaInicio.
    expect(iniciarPend).toContain("if (p.horaInicio) {");
    expect(iniciarPend).toContain("where: { id }, data: { estado: 'EN_CURSO' }, include: PENDIENTE_INCLUDE,");
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
  // Asignar no arranca ningun reloj; reasignar uno en marcha cierra el tramo de
  // quien lo tenia y el nuevo operario empieza desde cero.
  it("asignar no arranca ningun reloj", () => {
    expect(asignar).not.toContain("horaInicio: now");
    expect(asignar).toContain("horaInicio: null");
    expect(asignar).toContain("await cerrarTramoPendiente(tx, id, now)");
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
    expect(traspasar).toContain("pasadoPorId: parsed.data.devolucion ? null : actor.id");
    expect(traspasar).toContain("operarioId: ayudante.id");
  });

  // Como en todos los procesos del CEDI: pasarlo empezado no reinicia el reloj.
  // Se cierra el tramo de quien lo tenia y se abre el del ayudante.
  it("pasarlo empezado no reinicia el reloj: cada uno queda con su tramo", () => {
    expect(traspasar).not.toContain("horaInicio: null");
    expect(traspasar).toContain("await cerrarTramoPendiente(tx, id, now)");
    expect(traspasar).toContain("await abrirTramoPendiente(tx, id, ayudante.id, now)");
    expect(traspasar).toContain("estado: empezado ? 'EN_CURSO' : 'ASIGNADO'");
  });

  it("ubicarlo cierra el tramo del ayudante y avisa tambien a quien se lo paso", () => {
    const completarPend = leer("nuxt-app/server/api/pendientes/[id]/completar.post.ts");
    expect(completarPend).toContain("await cerrarTramoPendiente(tx, id, now)");
    expect(completarPend).toContain("p.pasadoPorId && p.pasadoPorId !== actor.id");
  });

  it("la pantalla pide la ubicacion inicial y dice quien se lo paso", () => {
    const ui = leer("nuxt-app/app/components/resurtido/PendientesTareas.vue");
    expect(ui).toContain("body: { plu: escaneoPlu.value.trim(), ubicacionInicial: ubicacionInicial.value.trim() }");
    expect(ui).toContain("te lo pasó: tú lo ubicas y cierras");
  });

  it("en indicadores cada persona suma su tramo del pendiente", () => {
    const ind = leer("nuxt-app/server/api/indicadores/index.get.ts");
    expect(ind).toContain("tramos: { select: { usuarioId: true, inicio: true, fin: true } }");
    expect(ind).toContain("const base = { usuarioId: t.usuarioId, inicio: t.inicio, tipo: 'pendiente' as const, registro }");
  });

  it("la tabla de tramos esta en los dos schemas, en un script aditivo y con RLS", () => {
    for (const rel of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      expect(leer(rel)).toContain("model TramoPendiente {");
    }
    const sql = leer("prisma/migrate-tramos-pendiente.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS tramos_pendiente");
    expect(sql).toContain("ALTER TABLE tramos_pendiente ENABLE ROW LEVEL SECURITY");
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

// Borrar pendientes: Viviana (quien lo pide), Felipe Ossa y Eduardo Zurita
// (permiso por persona) y el administrador.
describe("pendientes — borrar", () => {
  const del = leer("nuxt-app/server/api/pendientes/[id]/index.delete.ts");
  const ui = leer("nuxt-app/app/components/pendientes/Module.vue");

  it("el servidor aplica la misma regla que la pantalla", () => {
    expect(del).toContain("puedeBorrarPendiente({");
    expect(del).toContain("esAdmin: actor.role === 'ADMIN'");
    expect(del).toContain("tienePermisoMontar: await puedeMontarResurtido(actor.id)");
    expect(del).toContain("esQuienLoPidio: p.solicitadoPorId === actor.id");
    expect(ui).toContain("puedeBorrarPendiente({");
  });

  // Se borra con deleted_at: queda en auditoria y no rompe lo que lo referencia.
  it("es un borrado logico y queda en auditoria", () => {
    expect(del).toContain("data: { deletedAt: new Date(), borradoPorId: actor.id, motivoBorrado: motivo }");
    expect(del).not.toMatch(/pendienteGourmet\.delete\(|deleteMany/);
    expect(del).toContain("activityLog.create");
  });

  // Si iba sumado a un resurtido, el operario no debe bajar unidades que ya
  // nadie espera, ni seguir viendo la tarea en rojo por un pendiente borrado.
  it("devuelve las unidades de la tarea de resurtido y le quita la prioridad", () => {
    expect(del).toContain("unidadesPendientes: Math.max(0, tarea.unidadesPendientes - p.unidadesSolicitadas)");
    expect(del).toContain("...(quedan === 0 && { prioridad: false })");
  });

  it("un pendiente borrado no se da por ubicado al completar la tarea", () => {
    expect(leer("nuxt-app/server/api/resurtido-tareas/[id]/completar.post.ts"))
      .toContain("where: { tareaResurtidoId: id, estado: { not: 'COMPLETADO' }, deletedAt: null }");
  });

  it("se avisa al operario que lo tenia y a quien lo pidio", () => {
    expect(del).toContain("tipo: 'PENDIENTE_BORRADO'");
    expect(del).toContain("if (p.solicitadoPorId !== actor.id)");
  });

  it("se confirma antes de borrar, con el motivo", () => {
    const modal = leer("nuxt-app/app/components/pendientes/BorrarModal.vue");
    expect(modal).toContain('title="Borrar pendiente"');
    expect(modal).toContain("validarMotivoBorrado(props.pendiente.estado, motivo.value)");
    expect(ui).toContain("<PendientesBorrarModal");
    expect(ui).toContain("body: { motivo: motivo || undefined }");
  });

  // Los ubicados tambien se borran, solo el administrador y con justificante,
  // que queda guardado en el pendiente y en auditoria.
  it("el servidor exige y guarda el justificante", () => {
    expect(del).toContain("validarMotivoBorrado(p.estado, body.motivo)");
    expect(del).toContain("data: { deletedAt: new Date(), borradoPorId: actor.id, motivoBorrado: motivo }");
    expect(del).toContain("(motivo ? ` — motivo: ${motivo}` : '')");
    for (const rel of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      expect(leer(rel)).toContain('motivoBorrado String? @map("motivo_borrado")');
    }
    expect(leer("prisma/migrate-borrado-pendientes.sql")).toContain("ADD COLUMN IF NOT EXISTS motivo_borrado");
  });

  it("las tarjetas de ubicados tambien ofrecen borrar a quien puede", () => {
    const ubicados = ui.slice(ui.indexOf('v-for="p in cerrados"'));
    expect(ubicados.slice(0, 1500)).toContain('v-if="borrable(p)"');
  });

  // Con un solo limite para todo, al acumularse ubicados las devoluciones y
  // novedades desaparecian de la pantalla.
  it("lo abierto nunca se queda fuera de la lista por el limite", () => {
    const get = leer("nuxt-app/server/api/pendientes/index.get.ts");
    expect(get).toContain("where: { ...base, estado: { not: 'COMPLETADO' } }");
    expect(get).toContain("where: { ...base, estado: 'COMPLETADO' }");
  });
});

// "Pasar a un ayudante" en un pendiente sin resurtido: la lista de ayudantes
// se pedia a Montaje Resurtido, que es solo de supervision; al operario le
// respondia 403 en silencio y la lista quedaba vacia.
describe("pendientes — pasar a un ayudante", () => {
  const pend = leer("nuxt-app/app/components/resurtido/PendientesTareas.vue");
  const tareas = leer("nuxt-app/app/components/resurtido/Tareas.vue");

  it("la lista de ayudantes sale de un servicio que el operario si puede leer", () => {
    expect(pend).toContain("`${API_MONTACARGAS}/ayudantes`");
    expect(pend).not.toContain("API_MONTAJE}/operarios");
    // Si falla, se dice; no se deja la lista vacia sin explicacion.
    expect(pend).toContain("No se pudo cargar la lista de ayudantes");
  });

  it("la opcion esta a la vista en la lista y en la tarjeta roja de Resurtido", () => {
    expect(pend).toContain('@click="pasarDesdeLista(p)"');
    expect(tareas).toContain("emit('irAPendientes', { id: p.id, pasar: true })");
    expect(leer("nuxt-app/app/pages/resurtido.vue")).toContain(':enfocar="enfocar"');
  });

  it("el servidor deja pasar a operarios y montacarguistas, igual que la lista", () => {
    const tras = leer("nuxt-app/server/api/pendientes/[id]/traspasar.post.ts");
    expect(tras).toContain("role: { in: ['OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'] }");
  });
});

// Viviana tambien reparte lo suyo: su selector sacaba la lista de Montaje
// Resurtido, que es solo de supervision, y le salia vacio.
describe("pendientes — a quien asignar", () => {
  it("la lista sale de Pendientes y la puede leer quien pide", () => {
    const get = leer("nuxt-app/server/api/pendientes/operarios.get.ts");
    expect(get).toContain("assertVePendientes(actor.role)");
    expect(get).toContain("listarOperarios()");
    const ui = leer("nuxt-app/app/components/pendientes/Module.vue");
    expect(ui).toContain("`${API_PENDIENTES}/operarios`");
    expect(ui).not.toContain("API_MONTAJE}/operarios");
  });
});

// Toda tarea de resurtido se puede pasar a un ayudante, como en todos los
// procesos: la opcion no existia y el operario no tenia a quien pasarsela.
describe("resurtido — pasar una tarea a un ayudante", () => {
  const tras = leer("nuxt-app/server/api/resurtido-tareas/[id]/traspasar.post.ts");
  const iniciar = leer("nuxt-app/server/api/resurtido-tareas/[id]/iniciar.post.ts");
  const completar = leer("nuxt-app/server/api/resurtido-tareas/[id]/completar.post.ts");
  const lista = leer("nuxt-app/server/api/resurtido-tareas/index.get.ts");
  const ui = leer("nuxt-app/app/components/resurtido/Tareas.vue");

  it("solo quien la tiene, y con el reloj corriendo", () => {
    expect(tras).toContain("if (responsableDeTarea(tarea) !== actor.id)");
    expect(tras).toContain("if (!tarea.horaInicio)");
    expect(tras).toContain("role: { in: [...ROLES_RECEPTORES] }");
  });

  it("el reloj no se reinicia: cada uno queda con su tramo", () => {
    expect(tras).toContain("await cerrarTramoTarea(tx, id, now)");
    expect(tras).toContain("await abrirTramoTarea(tx, id, ayudante.id, now)");
    expect(tras).toContain("responsableId: ayudante.id === tarea.montaje.operarioId ? null : ayudante.id");
    expect(tras).not.toContain("horaInicio: null");
    expect(tras).toContain("TAREA_RESURTIDO_PASADA");
    expect(tras).toContain("activityLog.create");
  });

  it("empezarla abre el tramo y cerrarla lo cierra, siempre por el responsable", () => {
    expect(iniciar).toContain("responsableDeTarea(tarea) !== actor.id");
    expect(iniciar).toContain("abrirTramoTarea(tx, id, actor.id, now)");
    expect(completar).toContain("responsableDeTarea(tarea) !== actor.id");
    expect(completar).toContain("await cerrarTramoTarea(tx, id, now)");
    // La tarea roja lleva su pendiente: se da por ubicado al cerrarla.
    expect(completar).toContain("tareaResurtidoId: id");
  });

  it("el ayudante la ve en su lista y la pantalla tiene la opcion", () => {
    expect(lista).toContain("recibidas: recibidas.map(mapTareaResurtido)");
    expect(ui).toContain("`/api/resurtido-tareas/${t.id}/traspasar`");
    expect(ui).toContain('v-if="esMia(t) && t.horaInicio" class="btn btn-sm pasar-lista"');
    expect(ui).toContain("te la pasó: tú la cierras");
  });

  it("indicadores reparte el tiempo de la tarea por persona", () => {
    const ind = leer("nuxt-app/server/api/indicadores/index.get.ts");
    expect(ind).toContain("const tramosTarea = t.tramos.length > 0");
    expect(ind).toContain("usuarioId: t.responsableId ?? t.montaje.operarioId");
  });

  it("la tabla de tramos esta en los dos schemas, en un script aditivo y con RLS", () => {
    for (const rel of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      expect(leer(rel)).toContain("model TramoTareaResurtido {");
      expect(leer(rel)).toContain('responsableId String? @map("responsable_id")');
    }
    const sql = leer("prisma/migrate-tramos-tarea-resurtido.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS tramos_tarea_resurtido");
    expect(sql).toContain("ALTER TABLE tramos_tarea_resurtido ENABLE ROW LEVEL SECURITY");
  });
});

// Una respuesta vieja de otra pestaña no puede pintar encima de la actual.
describe("control montacargas — no mezclar pestañas", () => {
  const modulo = leer("nuxt-app/app/components/montacargas/Module.vue");
  it("solo pinta la ultima carga y vacia al cambiar de pestaña", () => {
    expect(modulo).toContain("if (seq !== seqLista) return");
    expect(modulo).toContain("if (seq !== seqAbiertos) return");
    expect(modulo).toContain("if (seq !== seqConteos) return");
    expect(modulo).toContain("abiertos.value = []");
  });
});

// Si al ayudante no le cabe NINGUNA unidad, en todos los modulos devuelve el
// total a quien se lo paso, con el reloj corriendo.
describe("devolver el total cuando no cupo nada", () => {
  it("montacargas: 0 unidades devuelve el registro entero sin ubicacion", () => {
    const ub = leer("nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts");
    expect(ub).toContain("const devuelveTodo = parsed.data.unidadesAlmacenadas === 0");
    expect(ub).toContain("await abrirTramo(tx, id, devolverA, now, orden + 1)");
    expect(ub).toContain("devueltoCompleto: true");
    const reg = leer("nuxt-app/app/components/montacargas/RegistroAbierto.vue");
    expect(reg).toContain("No cupo ninguna: devolver todo");
    expect(reg).toContain('v-if="!devuelveTodo" class="f f-ubic"');
  });

  it("pendientes y tareas de resurtido: se devuelve a quien lo paso", () => {
    for (const rel of [
      "nuxt-app/app/components/resurtido/PendientesTareas.vue",
      "nuxt-app/app/components/resurtido/Tareas.vue",
    ]) {
      const ui = leer(rel);
      expect(ui).toContain("devolucion: true");
      expect(ui).toContain("No pude almacenar ninguna");
    }
    for (const rel of [
      "nuxt-app/server/api/pendientes/[id]/traspasar.post.ts",
      "nuxt-app/server/api/resurtido-tareas/[id]/traspasar.post.ts",
    ]) {
      const srv = leer(rel);
      expect(srv).toContain("devolucion: z.boolean().optional()");
      expect(srv).toContain("pasadoPorId: parsed.data.devolucion ? null : actor.id");
    }
    expect(leer("nuxt-app/server/utils/mapRow.ts")).toContain("pasadoPorId: p.pasadoPorId ?? null");
  });
});

// Cuando el turno se acaba sin terminar el resurtido, supervision le pasa lo que
// falta a otro operario.
describe("montaje — reasignar lo que falta", () => {
  const re = leer("nuxt-app/server/api/montaje-resurtido/[id]/reasignar.post.ts");
  const lista = leer("nuxt-app/server/api/resurtido-tareas/index.get.ts");
  const ui = leer("nuxt-app/app/components/montaje/Module.vue");

  it("solo quien puede montar, dentro del bloqueo de operaciones", () => {
    expect(re).toContain("defineOperacionAlmacenHandler");
    expect(re).toContain("await assertPuedeMontar(actor.id)");
  });

  // Lo hecho es del primero y sigue en sus indicadores.
  it("no toca las completadas y pasa las en curso con el reloj corriendo", () => {
    expect(re).toContain("where: { estado: { not: 'COMPLETADA' } }");
    expect(re).toContain("await cerrarTramoTarea(tx, t.id, now)");
    expect(re).toContain("await abrirTramoTarea(tx, t.id, nuevo.id, now)");
    expect(re).not.toContain("horaInicio: null");
    expect(re).toContain("RESURTIDO_REASIGNADO");
    expect(re).toContain("activityLog.create");
  });

  it("el nuevo operario ve el resurtido reasignado entero", () => {
    expect(lista).toContain("reasignados: reasignados.map(mapMontaje)");
    expect(lista).toContain("tareas: { some: { responsableId: actor.id, pasadoPorId: null");
    expect(leer("nuxt-app/app/components/resurtido/Tareas.vue")).toContain("Reasignado de {{ r.de }}");
  });

  it("un pendiente cruza con la tarea de quien la tiene en la mano", () => {
    expect(leer("nuxt-app/server/api/pendientes/[id]/asignar.post.ts"))
      .toContain("{ responsableId: operario.id }");
  });

  it("supervision tiene el boton y ve quien tiene cada tarea", () => {
    expect(ui).toContain("Reasignar lo que falta");
    expect(ui).toContain("`${API_MONTAJE}/${m.id}/reasignar`");
    expect(ui).toContain("<th>Responsable</th>");
  });
});

// Al asignar un pendiente que no cruza con el resurtido, el teorico vigente
// dice de que altura sacarlo y a que picking llevarlo.
describe("pendientes — altura y picking sugeridos por el teorico", () => {
  const asignar = leer("nuxt-app/server/api/pendientes/[id]/asignar.post.ts");
  const util = leer("nuxt-app/server/utils/sugerenciaPendiente.ts");

  it("se calcula solo sin cruce con el resurtido y se recalcula al reasignar", () => {
    expect(asignar).toContain("const sugerencia = tarea");
    expect(asignar).toContain("calcularSugerenciaPendiente(tx, { id, plu: p.plu, unidadesSolicitadas: p.unidadesSolicitadas }, now)");
    expect(asignar).toContain("Prisma.DbNull");
    expect(asignar).toContain("textoSugerencia(sugerencia)");
  });

  it("usa el teorico de las ultimas 12 horas, la capacidad registrada y descuenta lo comprometido", () => {
    expect(util).toContain("teoricoVigente(teorico.creadoAt, ahora)");
    expect(util).toContain("tx.pickingCapacidad.findUnique");
    expect(util).toContain("estado: { in: ['ASIGNADO', 'EN_CURSO'] }");
    expect(util).toContain("tx.tareaResurtido.findMany");
  });

  it("el operario y el modulo Pendientes lo ven; supervision tiene el registro de desvios", () => {
    expect(leer("nuxt-app/app/components/resurtido/PendientesTareas.vue")).toContain("<PendientesSugerencia");
    expect(leer("nuxt-app/app/components/pendientes/Module.vue")).toContain("<PendientesSugerencia");
    const api = leer("nuxt-app/server/api/indicadores/ubicaciones-pendientes.get.ts");
    expect(api).toContain("actor.role === 'ADMIN' || (await puedeMontarResurtido(actor.id))");
    expect(api).toContain("desvioSugerencia(s, p.ubicacionInicial, p.ubicacionFinal)");
    expect(leer("nuxt-app/app/components/indicadores/Module.vue")).toContain("<IndicadoresUbicaciones");
  });
});
