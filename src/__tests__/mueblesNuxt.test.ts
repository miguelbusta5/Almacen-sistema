// Guarda de Picking e Inspeccion de Muebles, que viven SOLO en nuxt-app.
//
// Igual que montacargasNuxt/resurtidoNuxt: la copia de Nitro se lee como TEXTO
// en vez de importarse, porque `nuxt-app/` vive bajo su propio tsconfig que
// referencia `./.nuxt/*` (gitignorado, lo genera `nuxt prepare`). En CI las
// dependencias de nuxt-app no se instalan y un import cruzado revienta el
// transform con TSCONFIG_ERROR.
//
// Lo que protege: si la copia se desvia de src/lib/pickingMuebles.ts, el
// servidor valida distinto que los tests y nadie se entera hasta produccion.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

const fuente = leer("src/lib/pickingMuebles.ts");
const calcServidor = leer("nuxt-app/server/utils/mueblesCalc.ts");
const indFuente = leer("src/lib/mueblesIndicadores.ts");
const indServidor = leer("nuxt-app/server/utils/mueblesIndicadoresCalc.ts");

describe("muebles — las dos copias de la logica", () => {
  const funciones = [
    "puedePickear",
    "puedeInspeccionar",
    "esGestionMuebles",
    "normalizarCodigoOrden",
    "derivarTipoOrden",
    "validarCodigoOrden",
    "normalizarRotulo",
    "duracionMinutos",
    "duracionInspeccionNetaMinutos",
    "totalesLinea",
    "medidaPorUnidad",
    "volumenOrden",
    "clasificarPorDescripcion",
    "quienCierra",
    "puedeCerrarOrden",
    "validarPasoAInspeccion",
    "ordenInspeccionCompleta",
    "validarAgregarPlu",
    "resumenOrden",
  ];

  it.each(funciones)("%s existe en las dos", (fn) => {
    for (const src of [fuente, calcServidor]) {
      expect(src).toContain(`export function ${fn}`);
    }
  });

  // El orden de las reglas ES la logica: un sofa reclinable es un reclinable, y
  // una silla de comedor no es una mesa. Si una copia reordena, clasifica
  // distinto que la otra y el informe cambia segun quien lo pida.
  it("las reglas de clasificacion mantienen su orden en las dos copias", () => {
    for (const src of [fuente, calcServidor]) {
      const reglas = src.slice(src.indexOf("REGLAS_TIPO"));
      const orden = ["RECLINABLE", "POLTRONA", "SOFA", "LUMINARIA", "SILLA", "MESA"]
        .map((t) => reglas.indexOf(`["${t}"`) >= 0 ? reglas.indexOf(`["${t}"`) : reglas.indexOf(`['${t}'`));
      expect(orden.every((v, i) => i === 0 || v > orden[i - 1]!)).toBe(true);
    }
  });

  it("los indicadores tambien estan en las dos copias", () => {
    for (const fn of ["tramoDe", "desplazamientos", "agregarIndicadoresMuebles", "etiquetaTramo"]) {
      for (const src of [indFuente, indServidor]) {
        expect(src).toContain(`export function ${fn}`);
      }
    }
  });

  // Los cortes y el tope de desplazamiento son numeros de negocio: si una copia
  // se desvia, el mismo dato da dos informes distintos.
  it("los cortes de los tramos no se desvian entre copias", () => {
    for (const src of [indFuente, indServidor]) {
      expect(src).toContain("TRAMOS_VOLUMEN_M3 = [0.5, 1.5, 3]");
      expect(src).toContain("TRAMOS_PESO_KG = [20, 50, 100]");
      expect(src).toContain("MAX_DESPLAZAMIENTO_SEG = 30 * 60");
    }
  });

  // El motor de montacargas NO se toca: TipoTarea es un union cerrado de cinco
  // valores, triplicado y con sus propios guards.
  it("los indicadores de muebles no meten tipos nuevos en TIPOS_TAREA", () => {
    for (const src of [indFuente, indServidor]) {
      expect(src).not.toContain("TIPOS_TAREA");
    }
  });

  it("los nombres de rol son literalmente los mismos", () => {
    for (const src of [fuente, calcServidor]) {
      expect(src).toContain("PICKING_MUEBLES");
      expect(src).toContain("INSPECCION_MUEBLES");
    }
  });
});

// Donde arranca y donde para cada reloj es la mitad de lo que mide el modulo.
// Estos asserts son la especificacion ejecutable del flujo que pidio operacion.
describe("muebles — los relojes", () => {
  const crearOrden = leer("nuxt-app/server/api/picking-muebles/index.post.ts");
  const helpers = leer("nuxt-app/server/utils/muebles.ts");
  const agregarPlu = leer("nuxt-app/server/api/picking-muebles/[id]/plu.post.ts");
  const cerrarLinea = leer("nuxt-app/server/api/picking-muebles/[id]/linea/[lineaId]/cerrar.post.ts");
  const pasarInspeccion = leer("nuxt-app/server/api/picking-muebles/[id]/inspeccion.post.ts");
  const iniciarInsp = leer("nuxt-app/server/api/inspeccion-muebles/[id]/linea/[lineaId]/iniciar.post.ts");
  const completarInsp = leer("nuxt-app/server/api/inspeccion-muebles/[id]/linea/[lineaId]/completar.post.ts");
  const enviarEbanisteria = leer("nuxt-app/server/api/inspeccion-muebles/[id]/linea/[lineaId]/ebanisteria.post.ts");
  const recibirEbanisteria = leer(
    "nuxt-app/server/api/inspeccion-muebles/[id]/linea/[lineaId]/ebanisteria-recibir.post.ts",
  );

  it("el reloj de la orden arranca al crearla", () => {
    expect(crearOrden).toContain("horaInicio: now");
  });

  it("solo se permite una orden abierta por operario", () => {
    // La consulta vive en ordenAbierta() (utils/muebles.ts), que filtra por
    // estado EN_PICKING; aqui se comprueba que el handler la use y corte.
    expect(crearOrden).toContain("ordenAbierta(actor.id)");
    expect(crearOrden).toMatch(/statusCode: 409/);
    expect(crearOrden).toMatch(/ya tienes una orden/i);
    expect(helpers).toContain("estado: 'EN_PICKING'");
  });

  it("sin equipo asignado hoy no se puede abrir una orden", () => {
    // Sin equipo no hay contra que medir la capacidad, que es medio modulo.
    expect(crearOrden).toContain("equipoDelDia(actor.id)");
    expect(crearOrden).toMatch(/no tienes equipo asignado hoy/i);
    // equipoDelDia se ata al dia en Bogota: una asignacion es por jornada.
    expect(helpers).toContain("asignacionEquipoMuebles");
    expect(helpers).toContain("todayBogota()");
  });

  it("el reloj del PLU arranca al escanear el PLU", () => {
    expect(agregarPlu).toContain("validarAgregarPlu");
    expect(agregarPlu).toContain("horaInicio: now");
  });

  it("el reloj del PLU para al escanear el QR del rotulo", () => {
    expect(cerrarLinea).toContain("normalizarRotulo");
    expect(cerrarLinea).toContain("horaFin: now");
    expect(cerrarLinea).toContain("totalesLinea");
  });

  // Los dos relojes de la orden se encadenan en la MISMA transaccion para que no
  // quede un hueco de tiempo sin dueno entre picking e inspeccion.
  it("pasar a inspeccion cierra el reloj de picking y abre el de inspeccion a la vez", () => {
    expect(pasarInspeccion).toContain("validarPasoAInspeccion");
    expect(pasarInspeccion).toContain("horaPasoInspeccion: now");
    expect(pasarInspeccion).toContain("EN_INSPECCION");
  });

  it("el reloj de inspeccion del PLU arranca al seleccionarlo", () => {
    // Un PLU averiado ya se habia empezado: conservar su primer arranque es lo
    // que permite descontar despues la espera del repuesto.
    expect(iniciarInsp).toContain("inspHoraInicio: linea.inspHoraInicio ?? now");
  });

  it("completar un PLU cierra su reloj y puede cerrar el de la orden", () => {
    expect(completarInsp).toContain("inspHoraFin: now");
    expect(completarInsp).toContain("ordenInspeccionCompleta");
    expect(completarInsp).toContain("horaFinInspeccion");
  });

  it("enviar a ebanisteria exige motivo y pausa la inspeccion", () => {
    expect(enviarEbanisteria).toContain("ebanisteriaInicio: now");
    expect(enviarEbanisteria).toContain("motivoEbanisteria");
    expect(enviarEbanisteria).toContain("EN_EBANISTERIA");
  });

  it("recibir de ebanisteria cierra ese reloj y devuelve el PLU a inspeccion", () => {
    expect(recibirEbanisteria).toContain("ebanisteriaFin: now");
  });

  // Las horas las sella el servidor, nunca el cliente: es lo que hace confiable
  // la medicion de productividad (misma razon que en montacargas).
  it("ningun handler acepta una hora enviada por el cliente", () => {
    for (const src of [crearOrden, agregarPlu, cerrarLinea, pasarInspeccion, iniciarInsp, completarInsp]) {
      expect(src).toContain("new Date()");
      expect(src).not.toMatch(/horaInicio:\s*(body|parsed|d)\./);
      expect(src).not.toMatch(/horaFin:\s*(body|parsed|d)\./);
    }
  });
});

// Reasignacion: el Genie no puede con un PLU y lo baja el del Order Picker,
// entrando a LA MISMA orden. Lo que se registra es quien acabo bajando cada PLU.
describe("picking — orden compartida por reasignacion", () => {
  const crearOrden = leer("nuxt-app/server/api/picking-muebles/index.post.ts");
  const unirse = leer("nuxt-app/server/api/picking-muebles/[id]/unirse.post.ts");
  const agregarPlu = leer("nuxt-app/server/api/picking-muebles/[id]/plu.post.ts");
  const cerrarLinea = leer("nuxt-app/server/api/picking-muebles/[id]/linea/[lineaId]/cerrar.post.ts");
  const pasarInspeccion = leer("nuxt-app/server/api/picking-muebles/[id]/inspeccion.post.ts");
  const helpers = leer("nuxt-app/server/utils/muebles.ts");

  // Sin este marcador la pantalla no puede distinguir "te equivocaste de numero"
  // de "esta es la orden a la que tienes que unirte".
  it("chocar con una orden en picking devuelve un error identificable", () => {
    expect(crearOrden).toContain("ORDEN_YA_ABIERTA");
    expect(crearOrden).toContain("ordenId");
  });

  it("unirse no arranca ningun reloj nuevo", () => {
    // El de la orden ya corre desde que la abrio el primero.
    expect(unirse).not.toContain("horaInicio: now");
    expect(unirse).toContain("participanteOrdenMuebles.create");
  });

  it("unirse ocupa el turno: no se puede tener ademas una orden propia", () => {
    expect(unirse).toContain("ordenAbierta(actor.id)");
    expect(helpers).toContain("participantes: { some: { usuarioId } }");
  });

  it("cada linea guarda quien la pickeo", () => {
    expect(agregarPlu).toContain("operarioId: actor.id");
  });

  it("el PLU en curso se mira por persona, no por orden", () => {
    expect(agregarPlu).toContain("validarAgregarPlu(orden.lineas, plu, actor.id)");
  });

  it("cada operario cierra solo sus propias lineas", () => {
    expect(cerrarLinea).toContain("linea.operarioId !== actor.id");
  });

  it("la pasa a inspeccion el que se unio, y gestion como salida de emergencia", () => {
    expect(pasarInspeccion).toContain("puedeCerrarOrden(orden.participantes, actor.id, actor.role)");
    expect(pasarInspeccion).toContain("cerrada por supervision");
  });
});

// La pantalla de administracion es lo que hace operable el modulo: sin ella un
// ADMIN no puede dar de alta equipos ni hacer la asignacion del dia, y sin
// asignacion del dia ningun operario puede abrir una orden.
describe("admin — la pantalla que desbloquea el area", () => {
  const raiz = "nuxt-app/app/components/admin-muebles";
  const modulo = leer(`${raiz}/Module.vue`);
  const asignacion = leer(`${raiz}/Asignacion.vue`);

  it("existe una pantalla por cada grupo de endpoints admin", () => {
    for (const vista of ["Asignacion", "Equipos", "Inspectores", "Tipos", "Pendientes"]) {
      expect(() => leer(`${raiz}/${vista}.vue`)).not.toThrow();
    }
  });

  // Va primera porque es lo primero de la manana y lo unico que bloquea al area
  // entera si falta.
  it("la asignacion del dia es la primera pestaña", () => {
    const orden = modulo.indexOf("'asignacion' as const");
    const siguiente = modulo.indexOf("'equipos' as const");
    expect(orden).toBeGreaterThan(-1);
    expect(orden).toBeLessThan(siguiente);
  });

  it("avisa de cuantos operarios se quedarian sin poder trabajar", () => {
    expect(asignacion).toContain("sinEquipo");
    expect(asignacion).toMatch(/no .*abrir órdenes|abrir órdenes/);
  });

  it("deja poner la asignacion de otro dia (la tarde anterior)", () => {
    expect(asignacion).toContain("fecha: fecha.value");
  });
});

// El login de inspeccion es compartido (2 PCs, ~5 inspectores). Que un inspector
// salga de una orden no puede tumbar el trabajo de nadie.
describe("inspeccion — login compartido", () => {
  const asignar = leer("nuxt-app/server/api/inspeccion-muebles/[id]/asignar.post.ts");
  const listado = leer("nuxt-app/server/api/inspeccion-muebles/index.get.ts");

  it("la orden se asigna a un inspector del catalogo, no al usuario logueado", () => {
    expect(asignar).toContain("inspectorId");
    expect(asignar).toContain("inspector");
  });

  it("el listado dice quien tiene cada orden para que nadie la pise", () => {
    expect(listado).toContain("inspector");
    expect(listado).toContain("EN_INSPECCION");
  });

  // No hay endpoint de "salir": salir es solo navegar. Si existiera y tocara los
  // relojes, un inspector dejaria a otro sin su tiempo.
  it("no existe un endpoint que cierre relojes al salir de una orden", () => {
    const dir = "nuxt-app/server/api/inspeccion-muebles";
    expect(() => leer(`${dir}/[id]/salir.post.ts`)).toThrow();
  });
});

// El boton de almuerzo (pausas operativas) tambien en Picking de Muebles: la
// orden y el PLU en la mano se detienen, y ese rato no cuenta como picking.
describe("picking muebles — almuerzo", () => {
  const pausas = leer("nuxt-app/server/utils/pausasOperativas.ts");
  const util = leer("nuxt-app/server/utils/muebles.ts");
  const layout = leer("nuxt-app/app/layouts/default.vue");
  const modulo = leer("nuxt-app/app/components/picking-muebles/Module.vue");

  it("la pausa detiene la orden abierta y los PLU del operario", () => {
    expect(pausas).toContain("puedePickear");
    expect(pausas).toContain("prisma.ordenMuebles.findMany");
    expect(pausas).toContain("prisma.lineaMuebles.findMany");
    expect(pausas).toContain("ordenesMuebles: ids(ordenesMuebles), lineasMuebles: ids(lineasMuebles)");
  });

  it("mientras esta en pausa no se puede escanear ni cerrar un PLU", () => {
    expect(util).toContain("requirePickingActivo");
    expect(util).toContain("assertSinPausa(actor.id)");
    for (const rel of [
      "nuxt-app/server/api/picking-muebles/index.post.ts",
      "nuxt-app/server/api/picking-muebles/[id]/plu.post.ts",
      "nuxt-app/server/api/picking-muebles/[id]/linea/[lineaId]/cerrar.post.ts",
      "nuxt-app/server/api/picking-muebles/[id]/inspeccion.post.ts",
    ]) {
      expect(leer(rel)).toContain("requirePickingActivo(event)");
    }
  });

  it("el boton sale en la pantalla y al volver se repinta la orden", () => {
    expect(layout).toContain("'picking-muebles'].some");
    expect(modulo).toContain("watch(pausaRevision, () => { void cargar() })");
  });

  it("los indicadores descuentan lo pausado del reloj de picking", () => {
    for (const src of [indFuente, indServidor]) {
      expect(src).toContain("minutosPickingLinea");
      expect(src).toContain("pausaSegundos");
    }
    expect(leer("nuxt-app/server/api/indicadores-muebles/index.get.ts")).toContain("pausaSegundos: true");
  });
});


// Lo que pidio el area de muebles: averias con reposicion, almuerzo dentro de la
// orden, PLU que llegan de tienda, facturas de contado y TSDM entre varios.
describe("inspeccion — averias, almuerzo, contado y varios inspectores", () => {
  const averia = leer("nuxt-app/server/api/inspeccion-muebles/[id]/linea/[lineaId]/averia.post.ts");
  const almuerzo = leer("nuxt-app/server/api/inspeccion-muebles/[id]/almuerzo.post.ts");
  const agregar = leer("nuxt-app/server/api/inspeccion-muebles/[id]/linea/index.post.ts");
  const contado = leer("nuxt-app/server/api/inspeccion-muebles/contado.post.ts");
  const unirse = leer("nuxt-app/server/api/inspeccion-muebles/[id]/unirse.post.ts");
  const resolver = leer("nuxt-app/server/api/picking-muebles/pendiente/[id]/resolver.post.ts");
  const iniciar = leer("nuxt-app/server/api/inspeccion-muebles/[id]/linea/[lineaId]/iniciar.post.ts");
  const detalle = leer("nuxt-app/app/components/inspeccion-muebles/OrdenDetalle.vue");

  it("el averiado vuelve a la cola y se le pide el repuesto a un operario de picking", () => {
    expect(averia).toContain("estado: 'PICKEADA'");
    expect(averia).toContain("averiado: true");
    expect(averia).toContain("reposicionInicio: now");
    expect(averia).toContain("motivo: 'AVERIA'");
    expect(averia).toContain("estado: 'ASIGNADO'");
    expect(averia).toContain("puedePickear(operario.role)");
  });

  it("no se puede reinspeccionar hasta que llegue el repuesto", () => {
    expect(iniciar).toContain("linea.reposicionInicio && !linea.reposicionFin");
    expect(resolver).toContain("reposicionFin: now");
  });

  it("la espera del repuesto y el almuerzo no cuentan como inspeccion", () => {
    for (const src of [fuente, calcServidor]) {
      expect(src).toContain("enReposicion");
      expect(src).toContain("inspPausaSegundos");
      expect(src).toContain("bruta - enTaller - enReposicion - almuerzo");
    }
  });

  it("el almuerzo detiene la orden y sus PLU en inspeccion", () => {
    expect(almuerzo).toContain("inspPausaInicio: now");
    expect(almuerzo).toContain("estado: 'EN_INSPECCION' }");
    expect(almuerzo).toContain("inspPausaSegundos: { increment: segundos }");
    expect(iniciar).toContain("orden.inspPausaInicio");
    expect(detalle).toContain("enAlmuerzo");
  });

  it("un PLU de tienda entra ya pickeado y reabre la orden si estaba cerrada", () => {
    expect(agregar).toContain("estado: 'PICKEADA'");
    expect(agregar).toContain("horaFin: now");
    expect(agregar).toContain("horaFinInspeccion: null");
  });

  it("la factura de contado nace en inspeccion, con su cliente", () => {
    expect(contado).toContain("tipoOrden: 'CONTADO'");
    expect(contado).toContain("estado: 'EN_INSPECCION'");
    expect(contado).toContain("codigoContado(d.factura)");
    expect(contado).toContain("cliente");
    for (const src of [fuente, calcServidor]) expect(src).toContain("validarFacturaContado");
  });

  it("varios inspectores entran a la misma orden y queda quien esta dentro", () => {
    expect(unirse).toContain("inspectorOrdenMuebles.upsert");
    expect(iniciar).toContain("inspectorOrdenMuebles.upsert");
    expect(detalle).toContain("orden.inspectores");
  });
});

// Entrega a transporte: la ciudad la pone el inspector al empezar, la orden
// inspeccionada cae sola en la bandeja del patinador y al entregarla se cierra
// el lead time (de abrir el picking a subir al camion).
describe("muebles — entrega a transporte", () => {
  const ciudad = leer("nuxt-app/server/api/inspeccion-muebles/[id]/ciudad.post.ts");
  const iniciar = leer("nuxt-app/server/api/inspeccion-muebles/[id]/linea/[lineaId]/iniciar.post.ts");
  const bandeja = leer("nuxt-app/server/api/entrega-muebles/index.get.ts");
  const entregar = leer("nuxt-app/server/api/entrega-muebles/entregar.post.ts");
  const ui = leer("nuxt-app/app/components/entrega-muebles/Module.vue");

  it("la ciudad se guarda normalizada para que el filtro no se parta", () => {
    for (const src of [fuente, calcServidor]) {
      expect(src).toContain("normalizarCiudad");
      expect(src).toContain("toUpperCase()");
    }
    expect(ciudad).toContain("normalizarCiudad(parsed.data.ciudad)");
    expect(ciudad).toContain("validarCiudad");
  });

  it("sin ciudad no se empieza a inspeccionar", () => {
    expect(iniciar).toContain("!orden.ciudadEnvio");
  });

  it("a la bandeja del patinador solo llegan las ordenes completas", () => {
    expect(bandeja).toContain("estado: historico ? 'ENTREGADA_TRANSPORTE' : 'INSPECCIONADA'");
    expect(bandeja).toContain("groupBy");
    expect(bandeja).toContain("puedeEntregarTransporte(actor.role)");
  });

  it("se entregan varias de una vez y ahi cierra la medicion", () => {
    expect(entregar).toContain("ordenIds: z.array");
    expect(entregar).toContain("estado: 'ENTREGADA_TRANSPORTE', entregadaTransporteAt: now");
    expect(entregar).toContain("noListas");
    expect(ui).toContain("Entregar a transporte");
  });

  it("el rol nuevo solo puede entregar", () => {
    for (const src of [fuente, calcServidor]) {
      expect(src).toContain("PATINADOR_MUEBLES");
      expect(src).toContain("puedeEntregarTransporte");
    }
    expect(leer("src/lib/modulePermissions.ts")).toContain('"entrega-muebles": ["PATINADOR_MUEBLES"');
  });

  it("los indicadores muestran el lead time por orden y su promedio", () => {
    for (const src of [indFuente, indServidor]) {
      expect(src).toContain("leadTimeMin");
      expect(src).toContain("leadTimePromedioMin");
      expect(src).toContain("ordenesEntregadas");
    }
    expect(leer("nuxt-app/server/api/indicadores-muebles/index.get.ts")).toContain("entregadaTransporteAt: true");
    expect(leer("nuxt-app/app/components/indicadores-muebles/Module.vue")).toContain("Lead time");
  });
});

// Historial de ordenes: ver como quedaron los tiempos de cualquier orden y, solo
// el administrador, corregir lo que se escaneo mal.
describe("muebles — historial de ordenes", () => {
  const lista = leer("nuxt-app/server/api/historial-muebles/index.get.ts");
  const detalle = leer("nuxt-app/server/api/historial-muebles/[id]/index.get.ts");
  const corregir = leer("nuxt-app/server/api/historial-muebles/[id]/linea/[lineaId]/corregir.post.ts");
  const modal = leer("nuxt-app/app/components/historial-muebles/CorregirModal.vue");

  it("es de supervision y buscar por codigo ignora las fechas", () => {
    expect(lista).toContain("esGestionMuebles(actor.role)");
    expect(detalle).toContain("esGestionMuebles(actor.role)");
    expect(lista).toContain("codigo ? { codigo: { contains: codigo } } : { horaInicio: { gte: inicio, lte: fin } }");
  });

  it("corregir es solo del admin, con motivo, y queda en la bitacora con el valor anterior", () => {
    expect(corregir).toContain("actor.role !== 'ADMIN'");
    expect(corregir).toContain("motivo: z.string().trim().min(5");
    expect(corregir).toContain("`${etiqueta}: ${fmt(antes)} -> ${fmt(despues)}`");
    expect(corregir).toContain("`Correccion en ${orden.codigo}");
  });

  it("un PLU corregido se valida contra el maestro y trae sus medidas", () => {
    expect(corregir).toContain("existePlu(plu)");
    expect(corregir).toContain("medidas = await datosPlu(plu)");
    expect(corregir).toContain("totalesLinea(unidades, volumen, peso)");
    expect(corregir).toContain("El fin del picking no puede ser antes del inicio");
  });

  it("la pantalla solo manda lo que se toco", () => {
    expect(modal).toContain("if (f.value[k] !== inicial[k]) c[k] = aIso(f.value[k])");
  });

  it("los tiempos del detalle no se redondean a cero y descuentan el almuerzo", () => {
    const map = leer("nuxt-app/server/utils/mapRow.ts");
    expect(map).toContain("duracionPickingMin: netoMin(minutosPrecisos(l.horaInicio, l.horaFin), l.pausaSegundos)");
    expect(map).toContain("netoMin(minutosPrecisos(o.horaPasoInspeccion, o.horaFinInspeccion), o.inspPausaSegundos)");
  });
});

describe("muebles — el EAN escaneado se convierte en PLU", () => {
  const maestro = leer("nuxt-app/server/utils/maestroMuebles.ts");

  it("usa el traductor comun de codigos", () => {
    expect(maestro).toContain("return resolverPluMaestro(codigo)");
  });

  it("se usa al escanear, al agregar en inspeccion y al corregir", () => {
    expect(leer("nuxt-app/server/api/picking-muebles/[id]/plu.post.ts")).toContain("await resolverPlu(normalizePlu(");
    expect(leer("nuxt-app/server/api/inspeccion-muebles/[id]/linea/index.post.ts")).toContain("await resolverPlu(normalizePlu(");
    expect(leer("nuxt-app/server/api/historial-muebles/[id]/linea/[lineaId]/corregir.post.ts")).toContain("await resolverPlu(normalizePlu(");
  });
});

// El codigo de barras se traduce a PLU en TODOS los modulos, no solo en muebles:
// en Resurtido y Pendientes el escaneo del EAN se rechazaba con "ese no es el PLU".
describe("codigo de barras -> PLU en todos los modulos", () => {
  const traductor = leer("nuxt-app/server/utils/codigoProducto.ts");

  it("un solo traductor: PLU, luego EAN del maestro, luego EAN de Ambiente confirmado", () => {
    expect(traductor).toContain("if (await existe(codigo)) return codigo");
    expect(traductor).toContain("where: { ean: codigo }");
    expect(traductor).toContain("pluDesdeEanAmbiente(codigo)");
    expect(leer("nuxt-app/server/utils/maestroMuebles.ts")).toContain("return resolverPluMaestro(codigo)");
  });

  it.each([
    "nuxt-app/server/api/resurtido-tareas/[id]/completar.post.ts",
    "nuxt-app/server/api/pendientes/[id]/iniciar.post.ts",
    "nuxt-app/server/api/pendientes/index.post.ts",
    "nuxt-app/server/api/pendientes/[id]/index.patch.ts",
    "nuxt-app/server/api/pendientes/consulta.get.ts",
    "nuxt-app/server/api/recepcion-contenedores/[id]/novedad.post.ts",
    "nuxt-app/server/api/inspeccion-muebles/pendientes/index.post.ts",
    "nuxt-app/server/utils/exportacionesHandlers.ts",
    "nuxt-app/server/api/tienda/index.post.ts",
    "nuxt-app/server/api/productos-maestro/[plu].get.ts",
    "nuxt-app/server/api/capacidad-picking/index.post.ts",
    "nuxt-app/server/api/capacidad-picking/producto.get.ts",
  ])("%s pasa lo escaneado por el traductor", (rel) => {
    expect(leer(rel)).toContain("resolverPluMaestro(");
  });

  it("montacargas y el buscador tienen el respaldo para productos sin EAN cargado", () => {
    expect(leer("nuxt-app/server/utils/montacargas.ts")).toContain("pluDesdeEanAmbiente(codigo)");
    expect(leer("nuxt-app/server/api/productos-maestro/buscar.get.ts")).toContain("pluDesdeEanAmbiente(codigo)");
  });
});

describe("picking muebles — escaneo a prueba de errores", () => {
  const captura = leer("nuxt-app/app/components/picking-muebles/CapturaPlu.vue");
  const plu = leer("nuxt-app/server/api/picking-muebles/[id]/plu.post.ts");

  it("con orden en curso no se puede pegar ni copiar en PLU ni en ubicacion", () => {
    expect(captura.match(/@paste="bloquearPegado" @drop="bloquearPegado" @copy.prevent @cut.prevent @contextmenu.prevent/g)?.length).toBe(2);
  });

  it("una ubicacion en el campo del PLU sale con alerta y no se envia", () => {
    expect(captura).toContain("if (pareceUbicacion(v)) {");
    expect(captura).toContain("Eso es una ubicación, no un PLU");
    expect(plu).toContain("if (pareceUbicacion(parsed.data.plu))");
    for (const src of [fuente, calcServidor]) expect(src).toContain("export function pareceUbicacion");
  });
});

describe("errores de picking — solo el administrador", () => {
  const marcar = leer("nuxt-app/server/api/inspeccion-muebles/[id]/linea/[lineaId]/error-picking.post.ts");
  const terminar = leer("nuxt-app/server/api/inspeccion-muebles/[id]/terminar.post.ts");
  const detalle = leer("nuxt-app/app/components/inspeccion-muebles/OrdenDetalle.vue");
  const ind = leer("nuxt-app/server/api/indicadores-muebles/index.get.ts");

  it("marcar y terminar exigen ADMIN en el servidor", () => {
    expect(marcar).toContain("actor.role !== 'ADMIN'");
    expect(terminar).toContain("actor.role !== 'ADMIN'");
  });

  it("el error queda a nombre de quien pickeo el PLU", () => {
    expect(marcar).toContain("operarioId: linea.operarioId");
  });

  it("terminar deja la orden lista para el patinador y cierra el reloj abierto", () => {
    expect(terminar).toContain("validarTerminarConErrores(");
    expect(terminar).toContain("estado: 'INSPECCIONADA', horaFinInspeccion: now");
    expect(terminar).toContain("l.inspHoraInicio && !l.inspHoraFin ? { inspHoraFin: now } : {}");
  });

  it("los botones solo salen al admin y el indicador trae los errores", () => {
    expect(detalle).toContain('v-if="esAdmin"');
    expect(ind).toContain("resumirErroresPicking(");
  });
});
