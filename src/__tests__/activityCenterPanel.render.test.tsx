import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityCenterPanel, performMarkAllRead } from "@/components/common/ActivityCenterPanel";
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

function renderPanel(overrides: Partial<{
  open: boolean;
  notifications: NotificacionItem[];
  totalNoLeidas: number;
  loading: boolean;
  isMobile: boolean;
  markingAllRead: boolean;
}> = {}, onMarkAllRead: () => void = () => {}) {
  return renderToStaticMarkup(
    <ActivityCenterPanel
      open={overrides.open ?? true}
      notifications={overrides.notifications ?? [mockNotif]}
      totalNoLeidas={overrides.totalNoLeidas ?? 1}
      loading={overrides.loading ?? false}
      isMobile={overrides.isMobile ?? false}
      onNavigate={() => {}}
      onMarkAllRead={onMarkAllRead}
      markingAllRead={overrides.markingAllRead ?? false}
    />,
  );
}

describe("ActivityCenterPanel — render base (Fase C1)", () => {
  it("renderiza el título 'Centro de actividad'", () => {
    expect(renderPanel()).toContain("Centro de actividad");
  });

  it("renderiza una notificación mock (título y descripción)", () => {
    const html = renderPanel();
    expect(html).toContain("Solicitud de transporte rechazada");
    expect(html).toContain("PED-12345 fue rechazada por el gestor");
  });

  it("muestra empty state cuando no hay notificaciones", () => {
    const html = renderPanel({ notifications: [], totalNoLeidas: 0 });
    expect(html).toContain("Sin notificaciones");
  });

  it("muestra el contador de no leídas", () => {
    expect(renderPanel({ totalNoLeidas: 3 })).toContain("3 sin leer");
  });

  it("si la notificación tiene enlace, el item es un <a> navegable", () => {
    expect(renderPanel()).toContain(`href="${mockNotif.enlace}"`);
  });

  it("si la notificación NO tiene enlace, no rompe y no genera un <a>", () => {
    const sinEnlace: NotificacionItem = { ...mockNotif, id: "notif-2", enlace: null };
    const html = renderPanel({ notifications: [sinEnlace] });
    expect(html).toContain(sinEnlace.titulo);
    expect(html).not.toContain("<a ");
  });

  it("no devuelve markup cuando open=false", () => {
    expect(renderPanel({ open: false })).toBe("");
  });

  it("no usa tr::before ni tr::after (el panel no contiene tablas)", () => {
    const html = renderPanel();
    expect(html).not.toMatch(/tr::before/i);
    expect(html).not.toMatch(/tr::after/i);
  });

  it("nunca toca /dashboard/mis-tareas", () => {
    expect(renderPanel()).not.toContain("/dashboard/mis-tareas");
  });
});

describe("ActivityCenterPanel — botón 'Marcar todas como leídas' (Fase C2)", () => {
  it("el botón aparece si hay notificaciones no leídas", () => {
    expect(renderPanel({ totalNoLeidas: 2 })).toContain("Marcar todas como leídas");
  });

  it("el botón NO aparece si no hay notificaciones no leídas", () => {
    const html = renderPanel({ totalNoLeidas: 0, notifications: [] });
    expect(html).not.toContain("Marcar todas como leídas");
  });

  it("mientras está cargando, el botón queda deshabilitado y cambia su texto", () => {
    const html = renderPanel({ markingAllRead: true });
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Marcando…");
    expect(html).not.toContain("Marcar todas como leídas");
  });

  it("no existe ningún control de marcado individual por notificación", () => {
    const html = renderPanel({ notifications: [mockNotif, { ...mockNotif, id: "notif-2" }], totalNoLeidas: 2 });
    // Solo debe existir el botón global — no un botón "marcar leída" por cada item.
    const matches = html.match(/Marcar/gi) ?? [];
    expect(matches.length).toBe(1);
  });

  it("el panel sigue renderizando EmptyState cuando queda vacío tras marcar todas", () => {
    const html = renderPanel({ notifications: [], totalNoLeidas: 0 });
    expect(html).toContain("Sin notificaciones");
    expect(html).not.toContain("Marcar todas como leídas");
  });
});

describe("performMarkAllRead — llamada al endpoint existente (sin DOM)", () => {
  it("llama a PUT /api/notificaciones/leer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await performMarkAllRead(fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledWith("/api/notificaciones/leer", { method: "PUT" });
  });

  it("devuelve true si el PUT responde success:true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const result = await performMarkAllRead(fetchMock as unknown as typeof fetch);
    expect(result).toBe(true);
  });

  it("devuelve false si el PUT responde ok:false", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "No autorizado" }) });
    const result = await performMarkAllRead(fetchMock as unknown as typeof fetch);
    expect(result).toBe(false);
  });

  it("devuelve false si el fetch lanza (error de red)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
    const result = await performMarkAllRead(fetchMock as unknown as typeof fetch);
    expect(result).toBe(false);
  });

  it("no llama a ningún otro endpoint (no hay marcado individual ni otras rutas)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    await performMarkAllRead(fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/notificaciones/leer");
  });
});

describe("ActivityCenterPanel — no llama a endpoints por sí mismo", () => {
  it("renderizar el panel no dispara fetch (la mutación vive en Header, no en el panel)", () => {
    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      renderPanel();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
