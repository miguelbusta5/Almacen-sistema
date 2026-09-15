// Indicadores del area de Muebles — FUENTE DE VERDAD.
//
// Se duplica en nuxt-app/server/utils/mueblesIndicadoresCalc.ts por la misma
// razon que pickingMuebles.ts: Nitro no puede importar de src/lib. Hay un guard
// en src/__tests__/mueblesNuxt.test.ts que compara las dos copias.
//
// Por que NO reutiliza `agregarIndicadores` de src/lib/indicadores.ts: ese motor
// gira sobre `TipoTarea`, un union cerrado de cinco valores (recepcion,
// movimiento, resurtido, pendiente, contenedor) triplicado y vigilado por tests.
// Meter "picking" e "inspeccion" ahi obligaria a tocar los tres archivos y a
// revisar todo lo de montacargas. Aqui solo se reutilizan helpers sueltos de
// fecha, que es lo que de verdad se comparte.
import { duracionInspeccionNetaMinutos, TIPOS_MERCANCIA_MUEBLE, type TipoMercanciaMueble } from "@/lib/pickingMuebles";
import { diaBogota, promedio } from "@/lib/indicadores";

/**
 * Cortes de arranque, pensados para ajustarse viendo datos reales. Viven aqui y
 * en ningun otro sitio: cambiarlos es una linea.
 */
export const TRAMOS_VOLUMEN_M3 = [0.5, 1.5, 3] as const;
export const TRAMOS_PESO_KG = [20, 50, 100] as const;

/**
 * Un hueco mayor que esto entre dos PLU no es desplazamiento: es almuerzo,
 * reunion, fin de turno o una orden que quedo a medias. Contarlo como "caminar
 * hasta la estanteria" inflaria el promedio hasta volverlo inservible.
 */
export const MAX_DESPLAZAMIENTO_SEG = 30 * 60;

// ── Tramos ──────────────────────────────────────────────────────────────────

/** Etiqueta legible de un tramo, del estilo "0,5 - 1,5 m³". */
export function etiquetaTramo(cortes: readonly number[], indice: number, unidad: string): string {
  const fmt = (n: number) => String(n).replace(".", ",");
  if (indice === 0) return `< ${fmt(cortes[0]!)} ${unidad}`;
  if (indice === cortes.length) return `> ${fmt(cortes[cortes.length - 1]!)} ${unidad}`;
  return `${fmt(cortes[indice - 1]!)} - ${fmt(cortes[indice]!)} ${unidad}`;
}

/** Indice del tramo al que cae un valor. Null si no hay medida. */
export function tramoDe(valor: number | null | undefined, cortes: readonly number[]): number | null {
  if (valor == null || !Number.isFinite(valor)) return null;
  for (let i = 0; i < cortes.length; i++) {
    if (valor < cortes[i]!) return i;
  }
  return cortes.length;
}

// ── Desplazamiento ──────────────────────────────────────────────────────────

export interface LineaMedida {
  plu: string;
  operarioId: string;
  ordenId: string;
  horaInicio: Date;
  horaFin: Date | null;
  volumenTotalM3: number | null;
  pesoTotalKg: number | null;
  inspectorId: string | null;
  inspHoraInicio: Date | null;
  inspHoraFin: Date | null;
  ebanisteriaInicio: Date | null;
  ebanisteriaFin: Date | null;
  motivoEbanisteria: string | null;
  estado: string;
  /** Almuerzo o cambio de baterias: no es tiempo de picking. */
  pausaSegundos?: number;
}

/**
 * Huecos entre el fin de un PLU y el inicio del siguiente, para UNA persona.
 *
 * Es el tiempo que no esta contabilizado en ningun reloj pero que el operario si
 * gasta: caminar hasta la siguiente ubicacion, bajar del equipo, buscar. Se
 * descartan los huecos que cruzan de dia y los que pasan de
 * MAX_DESPLAZAMIENTO_SEG.
 */
export function desplazamientos(lineas: readonly LineaMedida[]): number[] {
  const cerradas = lineas
    .filter((l) => l.horaFin != null)
    .sort((a, b) => a.horaInicio.getTime() - b.horaInicio.getTime());

  const huecos: number[] = [];
  for (let i = 1; i < cerradas.length; i++) {
    const anterior = cerradas[i - 1]!;
    const actual = cerradas[i]!;
    const seg = (actual.horaInicio.getTime() - anterior.horaFin!.getTime()) / 1000;
    // Negativo = solapado (no deberia pasar con un PLU en curso por persona,
    // pero una correccion de horas lo puede provocar).
    if (seg <= 0 || seg > MAX_DESPLAZAMIENTO_SEG) continue;
    if (diaBogota(anterior.horaFin!) !== diaBogota(actual.horaInicio)) continue;
    huecos.push(Math.round(seg));
  }
  return huecos;
}

// ── Agregacion ──────────────────────────────────────────────────────────────

export interface Persona {
  id: string;
  nombre: string;
}

export interface OrdenMedida {
  id: string;
  codigo: string;
  horaInicio: Date;
  horaPasoInspeccion: Date | null;
  horaFinInspeccion: Date | null;
  /** Almuerzo o cambio de baterias del operario durante el picking. */
  pausaSegundos?: number;
}

export interface FilaOperario {
  id: string;
  nombre: string;
  plus: number;
  minutosPicking: number;
  promedioPluMin: number | null;
  desplazamientoPromedioSeg: number | null;
  desplazamientoTotalMin: number;
  m3: number;
  kg: number;
}

export interface FilaInspector {
  id: string;
  nombre: string;
  plus: number;
  minutosInspeccion: number;
  promedioPluMin: number | null;
  enviadosEbanisteria: number;
}

export interface FilaGrupo {
  clave: string;
  etiqueta: string;
  plus: number;
  promedioPickingMin: number | null;
  promedioInspeccionMin: number | null;
  m3: number;
}

export interface Ebanisteria {
  enviados: number;
  enTallerAhora: number;
  promedioEsperaMin: number | null;
  maximoEsperaMin: number | null;
  motivos: Array<{ motivo: string; veces: number }>;
}

export interface FilaOrden {
  id: string;
  codigo: string;
  pickingMin: number | null;
  inspeccionMin: number | null;
  totalMin: number | null;
}

export interface IndicadoresMuebles {
  resumen: {
    plusPickeados: number;
    minutosPicking: number;
    minutosInspeccion: number;
    m3: number;
    kg: number;
    desplazamientoPromedioSeg: number | null;
    /** Peso del desplazamiento sobre el tiempo de picking, en %. */
    desplazamientoPorcentaje: number | null;
  };
  operarios: FilaOperario[];
  inspectores: FilaInspector[];
  porTipo: FilaGrupo[];
  porVolumen: FilaGrupo[];
  porPeso: FilaGrupo[];
  ebanisteria: Ebanisteria;
  ordenes: FilaOrden[];
}

function minutos(inicio: Date | null, fin: Date | null, pausaSegundos = 0): number | null {
  if (!inicio || !fin) return null;
  return Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / 60000 - pausaSegundos / 60));
}

/** Reloj de picking de un PLU, sin el tiempo que estuvo en pausa. */
function minutosPickingLinea(l: LineaMedida): number | null {
  return minutos(l.horaInicio, l.horaFin, l.pausaSegundos ?? 0);
}

function redondear(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function agruparEn(
  lineas: readonly LineaMedida[],
  clave: (l: LineaMedida) => string | null,
  etiqueta: (clave: string) => string,
  ordenClaves: readonly string[],
): FilaGrupo[] {
  const mapa = new Map<string, LineaMedida[]>();
  for (const l of lineas) {
    const k = clave(l);
    if (k == null) continue;
    const lista = mapa.get(k) ?? [];
    lista.push(l);
    mapa.set(k, lista);
  }

  const claves = ordenClaves.length > 0
    ? ordenClaves.filter((k) => mapa.has(k))
    : [...mapa.keys()].sort();

  return claves.map((k) => {
    const grupo = mapa.get(k)!;
    const picking = grupo.map(minutosPickingLinea).filter((v): v is number => v != null);
    const insp = grupo
      .map((l) => duracionInspeccionNetaMinutos(l))
      .filter((v): v is number => v != null);
    return {
      clave: k,
      etiqueta: etiqueta(k),
      plus: grupo.length,
      promedioPickingMin: promedio(picking),
      promedioInspeccionMin: promedio(insp),
      m3: redondear(grupo.reduce((a, l) => a + (l.volumenTotalM3 ?? 0), 0), 3),
    };
  });
}

/**
 * Todo el informe en una pasada. Puro: recibe filas ya leidas de la DB y no
 * consulta nada, que es lo que lo hace testeable sin base de datos.
 *
 * `tipoPorPlu` llega resuelto desde fuera (tabla tipos_mueble_plu) en vez de
 * venir sellado en la linea: asi, corregir el tipo de un PLU arregla tambien el
 * historico, que es justo para lo que sirve poder corregirlo.
 */
export function agregarIndicadoresMuebles(entrada: {
  lineas: readonly LineaMedida[];
  ordenes: readonly OrdenMedida[];
  operarios: readonly Persona[];
  inspectores: readonly Persona[];
  tipoPorPlu: ReadonlyMap<string, TipoMercanciaMueble>;
}): IndicadoresMuebles {
  const { lineas, ordenes, operarios, inspectores, tipoPorPlu } = entrada;

  // ── Por operario ──
  const filasOperario: FilaOperario[] = operarios.map((p) => {
    const suyas = lineas.filter((l) => l.operarioId === p.id);
    const duraciones = suyas
      .map(minutosPickingLinea)
      .filter((v): v is number => v != null);
    const huecos = desplazamientos(suyas);
    return {
      id: p.id,
      nombre: p.nombre,
      plus: suyas.length,
      minutosPicking: duraciones.reduce((a, b) => a + b, 0),
      promedioPluMin: promedio(duraciones),
      desplazamientoPromedioSeg: promedio(huecos),
      desplazamientoTotalMin: Math.round(huecos.reduce((a, b) => a + b, 0) / 60),
      m3: redondear(suyas.reduce((a, l) => a + (l.volumenTotalM3 ?? 0), 0), 3),
      kg: redondear(suyas.reduce((a, l) => a + (l.pesoTotalKg ?? 0), 0), 1),
    };
  }).filter((f) => f.plus > 0);

  // ── Por inspector ──
  const filasInspector: FilaInspector[] = inspectores.map((p) => {
    const suyas = lineas.filter((l) => l.inspectorId === p.id);
    const duraciones = suyas
      .map((l) => duracionInspeccionNetaMinutos(l))
      .filter((v): v is number => v != null);
    return {
      id: p.id,
      nombre: p.nombre,
      plus: suyas.length,
      minutosInspeccion: duraciones.reduce((a, b) => a + b, 0),
      promedioPluMin: promedio(duraciones),
      enviadosEbanisteria: suyas.filter((l) => l.ebanisteriaInicio != null).length,
    };
  }).filter((f) => f.plus > 0);

  // ── Clasificaciones ──
  const porTipo = agruparEn(
    lineas,
    (l) => tipoPorPlu.get(l.plu) ?? "OTRO",
    (k) => k,
    TIPOS_MERCANCIA_MUEBLE,
  );

  const clavesVolumen = [...Array(TRAMOS_VOLUMEN_M3.length + 1).keys()].map(String);
  const porVolumen = agruparEn(
    lineas,
    (l) => { const t = tramoDe(l.volumenTotalM3, TRAMOS_VOLUMEN_M3); return t == null ? null : String(t); },
    (k) => etiquetaTramo(TRAMOS_VOLUMEN_M3, Number(k), "m³"),
    clavesVolumen,
  );

  const clavesPeso = [...Array(TRAMOS_PESO_KG.length + 1).keys()].map(String);
  const porPeso = agruparEn(
    lineas,
    (l) => { const t = tramoDe(l.pesoTotalKg, TRAMOS_PESO_KG); return t == null ? null : String(t); },
    (k) => etiquetaTramo(TRAMOS_PESO_KG, Number(k), "kg"),
    clavesPeso,
  );

  // ── Ebanisteria ──
  const aTaller = lineas.filter((l) => l.ebanisteriaInicio != null);
  const esperas = aTaller
    .map((l) => minutos(l.ebanisteriaInicio, l.ebanisteriaFin))
    .filter((v): v is number => v != null);
  const motivos = new Map<string, number>();
  for (const l of aTaller) {
    const m = (l.motivoEbanisteria ?? "").trim();
    if (!m) continue;
    motivos.set(m, (motivos.get(m) ?? 0) + 1);
  }

  const ebanisteria: Ebanisteria = {
    enviados: aTaller.length,
    enTallerAhora: aTaller.filter((l) => l.ebanisteriaFin == null).length,
    promedioEsperaMin: promedio(esperas),
    maximoEsperaMin: esperas.length > 0 ? Math.max(...esperas) : null,
    motivos: [...motivos.entries()]
      .map(([motivo, veces]) => ({ motivo, veces }))
      .sort((a, b) => b.veces - a.veces)
      .slice(0, 10),
  };

  // ── Ordenes completas ──
  const filasOrden: FilaOrden[] = ordenes.map((o) => {
    const pickingMin = minutos(o.horaInicio, o.horaPasoInspeccion, o.pausaSegundos ?? 0);
    const inspeccionMin = minutos(o.horaPasoInspeccion, o.horaFinInspeccion);
    return {
      id: o.id,
      codigo: o.codigo,
      pickingMin,
      inspeccionMin,
      totalMin: minutos(o.horaInicio, o.horaFinInspeccion, o.pausaSegundos ?? 0),
    };
  });

  // ── Resumen ──
  const minutosPicking = filasOperario.reduce((a, f) => a + f.minutosPicking, 0);
  const todosLosHuecos = operarios.flatMap((p) => desplazamientos(lineas.filter((l) => l.operarioId === p.id)));
  const desplazamientoTotalMin = Math.round(todosLosHuecos.reduce((a, b) => a + b, 0) / 60);

  return {
    resumen: {
      plusPickeados: lineas.length,
      minutosPicking,
      minutosInspeccion: filasInspector.reduce((a, f) => a + f.minutosInspeccion, 0),
      m3: redondear(lineas.reduce((a, l) => a + (l.volumenTotalM3 ?? 0), 0), 3),
      kg: redondear(lineas.reduce((a, l) => a + (l.pesoTotalKg ?? 0), 0), 1),
      desplazamientoPromedioSeg: promedio(todosLosHuecos),
      // Contra picking + desplazamiento, que es el tiempo que el operario estuvo
      // realmente en la jugada. Contra solo picking daria mas del 100%.
      desplazamientoPorcentaje: minutosPicking + desplazamientoTotalMin > 0
        ? Math.round((desplazamientoTotalMin / (minutosPicking + desplazamientoTotalMin)) * 100)
        : null,
    },
    operarios: filasOperario.sort((a, b) => b.minutosPicking - a.minutosPicking),
    inspectores: filasInspector.sort((a, b) => b.minutosInspeccion - a.minutosInspeccion),
    porTipo,
    porVolumen,
    porPeso,
    ebanisteria,
    ordenes: filasOrden,
  };
}
