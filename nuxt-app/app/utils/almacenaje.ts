// ════════════════════════════════════════════════
// LÓGICA DE ALMACENAJE — portada 1:1 desde la app Next.js
// Gracia días 0-30 → $0. Cada bloque de 30 días después → 1 cobro de $150.000.
// ════════════════════════════════════════════════
import dayjs from 'dayjs';

export const TARIFA_ALM = 150_000;

export interface Almacenaje {
  diasTranscurridos: number;
  diasGraciaRestantes: number;
  cobrosGenerados: number;
  costoAcumulado: number;
  fechaPrimerCobro: string;
  fechaProximoCobro: string;
  diasHastaProximoCobro: number;
  fase: 'gracia' | 'cobro';
  costo: number;
  meses: number;
  finGracia: string;
  diasRestantes: number;
  costoProximo: number;
  diasHastaProxima: number;
  diasEnPeriodo: number;
  proximaCarga: string;
}

export function calcAlmacenaje(fechaInicio: string, endDate?: string | null): Almacenaje {
  const inicio = dayjs(fechaInicio).startOf('day');
  const fin = dayjs(endDate ?? dayjs().format('YYYY-MM-DD')).startOf('day');

  const diasTranscurridos = Math.max(0, fin.diff(inicio, 'day'));
  const diasGraciaRestantes = Math.max(0, 30 - diasTranscurridos);
  const fechaFinGracia = inicio.add(30, 'day');
  const fechaPrimerCobro = inicio.add(31, 'day');

  const cobrosGenerados = diasTranscurridos <= 30 ? 0 : Math.floor((diasTranscurridos - 31) / 30) + 1;
  const costoAcumulado = cobrosGenerados * TARIFA_ALM;

  const diaProximoCobro = 31 + cobrosGenerados * 30;
  const diasHastaProximoCobro = diaProximoCobro - diasTranscurridos;
  const fechaProximoCobro = fin.add(diasHastaProximoCobro, 'day');

  const diasEnPeriodo = diasTranscurridos <= 30 ? diasTranscurridos : ((diasTranscurridos - 31) % 30) + 1;
  const fase: 'gracia' | 'cobro' = diasTranscurridos <= 30 ? 'gracia' : 'cobro';

  return {
    diasTranscurridos,
    diasGraciaRestantes,
    cobrosGenerados,
    costoAcumulado,
    fechaPrimerCobro: fechaPrimerCobro.format('YYYY-MM-DD'),
    fechaProximoCobro: fechaProximoCobro.format('YYYY-MM-DD'),
    diasHastaProximoCobro,
    fase,
    costo: costoAcumulado,
    meses: cobrosGenerados,
    finGracia: fechaFinGracia.format('YYYY-MM-DD'),
    diasRestantes: diasGraciaRestantes,
    costoProximo: (cobrosGenerados + 1) * TARIFA_ALM,
    diasHastaProxima: diasHastaProximoCobro,
    diasEnPeriodo,
    proximaCarga: fechaProximoCobro.format('YYYY-MM-DD'),
  };
}
