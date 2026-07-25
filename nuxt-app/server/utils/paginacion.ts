// Saneado de paginación compartido por los módulos nuevos.
// `Number('abc')` es NaN y `Math.max(1, NaN)` sigue siendo NaN: un `skip: NaN`
// revienta Prisma en tiempo de ejecución, así que el Number.isFinite no es opcional.
//
// (solicitudesTransporteCalc.ts tiene su propia copia por razones históricas —
// se dejó ahí para no tocar un módulo ya desplegado y con tests que la fijan.)
export function sanearPaginacion(
  rawPage: unknown,
  rawPageSize: unknown,
  porDefecto = 25,
  maximo = 100,
  minimo = 10,
) {
  const p = Number(rawPage)
  const s = Number(rawPageSize)
  const page = Number.isFinite(p) ? Math.max(1, Math.floor(p)) : 1
  const pageSize = Number.isFinite(s) ? Math.min(maximo, Math.max(minimo, Math.floor(s))) : porDefecto
  return { page, pageSize }
}
