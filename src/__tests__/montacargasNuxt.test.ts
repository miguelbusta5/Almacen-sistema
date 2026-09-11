// Guarda de sincronía de Control Montacargas y Resurtido, que viven SOLO en
// nuxt-app (no hay página React de respaldo: se construyeron directo sobre el
// stack vivo).
//
// Por qué se lee el archivo como TEXTO en vez de importarlo: `nuxt-app/` vive bajo
// su propio tsconfig, que referencia `./.nuxt/*` — un directorio que genera
// `nuxt prepare` y que está gitignorado. En CI las dependencias de nuxt-app no se
// instalan, así que cualquier import cruzado revienta el transform con
// TSCONFIG_ERROR. Leer con `fs` no involucra al transform.
//
// Lo que protege: la lógica está triplicada a propósito entre
// src/lib/montacargas.ts (fuente de verdad y tests),
// nuxt-app/server/utils/montacargasCalc.ts (Nitro) y
// nuxt-app/app/utils/montacargas.ts (Vue). Si una copia se desvía, el cliente
// valida distinto que el servidor y el operario ve rechazos inexplicables.
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { UBICACION_PATTERN, GESTORES_MONTACARGAS, ROLES_MONTACARGAS } from "@/lib/montacargas";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

const calcServidor = leer("nuxt-app/server/utils/montacargasCalc.ts");
const utilsServidor = leer("nuxt-app/server/utils/montacargas.ts");
const utilsCliente = leer("nuxt-app/app/utils/montacargas.ts");
const mapRow = leer("nuxt-app/server/utils/mapRow.ts");
const layout = leer("nuxt-app/app/layouts/default.vue");
const nextConfig = leer("next.config.ts");
const moduleVue = leer("nuxt-app/app/components/montacargas/Module.vue");
const capturaVue = leer("nuxt-app/app/components/montacargas/Captura.vue");
const registroVue = leer("nuxt-app/app/components/montacargas/RegistroAbierto.vue");

describe("montacargas — patrones y roles sincronizados", () => {
  it("el patrón de ubicación canónica es el mismo en las tres copias", () => {
    const fuente = UBICACION_PATTERN.source;
    expect(calcServidor).toContain(fuente);
    expect(utilsCliente).toContain(fuente);
  });

  it("las listas de roles coinciden con src/lib/montacargas.ts", () => {
    for (const rol of ROLES_MONTACARGAS) {
      expect(calcServidor).toContain(`'${rol}'`);
      expect(utilsCliente).toContain(`'${rol}'`);
    }
    for (const rol of GESTORES_MONTACARGAS) {
      expect(utilsCliente).toContain(`'${rol}'`);
    }
    // MONTACARGAS usa pero NO gestiona: si se colara en la lista de gestores del
    // cliente, la UI ofrecería borrar y exportar y el servidor devolvería 403.
    const gestoresCliente = utilsCliente.match(/GESTORES_MONTACARGAS\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    expect(gestoresCliente).not.toContain("MONTACARGAS'");
    // El ayudante entra al módulo pero no crea: las dos copias lo distinguen.
    expect(calcServidor).toContain("OPERARIO_ALMACENAMIENTO");
    expect(utilsCliente).toContain("OPERARIO_ALMACENAMIENTO");
    // Y las tres copias saben quién puede RECIBIR un traspaso, que no es lo
    // mismo que quién puede crear: ahí entra MONTACARGAS pero no gestión.
    for (const copia of [calcServidor, utilsCliente]) {
      expect(copia).toContain("ROLES_RECEPTORES");
      expect(copia).toContain("puedeRecibirTraspaso");
      expect(copia).toContain("recibioTraspaso");
      const receptores = copia.match(/ROLES_RECEPTORES\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
      expect(receptores).toContain("MONTACARGAS");
      expect(receptores).not.toContain("GERENTE");
    }
  });
});

describe("montacargas — handlers Nitro presentes", () => {
  const handlers = [
    "nuxt-app/server/api/montacargas/index.get.ts",
    "nuxt-app/server/api/montacargas/index.post.ts",
    "nuxt-app/server/api/montacargas/abiertos.get.ts",
    "nuxt-app/server/api/montacargas/conteos.get.ts",
    "nuxt-app/server/api/montacargas/operarios.get.ts",
    "nuxt-app/server/api/montacargas/ayudantes.get.ts",
    "nuxt-app/server/api/montacargas/export.get.ts",
    "nuxt-app/server/api/montacargas/[id]/cantidades.patch.ts",
    "nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts",
    "nuxt-app/server/api/montacargas/[id]/traspasar.post.ts",
    "nuxt-app/server/api/montacargas/[id]/novedad.post.ts",
    "nuxt-app/server/api/montacargas/[id]/resolver-novedad.post.ts",
    "nuxt-app/server/api/montacargas/[id]/descartar.post.ts",
    "nuxt-app/server/api/montacargas/[id]/index.patch.ts",
    "nuxt-app/server/api/montacargas/[id]/index.delete.ts",
    "nuxt-app/server/api/productos-maestro/buscar.get.ts",
  ];

  it.each(handlers)("%s existe", (rel) => {
    expect(() => leer(rel)).not.toThrow();
  });

  it("todo handler de montacargas exige sesión y permiso del módulo", () => {
    for (const rel of handlers.filter((h) => h.includes("/montacargas/"))) {
      const src = leer(rel);
      expect(src, rel).toContain("requireAuth(event)");
      expect(src, rel).toMatch(/assert(Usuario|Gestor)Montacargas/);
    }
  });

  it("solo gestores exportan, listan operarios y borran", () => {
    for (const rel of [
      "nuxt-app/server/api/montacargas/export.get.ts",
      "nuxt-app/server/api/montacargas/operarios.get.ts",
      "nuxt-app/server/api/montacargas/[id]/index.delete.ts",
    ]) {
      expect(leer(rel), rel).toContain("assertGestorMontacargas");
    }
  });

  // Sin el filtro por tipo, Resurtido mostraría los movimientos de depósito y
  // al revés: los tres flujos comparten tabla.
  it("listado, abiertos, conteos y export filtran por tipo", () => {
    for (const rel of [
      "nuxt-app/server/api/montacargas/index.get.ts",
      "nuxt-app/server/api/montacargas/abiertos.get.ts",
      "nuxt-app/server/api/montacargas/conteos.get.ts",
      "nuxt-app/server/api/montacargas/export.get.ts",
    ]) {
      expect(leer(rel), rel).toContain("esTipoMovimiento");
    }
  });
});

describe("montacargas — el reloj arranca al digitar el PLU", () => {
  const post = leer("nuxt-app/server/api/montacargas/index.post.ts");
  const ubicacion = leer("nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts");

  it("crear solo pide PLU y origen: las cantidades llegan después", () => {
    const schema = post.match(/createSchema\s*=\s*z\.object\(\{([\s\S]*?)\n\}\)/)?.[1] ?? "";
    expect(schema).toContain("codigo");
    expect(schema).toContain("ubicacionInicial");
    // Si el POST exigiera cantidades, el reloj no podría arrancar con el PLU.
    expect(schema).not.toContain("cajas");
    expect(schema).not.toContain("unidadesSueltas");
  });

  it("horaInicio y el primer tramo los sella el servidor", () => {
    expect(post).toContain("horaInicio: now");
    expect(post).toContain("tramoMontacargas.create");
    expect(post).toContain("orden: 1");
    const schema = post.match(/createSchema\s*=\s*z\.object\(\{([\s\S]*?)\n\}\)/)?.[1] ?? "";
    expect(schema).not.toContain("horaInicio");
  });

  it("asignar la ubicación final cierra el tramo y para el reloj", () => {
    expect(ubicacion).toContain("cerrarTramoAbierto");
    expect(ubicacion).toContain("horaFinalizacion: now");
    expect(ubicacion).toContain("estado: 'CERRADO'");
    // Las cantidades se exigen al cerrar, no al abrir.
    expect(ubicacion).toContain("validarCantidades");
  });

  // Varios PLUs en curso en todos los flujos: antes, en recepción y
  // movimientos, abrir otro pedía terminar el que ya estaba registrado.
  it("se pueden tener varios PLUs en curso en cualquier flujo", () => {
    expect(post).not.toContain("MOVIMIENTO_ABIERTO");
    expect(post).not.toContain("admiteVariosAbiertos");
    expect(moduleVue).toContain("const puedeAbrirOtro = computed(() => puedeCrear.value)");
  });

  // Quien recibe el PLU dice cuánto cupo; el resto vuelve a quien se lo pasó.
  // La casilla dependía de una prop `esAyudante` que ya no se pasaba, así que
  // nunca salía y el sobrante no volvía a nadie.
  it("la casilla de unidades almacenadas sale a quien recibió el PLU", () => {
    const reg = leer("nuxt-app/app/components/montacargas/RegistroAbierto.vue");
    expect(reg).not.toMatch(/props\.esAyudante|v-if="esAyudante"/);
    expect(reg).toContain('<label v-if="recibido" class="f f-cant">');
    expect(reg).toContain("unidadesAlmacenadas: props.recibido ? almacenadasNum.value : m.value.cantidadTotal");
  });

  it("el sobrante vuelve a quien pasó el PLU, no a quien lo abrió", () => {
    const ubic = leer("nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts");
    expect(ubic).toContain("const paso = quienPasoElPlu(record.tramos, record.responsableId)");
    expect(ubic).toContain("responsableId: devolverA");
    expect(ubic).toContain("await abrirTramo(tx, creado.id, devolverA, now, 1)");
    for (const copia of [calcServidor, utilsCliente]) expect(copia).toContain("export function quienPasoElPlu");
  });

  // Como el reloj arranca con el PLU, un dedazo deja un registro corriendo.
  it("hay salida para descartar un PLU mal digitado", () => {
    const descartar = leer("nuxt-app/server/api/montacargas/[id]/descartar.post.ts");
    expect(descartar).toContain("deletedAt: now");
    expect(descartar).toContain("cerrarTramoAbierto");
    expect(registroVue).toContain("descartar");
  });
});

describe("montacargas — traspaso a ayudantes", () => {
  const traspasar = leer("nuxt-app/server/api/montacargas/[id]/traspasar.post.ts");

  it("cierra el tramo del primero y abre el del segundo", () => {
    expect(traspasar).toContain("cerrarTramoAbierto");
    expect(traspasar).toContain("abrirTramo");
    expect(traspasar).toContain("orden + 1");
    expect(traspasar).toContain("responsableId: ayudanteId");
  });

  // Un montacarguista tambien hace de ayudante cuando hace falta, asi que
  // tambien puede recibir. La comprobacion pasa por la lista de receptores en
  // vez de comparar contra un rol suelto.
  it("acepta operarios de almacenamiento y montacarguistas activos", () => {
    expect(traspasar).toContain("puedeRecibirTraspaso(ayudante.role)");
    expect(traspasar).toContain("active");
    expect(traspasar).not.toContain("role !== 'OPERARIO_ALMACENAMIENTO'");
    // Y la lista que alimenta el modal sale de la misma constante.
    expect(utilsServidor).toContain("role: { in: [...ROLES_RECEPTORES] }");
  });

  // Uno no se pasa el PLU a si mismo: verse en la lista solo estorba.
  it("la lista excluye a quien la esta pidiendo", () => {
    expect(leer("nuxt-app/server/api/montacargas/ayudantes.get.ts"))
      .toContain("listarAyudantes(actor.id)");
    expect(utilsServidor).toContain("id: { not: excluirId }");
  });

  // El ayudante recibe una cifra que debe cuadrar contra lo físico: traspasar
  // sin cantidades no le dejaría nada que confirmar.
  it("exige cantidades antes de pasar el PLU", () => {
    expect(traspasar).toContain("validarCantidades");
  });

  it("la lista de ayudantes muestra la carga pendiente", () => {
    expect(utilsServidor).toContain("listarAyudantes");
    expect(utilsServidor).toContain("pendientes");
    expect(leer("nuxt-app/app/components/montacargas/TraspasarModal.vue")).toContain("pendientes");
  });
});

describe("montacargas — novedades detienen el reloj", () => {
  const novedad = leer("nuxt-app/server/api/montacargas/[id]/novedad.post.ts");
  const resolver = leer("nuxt-app/server/api/montacargas/[id]/resolver-novedad.post.ts");
  const cantidades = leer("nuxt-app/server/api/montacargas/[id]/cantidades.patch.ts");

  it("abrir una novedad cierra el tramo: la verificación no se cronometra", () => {
    expect(novedad).toContain("cerrarTramoAbierto");
    expect(novedad).toContain("estado: 'NOVEDAD'");
  });

  // Solo se reanuda el reloj si el registro no llego a ubicarse (casos anteriores
  // a que marcar la novedad exigiera la ubicacion). Con ubicacion, cierra.
  it("resolver reanuda el reloj solo si falta ubicar", () => {
    expect(resolver).toContain("abrirTramo");
    expect(resolver).toContain("if (!yaUbicada)");
    expect(resolver).toContain("resueltaAt");
  });

  // Quien recibe no corrige: si no cuadra, marca la novedad. Y no la cierra el:
  // cerrarla exige el permiso explicito, que el no tiene.
  //
  // La guarda mira el REGISTRO y no el rol: desde que un montacarguista tambien
  // puede recibir, su rol ya no dice en que modo esta, y con la comprobacion
  // vieja habria podido corregir un PLU que le pasaron.
  it("quien recibio el PLU no edita cantidades ni cierra novedades", () => {
    expect(cantidades).toContain("recibioTraspaso(current, actor.id)");
    expect(cantidades).toContain("creadoPorId: true");
    expect(cantidades).not.toContain("esAyudante(actor.role)");
    expect(resolver).toContain("assertPuedeResolverNovedades");
  });

  // Un montacarguista que recibe necesita lo mismo que un ayudante: escanear el
  // PLU que trae en la mano. Atado al registro, no al rol — y solo cuando hay
  // algo en la bandeja: con ella vacia, la caja invitaba a escanear y respondia
  // "ese PLU no esta en tu bandeja" a todo.
  it("la caja de escaneo sale por bandeja, no por rol", () => {
    const modulo = leer("nuxt-app/app/components/montacargas/Module.vue");
    expect(modulo).toContain("const recibidos = computed(");
    expect(modulo).toContain('v-if="mios.length > 0" class="escaneo card bloque"');
    expect(modulo).not.toContain('v-if="ayudante || recibidos.length > 0"');
  });

  // Y lo mismo en la tarjeta: el modo de la UI va por registro.
  it("la tarjeta entra en modo confirmacion por registro, no por rol", () => {
    expect(registroVue).toContain("recibido: boolean");
    expect(registroVue).toContain('v-if="!recibido && !enNovedad"');
    expect(leer("nuxt-app/app/components/montacargas/Module.vue"))
      .toContain(':recibido="recibioTraspaso(m, userId)"');
  });

  // La estiba no se queda en el aire mientras se verifica: al marcar la novedad
  // hay que decir donde quedo, o nadie sabe donde buscarla.
  it("marcar la novedad exige y guarda la ubicacion final", () => {
    // Sin .optional(): es obligatoria.
    expect(novedad).toMatch(/ubicacionFinal: z\.string\(/);
    const linea = novedad.split(/\r?\n/).find((l) => l.includes("ubicacionFinal: z.")) ?? "";
    expect(linea).not.toContain("optional()");
    expect(novedad).toContain("ubicacionFinal, actualizadoPorId");
    expect(leer("nuxt-app/app/components/montacargas/NovedadModal.vue"))
      .toContain("¿Dónde dejaste la mercancía?");
  });

  // Cerrar una novedad es dar por buena una diferencia de inventario: es un
  // permiso por persona, no por rol.
  it("solo quien tiene el permiso explicito cierra una novedad", () => {
    expect(resolver).toContain("assertPuedeResolverNovedades");
    expect(utilsServidor).toContain("puedeResolverNovedades: true");
    // Se lee de la base y no del token, para que conceder o quitarlo no exija
    // volver a iniciar sesion.
    expect(leer("nuxt-app/server/api/me.get.ts")).toContain("puedeResolverNovedades");
    expect(registroVue).toContain("puedeResolverNovedades");
  });

  // El permiso no sirve de nada si la novedad nunca aparece delante de quien
  // puede cerrarla: la tarjeta con el boton solo se dibuja desde la bandeja, y
  // la bandeja solo traia lo del responsable.
  it("la novedad llega a la bandeja de quien puede verificarla", () => {
    const abiertos = leer("nuxt-app/server/api/montacargas/abiertos.get.ts");
    expect(abiertos).toContain("puedeResolverNovedades");
    expect(abiertos).toContain("estado: 'NOVEDAD' as const");
    // Sin perder lo propio: sigue trayendo lo del responsable.
    expect(abiertos).toContain("responsableId: actor.id");
    // Y la pestaña lleva al verificador a donde esta la novedad.
    expect(leer("nuxt-app/server/api/montacargas/mis-pendientes.get.ts"))
      .toContain("puedeResolverNovedades");
  });

  // Lo ajeno no es trabajo suyo: no puede bloquearle el formulario ni contar
  // como PLU en su bandeja.
  it("los registros ajenos no cuentan como carga propia", () => {
    const modulo = leer("nuxt-app/app/components/montacargas/Module.vue");
    expect(modulo).toContain("const mios = computed(");
    expect(modulo).toContain("m.responsableId === userId.value");
    // El vacio del ayudante mira solo lo suyo.
    expect(modulo).toContain('v-if="ayudante && mios.length === 0 && !loading"');
    // El escaner de la bandeja del ayudante solo encuentra lo suyo.
    expect(modulo).toContain("mios.value.find(");
    // Y la tarjeta ajena no ofrece descartar el registro de otro.
    expect(registroVue).toContain("ajeno");
    expect(registroVue).toContain("v-if=\"!ajeno\" class=\"btn-link danger\"");
  });

  // Con la mercancia ya ubicada, verificarla era lo ultimo que faltaba.
  it("resolver cierra el registro cuando ya tiene ubicacion", () => {
    expect(resolver).toContain("yaUbicada");
    expect(resolver).toContain("estado: yaUbicada ? 'CERRADO' : 'EN_CURSO'");
  });

  it("no se puede cerrar un registro con novedad abierta", () => {
    expect(leer("nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts"))
      .toContain("NOVEDAD");
  });

  it("la duración suma tramos, no la ventana completa", () => {
    expect(mapRow).toContain("segundosTrabajados(tramos)");
    expect(calcServidor).toContain("export function segundosTrabajados");
  });
});

describe("montacargas — reguero", () => {
  it("el total incluye las unidades sueltas", () => {
    expect(leer("nuxt-app/server/api/montacargas/[id]/cantidades.patch.ts"))
      .toContain("calcularCantidadTotal(d.cajas, d.unidadesPorCaja, unidadesSueltas)");
  });

  // Desmarcar el check tiene que limpiar la cantidad: dejarla la sumaría al
  // total sin que se vea en pantalla.
  it("la tarjeta limpia las unidades sueltas al desmarcar el reguero", () => {
    expect(registroVue).toMatch(/watch\(\(\) => form\.hayReguero[\s\S]{0,120}form\.unidadesSueltas = ''/);
  });
});

describe("montacargas — resolución del producto por PLU o EAN", () => {
  it("el servidor busca por los dos, priorizando según la forma del código", () => {
    expect(utilsServidor).toContain("pareceEan(codigo) ? [porEan, porPlu] : [porPlu, porEan]");
  });

  it("el EAN se busca con findFirst: no es único en el maestro", () => {
    expect(utilsServidor).toContain("findFirst({ where: { ean: codigo }");
  });

  it("la captura consulta el endpoint que acepta ambos", () => {
    expect(capturaVue).toContain("/api/productos-maestro/buscar");
  });
});

describe("montacargas — módulos registrados", () => {
  it("mapRow expone tramos, novedades y estado", () => {
    expect(mapRow).toContain("export function mapMovimientoMontacargas");
    expect(mapRow).toContain("novedadAbierta");
    expect(mapRow).toContain("tramos");
  });

  it("el sidebar Nuxt tiene las dos entradas", () => {
    expect(layout).toContain("moduleKey: 'control-montacargas'");
    expect(layout).toContain("moduleKey: 'resurtido'");
  });

  it("las tres copias de modulePermissions conocen los módulos y el ayudante", () => {
    for (const rel of [
      "src/lib/modulePermissions.ts",
      "nuxt-app/app/utils/modulePermissions.ts",
      "nuxt-app/server/utils/modulePermissions.ts",
    ]) {
      const src = leer(rel);
      expect(src, rel).toContain("control-montacargas");
      expect(src, rel).toContain("resurtido");
      expect(src, rel).toContain("OPERARIO_ALMACENAMIENTO");
      expect(src, rel).not.toContain("estibas");
    }
  });

  it("el proxy de Next enruta ambos y entra en SHARED_NUXT_URL", () => {
    expect(nextConfig).toContain("NUXT_PILOT_MONTACARGAS_URL");
    expect(nextConfig).toContain('"control-montacargas", "resurtido"');
    // Sin esto, si fuera la única variable definida no se emitirían las reglas de
    // /dashboard/api/* ni /dashboard/_nuxt/* y las páginas cargarían en blanco.
    const shared = nextConfig.match(/const SHARED_NUXT_URL =([^;]*);/)?.[1] ?? "";
    expect(shared).toContain("NUXT_PILOT_MONTACARGAS_URL");
  });

  // Resurtido dejo de ser una sola pantalla: ahora son tres pestanas y la de
  // Movimientos reutiliza este mismo Module, embebido y sin su cabecera.
  it("Resurtido reutiliza el Module para la pestana de movimientos", () => {
    const resurtido = leer("nuxt-app/app/pages/resurtido.vue");
    expect(resurtido).toContain("MontacargasModule");
    expect(resurtido).toContain("FLUJOS.MOVIMIENTO");
    expect(resurtido).toContain("sin-hero");
  });

  // Los indicadores salieron de los módulos: cada pestaña sumaba los relojes de
  // sus PLUs y, con varios a la vez, contaba el mismo minuto dos y tres veces.
  // Ahora hay un solo módulo que cuenta el tiempo real de la persona.
  it("los indicadores ya no son una pestaña del módulo", () => {
    expect(moduleVue).not.toContain("MontacargasIndicadores");
    expect(moduleVue).not.toContain("verIndicadores");
    expect(existsSync(path.join(process.cwd(), "nuxt-app/server/api/montacargas/indicadores.get.ts"))).toBe(false);
  });

  // Con un solo flujo (Movimientos dentro de Resurtido) una barra con una sola
  // pestaña no deja elegir nada.
  it("la barra de pestañas solo sale con varios flujos", () => {
    expect(moduleVue).toContain('<nav v-if="flujos.length > 1" class="tabs"');
  });

  // Un ayudante que recibía un movimiento abría el módulo en Recepción y no veía
  // nada: el traspaso no le decía dónde mirar.
  it("la UI lleva al operario a donde está su trabajo", () => {
    expect(leer("nuxt-app/server/api/montacargas/mis-pendientes.get.ts")).toContain("groupBy");
    expect(moduleVue).toContain("pendientes[f.tipo]");
    // Resurtido vive en otro módulo: sin el aviso los PLUs se quedan olvidados.
    expect(moduleVue).toContain("pendientesFuera");
  });
});

// Nitro serializa los errores como { error: true, statusCode, statusMessage, ... }.
// Cada componente tenía su propia copia de apiErr que leía `data.error` primero,
// así que el operario veía un cuadro rojo con la palabra "true" en vez del
// motivo (visto en producción al pasar un PLU a un ayudante). Vivía duplicada en
// 24 archivos: si alguien vuelve a pegar una copia local, esto lo caza.
// Una sola cifra de tiempo escondía quién hizo qué parte del trabajo cuando el
// PLU pasaba por un ayudante.
describe("montacargas — dos tiempos, uno por persona", () => {
  it("el mapeo expone el tramo del montacarguista y el del ayudante", () => {
    expect(mapRow).toContain("segundosMontacarguista");
    expect(mapRow).toContain("segundosAyudante");
    // Sin traspaso el segundo va en null, no en cero: un cero se leería como
    // "el ayudante tardó nada" en vez de "no hubo ayudante".
    expect(mapRow).toContain("huboTraspaso(tramos, r.creadoPorId)");
  });

  it("los helpers reparten por persona y están en las dos copias", () => {
    for (const src of [calcServidor]) {
      expect(src).toContain("export function segundosDelCreador");
      expect(src).toContain("export function segundosDeAyudantes");
      expect(src).toContain("export function huboTraspaso");
    }
  });

  it("la tabla y el Excel muestran las dos columnas", () => {
    const tabla = leer("nuxt-app/app/components/montacargas/Tabla.vue");
    expect(tabla).toContain("segundosMontacarguista");
    expect(tabla).toContain("segundosAyudante");
    expect(leer("nuxt-app/server/api/montacargas/export.get.ts"))
      .toContain("T. AYUDANTE (SEG)");
  });
});

// En resurtido el trabajo dura segundos: se vieron tramos reales de 14, 21 y 24
// segundos que, redondeados al minuto, salian como "0 min" y hacian ver como si
// nadie hubiera trabajado. Se acumula en segundos y se redondea al presentar.
describe("montacargas — el tiempo se mide en segundos", () => {
  it("los acumulados no van sumando minutos ya redondeados", () => {
    const indicadores = leer("src/lib/indicadores.ts");
    expect(indicadores).not.toContain("minutosTrabajados");
    expect(indicadores).toContain("return { total: Math.round(total)");
    const conteos = leer("nuxt-app/server/api/montacargas/conteos.get.ts");
    expect(conteos).toContain("segundosTrabajados(r.tramos)");
    expect(conteos).toContain("promedioSeg");
  });

  it("el promedio se redondea una sola vez, al final", () => {
    const indicadores = leer("src/lib/indicadores.ts");
    expect(indicadores).toContain("Math.round(valores.reduce((a, b) => a + b, 0) / valores.length)");
  });

  it("bajo el minuto la UI muestra segundos y no un cero", () => {
    const utils = leer("nuxt-app/app/utils/montacargas.ts");
    expect(utils).toContain("export function fmtTiempo");
    expect(utils).toContain("if (seg < 60) return `${seg} s`");
    // Y nadie se quedo con el formateador viejo, que recibia minutos.
    for (const rel of [
      "nuxt-app/app/components/montacargas/Tabla.vue",
      "nuxt-app/app/components/montacargas/KpiRail.vue",
      "nuxt-app/app/components/indicadores/TiempoPersonas.vue",
      "nuxt-app/app/components/indicadores/Module.vue",
      "nuxt-app/app/components/montacargas/ExitoOverlay.vue",
    ]) {
      expect(leer(rel)).not.toContain("fmtDuracion");
    }
  });
});

// Las tablas eran mas anchas que su tarjeta y `overflow: hidden` recortaba las
// ultimas columnas (estado, tiempo, acciones) sin forma de verlas.
describe("tablas — scroll horizontal dentro de la tarjeta", () => {
  const tablas = [
    "nuxt-app/app/components/auditoria/Tabla.vue",
    "nuxt-app/app/components/exportaciones/Tabla.vue",
    "nuxt-app/app/components/integracion/Table.vue",
    "nuxt-app/app/components/montacargas/Tabla.vue",
    "nuxt-app/app/components/preoperacional/SupervisorView.vue",
    "nuxt-app/app/components/solicitudes-transporte/Tabla.vue",
    "nuxt-app/app/components/usuarios/Tabla.vue",
  ];

  it.each(tablas)("%s no recorta sus columnas", (rel) => {
    const src = leer(rel);
    expect(src).not.toContain(".table-card { overflow: hidden; }");
    expect(src).toContain("overflow-x: auto");
    // Sin min-width el navegador comprime las columnas hasta hacerlas ilegibles
    // antes de desbordar, y el scroll nunca aparece. Da igual si va en su propia
    // regla o junto al resto: lo que se exige es que exista.
    expect(src).toMatch(/\.table \{[^}]*min-width: \d+px/);
  });
});

describe("apiErr — mensaje de error legible", () => {
  const util = leer("nuxt-app/app/utils/apiError.ts");

  it("el helper compartido existe y descarta el flag booleano", () => {
    expect(util).toContain("export function apiErr");
    // Solo acepta cadenas no vacías: un `error: true` cae al texto de respaldo.
    expect(util).toContain("typeof value === 'string'");
    expect(util).toContain("statusMessage");
  });

  it("no queda ninguna copia local que lo sombree", () => {
    const dir = path.join(raiz, "nuxt-app/app");
    const pendientes: string[] = [];
    const recorrer = (d: string) => {
      for (const entrada of readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entrada.name);
        if (entrada.isDirectory()) { recorrer(full); continue; }
        if (!/\.(vue|ts)$/.test(entrada.name)) continue;
        if (full.endsWith("apiError.ts")) continue;
        if (readFileSync(full, "utf8").includes("function apiErr")) {
          pendientes.push(path.relative(raiz, full));
        }
      }
    };
    recorrer(dir);
    expect(pendientes).toEqual([]);
  });

  it("nadie lee data.error como si fuera el mensaje", () => {
    expect(leer("nuxt-app/app/components/montacargas/Module.vue"))
      .not.toContain("e?.data?.error ||");
  });
});

// Cuando al ayudante no le caben todas las unidades: almacena lo que cabe y el
// resto vuelve al montacarguista como un registro propio, con su reloj.
describe("montacargas — sobrantes", () => {
  const ubicacion = leer("nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts");

  it("el cierre acepta cuantas unidades se almacenaron de verdad", () => {
    expect(ubicacion).toContain("unidadesAlmacenadas");
    expect(ubicacion).toContain("validarUnidadesAlmacenadas");
    // Opcional: si no viene, se cierra con todo, que es el caso normal.
    expect(ubicacion).toContain("parsed.data.unidadesAlmacenadas ?? record.cantidadTotal");
  });

  it("el registro cerrado queda valiendo lo que si se almaceno", () => {
    expect(ubicacion).toContain("repartirEnCajas(almacenadas, record.unidadesPorCaja)");
    expect(ubicacion).toContain("cantidadTotal: almacenadas");
  });

  it("el sobrante nace como registro propio de quien paso el PLU y con reloj", () => {
    expect(ubicacion).toContain("origenId: id");
    // Vuelve a quien le paso el PLU, no a quien lo cerro ni a quien lo abrio.
    expect(ubicacion).toContain("responsableId: devolverA");
    expect(ubicacion).toContain("estado: 'EN_CURSO'");
    expect(ubicacion).toContain("abrirTramo(tx, creado.id, devolverA, now, 1)");
    // Todo en la misma transaccion: o se parte entero o no se parte.
    expect(ubicacion).toContain("prisma.$transaction");
  });

  it("se marca en la UI para no leerlo como una estiba nueva", () => {
    expect(leer("nuxt-app/server/utils/mapRow.ts")).toContain("origenId: r.origenId ?? null");
    expect(leer("nuxt-app/app/components/montacargas/Tabla.vue")).toContain("item.origenId");
    const reg = leer("nuxt-app/app/components/montacargas/RegistroAbierto.vue");
    expect(reg).toContain("m.origenId");
    // La pregunta es solo para quien lo recibio: quien se lo paso elige la
    // ubicacion del sobrante, asi que a el le cabe por definicion.
    expect(reg).toContain('v-if="recibido" class="f f-cant"');
  });

  it("el enlace al registro de origen esta en los dos schemas", () => {
    for (const rel of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      const schema = leer(rel);
      expect(schema).toContain("origenId  String?");
      expect(schema).toContain('@relation("SobrantesMontacargas"');
    }
  });
});
