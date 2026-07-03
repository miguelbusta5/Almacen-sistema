// ════════════════════════════════════════════════
// LÓGICA DE ALMACENAJE — portada 1:1 desde la app Next.js
// Gracia días 0-30 → $0. Cada bloque de 30 días después → 1 cobro de $150.000.
// ════════════════════════════════════════════════

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

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function calcAlmacenaje(fechaInicio: string, endDate?: string | null): Almacenaje {
  const inicio = new Date(fechaInicio + 'T00:00:00');
  const fin = new Date((endDate ?? new Date().toISOString().slice(0, 10)) + 'T00:00:00');
  inicio.setHours(0, 0, 0, 0);
  fin.setHours(0, 0, 0, 0);

  const diasTranscurridos = Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / 86_400_000));
  const diasGraciaRestantes = Math.max(0, 30 - diasTranscurridos);
  const fechaFinGracia = addDays(inicio, 30);
  const fechaPrimerCobro = addDays(inicio, 31);

  const cobrosGenerados = diasTranscurridos <= 30 ? 0 : Math.floor((diasTranscurridos - 31) / 30) + 1;
  const costoAcumulado = cobrosGenerados * TARIFA_ALM;

  const diaProximoCobro = 31 + cobrosGenerados * 30;
  const diasHastaProximoCobro = diaProximoCobro - diasTranscurridos;
  const fechaProximoCobro = addDays(fin, diasHastaProximoCobro);

  const diasEnPeriodo = diasTranscurridos <= 30 ? diasTranscurridos : ((diasTranscurridos - 31) % 30) + 1;
  const fase: 'gracia' | 'cobro' = diasTranscurridos <= 30 ? 'gracia' : 'cobro';

  return {
    diasTranscurridos,
    diasGraciaRestantes,
    cobrosGenerados,
    costoAcumulado,
    fechaPrimerCobro: toISO(fechaPrimerCobro),
    fechaProximoCobro: toISO(fechaProximoCobro),
    diasHastaProximoCobro,
    fase,
    costo: costoAcumulado,
    meses: cobrosGenerados,
    finGracia: toISO(fechaFinGracia),
    diasRestantes: diasGraciaRestantes,
    costoProximo: (cobrosGenerados + 1) * TARIFA_ALM,
    diasHastaProxima: diasHastaProximoCobro,
    diasEnPeriodo,
    proximaCarga: toISO(fechaProximoCobro),
  };
}
