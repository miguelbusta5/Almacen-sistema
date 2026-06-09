/**
 * Pure validation for user creation — extracted so it can be unit-tested
 * independently of DB and auth middleware.
 */

/** Returns an error message if the TRANSPORTISTA binding is invalid, or null if OK. */
export function validateTransportistaBinding(
  role: string,
  transportistaId: string | null | undefined
): string | null {
  if (role === "TRANSPORTISTA" && !transportistaId) {
    return "Selecciona el transportista a vincular";
  }
  if (role !== "TRANSPORTISTA" && transportistaId) {
    return "Solo el rol Transportista puede vincularse a un conductor";
  }
  return null;
}

/** Returns true if the transportista record is eligible to be assigned a user account. */
export function isTransportistaDisponible(t: {
  activo: boolean;
  userId: string | null;
  vehiculoId: string | null;
}): boolean {
  return t.activo && t.userId === null && t.vehiculoId !== null;
}
