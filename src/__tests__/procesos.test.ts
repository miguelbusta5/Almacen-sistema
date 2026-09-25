// Indicadores por proceso del área de almacenamiento (23-09). El cálculo vive
// en nuxt-app sin gemelo en src/lib: se carga con cargarNuxt.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cargarNuxt } from "./apoyo/nuxt";

const { etiquetaRango, metaDeProceso, resumenGenerales, resumenProceso, resumenRecepcion, semaforo } =
  cargarNuxt("utils/procesosCalc.ts");
const nombres = new Map([["juan", "Juan"], ["pedro", "Pedro"]]);
const c = (usuarioId: string, dia: string, o: Partial<any> = {}) =>
  ({ usuarioId, dia, plu: "100", descripcion: "SILLA", unidades: 10, m3: 1, kg: 5, ...o });

describe("un proceso por PLU", () => {
  it("por persona al día (día trabajado), el equipo junto y el total", () => {
    const r = resumenProceso([
      c("juan", "2026-09-22"), c("juan", "2026-09-22"), c("juan", "2026-09-23"),
      c("pedro", "2026-09-22", { unidades: 30, m3: null, kg: null }),
    ], nombres);
    expect(r.total).toEqual({ plus: 4, unidades: 60, m3: 3, kg: 15 });
    expect(r.dias).toBe(2);
    expect(r.equipoDia).toMatchObject({ plus: 2, unidades: 30 }); // 4 PLU en 2 días
    // Persona-día: juan-22 (2), juan-23 (1), pedro-22 (1) → 4/3.
    expect(r.personaDia.plus).toBe(1.3);
    expect(r.sinMedida).toBe(1); // no suma cero: se cuenta aparte
    expect(r.personas[0]).toMatchObject({ nombre: "Juan", dias: 2, porDia: { plus: 1.5, unidades: 15 } });
    expect(r.serie.map((d: any) => d.dia)).toEqual(["2026-09-22", "2026-09-23"]);
    expect(r.topPlus[0]).toMatchObject({ plu: "100", veces: 4, unidades: 60 });
  });

  it("la meta es el día típico (mediana persona-día) y el semáforo 100 / 80 %", () => {
    const hist = [
      ...Array.from({ length: 10 }, () => c("juan", "2026-09-01")),
      ...Array.from({ length: 20 }, () => c("juan", "2026-09-02")),
      ...Array.from({ length: 30 }, () => c("pedro", "2026-09-02")),
    ];
    expect(metaDeProceso(hist)).toEqual({ plus: 20, unidades: 200 });
    expect(metaDeProceso([])).toBeNull();
    expect(semaforo(20, 20)).toBe("verde");
    expect(semaforo(16, 20)).toBe("amarillo");
    expect(semaforo(15.9, 20)).toBe("rojo");
    expect(semaforo(5, null)).toBeNull();
    const r = resumenProceso([c("juan", "2026-09-22")], nombres, { plus: 20 });
    expect(r.personas[0].semaforo).toBe("rojo");
  });

  it("un registro cuenta completo a todos los que lo tuvieron; el equipo, una vez", () => {
    const r = resumenProceso([c("pedro", "2026-09-22", { participantes: ["juan", "pedro"] })], nombres);
    expect(r.total).toMatchObject({ plus: 1, unidades: 10 });
    expect(r.personas.map((p: any) => [p.nombre, p.total.plus, p.total.unidades])).toEqual(
      expect.arrayContaining([["Juan", 1, 10], ["Pedro", 1, 10]]),
    );
    // La meta también acredita a los dos.
    expect(metaDeProceso([c("pedro", "2026-09-01", { participantes: ["juan", "pedro"] })])).toEqual({ plus: 1, unidades: 10 });
  });

  it("filtro de turno o persona: solo se acredita a los permitidos y solo cuentan sus registros", () => {
    const cierres = [
      c("pedro", "2026-09-22", { participantes: ["juan", "pedro"] }),
      c("pedro", "2026-09-22"),
    ];
    const r = resumenProceso(cierres, nombres, null, new Set(["juan"]));
    expect(r.total.plus).toBe(1);
    expect(r.personas.map((p: any) => p.nombre)).toEqual(["Juan"]);
  });
});

describe("tareas generales", () => {
  it("tiempo por persona-día, por equipo-día y en qué se va", () => {
    const r = resumenGenerales([
      { usuarioId: "juan", dia: "2026-09-22", descripcion: "aseo", segundos: 3600 },
      { usuarioId: "juan", dia: "2026-09-22", descripcion: "Aseo ", segundos: 1800 },
      { usuarioId: "pedro", dia: "2026-09-23", descripcion: "Patinador", segundos: 7200 },
    ], nombres);
    expect(r).toMatchObject({ segundos: 12600, dias: 2, equipoDiaSeg: 6300, personaDiaSeg: 6300 });
    expect(r.porDescripcion[0]).toMatchObject({ descripcion: "PATINADOR", segundos: 7200 });
    expect(r.porDescripcion.find((d: any) => d.descripcion === "ASEO")).toMatchObject({ veces: 2, segundos: 5400, personas: 1 });
    expect(r.personas.find((p: any) => p.usuarioId === "juan")).toMatchObject({ dias: 1, porDiaSeg: 5400, tareas: 2 });
  });
});

describe("recepción de contenedores clasificada", () => {
  const cont = (o: Partial<any>) => ({
    proveedor: "EHL", tipoContenedor: "PIES_40", unidades: 1000, pesoKg: 3000, m3: null,
    descargaMin: 120, almacenamientoMin: null, trabajoMin: null, cicloMin: null, personas: 4, ...o,
  });

  it("rangos fijos de unidades, m³ y kg", () => {
    expect(etiquetaRango([500, 2000, 5000], 100, "und")).toBe("Menos de 500 und");
    expect(etiquetaRango([500, 2000, 5000], 500, "und")).toBe("500 – 2.000 und");
    expect(etiquetaRango([500, 2000, 5000], 9000, "und")).toBe("Más de 5.000 und");
    expect(etiquetaRango([20, 40, 60], null, "m³")).toBe("Sin dato");
  });

  it("promedios por grupo; el almacenamiento solo sobre los que lo tienen", () => {
    const r = resumenRecepcion([
      cont({}),
      cont({ descargaMin: 60, almacenamientoMin: 90, trabajoMin: 150, cicloMin: 200, m3: 30, personas: 6 }),
      cont({ proveedor: "WISHINE", tipoContenedor: "PIES_20", unidades: 6000, pesoKg: 12000 }),
    ]);
    expect(r.general).toMatchObject({ contenedores: 3, descargaMin: 100, almacenamientoMin: 90, trabajoMin: 150, conAlmacenamiento: 1, personas: 4.7 });
    // Un solo tiempo, al segundo, solo sobre los completos: sin ninguno, vacio.
    expect(r.general).toMatchObject({ tiempoTotalSeg: null, tiempoDescargaSeg: null, tiempoColaSeg: null, completos: 0 });
    const t = resumenRecepcion([
      cont({ totalSeg: 14832, descargaSeg: 13361 }),
      cont({ totalSeg: 16068, descargaSeg: 16068 }),
      cont({ totalSeg: null, descargaSeg: 7200 }),
    ]);
    expect(t.general).toMatchObject({ tiempoTotalSeg: 15450, tiempoDescargaSeg: 14715, tiempoColaSeg: 735, completos: 2 });
    expect(r.porProveedor.find((g: any) => g.clave === "EHL")).toMatchObject({ contenedores: 2, descargaMin: 90 });
    expect(r.porTipo.map((g: any) => g.clave)).toEqual(["40 pies", "20 pies"]);
    expect(r.porUnidades.map((g: any) => g.clave)).toEqual(["500 – 2.000 und", "Más de 5.000 und"]);
    expect(r.porVolumen.map((g: any) => g.clave)).toEqual(["20 – 40 m³", "Sin dato"]);
    expect(r.porPeso.map((g: any) => g.clave)).toEqual(["2.000 – 5.000 kg", "Más de 10.000 kg"]);
  });
});

describe("endpoint y pantalla", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
  const api = leer("nuxt-app/server/api/indicadores/procesos.get.ts");

  it("solo supervisión; periodo, anterior y meta de 4 semanas", () => {
    expect(api).toContain("assertGestorMontacargas(");
    expect(api).toContain("const anterior = { desde: diaMas(desde, -n), hasta: diaMas(desde, -1) }");
    expect(api).toContain("const metaVentana = { desde: diaMas(desde, -28), hasta: diaMas(desde, -1) }");
  });

  it("movimientos = montacargas movimiento y resurtido; resurtido separa capacidad; generales recortadas al turno", () => {
    expect(api).toContain("tipo: { in: ['MOVIMIENTO', 'RESURTIDO'] }");
    expect(api).toContain("/^capacidad/i.test(t.montaje.nombreArchivo ?? '')");
    expect(api).toContain("recortarAlTurno({ usuarioId: a.usuarioId, inicio: a.horaInicio, fin: a.horaFin! }, ventanas)");
  });

  it("respeta el turno día / noche y acredita a todos los que tuvieron el registro", () => {
    expect(api).toContain("const turno = esJornada(sp.turno) ? sp.turno : null");
    expect(api).toContain("clasificarJornadas({");
    expect(api).toContain("participantes: participantesDe(tramos, usuario)");
    expect(api).toContain("resumenProceso(todos.filter((c) => enVentana(c.dia, actual)), nombres, meta, permitidas)");
    expect(leer("nuxt-app/app/components/indicadores/Procesos.vue")).toContain("turno: props.turno");
    expect(leer("nuxt-app/app/components/indicadores/Module.vue")).toContain(':turno="jornada"');
  });

  it("las pestañas de proceso van primero y exportan a Excel", () => {
    const mod = leer("nuxt-app/app/components/indicadores/Module.vue");
    expect(mod).toContain("<IndicadoresProcesos");
    expect(mod).toContain("('recepcion')");
    // Se exporta el dashboard entero desde el módulo (todas las pestañas).
    expect(mod).toContain("exportarDashboard({");
  });
});
