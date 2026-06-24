import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityCenterPanel } from "@/components/common/ActivityCenterPanel";
import type { NotificacionItem } from "@/components/common/ActivityCenterPanel";

const mockNotif: NotificacionItem = {
  id: "notif-1",
  titulo: "Solicitud de transporte rechazada",
  descripcion: "PED-12345 fue rechazada por el gestor",
  tipo: "SOLICITUD_TRANSPORTE",
  leida: false,
  enlace: "/dashboard/solicitudes-transporte?id=sol-1",
  createdAt: new Date().toISOString(),
};

describe("ActivityCenterPanel (Fase C1 — solo lectura)", () => {
  it("renderiza el título 'Centro de actividad'", () => {
    const html = renderToStaticMarkup(
      <ActivityCenterPanel open notifications={[mockNotif]} totalNoLeidas={1} loading={false} isMobile={false} onNavigate={() => {}} />,
    );
    expect(html).toContain("Centro de actividad");
  });

  it("renderiza una notificación mock (título y descripción)", () => {
    const html = renderToStaticMarkup(
      <ActivityCenterPanel open notifications={[mockNotif]} totalNoLeidas={1} loading={false} isMobile={false} onNavigate={() => {}} />,
    );
    expect(html).toContain("Solicitud de transporte rechazada");
    expect(html).toContain("PED-12345 fue rechazada por el gestor");
  });

  it("muestra empty state cuando no hay notificaciones", () => {
    const html = renderToStaticMarkup(
      <ActivityCenterPanel open notifications={[]} totalNoLeidas={0} loading={false} isMobile={false} onNavigate={() => {}} />,
    );
    expect(html).toContain("Sin notificaciones");
  });

  it("muestra el contador de no leídas", () => {
    const html = renderToStaticMarkup(
      <ActivityCenterPanel open notifications={[mockNotif]} totalNoLeidas={3} loading={false} isMobile={false} onNavigate={() => {}} />,
    );
    expect(html).toContain("3 sin leer");
  });

  it("si la notificación tiene enlace, el item es un <a> navegable", () => {
    const html = renderToStaticMarkup(
      <ActivityCenterPanel open notifications={[mockNotif]} totalNoLeidas={1} loading={false} isMobile={false} onNavigate={() => {}} />,
    );
    expect(html).toContain(`href="${mockNotif.enlace}"`);
  });

  it("si la notificación NO tiene enlace, no rompe y no genera un <a>", () => {
    const sinEnlace: NotificacionItem = { ...mockNotif, id: "notif-2", enlace: null };
    const html = renderToStaticMarkup(
      <ActivityCenterPanel open notifications={[sinEnlace]} totalNoLeidas={1} loading={false} isMobile={false} onNavigate={() => {}} />,
    );
    expect(html).toContain(sinEnlace.titulo);
    expect(html).not.toContain("<a ");
  });

  it("NO renderiza ningún botón de 'marcar como leídas' (Fase C1 es solo lectura)", () => {
    const html = renderToStaticMarkup(
      <ActivityCenterPanel open notifications={[mockNotif]} totalNoLeidas={1} loading={false} isMobile={false} onNavigate={() => {}} />,
    );
    expect(html.toLowerCase()).not.toContain("marcar");
  });

  it("no devuelve markup cuando open=false", () => {
    const html = renderToStaticMarkup(
      <ActivityCenterPanel open={false} notifications={[mockNotif]} totalNoLeidas={1} loading={false} isMobile={false} onNavigate={() => {}} />,
    );
    expect(html).toBe("");
  });

  it("no usa tr::before ni tr::after (el panel no contiene tablas)", () => {
    const html = renderToStaticMarkup(
      <ActivityCenterPanel open notifications={[mockNotif]} totalNoLeidas={1} loading={false} isMobile={false} onNavigate={() => {}} />,
    );
    expect(html).not.toMatch(/tr::before/i);
    expect(html).not.toMatch(/tr::after/i);
  });
});

describe("Fase C1 — no llama a endpoints de escritura", () => {
  it("el componente no invoca fetch/PUT por sí mismo (es puramente presentacional)", () => {
    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      // ActivityCenterPanel no recibe fetch ni lo importa: renderizarlo no debe
      // disparar ninguna llamada de red. Si en el futuro se le agrega fetch
      // propio, este test debe actualizarse para reflejar la nueva Fase C2.
      renderToStaticMarkup(
        <ActivityCenterPanel open notifications={[mockNotif]} totalNoLeidas={1} loading={false} isMobile={false} onNavigate={() => {}} />,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
