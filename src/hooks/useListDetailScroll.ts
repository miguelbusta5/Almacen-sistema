"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Conserva la posición de scroll del listado al alternar con una vista de
 * detalle a ancho completo (patrón `{detalleAbierto ? <detalle/> : <lista/>}`).
 *
 * Sin esto, al abrir el detalle (la lista se desmonta) y volver, la lista
 * remonta en scroll 0 y el usuario pierde su posición. Este hook:
 *  - mientras la lista está visible, recuerda continuamente `window.scrollY`;
 *  - al abrir el detalle, lleva la página al tope (detalle desde arriba);
 *  - al volver a la lista, restaura el scroll recordado.
 *
 * Robustez: el listener de scroll solo está activo cuando la lista se muestra,
 * así que el `scrollTo` de apertura/cierre (evento de scroll asíncrono) no
 * sobrescribe el valor recordado. Usar como: `useListDetailScroll(selected !== null)`.
 */
export function useListDetailScroll(detailOpen: boolean) {
  const savedY = useRef(0);
  const wasOpen = useRef(detailOpen);

  // Recordar el scroll del listado solo mientras está visible.
  useEffect(() => {
    if (detailOpen) return;
    const onScroll = () => { savedY.current = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [detailOpen]);

  // Al abrir → tope; al cerrar → restaurar. Layout effect para evitar parpadeo.
  useLayoutEffect(() => {
    if (detailOpen && !wasOpen.current) {
      window.scrollTo(0, 0);
    } else if (!detailOpen && wasOpen.current) {
      window.scrollTo(0, savedY.current);
    }
    wasOpen.current = detailOpen;
  }, [detailOpen]);
}
