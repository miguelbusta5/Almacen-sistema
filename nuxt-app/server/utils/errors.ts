// Portado desde src/lib/errors.ts — lee el `code` de un error de Prisma (p. ej. 'P2025') sin usar `any`.
export function getErrorCode(e: unknown): string | undefined {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code?: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}
