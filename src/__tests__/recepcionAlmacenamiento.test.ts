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
    });
  });

  it("no está completo mientras falte ubicar un PLU o la descarga siga abierta", () => {
    expect(almacenamientoContenedor(rec(), [mov({ estado: "EN_CURSO", horaFinalizacion: null })]))
      .toMatchObject({ abiertos: 1, completo: false, cicloSeg: null });
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
