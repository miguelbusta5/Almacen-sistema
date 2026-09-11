import { describe, expect, it } from "vitest";
import {
  agregarIndicadores,
  diaBogota,
  diasDelRango,
  partirPorDia,
  promedio,
  repartirTiempo,
  unidadesPorHora,
  type Intervalo,
} from "@/lib/indicadores";

// Hora de Bogotá -> Date (UTC-5, sin horario de verano).
const h = (hhmmss: string, dia = "2026-09-10") => new Date(`${dia}T${hhmmss}-05:00`);
const i = (desde: string, hasta: string, tipo: Intervalo["tipo"] = "resurtido"): Intervalo =>
  ({ inicio: h(desde), fin: h(hasta), tipo });

describe("tiempo laborado — no se cuenta dos veces el mismo minuto", () => {
  // El ejemplo del usuario: tres tapetes a la vez que cierran a los 3 minutos.
  it("tres PLUs a la vez durante 3 minutos son 3 minutos, no 9", () => {
    const r = repartirTiempo([
      i("09:00:00", "09:03:00"),
      i("09:00:00", "09:03:00"),
      i("09:00:00", "09:03:00"),
    ]);
    expect(r.total).toBe(180);
  });

  // Caso real de producción: SEBASTIAN JURADO cogió 4 tapetes en 26 segundos y
  // los fue ubicando uno a uno. Sus relojes suman 39,5 min; trabajó 16,8.
  it("el resurtido real de Sebastián da 16,8 min y no 39,5", () => {
    const tapetes = [
      i("09:46:06", "10:02:52"), // YUTE ALFA
      i("09:46:15", "09:58:45"), // CONVERSE
      i("09:46:25", "09:52:41"), // TOSANI
      i("09:46:32", "09:50:31"), // WARRICK
    ];
    // 16:46 + 12:30 + 6:16 + 3:59 = 2.371 s: lo que daba sumar los relojes.
    const suma = tapetes.reduce((s, t) => s + (t.fin.getTime() - t.inicio.getTime()) / 1000, 0);
    expect(suma).toBe(2371);
    expect(repartirTiempo(tapetes).total).toBe(1006); // 16 min 46 s
  });

  // "Varios al mismo tiempo pero no con los mismos tiempos": se cuenta el tramo
  // de reloj de pared en que tuvo AL MENOS uno en la mano.
  it("relojes escalonados cuentan de la primera apertura al último cierre", () => {
    const r = repartirTiempo([i("09:00:00", "09:05:00"), i("09:02:00", "09:10:00")]);
    expect(r.total).toBe(600); // 9:00 a 9:10
  });

  // Y lo contrario: si hay un hueco entre tareas, el hueco no es trabajo.
  it("un hueco entre tareas no cuenta", () => {
    const r = repartirTiempo([i("09:00:00", "09:05:00"), i("09:20:00", "09:25:00")]);
    expect(r.total).toBe(600);
  });

  it("un tramo que acaba justo cuando empieza otro no es un solape", () => {
    const r = repartirTiempo([i("09:00:00", "09:05:00"), i("09:05:00", "09:10:00")]);
    expect(r.total).toBe(600);
  });

  it("sin intervalos, o con intervalos vacíos, no hay tiempo", () => {
    expect(repartirTiempo([]).total).toBe(0);
    expect(repartirTiempo([i("09:00:00", "09:00:00")]).total).toBe(0);
  });
});

describe("tiempo laborado — reparto por tipo de tarea", () => {
  it("cada tipo se lleva su tiempo cuando no se pisan", () => {
    const r = repartirTiempo([
      i("09:00:00", "09:10:00", "recepcion"),
      i("09:10:00", "09:15:00", "movimiento"),
    ]);
    expect(r.porTipo.recepcion).toBe(600);
    expect(r.porTipo.movimiento).toBe(300);
  });

  // Si dos tipos se pisan, el trozo compartido se parte entre los dos en vez de
  // contarse entero en cada uno. Así las barras apiladas suman el total real.
  it("un trozo con dos tipos a la vez se parte entre ellos", () => {
    const r = repartirTiempo([
      i("09:00:00", "09:10:00", "resurtido"),
      i("09:05:00", "09:15:00", "pendiente"),
    ]);
    // 9:00-9:05 solo resurtido (300) · 9:05-9:10 los dos (150 + 150) · 9:10-9:15 solo pendiente (300)
    expect(r.porTipo.resurtido).toBe(450);
    expect(r.porTipo.pendiente).toBe(450);
    expect(r.total).toBe(900);
  });

  it("el reparto por tipo siempre suma el total exacto", () => {
    const r = repartirTiempo([
      i("09:00:00", "09:07:13", "resurtido"),
      i("09:03:21", "09:11:59", "movimiento"),
      i("09:05:00", "09:06:07", "pendiente"),
    ]);
    const suma = Object.values(r.porTipo).reduce((a, b) => a + b, 0);
    expect(suma).toBe(r.total);
  });
});

describe("tiempo laborado — días", () => {
  it("la fecha es la de Bogotá, no la de UTC", () => {
    // 21:00 en Bogotá ya es el día siguiente en UTC.
    expect(diaBogota(h("21:00:00"))).toBe("2026-09-10");
  });

  // Sin partirlo, la evolución diaria le cargaría el turno de noche entero al
  // día en que empezó.
  it("un tramo que cruza la medianoche cuenta una parte para cada día", () => {
    const partes = partirPorDia({
      inicio: h("23:30:00", "2026-09-10"),
      fin: h("00:45:00", "2026-09-11"),
      tipo: "movimiento",
    });
    expect(partes.map((p) => p.dia)).toEqual(["2026-09-10", "2026-09-11"]);
    const seg = partes.map((p) => (p.intervalo.fin.getTime() - p.intervalo.inicio.getTime()) / 1000);
    expect(seg).toEqual([1800, 2700]);
  });

  it("un tramo dentro del día no se parte", () => {
    expect(partirPorDia(i("09:00:00", "10:00:00"))).toHaveLength(1);
  });
});

describe("productividad", () => {
  it("unidades por hora sobre el tiempo real", () => {
    expect(unidadesPorHora(120, 1800)).toBe(240);
    expect(unidadesPorHora(50, 0)).toBeNull();
  });

  it("promedio de segundos", () => {
    expect(promedio([60, 120, 180])).toBe(120);
    expect(promedio([])).toBeNull();
  });
});

describe("indicadores del periodo", () => {
  const personas = [
    { id: "seb", nombre: "SEBASTIAN JURADO", rol: "MONTACARGAS" },
    { id: "duv", nombre: "DUVAN CASTRILLON", rol: "OPERARIO_ALMACENAMIENTO" },
  ];
  const t = (
    usuarioId: string,
    desde: string,
    hasta: string,
    tipo: Intervalo["tipo"],
    registro: string | null,
    dia = "2026-09-10",
  ) => ({ usuarioId, inicio: h(desde, dia), fin: h(hasta, dia), tipo, registro });

  it("el total de la persona es reloj de pared y cada PLU guarda su reloj", () => {
    const r = agregarIndicadores({
      personas,
      tiempos: [
        t("seb", "09:00:00", "09:03:00", "resurtido", "a"),
        t("seb", "09:00:00", "09:03:00", "resurtido", "b"),
        t("seb", "09:00:00", "09:03:00", "resurtido", "c"),
      ],
      unidades: [],
      desde: "2026-09-10",
      hasta: "2026-09-10",
    });
    const seb = r.personas[0];
    expect(seb.segundos).toBe(180);
    expect(seb.sumaRelojes).toBe(540);
    expect(seb.plus).toBe(3);
    expect(seb.promedioPorPlu).toBe(180);
  });

  // Un PLU con novedad deja dos tramos del mismo operario: es UN PLU.
  it("dos tramos del mismo PLU son un solo reloj", () => {
    const r = agregarIndicadores({
      personas,
      tiempos: [
        t("seb", "09:00:00", "09:02:00", "movimiento", "m1"),
        t("seb", "09:10:00", "09:11:00", "movimiento", "m1"),
      ],
      unidades: [],
      desde: "2026-09-10",
      hasta: "2026-09-10",
    });
    expect(r.personas[0].plus).toBe(1);
    expect(r.personas[0].promedioPorPlu).toBe(180);
  });

  // El traspaso: el montacarguista lo empieza y el ayudante lo ubica. Cada uno
  // tiene su tramo, pero es un solo PLU.
  it("un PLU que pasa de mano cuenta para los dos pero es un solo PLU", () => {
    const r = agregarIndicadores({
      personas,
      tiempos: [
        t("seb", "09:00:00", "09:02:00", "recepcion", "m1"),
        t("duv", "09:02:00", "09:05:00", "recepcion", "m1"),
      ],
      unidades: [],
      desde: "2026-09-10",
      hasta: "2026-09-10",
    });
    expect(r.resumen.plus).toBe(2);
    expect(r.resumen.registros).toBe(1);
  });

  it("lo que cae fuera del rango no cuenta", () => {
    const r = agregarIndicadores({
      personas,
      tiempos: [
        { usuarioId: "seb", inicio: h("23:50:00", "2026-09-09"), fin: h("00:10:00"), tipo: "movimiento", registro: "m" },
      ],
      unidades: [{ usuarioId: "seb", cuando: h("23:55:00", "2026-09-09"), unidades: 40 }],
      desde: "2026-09-10",
      hasta: "2026-09-10",
    });
    expect(r.personas[0].segundos).toBe(600);
    expect(r.personas[0].unidades).toBe(0);
  });

  it("las unidades son de quien cerró y cuentan el día que cerró", () => {
    const r = agregarIndicadores({
      personas,
      tiempos: [t("duv", "09:00:00", "09:30:00", "pendiente", "p1")],
      unidades: [{ usuarioId: "duv", cuando: h("09:30:00"), unidades: 60 }],
      desde: "2026-09-09",
      hasta: "2026-09-10",
    });
    expect(r.personas[0].unidades).toBe(60);
    expect(r.personas[0].unidadesPorHora).toBe(120);
    expect(r.porDia).toEqual([
      { dia: "2026-09-09", segundos: 0, unidades: 0 },
      { dia: "2026-09-10", segundos: 1800, unidades: 60 },
    ]);
  });

  // Un contenedor son miles de unidades en una sola descarga: si entrara en
  // und/hora, quien descarga contenedores parecería el más productivo.
  it("la descarga de contenedores no entra en und/hora ni en el promedio por PLU", () => {
    const r = agregarIndicadores({
      personas,
      tiempos: [
        t("seb", "08:00:00", "09:00:00", "contenedor", null),
        t("seb", "09:00:00", "09:30:00", "recepcion", "r1"),
      ],
      unidades: [{ usuarioId: "seb", cuando: h("09:30:00"), unidades: 100 }],
      desde: "2026-09-10",
      hasta: "2026-09-10",
    });
    const seb = r.personas[0];
    expect(seb.segundos).toBe(5400);
    expect(seb.porTipo.contenedor).toBe(3600);
    expect(seb.unidadesPorHora).toBe(200); // 100 und en 30 min de recepción
    expect(seb.plus).toBe(1);
  });

  it("quien no es de los medidos no aparece", () => {
    const r = agregarIndicadores({
      personas,
      tiempos: [t("otro", "09:00:00", "10:00:00", "movimiento", "x")],
      unidades: [{ usuarioId: "otro", cuando: h("10:00:00"), unidades: 5 }],
      desde: "2026-09-10",
      hasta: "2026-09-10",
    });
    expect(r.personas).toHaveLength(0);
    expect(r.resumen.segundos).toBe(0);
  });

  it("el resumen y la evolución diaria cuadran con las personas", () => {
    const r = agregarIndicadores({
      personas,
      tiempos: [
        t("seb", "09:00:00", "09:10:00", "movimiento", "m1"),
        t("seb", "09:05:00", "09:20:00", "resurtido", "m2"),
        t("duv", "10:00:00", "10:07:00", "pendiente", "p1"),
      ],
      unidades: [],
      desde: "2026-09-10",
      hasta: "2026-09-10",
    });
    const suma = r.personas.reduce((s, p) => s + p.segundos, 0);
    expect(r.resumen.segundos).toBe(suma);
    expect(r.porDia[0].segundos).toBe(suma);
    expect(Object.values(r.porTipo).reduce((a, b) => a + b, 0)).toBe(suma);
    expect(r.personas.map((p) => p.id)).toEqual(["seb", "duv"]);
  });

  it("el rango lista todos sus días", () => {
    expect(diasDelRango("2026-08-30", "2026-09-02")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });
});
