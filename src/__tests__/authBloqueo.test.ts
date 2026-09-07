// Bloqueo por fuerza bruta en el login (src/lib/auth.ts).
//
// Sin esto, una contraseña de 8 caracteres (el mínimo que exige la app) se podía
// probar sin límite contra /api/auth/callback/credentials. El contador se
// persiste en la base y no en memoria porque en serverless cada instancia
// tendría el suyo y el límite sería trivial de esquivar.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate } },
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mocks.compare, hash: vi.fn() },
}));

// NextAuth() se ejecuta al importar el módulo; solo necesitamos quedarnos con la
// config para poder invocar `authorize` directamente.
const capturado: { config?: any } = {};
vi.mock("next-auth", () => ({
  default: (config: any) => {
    capturado.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("next-auth/providers/credentials", () => ({
  default: (opts: any) => opts,
}));

await import("@/lib/auth");
const authorize = capturado.config.providers[0].authorize as (
  c: Record<string, unknown>,
) => Promise<unknown>;

const USUARIO = {
  id: "u1",
  email: "op@grupoambiente.co",
  name: "Operario",
  role: "MONTACARGAS",
  password: "$2a$12$hashficticio",
  active: true,
  mustChangePassword: false,
  intentosFallidos: 0,
  bloqueadoHasta: null as Date | null,
};

const credenciales = { email: "op@grupoambiente.co", password: "secreta123" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userUpdate.mockResolvedValue({});
});

describe("login — contraseña correcta", () => {
  it("devuelve el usuario y limpia el contador si venía de fallos", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...USUARIO, intentosFallidos: 3 });
    mocks.compare.mockResolvedValue(true);

    const res = await authorize(credenciales);

    expect(res).toMatchObject({ id: "u1", role: "MONTACARGAS" });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });
  });

  it("no escribe en la base si el contador ya estaba limpio", async () => {
    mocks.userFindUnique.mockResolvedValue(USUARIO);
    mocks.compare.mockResolvedValue(true);

    await authorize(credenciales);

    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});

describe("login — contraseña incorrecta", () => {
  it("suma un intento y todavía no bloquea", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...USUARIO, intentosFallidos: 1 });
    mocks.compare.mockResolvedValue(false);

    expect(await authorize(credenciales)).toBeNull();

    const data = mocks.userUpdate.mock.calls[0][0].data;
    expect(data.intentosFallidos).toBe(2);
    expect(data.bloqueadoHasta).toBeUndefined();
  });

  it("al quinto intento bloquea la cuenta 15 minutos", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...USUARIO, intentosFallidos: 4 });
    mocks.compare.mockResolvedValue(false);

    expect(await authorize(credenciales)).toBeNull();

    const data = mocks.userUpdate.mock.calls[0][0].data;
    expect(data.intentosFallidos).toBe(5);
    const minutos = (data.bloqueadoHasta.getTime() - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(14);
    expect(minutos).toBeLessThanOrEqual(15);
  });
});

describe("login — cuenta bloqueada", () => {
  it("rechaza sin evaluar la contraseña mientras dura el bloqueo", async () => {
    mocks.userFindUnique.mockResolvedValue({
      ...USUARIO,
      intentosFallidos: 5,
      bloqueadoHasta: new Date(Date.now() + 5 * 60_000),
    });

    expect(await authorize(credenciales)).toBeNull();
    // Ni siquiera se compara: es lo que hace que el bloqueo sirva de algo.
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("vuelve a admitir el login cuando el bloqueo ya venció", async () => {
    mocks.userFindUnique.mockResolvedValue({
      ...USUARIO,
      intentosFallidos: 5,
      bloqueadoHasta: new Date(Date.now() - 60_000),
    });
    mocks.compare.mockResolvedValue(true);

    expect(await authorize(credenciales)).toMatchObject({ id: "u1" });
  });
});

describe("login — enumeración de usuarios", () => {
  // Si el correo inexistente respondiera sin pasar por bcrypt, la diferencia de
  // tiempo delataría qué correos son de usuarios reales.
  it("compara contra un hash señuelo cuando el correo no existe", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.compare.mockResolvedValue(false);

    expect(await authorize(credenciales)).toBeNull();
    expect(mocks.compare).toHaveBeenCalledTimes(1);
  });

  it("hace lo mismo con un usuario inactivo", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...USUARIO, active: false });
    mocks.compare.mockResolvedValue(false);

    expect(await authorize(credenciales)).toBeNull();
    expect(mocks.compare).toHaveBeenCalledTimes(1);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});

describe("login — credenciales incompletas", () => {
  it("no consulta la base si falta email o contraseña", async () => {
    expect(await authorize({ email: "", password: "x" })).toBeNull();
    expect(await authorize({ email: "a@b.co", password: "" })).toBeNull();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });
});
