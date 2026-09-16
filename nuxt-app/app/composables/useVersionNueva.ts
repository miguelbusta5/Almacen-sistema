/** true cuando se desplego una version nueva que esta pestaña aun no tiene. */
export function useVersionNueva() {
  return useState('version-nueva', () => false)
}
