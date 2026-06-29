import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiGet,
  apiPost,
  apiSend,
  apiUpload,
  buildQuery,
} from "@/lib/apiClient";

// Helper para mockear `global.fetch` con una respuesta JSON dada.
function mockFetch(body: unknown, init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true;
  const status = init?.status ?? (ok ? 200 : 400);
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
  global.fetch = fetchMock;
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildQuery", () => {
  it("devuelve cadena vacia sin params", () => {
    expect(buildQuery()).toBe("");
    expect(buildQuery({})).toBe("");
  });

  it("omite null, undefined y cadenas vacias", () => {
    expect(buildQuery({ a: "1", b: null, c: undefined, d: "" })).toBe("?a=1");
  });

  it("serializa numeros y booleanos", () => {
    expect(buildQuery({ page: 2, activo: true })).toBe("?page=2&activo=true");
  });

  it("url-encodea valores", () => {
    expect(buildQuery({ q: "silla & mesa" })).toBe("?q=silla+%26+mesa");
  });
});

describe("apiGet", () => {
  it("devuelve la envoltura completa en exito", async () => {
    mockFetch({ success: true, data: [{ id: 1 }], total: 5, page: 1 });
    const res = await apiGet<{ data: { id: number }[]; total: number; page: number }>("/api/x");
    expect(res.data).toEqual([{ id: 1 }]);
    expect(res.total).toBe(5);
  });

  it("construye el query string desde params", async () => {
    const fetchMock = mockFetch({ success: true, data: [] });
    await apiGet("/api/x", { q: "abc", page: 2, vacio: "" });
    expect(fetchMock).toHaveBeenCalledWith("/api/x?q=abc&page=2");
  });

  it("acepta respuestas sin campo success (p. ej. /api/stats)", async () => {
    mockFetch({ novedades: { total: 3 } });
    const res = await apiGet<{ novedades: { total: number } }>("/api/stats");
    expect(res.novedades.total).toBe(3);
  });

  it("lanza ApiError con message y code en error de negocio (409)", async () => {
    mockFetch({ error: "Conflicto", code: "CONFLICT" }, { ok: false, status: 409 });
    await expect(apiGet("/api/x")).rejects.toMatchObject({
      name: "ApiError",
      message: "Conflicto",
      code: "CONFLICT",
      status: 409,
    });
  });

  it("lanza ApiError cuando el cuerpo trae success: false explicito (200)", async () => {
    mockFetch({ success: false, error: "Fallo logico" }, { ok: true, status: 200 });
    await expect(apiGet("/api/x")).rejects.toMatchObject({
      name: "ApiError",
      message: "Fallo logico",
      status: 200,
    });
  });

  it("lanza ApiError cuando !res.ok con el status HTTP", async () => {
    mockFetch({ error: "No autorizado" }, { ok: false, status: 403 });
    await expect(apiGet("/api/x")).rejects.toMatchObject({
      name: "ApiError",
      message: "No autorizado",
      status: 403,
    });
  });

  it("usa mensaje por defecto si el JSON es invalido", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("invalid json");
      },
    })) as unknown as typeof fetch;
    global.fetch = fetchMock;
    await expect(apiGet("/api/x")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("apiSend / apiPost", () => {
  it("envia Content-Type y body serializado", async () => {
    const fetchMock = mockFetch({ success: true, data: { id: 1 } }, { status: 201 });
    const res = await apiPost<{ data: { id: number } }>("/api/x", { nombre: "foo" });
    expect(res.data.id).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "foo" }),
    });
  });

  it("no envia headers ni body cuando no hay payload", async () => {
    const fetchMock = mockFetch({ success: true });
    await apiSend("/api/x/1/finalize", "POST");
    expect(fetchMock).toHaveBeenCalledWith("/api/x/1/finalize", {
      method: "POST",
      headers: undefined,
      body: undefined,
    });
  });
});

describe("apiUpload", () => {
  it("no fija Content-Type (multipart)", async () => {
    const fetchMock = mockFetch({ success: true, url: "/blob/foto.jpg" });
    const fd = new FormData();
    fd.append("foto", "x");
    await apiUpload<{ url: string }>("/api/uploads/foto", fd);
    expect(fetchMock).toHaveBeenCalledWith("/api/uploads/foto", {
      method: "POST",
      body: fd,
    });
  });
});
