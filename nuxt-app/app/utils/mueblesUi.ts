// Permisos de muebles en el cliente. Solo deciden que se PINTA: el servidor
// vuelve a comprobarlo todo, como en el resto del proyecto.
const GESTION = ['SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN']

export function esGestionMuebles(role: string | null | undefined): boolean {
  return GESTION.includes(role ?? '')
}
