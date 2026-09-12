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
    "capacidadEquipo",
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

  it("los umbrales de capacidad no se desvian entre copias", () => {
    for (const src of [fuente, calcServidor]) {
      expect(src).toContain("UMBRAL_AVISO = 80");
      expect(src).toContain("UMBRAL_CRITICO = 100");
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
    expect(iniciarInsp).toContain("inspHoraInicio: now");
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
