// Indicadores de Cargue de camiones (25-09-2026) — calculo puro.
//
// Sobre los camiones FINALIZADOS del periodo (por su dia de cargue):
// camiones, ordenes, bultos, tiempos (del camion y de cada orden), bultos por
// hora de cargue, novedades (bultos que no cuadran), y de lo de muebles m3, kg
// y valor OVDM. Repartido por dia, transportadora, ciudad, tipo de vehiculo,
// persona que carga, origen de la orden y hora del dia.

export interface OrdenInd {
  codigo: string
  origen: string
  tienda: string | null
  cliente: string | null
  ciudad: string | null
  bultosDeclarados: number | null
  bultosCargados: number | null
  notaDiferencia: string | null
  m3: number | null
  kg: number | null
  valorOvdm: number | null
  horaInicio: Date
  horaFin: Date | null
}

export interface CamionInd {
  id: string
  fecha: string
  tipoVehiculo: string
  transportadora: string
  placa: string | null
  horaInicio: Date
  horaFinalizacion: Date | null
  operarios: string[]
  ordenes: OrdenInd[]
}

const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100
const min = (a: Date | null, b: Date | null) => (a && b ? Math.max(0, (b.getTime() - a.getTime()) / 60_000) : null)
const prom = (v: number[]) => (v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null)
const HORA_BOGOTA_MS = 5 * 3600_000

export interface ResumenCargue {
  camiones: number
  ordenes: number
  bultos: number
  bultosDeclarados: number
  dias: number
  camionesDia: number | null
  bultosDia: number | null
  minCamion: number | null
  minOrden: number | null
  bultosHora: number | null
  ordenesPorCamion: number | null
  bultosPorCamion: number | null
  novedades: number
  pctNovedad: number | null
  m3: number
  kg: number
  valorOvdm: number
}

export interface Grupo {
  clave: string
  camiones: number
  ordenes: number
  bultos: number
  minCamion: number | null
  minOrden: number | null
}

function agrupar(
  camiones: readonly CamionInd[],
  clave: (c: CamionInd, o: OrdenInd | null) => string | string[],
  porOrden: boolean,
): Grupo[] {
  const g = new Map<string, { camiones: Set<string>; ordenes: number; bultos: number; minC: number[]; minO: number[] }>()
  const de = (k: string) => {
    let x = g.get(k)
    if (!x) { x = { camiones: new Set(), ordenes: 0, bultos: 0, minC: [], minO: [] }; g.set(k, x) }
    return x
  }
  for (const c of camiones) {
    const mc = min(c.horaInicio, c.horaFinalizacion)
    if (porOrden) {
      for (const o of c.ordenes) {
        for (const k of [clave(c, o)].flat()) {
          const x = de(k)
          if (!x.camiones.has(c.id)) { x.camiones.add(c.id); if (mc != null) x.minC.push(mc) }
          x.ordenes++
          x.bultos += o.bultosCargados ?? 0
          const mo = min(o.horaInicio, o.horaFin)
          if (mo != null) x.minO.push(mo)
        }
      }
    } else {
      for (const k of [clave(c, null)].flat()) {
        const x = de(k)
        x.camiones.add(c.id)
        if (mc != null) x.minC.push(mc)
        for (const o of c.ordenes) {
          x.ordenes++
          x.bultos += o.bultosCargados ?? 0
          const mo = min(o.horaInicio, o.horaFin)
          if (mo != null) x.minO.push(mo)
        }
      }
    }
  }
  return [...g.entries()]
    .map(([k, x]) => ({ clave: k, camiones: x.camiones.size, ordenes: x.ordenes, bultos: x.bultos, minCamion: prom(x.minC), minOrden: prom(x.minO) }))
    .sort((a, b) => b.bultos - a.bultos || b.ordenes - a.ordenes || a.clave.localeCompare(b.clave))
}

export function resumirCargue(camiones: readonly CamionInd[]): ResumenCargue {
  const ordenes = camiones.flatMap((c) => c.ordenes)
  const bultos = ordenes.reduce((s, o) => s + (o.bultosCargados ?? 0), 0)
  const minOrdenes = ordenes.map((o) => min(o.horaInicio, o.horaFin)).filter((v): v is number => v != null)
  const horasOrdenes = minOrdenes.reduce((s, v) => s + v, 0) / 60
  const novedades = ordenes.filter((o) => o.bultosDeclarados != null && o.bultosCargados != null && o.bultosDeclarados !== o.bultosCargados).length
  const dias = new Set(camiones.map((c) => c.fecha)).size
  return {
    camiones: camiones.length,
    ordenes: ordenes.length,
    bultos,
    bultosDeclarados: ordenes.reduce((s, o) => s + (o.bultosDeclarados ?? 0), 0),
    dias,
    camionesDia: dias ? r1(camiones.length / dias) : null,
    bultosDia: dias ? r1(bultos / dias) : null,
    minCamion: prom(camiones.map((c) => min(c.horaInicio, c.horaFinalizacion)).filter((v): v is number => v != null)),
    minOrden: prom(minOrdenes),
    bultosHora: horasOrdenes > 0 ? r1(bultos / horasOrdenes) : null,
    ordenesPorCamion: camiones.length ? r1(ordenes.length / camiones.length) : null,
    bultosPorCamion: camiones.length ? r1(bultos / camiones.length) : null,
    novedades,
    pctNovedad: ordenes.length ? r1((novedades / ordenes.length) * 100) : null,
    m3: r2(ordenes.reduce((s, o) => s + (o.m3 ?? 0), 0)),
    kg: r1(ordenes.reduce((s, o) => s + (o.kg ?? 0), 0)),
    valorOvdm: Math.round(ordenes.reduce((s, o) => s + (o.valorOvdm ?? 0), 0)),
  }
}

export interface IndicadoresCargue {
  resumen: ResumenCargue
  porDia: Array<{ dia: string; camiones: number; ordenes: number; bultos: number; valorOvdm: number; m3: number; kg: number }>
  porTransportadora: Grupo[]
  porCiudad: Grupo[]
  porVehiculo: Grupo[]
  porOperario: Grupo[]
  porOrigen: Grupo[]
  porHora: Array<{ hora: number; camiones: number }>
  novedades: Array<{ fecha: string; codigo: string; transportadora: string; ciudad: string | null; declarados: number | null; cargados: number | null; nota: string | null }>
  camiones: Array<{
    fecha: string; transportadora: string; tipoVehiculo: string; placa: string | null; inicio: string; fin: string | null
    minutos: number | null; ordenes: number; bultos: number; personas: number; novedades: number
  }>
}

const ORIGEN_LABEL: Record<string, string> = { GOURMET: 'Gourmet', MUEBLES: 'Muebles', AMBOS: 'Gourmet + Muebles', MANUAL: 'Sin registro' }

export function indicadoresCargue(camiones: readonly CamionInd[]): IndicadoresCargue {
  const dias = new Map<string, { camiones: number; ordenes: number; bultos: number; valorOvdm: number; m3: number; kg: number }>()
  for (const c of camiones) {
    const d = dias.get(c.fecha) ?? { camiones: 0, ordenes: 0, bultos: 0, valorOvdm: 0, m3: 0, kg: 0 }
    d.camiones++
    for (const o of c.ordenes) {
      d.ordenes++
      d.bultos += o.bultosCargados ?? 0
      d.valorOvdm += o.valorOvdm ?? 0
      d.m3 += o.m3 ?? 0
      d.kg += o.kg ?? 0
    }
    dias.set(c.fecha, d)
  }
  const horas = new Map<number, number>()
  for (const c of camiones) {
    const h = new Date(c.horaInicio.getTime() - HORA_BOGOTA_MS).getUTCHours()
    horas.set(h, (horas.get(h) ?? 0) + 1)
  }
  return {
    resumen: resumirCargue(camiones),
    porDia: [...dias.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, d]) => ({ dia, ...d, valorOvdm: Math.round(d.valorOvdm), m3: r2(d.m3), kg: r1(d.kg) })),
    porTransportadora: agrupar(camiones, (c) => c.transportadora, false),
    porCiudad: agrupar(camiones, (_c, o) => o?.ciudad?.trim().toUpperCase() || 'SIN CIUDAD', true),
    porVehiculo: agrupar(camiones, (c) => c.tipoVehiculo, false),
    // Cada persona suma completo cada camion en que cargo (como en almacenamiento:
    // el registro cuenta a todos los que lo tuvieron).
    porOperario: agrupar(camiones, (c) => (c.operarios.length ? c.operarios : ['SIN PERSONAS']), false),
    porOrigen: agrupar(camiones, (_c, o) => ORIGEN_LABEL[o?.origen ?? ''] ?? o?.origen ?? '—', true),
    porHora: [...horas.entries()].sort(([a], [b]) => a - b).map(([hora, n]) => ({ hora, camiones: n })),
    novedades: camiones.flatMap((c) => c.ordenes
      .filter((o) => o.bultosDeclarados != null && o.bultosCargados != null && o.bultosDeclarados !== o.bultosCargados)
      .map((o) => ({ fecha: c.fecha, codigo: o.codigo, transportadora: c.transportadora, ciudad: o.ciudad, declarados: o.bultosDeclarados, cargados: o.bultosCargados, nota: o.notaDiferencia }))),
    camiones: [...camiones].sort((a, b) => b.horaInicio.getTime() - a.horaInicio.getTime()).map((c) => ({
      fecha: c.fecha, transportadora: c.transportadora, tipoVehiculo: c.tipoVehiculo, placa: c.placa,
      inicio: c.horaInicio.toISOString(), fin: c.horaFinalizacion?.toISOString() ?? null,
      minutos: min(c.horaInicio, c.horaFinalizacion) == null ? null : r1(min(c.horaInicio, c.horaFinalizacion)!),
      ordenes: c.ordenes.length, bultos: c.ordenes.reduce((s, o) => s + (o.bultosCargados ?? 0), 0), personas: c.operarios.length,
      novedades: c.ordenes.filter((o) => o.bultosDeclarados != null && o.bultosCargados != null && o.bultosDeclarados !== o.bultosCargados).length,
    })),
  }
}
