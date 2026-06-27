// Helpers para leer datos de un error capturado como `unknown` (sin `any`),
// p. ej. el `code` de errores de Prisma (`P2002`, `P2025`) o el `message`.

export function getErrorCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export function getErrorMessage(e: unknown, fallback = ""): string {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === "string") return e || fallback;
  return fallback;
}
