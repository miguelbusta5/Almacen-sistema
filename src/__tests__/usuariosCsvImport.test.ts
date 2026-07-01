import { describe, it, expect } from "vitest";
import {
  validateColumns,
  validateRow,
  processRows,
  generateEmailFromName,
  generateTemporaryPassword,
  USER_ROLE_VALUES,
} from "../../scripts/lib/usuariosCsv.mjs";

describe("validateColumns", () => {
  it("ok=true si están nombre y rol", () => {
    expect(validateColumns(["nombre", "rol"])).toEqual({ ok: true, missing: [] });
  });

  it("ok=true si además viene 'email' (opcional)", () => {
    expect(validateColumns(["nombre", "rol", "email"]).ok).toBe(true);
  });

  it("ok=false y lista las columnas faltantes", () => {
    const r = validateColumns(["nombre"]);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["rol"]);
  });

  it("es insensible a mayúsculas/espacios en los nombres de columna", () => {
    expect(validateColumns([" NOMBRE ", "Rol"]).ok).toBe(true);
  });
});

describe("generateEmailFromName", () => {
  it("nombre simple minúsculas.apellido@dominio", () => {
    expect(generateEmailFromName("Carlos Ramirez")).toBe("carlos.ramirez@grupoambiente.com");
  });

  it("quita tildes/diacríticos", () => {
    expect(generateEmailFromName("María Fernández")).toBe("maria.fernandez@grupoambiente.com");
  });

  it("nombre con varias palabras las une todas con puntos", () => {
    expect(generateEmailFromName("Maria Fernanda Restrepo Gutierrez")).toBe(
      "maria.fernanda.restrepo.gutierrez@grupoambiente.com"
    );
  });

  it("acepta un dominio custom", () => {
    expect(generateEmailFromName("Ana Lopez", "otrodominio.com")).toBe("ana.lopez@otrodominio.com");
  });

  it("quita caracteres no alfanuméricos", () => {
    expect(generateEmailFromName("José D'Angelo")).toBe("jose.dangelo@grupoambiente.com");
  });
});

describe("generateTemporaryPassword", () => {
  it("genera una contraseña de la longitud pedida", () => {
    expect(generateTemporaryPassword(12).length).toBe(12);
    expect(generateTemporaryPassword(8).length).toBe(8);
  });

  it("es determinística si se le pasa un generador de aleatoriedad fijo", () => {
    const fixedRandom = () => 0;
    const pw = generateTemporaryPassword(4, fixedRandom);
    expect(pw).toBe(pw[0].repeat(4));
  });

  it("no genera contraseñas vacías ni con espacios", () => {
    const pw = generateTemporaryPassword(12);
    expect(pw).not.toMatch(/\s/);
    expect(pw.length).toBeGreaterThan(0);
  });
});

describe("validateRow", () => {
  it("acepta una fila válida con email explícito", () => {
    const r = validateRow({ nombre: "Carlos Ramirez", rol: "inventario", email: "carlos@empresa.com" }, 2);
    expect(r.ok).toBe(true);
    expect(r.row).toEqual({ nombre: "Carlos Ramirez", rol: "INVENTARIO", email: "carlos@empresa.com" });
  });

  it("genera el email si no viene en el CSV", () => {
    const r = validateRow({ nombre: "Carlos Ramirez", rol: "INVENTARIO" }, 2);
    expect(r.ok).toBe(true);
    expect(r.row?.email).toBe("carlos.ramirez@grupoambiente.com");
  });

  it("normaliza el rol a mayúsculas", () => {
    const r = validateRow({ nombre: "X", rol: "admin" }, 2);
    expect(r.ok).toBe(true);
    expect(r.row?.rol).toBe("ADMIN");
  });

  it("rechaza si falta nombre", () => {
    const r = validateRow({ rol: "ADMIN" }, 2);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/nombre/);
  });

  it("rechaza si falta rol", () => {
    const r = validateRow({ nombre: "X" }, 2);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/rol/);
  });

  it("rechaza un rol no reconocido", () => {
    const r = validateRow({ nombre: "X", rol: "SUPERADMIN" }, 2);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/rol no reconocido/);
  });

  it("rechaza un email explícito con formato inválido", () => {
    const r = validateRow({ nombre: "X", rol: "ADMIN", email: "no-es-email" }, 2);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/email inválido/);
  });

  it("todos los USER_ROLE_VALUES son aceptados", () => {
    for (const rol of USER_ROLE_VALUES) {
      expect(validateRow({ nombre: "X", rol }, 2).ok).toBe(true);
    }
  });
});

describe("processRows", () => {
  it("clasifica válidas/inválidas y arma el createPlan", () => {
    const result = processRows([
      { nombre: "Carlos Ramirez", rol: "ADMIN" },
      { nombre: "Ana Lopez", rol: "GERENTE" },
      { nombre: "", rol: "ADMIN" },
    ]);
    expect(result.totalRows).toBe(3);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(1);
    expect(result.createPlan).toHaveLength(2);
  });

  it("detecta emails duplicados dentro del CSV y se queda con la última fila válida", () => {
    const result = processRows([
      { nombre: "Carlos Ramirez", rol: "ADMIN", email: "dup@empresa.com" },
      { nombre: "Otro Nombre", rol: "GERENTE", email: "dup@empresa.com" },
    ]);
    expect(result.duplicateEmails).toEqual(["dup@empresa.com"]);
    expect(result.createPlan).toHaveLength(1);
    expect(result.createPlan[0].nombre).toBe("Otro Nombre");
  });
});
