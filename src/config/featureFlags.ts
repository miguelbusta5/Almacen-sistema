// Flags de funcionalidad (cambios de una línea para activar/desactivar).

/**
 * Expone el toggle de tema (claro/oscuro) en la UI. Mientras esté en `false`,
 * el control no se renderiza para los usuarios: el oscuro sigue siendo el único
 * tema visible. QA puede probar el claro vía `localStorage.theme='light'` /
 * devtools. Se pondrá en `true` tras validar el modo claro (Fase D).
 */
export const THEME_TOGGLE_ENABLED = false;
