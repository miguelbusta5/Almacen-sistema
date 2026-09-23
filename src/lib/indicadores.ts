// Lógica pura del módulo de Indicadores: el tiempo laborado de cada persona.
//
// Fuente de verdad. Se replica en nuxt-app/server/utils/indicadoresCalc.ts
// (Nitro), que no puede importar de src/lib. Hay tests que comparan las dos.
//
// EL PROBLEMA QUE RESUELVE. Una persona puede tener varios relojes corriendo a
// la vez —en resurtido se permiten varios PLUs abiertos, y un ayudante puede
// recibir un PLU mientras termina otro—. Sumar esos relojes cuenta el mismo
// minuto varias veces: con datos reales de producción, a un montacarguista le
// salían 430 min trabajados cuando estuvo ocupado 283 (+52%).
//
// Aquí se cuenta el TIEMPO DE RELOJ DE PARED en que la persona tuvo al menos un
// PLU en la mano. Tres tapetes abiertos a la vez durante 3 minutos son 3
// minutos de trabajo, no 9. Cada PLU sigue mostrando su propio tiempo en su
// módulo; lo que cambia es cómo se suma a la persona.

export const TIPOS_TAREA = [
  "recepcion",
  "movimiento",
  "resurtido",
  "pendiente",
  "contenedor",
  "tarea",
] as const;
export type TipoTarea = (typeof TIPOS_TAREA)[number];

export const TIPO_TAREA_LABEL: Record<TipoTarea, string> = {
  recepcion: "Recepción",
  movimiento: "Movimientos",
  resurtido: "Resurtido",
  pendiente: "Pendientes",
  contenedor: "Recepción de contenedores",
  tarea: "Tareas generales",
};

export interface Intervalo {
  inicio: Date;
  fin: Date;
  tipo: TipoTarea;
}

export interface Reparto {
  /** Segundos de reloj de pared con al menos un PLU en la mano. */
  total: number;
  /**
   * Esos mismos segundos repartidos por tipo de tarea. Suman EXACTAMENTE
   * `total`: en un tramo con tareas de dos tipos a la vez, el tiempo se parte a
   * partes iguales entre ellos en vez de contarse entero en los dos.
   */
  porTipo: Record<TipoTarea, number>;
}

function vacio(): Record<TipoTarea, number> {
  return { recepcion: 0, movimiento: 0, resurtido: 0, pendiente: 0, contenedor: 0, tarea: 0 };
}

/**
 * Tiempo laborado de UNA persona a partir de todos sus intervalos.
 *
 * Barrido de línea: se ordenan todos los inicios y fines, y entre cada par de
 * instantes consecutivos se mira qué tareas estaban abiertas. Si había al menos
 * una, ese trozo cuenta UNA vez para la persona, y se reparte entre los tipos
 * que estaban activos.
 */
export function repartirTiempo(intervalos: readonly Intervalo[]): Reparto {
  const porTipo = vacio();
  const validos = intervalos.filter(
    (i) => i.fin.getTime() > i.inicio.getTime() && !Number.isNaN(i.inicio.getTime()),
  );
  if (validos.length === 0) return { total: 0, porTipo };

  // Cada intervalo aporta dos eventos: +1 al abrir y -1 al cerrar su tipo.
  const eventos: { t: number; tipo: TipoTarea; delta: 1 | -1 }[] = [];
  for (const i of validos) {
    eventos.push({ t: i.inicio.getTime(), tipo: i.tipo, delta: 1 });
    eventos.push({ t: i.fin.getTime(), tipo: i.tipo, delta: -1 });
  }
  // Los cierres antes que las aperturas en el mismo instante: un tramo que acaba
  // justo cuando empieza otro no es un solape.
  eventos.sort((a, b) => a.t - b.t || a.delta - b.delta);

  const abiertos = vacio();
  let total = 0;
  let previo = eventos[0]!.t;

  for (const e of eventos) {
    const trozo = (e.t - previo) / 1000;
    if (trozo > 0) {
      const activos = TIPOS_TAREA.filter((t) => abiertos[t] > 0);
      if (activos.length > 0) {
        total += trozo;
        for (const t of activos) porTipo[t] += trozo / activos.length;
      }
    }
    abiertos[e.tipo] += e.delta;
    previo = e.t;
  }

  return { total: Math.round(total), porTipo: redondearReparto(porTipo, Math.round(total)) };
}

/**
 * Redondea el reparto a segundos enteros sin que deje de sumar el total: el
 * sobrante del redondeo va al tipo con más tiempo, donde no se nota.
 */
function redondearReparto(
  porTipo: Record<TipoTarea, number>,
  total: number,
): Record<TipoTarea, number> {
  const r = vacio();
  let suma = 0;
  for (const t of TIPOS_TAREA) {
    r[t] = Math.round(porTipo[t]);
    suma += r[t];
  }
  const diferencia = total - suma;
  if (diferencia !== 0) {
    const mayor = TIPOS_TAREA.reduce((a, b) => (porTipo[b] > porTipo[a] ? b : a));
    r[mayor] += diferencia;
  }
  return r;
}

// ── Días ─────────────────────────────────────────────────────────────
const MS_DIA = 24 * 60 * 60 * 1000;
/** Colombia no tiene horario de verano: UTC-5 todo el año. */
const DESFASE_BOGOTA_MS = -5 * 60 * 60 * 1000;

/** Fecha YYYY-MM-DD en hora de Bogotá. */
export function diaBogota(d: Date): string {
  return new Date(d.getTime() + DESFASE_BOGOTA_MS).toISOString().slice(0, 10);
}

/**
 * Parte un intervalo en los días de Bogotá que toca.
 *
 * Un tramo que cruza la medianoche cuenta una parte para cada día; sin esto la
 * evolución diaria le cargaría el turno de noche entero al día en que empezó.
 */
export function partirPorDia(i: Intervalo): { dia: string; intervalo: Intervalo }[] {
  const partes: { dia: string; intervalo: Intervalo }[] = [];
  let desde = i.inicio.getTime();
  const hasta = i.fin.getTime();
  while (desde < hasta) {
    const local = desde + DESFASE_BOGOTA_MS;
    const finDiaLocal = Math.floor(local / MS_DIA) * MS_DIA + MS_DIA;
    const corte = Math.min(hasta, finDiaLocal - DESFASE_BOGOTA_MS);
    partes.push({
      dia: diaBogota(new Date(desde)),
      intervalo: { inicio: new Date(desde), fin: new Date(corte), tipo: i.tipo },
    });
    desde = corte;
  }
  return partes;
}

// ── Productividad ────────────────────────────────────────────────────
/**
 * Unidades por hora laborada. Es la cifra que separa a quien trabaja muchas
 * horas de quien rinde en ellas; se calcula sobre el tiempo REAL, así que ya no
 * castiga a quien lleva varios PLUs a la vez.
 */
export function unidadesPorHora(unidades: number, segundos: number): number | null {
  if (!Number.isFinite(unidades) || segundos <= 0) return null;
  return Math.round((unidades / segundos) * 3600);
}

/** Promedio de una lista de segundos, o null si está vacía. */
export function promedio(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

// ── Agregado del periodo ─────────────────────────────────────────────
// Lo que devuelve la API. Vive aquí, puro, y no en el endpoint, para que la
// cuenta se pueda probar sin base de datos: el endpoint solo junta las filas.

export interface PersonaMedida {
  id: string;
  nombre: string;
  rol: string;
}

/** Un tramo de reloj de UNA persona sobre un registro. */
export interface TiempoRegistrado {
  usuarioId: string;
  inicio: Date;
  fin: Date;
  tipo: TipoTarea;
  /**
   * El PLU o la tarea a la que pertenece el tramo. Los tramos de la misma
   * persona en el mismo registro forman UN reloj (un PLU con novedad tiene dos
   * tramos del mismo operario). null = no es trabajo por PLU (un contenedor)
   * y no entra en el promedio por PLU.
   */
  registro: string | null;
}

/** Unidades ubicadas: de quien cerró el registro, el día que lo cerró. */
export interface UnidadesRegistradas {
  usuarioId: string;
  cuando: Date;
  unidades: number;
}

/**
 * El turno de una persona un día concreto: contra esto se mide la efectividad.
 *
 * Sale del cuadro de turnos (src/lib/turnos.ts). Sin cuadro no hay ventana, y
 * entonces solo se puede decir cuánto trabajó, no qué parte de su jornada fue.
 */
export interface VentanaTurno {
  usuarioId: string;
  /** Día de Bogotá al que pertenece el turno (el que empieza). */
  dia: string;
  inicio: Date;
  fin: Date;
}

/** Intervalos ordenados y unidos: los ratos en que hubo trabajo, sin repetir. */
function bloquesDeTrabajo(intervalos: readonly { inicio: Date; fin: Date }[]): { a: number; b: number }[] {
  const lista = intervalos
    .filter((i) => i.fin.getTime() > i.inicio.getTime())
    .map((i) => ({ a: i.inicio.getTime(), b: i.fin.getTime() }))
    .sort((x, y) => x.a - y.a);
  const bloques: { a: number; b: number }[] = [];
  for (const it of lista) {
    const ultimo = bloques[bloques.length - 1];
    if (ultimo && it.a <= ultimo.b) ultimo.b = Math.max(ultimo.b, it.b);
    else bloques.push({ ...it });
  }
  return bloques;
}

/** Segundos de trabajo que caen DENTRO del turno. */
export function segundosEnVentanas(
  intervalos: readonly { inicio: Date; fin: Date }[],
  ventanas: readonly { inicio: Date; fin: Date }[],
): number {
  const bloques = bloquesDeTrabajo(intervalos);
  let total = 0;
  for (const v of ventanas) {
    for (const b of bloques) {
      const a = Math.max(b.a, v.inicio.getTime());
      const z = Math.min(b.b, v.fin.getTime());
      if (z > a) total += (z - a) / 1000;
    }
  }
  return Math.round(total);
}

// ── El periodo se cuenta por turnos ──────────────────────────────────
/**
 * El periodo de UNA persona, contado por turnos y no por calendario.
 *
 * Un turno pertenece al día en que EMPIEZA y cuenta entero: el de noche del 13,
 * de 20:30 a 06:00, incluye la madrugada del 14. Cortarlo a medianoche partía el
 * turno en dos y la efectividad solo veía hasta las 12. Por lo mismo, la
 * madrugada del primer día es del turno de la noche anterior y no entra.
 * Sin turnos cargados, el periodo es el de calendario.
 */
export function periodoDePersona(
  ventanas: readonly VentanaTurno[],
  desde: string,
  hasta: string,
): { inicio: Date; fin: Date; turnos: VentanaTurno[] } {
  const { inicio, fin } = limitesRango(desde, hasta);
  let a = inicio.getTime();
  let b = fin.getTime();
  const turnos: VentanaTurno[] = [];
  for (const v of ventanas) {
    if (v.dia < desde) {
      // El turno de la noche anterior se lleva su madrugada.
      if (v.fin.getTime() > a) a = v.fin.getTime();
    } else if (v.dia <= hasta) {
      turnos.push(v);
      b = Math.max(b, v.fin.getTime());
    }
  }
  return { inicio: new Date(Math.min(a, b)), fin: new Date(b), turnos };
}

// ── Turno día / turno noche ──────────────────────────────────────────
export type Jornada = "dia" | "noche";
export const JORNADAS: readonly Jornada[] = ["dia", "noche"];

export function esJornada(v: unknown): v is Jornada {
  return v === "dia" || v === "noche";
}

/** Un turno es de noche cuando termina otro día de Bogotá (cruza la medianoche). */
export function esTurnoNoche(v: { dia: string; fin: Date }): boolean {
  return diaBogota(new Date(v.fin.getTime() - 1)) > v.dia;
}

/** Hora de Bogotá (0-23) de un instante. */
function horaBogota(d: Date): number {
  return new Date(d.getTime() + DESFASE_BOGOTA_MS).getUTCHours();
}

/**
 * Si cada persona es del turno de día o del de noche en el periodo.
 *
 * Manda el cuadro de turnos: noche si la mayoría de sus turnos del periodo cruzan
 * la medianoche. Sin turno en el periodo, se mira a qué hora empezó su trabajo:
 * noche si la mayoría de sus tramos arrancan entre las 18:00 y las 05:00. Sin
 * nada que mirar, día.
 */
export function clasificarJornadas(entrada: {
  personas: readonly PersonaMedida[];
  ventanas: readonly VentanaTurno[];
  tiempos: readonly { usuarioId: string; inicio: Date }[];
  desde: string;
  hasta: string;
}): Map<string, Jornada> {
  const turnos = new Map<string, { noche: number; dia: number }>();
  for (const v of entrada.ventanas) {
    if (v.dia < entrada.desde || v.dia > entrada.hasta) continue;
    const c = turnos.get(v.usuarioId) ?? { noche: 0, dia: 0 };
    if (esTurnoNoche(v)) c.noche += 1;
    else c.dia += 1;
    turnos.set(v.usuarioId, c);
  }
  const horas = new Map<string, { noche: number; dia: number }>();
  for (const t of entrada.tiempos) {
    const h = horaBogota(t.inicio);
    const c = horas.get(t.usuarioId) ?? { noche: 0, dia: 0 };
    if (h >= 18 || h < 5) c.noche += 1;
    else c.dia += 1;
    horas.set(t.usuarioId, c);
  }
  return new Map(entrada.personas.map((p) => {
    const c = turnos.get(p.id) ?? horas.get(p.id);
    return [p.id, c && c.noche > c.dia ? "noche" : "dia"] as [string, Jornada];
  }));
}

/** El día al que se apunta un instante: el de su turno si cae dentro de uno. */
function diaDeTrabajo(t: number, turnos: readonly VentanaTurno[], desde: string, hasta: string): string {
  const turno = turnos.find((v) => v.inicio.getTime() <= t && t < v.fin.getTime());
  const dia = turno ? turno.dia : diaBogota(new Date(t));
  return dia < desde ? desde : dia > hasta ? hasta : dia;
}

/**
 * Parte un intervalo en los días a los que pertenece: lo que cae dentro de un
 * turno va entero al día del turno (aunque pase la medianoche); lo de fuera, al
 * día de calendario.
 */
export function partirPorTurno(
  i: Intervalo,
  turnos: readonly VentanaTurno[],
  desde: string,
  hasta: string,
): { dia: string; intervalo: Intervalo }[] {
  const ini = i.inicio.getTime();
  const fin = i.fin.getTime();
  const cortes = new Set<number>([ini, fin]);
  for (const v of turnos) {
    for (const x of [v.inicio.getTime(), v.fin.getTime()]) if (x > ini && x < fin) cortes.add(x);
  }
  const puntos = [...cortes].sort((x, y) => x - y);
  const partes: { dia: string; intervalo: Intervalo }[] = [];
  for (let k = 0; k < puntos.length - 1; k++) {
    const trozo: Intervalo = { inicio: new Date(puntos[k]!), fin: new Date(puntos[k + 1]!), tipo: i.tipo };
    const medio = (puntos[k]! + puntos[k + 1]!) / 2;
    if (turnos.some((v) => v.inicio.getTime() <= medio && medio < v.fin.getTime())) {
      partes.push({ dia: diaDeTrabajo(medio, turnos, desde, hasta), intervalo: trozo });
    } else {
      for (const p of partirPorDia(trozo)) {
        partes.push({ dia: diaDeTrabajo(p.intervalo.inicio.getTime(), [], desde, hasta), intervalo: p.intervalo });
      }
    }
  }
  return partes;
}

export interface IndicadorPersona {
  id: string;
  nombre: string;
  rol: string;
  /** Tiempo real laborado (reloj de pared). */
  segundos: number;
  /** Lo que daba sumar los relojes: para ver cuánto se inflaba. */
  sumaRelojes: number;
  porTipo: Record<TipoTarea, number>;
  unidades: number;
  plus: number;
  unidadesPorHora: number | null;
  promedioPorPlu: number | null;
  /** Lo que dice el cuadro de turnos que debía trabajar en el periodo. */
  jornadaSegundos: number;
  /** De su tiempo real, lo que cayó dentro del turno. */
  segundosEnTurno: number;
  /** Porcentaje de la jornada con trabajo registrado. Null sin turno cargado. */
  efectividad: number | null;
  /** Su evolución: un punto por día del periodo, también los que no trabajó. */
  porDia: { dia: string; segundos: number; unidades: number }[];
}

export interface IndicadoresPeriodo {
  resumen: {
    segundos: number;
    sumaRelojes: number;
    unidades: number;
    /**
     * PLUs por persona, sumados: un PLU que pasó del montacarguista al
     * ayudante cuenta para los dos. Sirve para pesar el promedio por PLU.
     */
    plus: number;
    /** PLUs distintos: ese mismo PLU cuenta una vez. */
    registros: number;
    unidadesPorHora: number | null;
    personas: number;
    jornadaSegundos: number;
    segundosEnTurno: number;
    efectividad: number | null;
  };
  personas: IndicadorPersona[];
  porDia: { dia: string; segundos: number; unidades: number }[];
  porTipo: Record<TipoTarea, number>;
}

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Inicio y fin (inclusive) de un rango de días de Bogotá. */
export function limitesRango(desde: string, hasta: string): { inicio: Date; fin: Date } {
  if (!RE_DIA.test(desde) || !RE_DIA.test(hasta)) throw new Error("Rango de fechas inválido");
  return {
    inicio: new Date(`${desde}T00:00:00-05:00`),
    fin: new Date(`${hasta}T23:59:59.999-05:00`),
  };
}

/** Todos los días del rango, también los que no tuvieron trabajo. */
export function diasDelRango(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  // Mediodía: lejos de la medianoche, así sumar 24 h nunca se salta un día.
  for (let t = new Date(`${desde}T12:00:00-05:00`).getTime(); diaBogota(new Date(t)) <= hasta; t += MS_DIA) {
    dias.push(diaBogota(new Date(t)));
  }
  return dias;
}

/**
 * Un tramo de reloj mas largo que esto no es trabajo real: es un registro que
 * se quedo abierto (el caso del PLU 4745 de FABIAN MANRIQUE, abierto desde el
 * 10-09 y cerrado por una pausa el 15-09, que le sumaba 9 h 39 min en un dia).
 * 16 h cubre de sobra el turno mas largo, incluido el de noche.
 */
export const MAX_TRAMO_SEG = 16 * 60 * 60;

export function tramoImposible(t: { inicio: Date; fin: Date }): boolean {
  return (t.fin.getTime() - t.inicio.getTime()) / 1000 > MAX_TRAMO_SEG;
}

/** El periodo de cada persona medida, con sus turnos. */
function periodosPorPersona(
  personas: readonly PersonaMedida[],
  ventanas: readonly VentanaTurno[],
  desde: string,
  hasta: string,
): Map<string, { inicio: Date; fin: Date; turnos: VentanaTurno[] }> {
  const suyas = new Map<string, VentanaTurno[]>();
  for (const v of ventanas) {
    const lista = suyas.get(v.usuarioId) ?? [];
    lista.push(v);
    suyas.set(v.usuarioId, lista);
  }
  return new Map(personas.map((p) => [p.id, periodoDePersona(suyas.get(p.id) ?? [], desde, hasta)]));
}

function duracion(i: { inicio: Date; fin: Date }): number {
  return (i.fin.getTime() - i.inicio.getTime()) / 1000;
}

/**
 * Indicadores de un periodo a partir de las tomas de tiempo de todos los módulos.
 *
 * - El tiempo de cada persona es reloj de pared (repartirTiempo), recortado al
 *   rango: lo que cae fuera no es de este periodo.
 * - Cada PLU conserva su propio reloj para el promedio por PLU.
 * - La productividad (und/hora) se mide solo sobre el trabajo por PLU: un
 *   contenedor no es un PLU, y sus miles de unidades la desvirtuarían.
 */
export function agregarIndicadores(entrada: {
  personas: readonly PersonaMedida[];
  tiempos: readonly TiempoRegistrado[];
  unidades: readonly UnidadesRegistradas[];
  /** Turnos del periodo, si hay cuadro cargado. */
  ventanas?: readonly VentanaTurno[];
  desde: string;
  hasta: string;
}): IndicadoresPeriodo {
  const medidas = new Map(entrada.personas.map((p) => [p.id, p]));
  const periodos = periodosPorPersona(entrada.personas, entrada.ventanas ?? [], entrada.desde, entrada.hasta);

  interface Acc {
    intervalos: Intervalo[];
    sumaRelojes: number;
    relojes: Map<string, number>;
    unidades: number;
  }
  const acc = new Map<string, Acc>();
  const registros = new Set<string>();
  const de = (id: string): Acc => {
    let a = acc.get(id);
    if (!a) {
      a = { intervalos: [], sumaRelojes: 0, relojes: new Map(), unidades: 0 };
      acc.set(id, a);
    }
    return a;
  };

  for (const t of entrada.tiempos) {
    // Un reloj olvidado abierto por dias no es trabajo (ver MAX_TRAMO_SEG).
    if (tramoImposible(t)) continue;
    const periodo = periodos.get(t.usuarioId);
    if (!periodo) continue;
    const a = Math.max(t.inicio.getTime(), periodo.inicio.getTime());
    const b = Math.min(t.fin.getTime(), periodo.fin.getTime());
    if (b <= a) continue;
    const recortado: Intervalo = { inicio: new Date(a), fin: new Date(b), tipo: t.tipo };
    const p = de(t.usuarioId);
    p.intervalos.push(recortado);
    p.sumaRelojes += duracion(recortado);
    if (t.registro !== null) {
      p.relojes.set(t.registro, (p.relojes.get(t.registro) ?? 0) + duracion(recortado));
      registros.add(t.registro);
    }
  }

  const unidadesPorDia = new Map<string, number>();
  const unidadesPersonaDia = new Map<string, Map<string, number>>();
  for (const u of entrada.unidades) {
    const periodo = periodos.get(u.usuarioId);
    if (!periodo) continue;
    const t = u.cuando.getTime();
    if (t < periodo.inicio.getTime() || t > periodo.fin.getTime()) continue;
    de(u.usuarioId).unidades += u.unidades;
    // Las de la madrugada de un turno de noche son del día en que empezó.
    const dia = diaDeTrabajo(t, periodo.turnos, entrada.desde, entrada.hasta);
    unidadesPorDia.set(dia, (unidadesPorDia.get(dia) ?? 0) + u.unidades);
    const suyas = unidadesPersonaDia.get(u.usuarioId) ?? new Map<string, number>();
    suyas.set(dia, (suyas.get(dia) ?? 0) + u.unidades);
    unidadesPersonaDia.set(u.usuarioId, suyas);
  }

  const dias = diasDelRango(entrada.desde, entrada.hasta);

  const porTipo = vacio();
  const segundosPorDia = new Map<string, number>();

  const personas: IndicadorPersona[] = [];
  for (const [id, a] of acc) {
    const persona = medidas.get(id)!;
    const reparto = repartirTiempo(a.intervalos);
    for (const t of TIPOS_TAREA) porTipo[t] += reparto.porTipo[t];

    // Cada persona se calcula día a día, y el día es el de su turno: la
    // madrugada de un turno de noche va con la noche en que empezó.
    const turnos = periodos.get(id)!.turnos;
    const porDia = new Map<string, Intervalo[]>();
    for (const it of a.intervalos) {
      for (const parte of partirPorTurno(it, turnos, entrada.desde, entrada.hasta)) {
        const lista = porDia.get(parte.dia) ?? [];
        lista.push(parte.intervalo);
        porDia.set(parte.dia, lista);
      }
    }
    const suyosPorDia = new Map<string, number>();
    for (const [dia, ints] of porDia) {
      const seg = repartirTiempo(ints).total;
      suyosPorDia.set(dia, seg);
      segundosPorDia.set(dia, (segundosPorDia.get(dia) ?? 0) + seg);
    }

    if (reparto.total === 0 && a.unidades === 0) continue;
    const relojes = [...a.relojes.values()];
    // El turno entero, también la parte que pasa de la medianoche.
    const jornadaSegundos = Math.round(
      turnos.reduce((s, v) => s + (v.fin.getTime() - v.inicio.getTime()) / 1000, 0),
    );
    const segundosEnTurno = turnos.length > 0 ? segundosEnVentanas(a.intervalos, turnos) : 0;
    personas.push({
      id,
      nombre: persona.nombre,
      rol: persona.rol,
      segundos: reparto.total,
      sumaRelojes: Math.round(a.sumaRelojes),
      porTipo: reparto.porTipo,
      unidades: a.unidades,
      plus: relojes.length,
      unidadesPorHora: unidadesPorHora(a.unidades, reparto.total - reparto.porTipo.contenedor),
      promedioPorPlu: promedio(relojes),
      jornadaSegundos,
      segundosEnTurno,
      efectividad: jornadaSegundos > 0 ? Math.round((segundosEnTurno / jornadaSegundos) * 100) : null,
      // La evolución es de cada persona: la del equipo sumaba horas de gente
      // distinta y daba más que cualquier turno.
      porDia: dias.map((dia) => ({
        dia,
        segundos: suyosPorDia.get(dia) ?? 0,
        unidades: unidadesPersonaDia.get(id)?.get(dia) ?? 0,
      })),
    });
  }
  personas.sort((x, y) => y.segundos - x.segundos || x.nombre.localeCompare(y.nombre));

  const sumar = (f: (p: IndicadorPersona) => number) => personas.reduce((s, p) => s + f(p), 0);
  const unidadesTotal = sumar((p) => p.unidades);

  return {
    resumen: {
      segundos: sumar((p) => p.segundos),
      sumaRelojes: sumar((p) => p.sumaRelojes),
      unidades: unidadesTotal,
      plus: sumar((p) => p.plus),
      registros: registros.size,
      unidadesPorHora: unidadesPorHora(unidadesTotal, sumar((p) => p.segundos - p.porTipo.contenedor)),
      personas: personas.length,
      jornadaSegundos: sumar((p) => p.jornadaSegundos),
      segundosEnTurno: sumar((p) => p.segundosEnTurno),
      // Una razón, no una suma de horas: cuánto del turno del equipo fue trabajo.
      efectividad: sumar((p) => p.jornadaSegundos) > 0
        ? Math.round((sumar((p) => p.segundosEnTurno) / sumar((p) => p.jornadaSegundos)) * 100)
        : null,
    },
    personas,
    porDia: dias.map((dia) => ({
      dia,
      segundos: segundosPorDia.get(dia) ?? 0,
      unidades: unidadesPorDia.get(dia) ?? 0,
    })),
    porTipo,
  };
}

// ── Tiempos muertos ──────────────────────────────────────────────────
// Un tiempo muerto es un rato sin NINGÚN PLU en la mano entre el primero y el
// último del día de una persona. No se guarda: sale de los mismos tramos que el
// tiempo laborado. Lo que se guarda es la justificación que le da un supervisor,
// con el rato de reloj que cubre.
//
// Lo de antes del primer PLU y después del último no se cuenta todavía: sin el
// horario del turno no se sabe si la persona ya había entrado o ya se había ido.

/** Menos que esto es ir por el siguiente PLU, no un tiempo muerto. */
export const MIN_TIEMPO_MUERTO_SEG = 10 * 60;

/**
 * Un hueco de esto o más es un cambio de turno, no un tiempo muerto.
 *
 * No se puede cortar por día de calendario: hay turnos de noche (de 22:00 a
 * 05:00) y cortando a medianoche el rato entre un turno y el siguiente —de las
 * 05:00 a las 22:00— salía como 17 horas de tiempo muerto. Mientras no estén
 * cargados los horarios de los turnos, un hueco así de largo es la persona que
 * se fue a su casa.
 */
export const MAX_HUECO_EN_TURNO_SEG = 4 * 60 * 60;

/** Un resto sin cubrir menor que esto es ruido de reloj, no algo que revisar. */
const TOLERANCIA_PENDIENTE_SEG = 60;

export const MOTIVOS_TIEMPO_MUERTO = [
  "ALMUERZO",
  "PAUSA",
  "ESPERA_MERCANCIA",
  "EQUIPO",
  "NOVEDAD",
  "REUNION",
  "ORDEN_ASEO",
  "APOYO_OTRA_AREA",
  "TAREA_SIN_REGISTRO",
  "PERMISO",
  "OTRO",
  "SIN_JUSTIFICACION",
] as const;
export type MotivoTiempoMuerto = (typeof MOTIVOS_TIEMPO_MUERTO)[number];

export const MOTIVO_TIEMPO_MUERTO_LABEL: Record<MotivoTiempoMuerto, string> = {
  ALMUERZO: "Almuerzo",
  PAUSA: "Pausa activa o descanso",
  ESPERA_MERCANCIA: "Esperando mercancía o contenedor",
  EQUIPO: "Montacargas o equipo no disponible",
  NOVEDAD: "Verificando una novedad",
  REUNION: "Reunión o capacitación",
  ORDEN_ASEO: "Orden y aseo",
  APOYO_OTRA_AREA: "Apoyo a otra área",
  TAREA_SIN_REGISTRO: "Tarea sin toma de tiempo",
  PERMISO: "Permiso o ausencia",
  OTRO: "Otro",
  // También es una respuesta: el supervisor lo revisó y fue tiempo perdido.
  SIN_JUSTIFICACION: "Sin justificación",
};

export function esMotivoTiempoMuerto(v: unknown): v is MotivoTiempoMuerto {
  return typeof v === "string" && (MOTIVOS_TIEMPO_MUERTO as readonly string[]).includes(v);
}

export const MAX_TRAMOS_POR_JUSTIFICACION = 200;
const MAX_OBSERVACION = 500;

/**
 * Valida una justificación (uno o varios tiempos muertos con el mismo motivo).
 * Devuelve el mensaje de error o null.
 */
export function validarJustificacion(entrada: {
  motivo: unknown;
  observacion?: unknown;
  tramos: unknown;
  ahora?: Date;
}): string | null {
  if (!esMotivoTiempoMuerto(entrada.motivo)) return "Elige un motivo de la lista";
  const obs = entrada.observacion;
  if (obs != null && typeof obs !== "string") return "La observación no es válida";
  const texto = typeof obs === "string" ? obs.trim() : "";
  if (texto.length > MAX_OBSERVACION) return `La observación admite hasta ${MAX_OBSERVACION} caracteres`;
  // "Otro" sin explicar no justifica nada.
  if (entrada.motivo === "OTRO" && texto.length < 3) return "Con el motivo Otro, escribe qué pasó";

  const tramos = entrada.tramos;
  if (!Array.isArray(tramos) || tramos.length === 0) return "No hay tiempos muertos que justificar";
  if (tramos.length > MAX_TRAMOS_POR_JUSTIFICACION) {
    return `Como máximo ${MAX_TRAMOS_POR_JUSTIFICACION} tiempos muertos a la vez`;
  }
  const limite = (entrada.ahora ?? new Date()).getTime() + 60_000;
  for (const t of tramos) {
    const r = t as { usuarioId?: unknown; inicio?: unknown; fin?: unknown };
    if (typeof r?.usuarioId !== "string" || !r.usuarioId) return "Falta la persona de un tiempo muerto";
    const ini = new Date(String(r.inicio));
    const fin = new Date(String(r.fin));
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return "Hay un tiempo muerto con horas inválidas";
    if (fin.getTime() <= ini.getTime()) return "Hay un tiempo muerto que termina antes de empezar";
    if (fin.getTime() - ini.getTime() > MS_DIA) return "Un tiempo muerto no puede pasar de un día";
    if (fin.getTime() > limite) return "No se puede justificar un tiempo que todavía no ha pasado";
  }
  return null;
}

/** Final del día de Bogotá en que cae `d` (el último milisegundo). */
export function finDelDiaBogota(d: Date): Date {
  const local = d.getTime() + DESFASE_BOGOTA_MS;
  return new Date(Math.floor(local / MS_DIA) * MS_DIA + MS_DIA - DESFASE_BOGOTA_MS - 1);
}

export interface Hueco {
  dia: string;
  inicio: Date;
  fin: Date;
}

/**
 * Los ratos sin nada en la mano de UNA persona.
 *
 * Primero se juntan los intervalos que se pisan o se tocan en bloques de
 * trabajo; los huecos son lo que queda entre un bloque y el siguiente. Se mira
 * la línea de tiempo entera, sin cortar a medianoche (turnos de noche), y un
 * hueco de MAX_HUECO_EN_TURNO_SEG o más se toma como cambio de turno. El hueco
 * se apunta al día en que empezó.
 */
export function detectarTiemposMuertos(
  intervalos: readonly Intervalo[],
  minimoSeg: number = MIN_TIEMPO_MUERTO_SEG,
  maximoSeg: number = MAX_HUECO_EN_TURNO_SEG,
): Hueco[] {
  const lista = bloquesDeTrabajo(intervalos);
  if (lista.length === 0) return [];

  const huecos: Hueco[] = [];
  let finBloque = lista[0]!.b;
  for (const it of lista.slice(1)) {
    if (it.a > finBloque) {
      const seg = (it.a - finBloque) / 1000;
      if (seg >= minimoSeg && seg < maximoSeg) {
        const inicio = new Date(finBloque);
        huecos.push({ dia: diaBogota(inicio), inicio, fin: new Date(it.a) });
      }
      finBloque = it.b;
    } else if (it.b > finBloque) {
      finBloque = it.b;
    }
  }
  return huecos;
}

/**
 * Los ratos parados DENTRO del turno, cuando hay cuadro cargado.
 *
 * Aquí sí cuenta lo de antes del primer PLU y lo de después del último: con el
 * turno delante se sabe que la persona ya había entrado o todavía no se había
 * ido. Así el tiempo muerto y el trabajado suman exactamente la jornada.
 */
export function huecosEnVentana(
  intervalos: readonly Intervalo[],
  ventana: { dia: string; inicio: Date; fin: Date },
  minimoSeg: number = MIN_TIEMPO_MUERTO_SEG,
): Hueco[] {
  const a = ventana.inicio.getTime();
  const b = ventana.fin.getTime();
  const bloques = bloquesDeTrabajo(intervalos)
    .map((x) => ({ a: Math.max(x.a, a), b: Math.min(x.b, b) }))
    .filter((x) => x.b > x.a);

  const huecos: Hueco[] = [];
  const apuntar = (desde: number, hasta: number) => {
    if ((hasta - desde) / 1000 >= minimoSeg) {
      huecos.push({ dia: ventana.dia, inicio: new Date(desde), fin: new Date(hasta) });
    }
  };
  let cursor = a;
  for (const bloque of bloques) {
    apuntar(cursor, bloque.a);
    cursor = Math.max(cursor, bloque.b);
  }
  apuntar(cursor, b);
  return huecos;
}

export interface JustificacionTiempoMuerto {
  id: string;
  usuarioId: string;
  inicio: Date;
  fin: Date;
  motivo: MotivoTiempoMuerto;
  observacion: string | null;
  justificadoPor: string;
  justificadoAt: Date;
}

export type EstadoTiempoMuerto = "pendiente" | "justificado" | "sin_justificacion";

export interface TiempoMuertoDetalle {
  usuarioId: string;
  nombre: string;
  rol: string;
  dia: string;
  inicio: Date;
  fin: Date;
  segundos: number;
  estado: EstadoTiempoMuerto;
  /** Lo que todavía nadie ha explicado. */
  segundosPendientes: number;
  /** La justificación que cubre la mayor parte del rato, si hay alguna. */
  justificacion: {
    id: string;
    motivo: MotivoTiempoMuerto;
    observacion: string | null;
    justificadoPor: string;
    justificadoAt: Date;
  } | null;
}

export interface TiempoMuertoPersona {
  id: string;
  nombre: string;
  rol: string;
  segundos: number;
  justificados: number;
  sinJustificacion: number;
  pendientes: number;
  cantidad: number;
}

export interface TiemposMuertosPeriodo {
  minimoSegundos: number;
  /** Desde aquí, un hueco es cambio de turno y no tiempo muerto. */
  maximoSegundos: number;
  /** Hay cuadro de turnos: los huecos van acotados a la jornada. */
  conTurnos: boolean;
  resumen: {
    segundos: number;
    justificados: number;
    sinJustificacion: number;
    pendientes: number;
    cantidad: number;
    cantidadPendientes: number;
  };
  personas: TiempoMuertoPersona[];
  /** Tiempo revisado por motivo (incluye "Sin justificación"), de más a menos. */
  porMotivo: { motivo: MotivoTiempoMuerto; segundos: number }[];
  /** Cada tiempo muerto, el más reciente primero. */
  tramos: TiempoMuertoDetalle[];
}

/**
 * Reparte un hueco entre las justificaciones que lo tocan. Si dos se pisan,
 * manda la más reciente: justificar otra vez un rato es corregir la anterior.
 */
function cubrirHueco(
  hueco: Hueco,
  justificaciones: readonly JustificacionTiempoMuerto[],
): { porJustificacion: Map<string, number>; cubierto: number } {
  const a = hueco.inicio.getTime();
  const b = hueco.fin.getTime();
  const tocan = justificaciones.filter((j) => j.inicio.getTime() < b && j.fin.getTime() > a);
  const porJustificacion = new Map<string, number>();
  if (tocan.length === 0) return { porJustificacion, cubierto: 0 };

  const cortes = new Set<number>([a, b]);
  for (const j of tocan) {
    cortes.add(Math.max(a, j.inicio.getTime()));
    cortes.add(Math.min(b, j.fin.getTime()));
  }
  const puntos = [...cortes].sort((x, y) => x - y);
  const recientes = [...tocan].sort((x, y) => y.justificadoAt.getTime() - x.justificadoAt.getTime());
  let cubierto = 0;
  for (let k = 0; k < puntos.length - 1; k++) {
    const desde = puntos[k]!;
    const hasta = puntos[k + 1]!;
    const j = recientes.find((x) => x.inicio.getTime() <= desde && x.fin.getTime() >= hasta);
    if (!j) continue;
    const seg = (hasta - desde) / 1000;
    porJustificacion.set(j.id, (porJustificacion.get(j.id) ?? 0) + seg);
    cubierto += seg;
  }
  return { porJustificacion, cubierto };
}

/**
 * Tiempos muertos de un periodo, con lo que ya justificaron los supervisores.
 *
 * `tiempos` debe traer también lo que sigue en curso (con el fin puesto en
 * "ahora"): una persona con un PLU abierto está trabajando, no parada.
 */
export function agregarTiemposMuertos(entrada: {
  personas: readonly PersonaMedida[];
  tiempos: readonly TiempoRegistrado[];
  justificaciones: readonly JustificacionTiempoMuerto[];
  /** Turnos del periodo, si hay cuadro cargado. */
  ventanas?: readonly VentanaTurno[];
  desde: string;
  hasta: string;
  minimoSeg?: number;
}): TiemposMuertosPeriodo {
  const minimo = entrada.minimoSeg ?? MIN_TIEMPO_MUERTO_SEG;
  const maximo = MAX_HUECO_EN_TURNO_SEG;
  const medidas = new Map(entrada.personas.map((p) => [p.id, p]));
  // Por turnos, igual que el tiempo laborado: el turno de noche entero, con su
  // madrugada, en el día en que empezó.
  const periodos = periodosPorPersona(entrada.personas, entrada.ventanas ?? [], entrada.desde, entrada.hasta);

  const intervalos = new Map<string, Intervalo[]>();
  for (const t of entrada.tiempos) {
    // Un reloj olvidado abierto por dias no es trabajo (ver MAX_TRAMO_SEG).
    if (tramoImposible(t)) continue;
    const periodo = periodos.get(t.usuarioId);
    if (!periodo) continue;
    const a = Math.max(t.inicio.getTime(), periodo.inicio.getTime());
    const b = Math.min(t.fin.getTime(), periodo.fin.getTime());
    if (b <= a) continue;
    const lista = intervalos.get(t.usuarioId) ?? [];
    lista.push({ inicio: new Date(a), fin: new Date(b), tipo: t.tipo });
    intervalos.set(t.usuarioId, lista);
  }

  const justPorPersona = new Map<string, JustificacionTiempoMuerto[]>();
  for (const j of entrada.justificaciones) {
    const lista = justPorPersona.get(j.usuarioId) ?? [];
    lista.push(j);
    justPorPersona.set(j.usuarioId, lista);
  }

  const tramos: TiempoMuertoDetalle[] = [];
  const personas: TiempoMuertoPersona[] = [];
  const porMotivo = new Map<MotivoTiempoMuerto, number>();

  for (const [id, ints] of intervalos) {
    const persona = medidas.get(id)!;
    const justs = justPorPersona.get(id) ?? [];
    const acc: TiempoMuertoPersona = {
      id, nombre: persona.nombre, rol: persona.rol,
      segundos: 0, justificados: 0, sinJustificacion: 0, pendientes: 0, cantidad: 0,
    };

    // Con turno se mide contra la jornada (entra lo de antes del primer PLU y
    // lo de después del último); sin turno, solo los huecos entre PLUs.
    const ventanas = periodos.get(id)!.turnos;
    const huecos = ventanas.length > 0
      ? ventanas.flatMap((v) => huecosEnVentana(ints, v, minimo))
      : detectarTiemposMuertos(ints, minimo, maximo);
    for (const h of huecos) {
      const segundos = Math.round((h.fin.getTime() - h.inicio.getTime()) / 1000);
      const { porJustificacion } = cubrirHueco(h, justs);
      // Segundos enteros por justificación, y la mayor recibe el resto del
      // redondeo y lo que quede sin cubrir por debajo de la tolerancia.
      const cubiertos = [...porJustificacion.entries()]
        .map(([jid, seg]) => ({ j: justs.find((x) => x.id === jid)!, seg: Math.round(seg) }))
        .sort((x, y) => y.seg - x.seg);
      let pendientes = segundos - cubiertos.reduce((s, c) => s + c.seg, 0);
      if (cubiertos.length > 0 && pendientes < TOLERANCIA_PENDIENTE_SEG) {
        cubiertos[0]!.seg += pendientes;
        pendientes = 0;
      }

      for (const c of cubiertos) {
        if (c.j.motivo === "SIN_JUSTIFICACION") acc.sinJustificacion += c.seg;
        else acc.justificados += c.seg;
        porMotivo.set(c.j.motivo, (porMotivo.get(c.j.motivo) ?? 0) + c.seg);
      }
      acc.pendientes += pendientes;
      acc.segundos += segundos;
      acc.cantidad += 1;

      const principal = cubiertos[0]?.j ?? null;
      tramos.push({
        usuarioId: id,
        nombre: persona.nombre,
        rol: persona.rol,
        dia: h.dia,
        inicio: h.inicio,
        fin: h.fin,
        segundos,
        estado: pendientes > 0 || !principal
          ? "pendiente"
          : principal.motivo === "SIN_JUSTIFICACION" ? "sin_justificacion" : "justificado",
        segundosPendientes: pendientes,
        justificacion: principal
          ? {
            id: principal.id,
            motivo: principal.motivo,
            observacion: principal.observacion,
            justificadoPor: principal.justificadoPor,
            justificadoAt: principal.justificadoAt,
          }
          : null,
      });
    }
    if (acc.cantidad > 0) personas.push(acc);
  }

  personas.sort((x, y) => y.segundos - x.segundos || x.nombre.localeCompare(y.nombre));
  tramos.sort((x, y) => y.inicio.getTime() - x.inicio.getTime());
  const sumar = (f: (p: TiempoMuertoPersona) => number) => personas.reduce((s, p) => s + f(p), 0);

  return {
    minimoSegundos: minimo,
    maximoSegundos: maximo,
    conTurnos: (entrada.ventanas?.length ?? 0) > 0,
    resumen: {
      segundos: sumar((p) => p.segundos),
      justificados: sumar((p) => p.justificados),
      sinJustificacion: sumar((p) => p.sinJustificacion),
      pendientes: sumar((p) => p.pendientes),
      cantidad: tramos.length,
      cantidadPendientes: tramos.filter((t) => t.estado === "pendiente").length,
    },
    personas,
    porMotivo: [...porMotivo.entries()]
      .map(([motivo, segundos]) => ({ motivo, segundos }))
      .sort((x, y) => y.segundos - x.segundos),
    tramos,
  };
}

// ── Pausas de alimentación y cambio de baterías ──────────────────────
// Cuántas veces y cuánto tiempo usa cada persona los botones de pausa. Solo lo
// ve quien reparte el trabajo (Felipe Ossa, Eduardo Zurita) y el administrador.

export const MOTIVOS_PAUSA = ["ALIMENTACION", "CAMBIO_BATERIAS"] as const;
export type MotivoPausa = (typeof MOTIVOS_PAUSA)[number];

export interface PausaRegistrada {
  id: string;
  usuarioId: string;
  motivo: string;
  inicio: Date;
  /** Null mientras sigue en pausa. */
  fin: Date | null;
}

export interface PausasPersona {
  id: string;
  nombre: string;
  rol: string;
  veces: Record<MotivoPausa, number>;
  segundos: Record<MotivoPausa, number>;
  totalVeces: number;
  totalSegundos: number;
  /** Está en pausa ahora mismo. */
  enPausa: boolean;
}

export interface PausasPeriodo {
  resumen: { veces: Record<MotivoPausa, number>; segundos: Record<MotivoPausa, number>; personas: number };
  personas: PausasPersona[];
  /** Cada pausa, la más reciente primero. */
  detalle: {
    id: string;
    usuarioId: string;
    nombre: string;
    motivo: MotivoPausa;
    dia: string;
    inicio: Date;
    fin: Date | null;
    segundos: number;
  }[];
}

function porMotivo(): Record<MotivoPausa, number> {
  return { ALIMENTACION: 0, CAMBIO_BATERIAS: 0 };
}

/**
 * Resume las pausas de un periodo por persona y motivo.
 *
 * Una pausa cuenta en el periodo en que EMPIEZA. La que sigue abierta cuenta
 * hasta `ahora`, así el tiempo de quien lleva rato en pausa no sale en cero.
 */
export function resumenPausas(entrada: {
  personas: readonly PersonaMedida[];
  pausas: readonly PausaRegistrada[];
  ahora: Date;
}): PausasPeriodo {
  const medidas = new Map(entrada.personas.map((p) => [p.id, p]));
  const acc = new Map<string, PausasPersona>();
  const resumen = { veces: porMotivo(), segundos: porMotivo(), personas: 0 };
  const detalle: PausasPeriodo["detalle"] = [];

  for (const pausa of entrada.pausas) {
    const persona = medidas.get(pausa.usuarioId);
    if (!persona) continue;
    const motivo = (MOTIVOS_PAUSA as readonly string[]).includes(pausa.motivo)
      ? (pausa.motivo as MotivoPausa)
      : null;
    if (!motivo) continue;
    const hasta = pausa.fin ?? entrada.ahora;
    const segundos = Math.max(0, Math.round((hasta.getTime() - pausa.inicio.getTime()) / 1000));

    let p = acc.get(persona.id);
    if (!p) {
      p = {
        id: persona.id, nombre: persona.nombre, rol: persona.rol,
        veces: porMotivo(), segundos: porMotivo(), totalVeces: 0, totalSegundos: 0, enPausa: false,
      };
      acc.set(persona.id, p);
    }
    p.veces[motivo] += 1;
    p.segundos[motivo] += segundos;
    p.totalVeces += 1;
    p.totalSegundos += segundos;
    if (!pausa.fin) p.enPausa = true;
    resumen.veces[motivo] += 1;
    resumen.segundos[motivo] += segundos;
    detalle.push({
      id: pausa.id, usuarioId: persona.id, nombre: persona.nombre, motivo,
      dia: diaBogota(pausa.inicio), inicio: pausa.inicio, fin: pausa.fin, segundos,
    });
  }

  const personas = [...acc.values()].sort((a, b) => b.totalSegundos - a.totalSegundos || a.nombre.localeCompare(b.nombre));
  resumen.personas = personas.length;
  detalle.sort((a, b) => b.inicio.getTime() - a.inicio.getTime());
  return { resumen, personas, detalle };
}

// ── Resurtido por operario ───────────────────────────────────────────

export interface ResurtidoOperario {
  id: string;
  nombre: string;
  /** Tareas de resurtido que cerro (un PLU por tarea). */
  plus: number;
  /** Dias con al menos un PLU resurtido. */
  dias: number;
  /** Tiempo real en resurtido (reloj de pared, sin duplicar). */
  segundos: number;
  plusPorHora: number | null;
  plusPorDia: number | null;
  /** Segundos promedio por PLU resurtido. */
  segundosPorPlu: number | null;
}

/**
 * Promedios de resurtido por operario.
 *
 * Los PLU son de quien cerro la tarea (igual que las unidades). El tiempo es el
 * de resurtido que ya calcula agregarIndicadores por persona (reloj de pared:
 * si pasó la tarea a un ayudante, cada uno tiene su parte).
 */
export function resumirResurtidoPorOperario(
  personas: readonly { id: string; nombre: string; porTipo: { resurtido: number } }[],
  cierres: readonly { usuarioId: string; cuando: Date }[],
): ResurtidoOperario[] {
  const plus = new Map<string, number>();
  const dias = new Map<string, Set<string>>();
  for (const c of cierres) {
    plus.set(c.usuarioId, (plus.get(c.usuarioId) ?? 0) + 1);
    const d = dias.get(c.usuarioId) ?? new Set<string>();
    d.add(diaBogota(c.cuando));
    dias.set(c.usuarioId, d);
  }
  return personas
    .map((p) => {
      const n = plus.get(p.id) ?? 0;
      const nDias = dias.get(p.id)?.size ?? 0;
      const seg = p.porTipo.resurtido;
      return {
        id: p.id,
        nombre: p.nombre,
        plus: n,
        dias: nDias,
        segundos: seg,
        plusPorHora: n > 0 && seg > 0 ? Math.round((n / (seg / 3600)) * 10) / 10 : null,
        plusPorDia: nDias > 0 ? Math.round((n / nDias) * 10) / 10 : null,
        segundosPorPlu: n > 0 && seg > 0 ? Math.round(seg / n) : null,
      };
    })
    .filter((f) => f.plus > 0 || f.segundos > 0)
    .sort((a, b) => b.plus - a.plus || a.nombre.localeCompare(b.nombre));
}

// ── Cierres por día: la proyección del turno ─────────────────────────

/** El día (de turno) al que pertenece un instante: la madrugada del turno de
 *  noche cae en el día en que empezó el turno, no en el siguiente. */
export function diaDeTurnoDeInstante(
  cuando: Date,
  turnos: readonly VentanaTurno[],
  desde: string,
  hasta: string,
): string {
  return diaDeTrabajo(cuando.getTime(), turnos, desde, hasta);
}

/**
 * Quién cerró un registro con reloj por tramos: el dueño del último tramo por
 * `orden`. Sin tramos (registros viejos), el respaldo que diga quien llama.
 */
export function cerradoPor(
  tramos: readonly { usuarioId: string; orden?: number | null }[],
  respaldo: string,
): string {
  if (!tramos.length) return respaldo;
  return [...tramos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[tramos.length - 1]!.usuarioId;
}

/** Quién lo empezó: el dueño del primer tramo. Sin tramos, nadie aparte. */
export function iniciadoPor(tramos: readonly { usuarioId: string; orden?: number | null }[]): string | null {
  if (!tramos.length) return null;
  return [...tramos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0]!.usuarioId;
}

export interface CierreResurtido {
  /** Quien la cerró. */
  usuarioId: string;
  /** Quien la empezó; null o igual a usuarioId si fue la misma persona. */
  iniciadoPorId: string | null;
  cuando: Date;
  tipo: "tarea" | "pendiente";
}

export interface CierresDiaPersona {
  dia: string;
  usuarioId: string;
  nombre: string;
  /** Tareas de resurtido que cerró ese día. */
  tareas: number;
  /** Pendientes que cerró ese día. */
  pendientes: number;
  /** tareas + pendientes: lo que terminó. */
  total: number;
  /**
   * Las que empezó y terminó otra persona. NO suman al total: si Juan la empieza
   * y Pedro la cierra, a Pedro le cuenta una cerrada y a Juan una pasada; el
   * total del día sigue siendo una.
   */
  pasadas: number;
}

/**
 * Cierres de resurtido y pendientes por día de turno y persona.
 *
 * El día de una pasada es el del cierre: es cuando la tarea deja de estar
 * abierta. Solo salen las personas pedidas (respeta el filtro de turno).
 */
export function cierresPorDiaYPersona(entrada: {
  personas: readonly { id: string; nombre: string }[];
  cierres: readonly CierreResurtido[];
  turnos: readonly VentanaTurno[];
  desde: string;
  hasta: string;
}): CierresDiaPersona[] {
  const nombres = new Map(entrada.personas.map((p) => [p.id, p.nombre]));
  const filas = new Map<string, CierresDiaPersona>();
  const fila = (dia: string, usuarioId: string) => {
    const k = `${dia}|${usuarioId}`;
    let f = filas.get(k);
    if (!f) {
      f = { dia, usuarioId, nombre: nombres.get(usuarioId) ?? usuarioId, tareas: 0, pendientes: 0, total: 0, pasadas: 0 };
      filas.set(k, f);
    }
    return f;
  };
  for (const c of entrada.cierres) {
    const deQuien = entrada.turnos.filter((v) => v.usuarioId === c.usuarioId);
    const dia = diaDeTurnoDeInstante(c.cuando, deQuien, entrada.desde, entrada.hasta);
    if (nombres.has(c.usuarioId)) {
      const f = fila(dia, c.usuarioId);
      if (c.tipo === "tarea") f.tareas++;
      else f.pendientes++;
      f.total++;
    }
    if (c.iniciadoPorId && c.iniciadoPorId !== c.usuarioId && nombres.has(c.iniciadoPorId)) {
      fila(dia, c.iniciadoPorId).pasadas++;
    }
  }
  return [...filas.values()].sort(
    (a, b) => b.dia.localeCompare(a.dia) || b.total - a.total || b.pasadas - a.pasadas || a.nombre.localeCompare(b.nombre),
  );
}

export interface ProyeccionPersona {
  usuarioId: string;
  nombre: string;
  /** Días con algo cerrado o pasado: los que trabajó en esto. */
  dias: number;
  tareasDia: number;
  pendientesDia: number;
  totalDia: number;
  pasadasDia: number;
  /** El mejor día: el techo que ya demostró. */
  maxTotal: number;
}

/**
 * Promedio por DÍA TRABAJADO de cada persona: lo que se puede esperar que
 * cierre en un turno. Sobre los días del rango saldría más bajo solo porque
 * descansó o estuvo en otra cosa.
 */
export function proyeccionDiaria(filas: readonly CierresDiaPersona[]): ProyeccionPersona[] {
  const acc = new Map<string, { nombre: string; dias: number; tareas: number; pendientes: number; total: number; pasadas: number; max: number }>();
  for (const f of filas) {
    const a = acc.get(f.usuarioId) ?? { nombre: f.nombre, dias: 0, tareas: 0, pendientes: 0, total: 0, pasadas: 0, max: 0 };
    a.dias++;
    a.tareas += f.tareas;
    a.pendientes += f.pendientes;
    a.total += f.total;
    a.pasadas += f.pasadas;
    a.max = Math.max(a.max, f.total);
    acc.set(f.usuarioId, a);
  }
  const prom = (n: number, d: number) => Math.round((n / d) * 10) / 10;
  return [...acc.entries()]
    .map(([usuarioId, a]) => ({
      usuarioId,
      nombre: a.nombre,
      dias: a.dias,
      tareasDia: prom(a.tareas, a.dias),
      pendientesDia: prom(a.pendientes, a.dias),
      totalDia: prom(a.total, a.dias),
      pasadasDia: prom(a.pasadas, a.dias),
      maxTotal: a.max,
    }))
    .sort((a, b) => b.totalDia - a.totalDia || a.nombre.localeCompare(b.nombre));
}
