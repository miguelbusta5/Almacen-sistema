// Permisos de Stretch film: quién gestiona y qué mantiene viva la pantalla
// compartida del CEDI.
//
// El 22-09 una pantalla creada por el administrador quedaba en 403 nada más
// activarla: el permiso del actor contemplaba al ADMIN y el de la sesión no.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cargarNuxt, h3Falso } from "./apoyo/nuxt";

const m = {
  acceso: { findUnique: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  sesion: { findUnique: vi.fn() },
  noti: { createMany: vi.fn() },
  cookie: vi.fn(),
};
const stretch = cargarNuxt("utils/stretch.ts", {
  h3: h3Falso({ getCookie: m.cookie }),
  "./prisma": { prisma: { user: m.user, stretchAcceso: m.acceso } },
  "./auth": { requireAuth: vi.fn() },
});
const tx = { stretchAcceso: m.acceso, user: m.user, stretchSesion: m.sesion, notificacion: m.noti };
const event = {} as never;
const viva = { id: "s1", creadaPorId: "admin", activada: true, revocadaAt: null, expiraAt: new Date(Date.now() + 3600_000) };

beforeEach(() => {
  vi.resetAllMocks();
  m.cookie.mockReturnValue("a".repeat(64));
  m.sesion.findUnique.mockResolvedValue(viva);
});

describe("quién gestiona stretch", () => {
  it("el administrador activo, sin fila de acceso", () => {
    expect(stretch.permisoDeStretch({ active: true, role: "ADMIN" }, null)).toEqual({ gestionar: true, solicitar: true });
  });

  it("una cuenta desactivada no puede nada, aunque sea admin o tenga permiso", () => {
    expect(stretch.permisoDeStretch({ active: false, role: "ADMIN" }, { gestionar: true, solicitar: true }))
      .toEqual({ gestionar: false, solicitar: false });
    expect(stretch.permisoDeStretch(null, { gestionar: true, solicitar: true }))
      .toEqual({ gestionar: false, solicitar: false });
  });

  it("Viviana solicita pero no gestiona", () => {
    expect(stretch.permisoDeStretch({ active: true, role: "OPERADOR" }, { gestionar: false, solicitar: true }))
      .toEqual({ gestionar: false, solicitar: true });
  });
});

describe("la pantalla compartida del CEDI", () => {
  it("sigue viva si la creó un administrador sin fila de acceso", async () => {
    m.acceso.findUnique.mockResolvedValue(null);
    m.user.findUnique.mockResolvedValue({ active: true, role: "ADMIN" });
    await expect(stretch.sesionStretch(event, tx)).resolves.toMatchObject({ id: "s1" });
  });

  it("se cae si a quien la creó le quitaron el permiso", async () => {
    m.acceso.findUnique.mockResolvedValue({ gestionar: false, solicitar: true });
    m.user.findUnique.mockResolvedValue({ active: true, role: "OPERADOR" });
    await expect(stretch.sesionStretch(event, tx)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("se cae si a quien la creó le desactivaron la cuenta", async () => {
    m.acceso.findUnique.mockResolvedValue({ gestionar: true, solicitar: true });
    m.user.findUnique.mockResolvedValue({ active: false, role: "ADMIN" });
    await expect(stretch.sesionStretch(event, tx)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("una sesión vencida no sirve", async () => {
    m.sesion.findUnique.mockResolvedValue({ ...viva, expiraAt: new Date(0) });
    await expect(stretch.sesionStretch(event, tx)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe("a quién le avisa una solicitud", () => {
  it("a los gestores y a los administradores, sin repetir", async () => {
    m.acceso.findMany.mockResolvedValue([{ userId: "felipe" }]);
    m.user.findMany.mockResolvedValue([{ id: "felipe" }, { id: "admin" }]);
    await stretch.avisarStretch(tx, "Persona CEDI", 2);
    expect(m.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true, OR: [{ id: { in: ["felipe"] } }, { role: "ADMIN" }] },
    }));
    expect(m.noti.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ userId: "felipe" }),
      expect.objectContaining({ userId: "admin" }),
    ] });
  });
});
