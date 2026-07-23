// ════════════════════════════════════════════════
// LÓGICA DE ALMACENAJE — portada 1:1 desde la app Next.js
// Gracia días 0-30 → $0. A partir del día 31, $5.000 por cada día
// transcurrido (acumulación diaria, sin bloques de 30 días).
// ════════════════════════════════════════════════
import dayjs from 'dayjs';

export const TARIFA_ALM = 5_000;

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

  const diasCobrados = Math.max(0, diasTranscurridos - 30);
  const costoAcumulado = diasCobrados * TARIFA_ALM;

  const diasHastaProximoCobro = diasTranscurridos <= 30 ? 31 - diasTranscurridos : 1;
  const fechaProximoCobro = fin.add(diasHastaProximoCobro, 'day');

  const fase: 'gracia' | 'cobro' = diasTranscurridos <= 30 ? 'gracia' : 'cobro';
  const diasEnPeriodo = diasCobrados > 0 ? 1 : diasTranscurridos;

  return {
    diasTranscurridos,
    diasGraciaRestantes,
    cobrosGenerados: diasCobrados,
    costoAcumulado,
    fechaPrimerCobro: fechaPrimerCobro.format('YYYY-MM-DD'),
    fechaProximoCobro: fechaProximoCobro.format('YYYY-MM-DD'),
    diasHastaProximoCobro,
    fase,
    costo: costoAcumulado,
    meses: diasCobrados,
    finGracia: fechaFinGracia.format('YYYY-MM-DD'),
    diasRestantes: diasGraciaRestantes,
    costoProximo: costoAcumulado + TARIFA_ALM,
    diasHastaProxima: diasHastaProximoCobro,
    diasEnPeriodo,
    proximaCarga: fechaProximoCobro.format('YYYY-MM-DD'),
  };
}
