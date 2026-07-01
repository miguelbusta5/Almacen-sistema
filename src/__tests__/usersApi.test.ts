import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
  transportistaFindFirst: vi.fn(),
  transportistaUpdate: vi.fn(),
  transaction: vi.fn(),
  activityLogCreate: vi.fn(),
}));

// authz.ts (requireAuth/requireRole) importa `auth` de "@/lib/auth" — mockear
// solo `auth` alcanza para ambos estilos de autorización que usan los
// endpoints de usuarios (auth() directo y requireAuth() de authz.ts).
vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

const tx = {
  user: { create: mocks.userCreate },
  transportista: { update: mocks.transportistaUpdate },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      create: mocks.userCreate,
      update: mocks.userUpdate,
    },
    transportista: {
      findFirst: mocks.transportistaFindFirst,
      update: mocks.transportistaUpdate,
    },
    activityLog: { create: mocks.activityLogCreate },
    $transaction: mocks.transaction,
  },
}));

import { POST as postUser } from "@/app/api/users/route";
import { PUT as putUser } from "@/app/api/users/[id]/route";
import { POST as postChangePassword } from "@/app/api/users/me/password/route";

function actor(role: string, id = "u_1") {
  return { user: { id, email: "actor@test.com", name: "Actor", role } };
}

function postUserReq(body: unknown) {
  return new NextRequest("http://localhost/api/users", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function putUserReq(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function changePasswordReq(body: unknown) {
  return new NextRequest("http://localhost/api/users/me/password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));
  mocks.activityLogCreate.mockResolvedValue({});
});

describe("POST /api/users — nuevas cuentas empiezan con contraseña temporal", () => {
  const validBody = { email: "nuevo@grupoambiente.com", name: "Usuario Nuevo", password: "password123", role: "INVENTARIO" };

  it("crea el usuario con mustChangePassword: true", async () => {
    mocks.auth.mockResolvedValue(actor("ADMIN"));
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue({ id: "new1", email: validBody.email, name: validBody.name, role: validBody.role, active: true });

    const res = await postUser(postUserReq(validBody));
    expect(res.status).toBe(201);
    expect(mocks.userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mustChangePassword: true }),
      })
    );
  });

  it("rechaza si no es ADMIN (403)", async () => {
    mocks.auth.mockResolvedValue(actor("GERENTE"));
    const res = await postUser(postUserReq(validBody));
    expect(res.status).toBe(403);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});

describe("PUT /api/users/[id] — resetear contraseña marca mustChangePassword", () => {
  const params = { params: Promise.resolve({ id: "u_target" }) };

  it("al enviar password nuevo, setea mustChangePassword: true", async () => {
    mocks.auth.mockResolvedValue(actor("ADMIN", "u_admin"));
    mocks.userUpdate.mockResolvedValue({ id: "u_target", email: "x@x.com", name: "X", role: "INVENTARIO", active: true });

    const res = await putUser(putUserReq("u_target", { password: "nuevaPass123" }), params);
    expect(res.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mustChangePassword: true }),
      })
    );
  });

  it("si no envía password, no toca mustChangePassword", async () => {
    mocks.auth.mockResolvedValue(actor("ADMIN", "u_admin"));
    mocks.userUpdate.mockResolvedValue({ id: "u_target", email: "x@x.com", name: "X", role: "INVENTARIO", active: true });

    await putUser(putUserReq("u_target", { name: "Nuevo Nombre" }), params);
    expect(mocks.userUpdate.mock.calls[0][0].data).not.toHaveProperty("mustChangePassword");
  });
});

describe("POST /api/users/me/password", () => {
  it("401 sin sesión", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await postChangePassword(changePasswordReq({ currentPassword: "a", newPassword: "b12345678" }));
    expect(res.status).toBe(401);
  });

  it("400 si la contraseña actual no coincide", async () => {
    mocks.auth.mockResolvedValue(actor("INVENTARIO", "u_1"));
    // hash real de "correcta123" para poder comparar con bcrypt.compare
    const bcrypt = await import("bcryptjs");
    mocks.userFindUnique.mockResolvedValue({ password: await bcrypt.hash("correcta123", 12) });

    const res = await postChangePassword(changePasswordReq({ currentPassword: "incorrecta", newPassword: "nuevaPass123" }));
    expect(res.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("400 si la nueva contraseña es igual a la actual", async () => {
    mocks.auth.mockResolvedValue(actor("INVENTARIO", "u_1"));
    const res = await postChangePassword(changePasswordReq({ currentPassword: "igualPass123", newPassword: "igualPass123" }));
    expect(res.status).toBe(400);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("400 si la nueva contraseña tiene menos de 8 caracteres", async () => {
    mocks.auth.mockResolvedValue(actor("INVENTARIO", "u_1"));
    const res = await postChangePassword(changePasswordReq({ currentPassword: "actualPass123", newPassword: "corta" }));
    expect(res.status).toBe(400);
  });

  it("200: actualiza la contraseña y pone mustChangePassword en false", async () => {
    mocks.auth.mockResolvedValue(actor("INVENTARIO", "u_1"));
    const bcrypt = await import("bcryptjs");
    mocks.userFindUnique.mockResolvedValue({ password: await bcrypt.hash("temporal123", 12) });
    mocks.userUpdate.mockResolvedValue({ id: "u_1" });

    const res = await postChangePassword(changePasswordReq({ currentPassword: "temporal123", newPassword: "miNuevaClave123" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u_1" },
        data: expect.objectContaining({ mustChangePassword: false }),
      })
    );
  });

  it("registra la acción en activityLog", async () => {
    mocks.auth.mockResolvedValue(actor("INVENTARIO", "u_1"));
    const bcrypt = await import("bcryptjs");
    mocks.userFindUnique.mockResolvedValue({ password: await bcrypt.hash("temporal123", 12) });
    mocks.userUpdate.mockResolvedValue({ id: "u_1" });

    await postChangePassword(changePasswordReq({ currentPassword: "temporal123", newPassword: "miNuevaClave123" }));

    expect(mocks.activityLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "UPDATE", module: "usuarios", recordId: "u_1" }),
      })
    );
  });
});
