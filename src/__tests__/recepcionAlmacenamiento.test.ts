// Un contenedor de punta a punta (23-09): descarga (Recepción de Contenedores)
// + almacenamiento (los PLU del montacarguista con el mismo pedido).
// El cálculo vive en nuxt-app sin gemelo en src/lib: se carga con cargarNuxt.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cargarNuxt } from "./apoyo/nuxt";

const { almacenamientoContenedor, asignarMovimientos, clavePedidoRecepcion, proyeccionContenedores, segundosUnidos } =
  cargarNuxt("utils/recepcionAlmacenamientoCalc.ts");

// Hora de Bogotá del 24-09 → Date.
const h = (hora: number, min = 0) => new Date(Date.UTC(2026, 8, 24, hora + 5, min));
const rec = (o: Partial<any> = {}) => ({
  id: "r1", numeroPedido: "PEDDM1", tipoContenedor: "PIES_40", estado: "CERRADO",
  horaInicio: h(8), horaFinalizacion: h(9), pausaSegundos: 0, ...o,
});
let n = 0;
const mov = (o: Partial<any> = {}) => ({
  id: `m${++n}`, numeroPedido: "PEDDM1", plu: "100", cantidadTotal: 10, estado: "CERRADO",
  horaInicio: h(9), horaFinalizacion: h(9, 30), m3: 1, kg: 50,
  tramos: [{ usuarioId: "a", inicio: h(9), fin: h(9, 30) }], ...o,
});

describe("reloj sin duplicar", () => {
  it("une los intervalos que se pisan", () => {
    const ms = (a: number, b: number) => [h(9, a).getTime(), h(9, b).getTime()];
    expect(segundosUnidos([ms(0, 30), ms(10, 40), ms(50, 55)])).toBe(45 * 60);
    expect(segundosUnidos([])).toBe(0);
  });
});

describe("cada PLU a su contenedor", () => {
  it("por pedido; si el pedido llega en dos contenedores, al último que empezó antes", () => {
    const r1 = rec({ id: "r1", horaInicio: h(6) });
    const r2 = rec({ id: "r2", horaInicio: h(12) });
    const a = mov({ horaInicio: h(8) }), b = mov({ horaInicio: h(13) }), c = mov({ horaInicio: h(5) });
    const otro = mov({ numeroPedido: "PEDMAL" });
    const { porRecepcion, sinContenedor } = asignarMovimientos([r2, r1], [a, b, c, otro]);
    expect(porRecepcion.get("r1").map((m: any) => m.id)).toEqual([a.id, c.id]); // c: ninguno antes → el primero
    expect(porRecepcion.get("r2").map((m: any) => m.id)).toEqual([b.id]);
    expect(sinContenedor).toEqual([otro]); // pedido mal escrito: se muestra para corregir
  });

  it("cruza por el número: '1921' es del contenedor PEDDM1921", () => {
    expect(clavePedidoRecepcion("PEDDM1921")).toBe("1921");
    expect(clavePedidoRecepcion(" peddm 1921 ")).toBe("1921");
    expect(clavePedidoRecepcion("1921")).toBe("1921");
    expect(clavePedidoRecepcion("PEDDM1974-1907")).toBe("1974-1907");
    expect(clavePedidoRecepcion("PEDMAL")).toBe("PEDMAL");
    const r = rec({ id: "r1", numeroPedido: "PEDDM1921", horaInicio: h(6) });
    const solo = mov({ numeroPedido: "1921" }), completo = mov({ numeroPedido: "PEDDM1921" });
    const otro = mov({ numeroPedido: "11921" });
    const { porRecepcion, sinContenedor } = asignarMovimientos([r], [solo, completo, otro]);
    expect(porRecepcion.get("r1").map((m: any) => m.id)).toEqual([solo.id, completo.id]);
    expect(sinContenedor).toEqual([otro]);
  });
});

describe("un contenedor", () => {
  it("PLU, unidades, m³, descarga, almacenamiento sin duplicar, trabajo y ciclo", () => {
    const r = rec({ pausaSegundos: 600 }); // 8:00-9:00 con 10 min de pausa → 50 min
    const movs = [
      mov({ plu: "100", tramos: [{ usuarioId: "a", inicio: h(9), fin: h(9, 30) }], horaFinalizacion: h(9, 30) }),
      // Otro montacarguista a la vez (9:15-9:45): el reloj va hasta 9:45, no suma 60.
      mov({ plu: "200", cantidadTotal: 5, m3: null, kg: null, tramos: [{ usuarioId: "b", inicio: h(9, 15), fin: h(9, 45) }], horaFinalizacion: h(9, 45) }),
    ];
    const a = almacenamientoContenedor(r, movs);
    expect(a).toMatchObject({
      movimientos: 2, abiertos: 0, plus: 2, unidades: 15, m3: 1, kg: 50, sinMedida: 1, montacarguistas: 2,
      descargaSeg: 50 * 60, almacenamientoRelojSeg: 45 * 60, almacenamientoPersonaSeg: 60 * 60,
      trabajoSeg: 95 * 60, cicloSeg: 105 * 60, completo: true, // 8:00 → 9:45
      // EL tiempo de recepcion: descarga neta (50) + lo que faltaba al cerrarla (9:00 → 9:45).
      totalSeg: 95 * 60, colaSeg: 45 * 60,
    });
  });

  it("si todo quedo ubicado antes de cerrar la descarga, el tiempo de recepcion es la descarga", () => {
    const a = almacenamientoContenedor(rec(), [mov({ horaFinalizacion: h(8, 40), tramos: [{ usuarioId: "a", inicio: h(8, 30), fin: h(8, 40) }] })]);
    expect(a).toMatchObject({ descargaSeg: 60 * 60, colaSeg: 0, totalSeg: 60 * 60 });
  });

  it("desglose: ubicando + entre PLU = ventana, por contenedor y por montacarguista", () => {
    const { desgloseAlmacenamiento } = cargarNuxt("utils/recepcionAlmacenamientoCalc.ts");
    const movs = [
      // a: 9:00-9:10 y 9:30-9:40 (espera de 20 min); b a la vez 9:05-9:15.
      mov({ tramos: [{ usuarioId: "a", inicio: h(9), fin: h(9, 10) }] }),
      mov({ tramos: [{ usuarioId: "a", inicio: h(9, 30), fin: h(9, 40) }] }),
      mov({ tramos: [{ usuarioId: "b", inicio: h(9, 5), fin: h(9, 15) }] }),
      // Registrado antes de abrir la descarga (8:00): no alarga el contenedor.
      mov({ tramos: [{ usuarioId: "c", inicio: h(7), fin: h(7, 5) }] }),
    ];
    const d = desgloseAlmacenamiento(rec({ horaInicio: h(8) }), movs);
    // Ventana 9:00-9:40 = 40; ubicando 9:00-9:15 + 9:30-9:40 = 25; entre = 15.
    expect(d).toMatchObject({ ventanaSeg: 40 * 60, ubicandoSeg: 25 * 60, entrePluSeg: 15 * 60, mayorHuecoSeg: 15 * 60 });
    const a = d.porMontacarguista.find((m: any) => m.usuarioId === "a");
    expect(a).toMatchObject({ plus: 2, ubicandoSeg: 20 * 60, entrePluSeg: 20 * 60, ventanaSeg: 40 * 60, promPluSeg: 10 * 60, promEntrePluSeg: 20 * 60, huecos: 1 });
    expect(d.porMontacarguista.map((m: any) => m.usuarioId)).not.toContain("c");
    // Por persona: (20 + 10) min / 3 PLU; esperas 20 min / 1 hueco.
    expect(d).toMatchObject({ promPluSeg: 10 * 60, promEntrePluSeg: 20 * 60, nPlu: 3, nHuecos: 1 });
  });

  it("el promedio de las partes suma exacto el total (al segundo)", () => {
    const { partesTiempo } = cargarNuxt("utils/recepcionAlmacenamientoCalc.ts");
    const p = partesTiempo([
      { totalSeg: 14832, descargaSeg: 13361 }, // ARAMORO 25-09: 4 h 07 min 12 s = 3 h 42 min 41 s + 24 min 31 s
      { totalSeg: 16068, descargaSeg: 16068 },
      { totalSeg: null, descargaSeg: 999 },
    ]);
    expect(p).toEqual({ totalSeg: 15450, descargaSeg: 14715, colaSeg: 735 });
    expect(p.descargaSeg + p.colaSeg).toBe(p.totalSeg);
  });

  it("no está completo mientras falte ubicar un PLU o la descarga siga abierta", () => {
    expect(almacenamientoContenedor(rec(), [mov({ estado: "EN_CURSO", horaFinalizacion: null })]))
      .toMatchObject({ abiertos: 1, completo: false, cicloSeg: null, totalSeg: null, colaSeg: null });
    expect(almacenamientoContenedor(rec({ estado: "EN_CURSO", horaFinalizacion: null }), [mov()]))
      .toMatchObject({ descargaSeg: null, trabajoSeg: null, completo: false });
    // Sin PLU del montacarguista (lo de antes del 24-09) no entra.
    expect(almacenamientoContenedor(rec(), [])).toMatchObject({ movimientos: 0, completo: false });
  });
});

describe("contenedores por día, por tipo", () => {
  const alm = (descargaMin: number, relojMin: number, personaMin: number) => ({
    plus: 20, unidades: 400, m3: 30, descargaSeg: descargaMin * 60, almacenamientoRelojSeg: relojMin * 60,
    almacenamientoPersonaSeg: personaMin * 60, trabajoSeg: (descargaMin + relojMin) * 60, cicloSeg: (descargaMin + relojMin + 30) * 60,
  });

  it("manda la etapa más lenta: la descarga de a uno, el almacenamiento entre los montacarguistas", () => {
    const p = proyeccionContenedores([
      { tipoContenedor: "PIES_40", alm: alm(120, 150, 240) },
      { tipoContenedor: "PIES_40", alm: alm(120, 150, 240) },
      { tipoContenedor: "PIES_20", alm: alm(60, 50, 60) },
    ], { horas: 8, montacarguistas: 2 });
    const c40 = p.find((x: any) => x.tipoContenedor === "PIES_40");
    // Descarga: 480/120 = 4. Almacenamiento: 2×480/240 = 4. Empate → almacenamiento.
    expect(c40).toMatchObject({ contenedores: 2, descargaMin: 120, almacenamientoPersonaMin: 240, trabajoMin: 270, cicloMin: 300, capacidadDescarga: 4, capacidadAlmacenamiento: 4, capacidad: 4 });
    const c20 = p.find((x: any) => x.tipoContenedor === "PIES_20");
    // Descarga: 480/60 = 8. Almacenamiento: 960/60 = 16 → limita la descarga.
    expect(c20).toMatchObject({ capacidad: 8, cuello: "descarga" });
    expect(p.map((x: any) => x.tipoContenedor)).toEqual(["PIES_40", "PIES_20"]);
  });
});

describe("endpoint y pantalla", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  it("el listado trae el almacenamiento y la proyección es de supervisión", () => {
    expect(leer("nuxt-app/server/api/recepcion-contenedores/index.get.ts")).toContain("almacenamientoDeRecepciones(rows)");
    const api = leer("nuxt-app/server/api/recepcion-contenedores/almacenamiento.get.ts");
    expect(api).toContain("assertGestorRecepcion(");
    expect(api).toContain("c.alm.completo");
  });
  it("la tabla muestra lo almacenado y la tarjeta solo la ve supervisión", () => {
    expect(leer("nuxt-app/app/components/recepcion/Tabla.vue")).toContain("<th>Almacenado (montacargas)</th>");
    expect(leer("nuxt-app/app/components/recepcion/Module.vue")).toContain('<RecepcionProyeccion v-if="canManage"');
  });
});
