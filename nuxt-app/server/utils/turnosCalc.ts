// Logica pura del cuadro de turnos, para Nitro.
//
// Copia de src/lib/turnos.ts (fuente de verdad): Nitro no puede importar de
// src/lib. Mantener en sync; hay tests que comparan los dos archivos.
//
// Convierte el Excel de turnos en horarios: con ellos los indicadores pueden
// decir cuanto de la jornada fue trabajo registrado, que es la efectividad.

import type { ExcelRow } from './excel'

export const TURNOS_SHEET_NAMES = ["Hoja1", "HORARIO", "TURNOS"] as const

/** 0 = domingo … 6 = sábado, como getDay(). */
export const DIAS_SEMANA = [
  "DOMINGO",
  "LUNES",
  "MARTES",
  "MIERCOLES",
  "JUEVES",
  "VIERNES",
  "SABADO",
] as const

export const DIA_SEMANA_LABEL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]

/** Sin tildes, sin dobles espacios y en mayúsculas: "MIÉRCOLES" y "MIERCOLES". */
export function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

export function indiceDia(texto: unknown): number | null {
  const t = normalizarTexto(texto)
  const i = DIAS_SEMANA.indexOf(t as (typeof DIAS_SEMANA)[number])
  return i >= 0 ? i : null
}

/**
 * "6am" → 360, "3:30pm" → 930, "12pm" → 720, "12am" → 0.
 *
 * Devuelve minutos desde la medianoche, o null si no es una hora.
 */
export function parseHora(texto: unknown): number | null {
  const t = normalizarTexto(texto).replace(/\./g, "").replace(/\s/g, "")
  const m = /^(\d{1,2})(?::(\d{2}))?(AM|PM|M)?$/.exec(t)
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (h > 23 || min > 59) return null
  const sufijo = m[3]
  if (sufijo === "PM" && h < 12) h += 12
  if (sufijo === "AM" && h === 12) h = 0
  return h * 60 + min
}

export interface RangoTurno {
  /** Minutos desde la medianoche. */
  inicioMin: number
  /** Si es menor o igual que el inicio, el turno cruza la medianoche. */
  finMin: number
}

/** ¿El turno termina al día siguiente? (8:30pm-6am). */
export function cruzaMedianoche(t: RangoTurno): boolean {
  return t.finMin <= t.inicioMin
}

export function duracionTurnoMin(t: RangoTurno): number {
  return cruzaMedianoche(t) ? 24 * 60 - t.inicioMin + t.finMin : t.finMin - t.inicioMin
}

const DESCANSOS = ["DESCANSO", "LIBRE", "NO LABORA", "X", "-"]

/**
 * "6am-3:30pm" → { inicioMin: 360, finMin: 930 }. Un descanso o una celda
 * vacía devuelven null: ese día la persona no tiene turno.
 */
export function parseRangoTurno(texto: unknown): RangoTurno | null {
  const t = normalizarTexto(texto)
  if (!t || DESCANSOS.includes(t)) return null
  const partes = t.split(/[-–—]|\bA\b/).map((p) => p.trim()).filter(Boolean)
  if (partes.length !== 2) return null
  const inicioMin = parseHora(partes[0])
  const finMin = parseHora(partes[1])
  if (inicioMin === null || finMin === null) return null
  if (inicioMin === finMin) return null
  return { inicioMin, finMin }
}

export interface FilaTurno {
  /** Tal como viene en el archivo: "OSSA OSPINA ANDRES FELIPE". */
  nombre: string
  dias: { diaSemana: number; inicioMin: number; finMin: number }[]
}

const CABECERA_OPERARIO = ["OPERARIO", "OPERARIOS", "PERSONA", "NOMBRE"]

/**
 * Lee el cuadro entero: cada bloque empieza en una fila "OPERARIO | LUNES | …"
 * y sigue con una fila por persona hasta la siguiente cabecera o el final.
 *
 * Se localiza por la cabecera y no por posición fija: el archivo trae los
 * turnos uno debajo de otro y con filas de título por el medio.
 */
export function mapCuadroTurnos(rows: readonly ExcelRow[]): FilaTurno[] {
  const filas: FilaTurno[] = []
  const porNombre = new Map<string, FilaTurno>()
  let columnas: { col: number; diaSemana: number }[] = []
  let colNombre = -1

  for (const row of rows) {
    const cabecera = row.findIndex((v) => CABECERA_OPERARIO.includes(normalizarTexto(v)))
    if (cabecera >= 0) {
      colNombre = cabecera
      columnas = []
      for (let c = cabecera + 1; c < row.length; c++) {
        const dia = indiceDia(row[c])
        if (dia !== null) columnas.push({ col: c, diaSemana: dia })
      }
      continue
    }
    if (colNombre < 0 || columnas.length === 0) continue

    const nombre = String(row[colNombre] ?? "").replace(/\s+/g, " ").trim()
    if (!nombre) continue
    // Las filas de título ("HORARIO ALMACENAMIENTO", "TURNO # 1") repiten el
    // mismo texto en toda la fila: no son personas.
    const repetida = columnas.every((c) => normalizarTexto(row[c.col]) === normalizarTexto(nombre))
    if (repetida) continue

    const dias = columnas
      .map((c) => ({ diaSemana: c.diaSemana, rango: parseRangoTurno(row[c.col]) }))
      .filter((d): d is { diaSemana: number; rango: RangoTurno } => d.rango !== null)
      .map((d) => ({ diaSemana: d.diaSemana, inicioMin: d.rango.inicioMin, finMin: d.rango.finMin }))
    if (dias.length === 0) continue

    // Una persona puede salir en dos bloques (media semana en cada turno): se
    // juntan, y si repite día manda el último.
    const previa = porNombre.get(normalizarTexto(nombre))
    if (previa) {
      for (const d of dias) {
        const i = previa.dias.findIndex((x) => x.diaSemana === d.diaSemana)
        if (i >= 0) previa.dias[i] = d
        else previa.dias.push(d)
      }
      continue
    }
    const fila: FilaTurno = { nombre, dias }
    porNombre.set(normalizarTexto(nombre), fila)
    filas.push(fila)
  }

  for (const f of filas) f.dias.sort((a, b) => a.diaSemana - b.diaSemana)
  return filas
}

// ── Emparejar con los usuarios del sistema ───────────────────────────
// En el archivo los nombres vienen como los escribe operación ("OSSA OSPINA
// ANDRES FELIPE", "JOEL DOMINGUEZ") y en el sistema como se creó el usuario
// ("Felipe Ossa", "JOEL DOMIGUEZ", con la errata incluida).

/** Distancia de edición, cortada en 2: solo interesa "es casi la misma palabra". */
function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2
  let fila = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const nueva = [i]
    for (let j = 1; j <= b.length; j++) {
      nueva[j] = Math.min(
        fila[j]! + 1,
        nueva[j - 1]! + 1,
        fila[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    fila = nueva
  }
  return fila[b.length]!
}

function palabras(nombre: string): string[] {
  return normalizarTexto(nombre).split(" ").filter((p) => p.length > 2)
}

export interface UsuarioEmparejable {
  id: string
  nombre: string
}

/**
 * A qué usuario corresponde un nombre del archivo.
 *
 * Primero el nombre exacto; si no, el que comparta más palabras (admitiendo una
 * letra de diferencia, que es lo que separa DOMINGUEZ de DOMIGUEZ). Si dos
 * empatan no se elige ninguno: es mejor pedir que lo confirmen que cargarle el
 * turno a la persona equivocada.
 */
export function emparejarUsuario(
  nombreArchivo: string,
  usuarios: readonly UsuarioEmparejable[],
): UsuarioEmparejable | null {
  const objetivo = normalizarTexto(nombreArchivo)
  const exacto = usuarios.filter((u) => normalizarTexto(u.nombre) === objetivo)
  if (exacto.length === 1) return exacto[0]!

  const tokens = palabras(nombreArchivo)
  if (tokens.length === 0) return null
  let mejor: UsuarioEmparejable | null = null
  let mejorPuntaje = 0
  let empatados = 0
  for (const u of usuarios) {
    const suyas = palabras(u.nombre)
    const puntaje = suyas.filter((p) => tokens.some((t) => t === p || distancia(t, p) <= 1)).length
    if (puntaje > mejorPuntaje) {
      mejor = u
      mejorPuntaje = puntaje
      empatados = 1
    } else if (puntaje === mejorPuntaje && puntaje > 0) {
      empatados += 1
    }
  }
  return mejorPuntaje > 0 && empatados === 1 ? mejor : null
}

// ── Ventanas de turno ────────────────────────────────────────────────
const MS_MIN = 60 * 1000
const DESFASE_BOGOTA = "-05:00"

/**
 * El turno de una persona un día concreto, en horas de reloj.
 *
 * `dia` es una fecha de Bogotá (YYYY-MM-DD) y el turno se aplica por su día de
 * la semana. Si cruza la medianoche, termina al día siguiente.
 */
export function ventanaTurno(dia: string, turno: RangoTurno): { inicio: Date; fin: Date } {
  const base = new Date(`${dia}T00:00:00${DESFASE_BOGOTA}`).getTime()
  const inicio = new Date(base + turno.inicioMin * MS_MIN)
  const fin = new Date(base + (cruzaMedianoche(turno) ? 24 * 60 : 0) * MS_MIN + turno.finMin * MS_MIN)
  return { inicio, fin }
}

/** Porcentaje de la jornada con trabajo registrado, redondeado. */
export function efectividad(trabajadoSeg: number, jornadaSeg: number): number | null {
  if (jornadaSeg <= 0) return null
  return Math.round((trabajadoSeg / jornadaSeg) * 100)
}
