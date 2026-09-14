// Guarda del SQL que se aplica a produccion a mano.
//
// Este archivo se ejecuta contra la base viva del CEDI, con 19k productos y
// datos de todos los modulos. Un DROP colado aqui no lo atrapa nadie: no pasa
// por el CI, no pasa por Prisma y no tiene vuelta atras. Por eso se vigila.
//
// Lo que NO puede comprobar un test: que el SQL deje la base exactamente como la
// espera Prisma. Eso se verifico con `prisma migrate diff` contra una replica
// local del estado de produccion (diff vacio, y vacio tambien tras aplicarlo dos
// veces). Si se toca este archivo, hay que repetir esa verificacion.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(path.join(process.cwd(), "prisma/migrate-muebles.sql"), "utf8");

// Las sentencias, sin comentarios: un `-- DROP TABLE` en la cabecera explicando
// que NO hay que borrar las tablas no puede hacer fallar al guard.
const codigo = sql
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("--"))
  .join("\n");

describe("migrate-muebles.sql — es aditivo", () => {
  it.each(["DROP TABLE", "DROP COLUMN", "DROP TYPE", "DROP DATABASE", "TRUNCATE", "DELETE FROM"])(
    "no contiene %s",
    (peligro) => {
      expect(codigo.toUpperCase()).not.toContain(peligro);
    },
  );

  // Un DROP CONSTRAINT o un ALTER COLUMN sobre una tabla que ya tiene datos es
  // justo el drift que este proyecto evita no usando `db push` aqui.
  it("no altera ni suelta restricciones de tablas existentes", () => {
    expect(codigo.toUpperCase()).not.toContain("DROP CONSTRAINT");
    expect(codigo.toUpperCase()).not.toContain("ALTER COLUMN");
  });

  it("lo unico que toca algo existente son los dos roles nuevos", () => {
    const alters = codigo.match(/^ALTER TABLE .*$/gm) ?? [];
    // Todos los ALTER TABLE son ADD CONSTRAINT ... FOREIGN KEY sobre las tablas
    // nuevas, dentro de su bloque DO.
    for (const a of alters) {
      expect(a).toMatch(/ADD CONSTRAINT/);
      expect(a).toMatch(/_muebles"|"tipos_mueble_plu"/);
    }
    const alterTypes = codigo.match(/^ALTER TYPE .*$/gm) ?? [];
    expect(alterTypes).toEqual([
      `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PICKING_MUEBLES';`,
      `ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INSPECCION_MUEBLES';`,
    ]);
  });
});

describe("migrate-muebles.sql — es idempotente", () => {
  it("toda tabla e indice lleva IF NOT EXISTS", () => {
    for (const m of codigo.match(/^CREATE (UNIQUE )?(TABLE|INDEX) .*$/gm) ?? []) {
      expect(m).toContain("IF NOT EXISTS");
    }
  });

  it("los enums nuevos van protegidos contra duplicate_object", () => {
    const enums = codigo.match(/CREATE TYPE "(\w+)"/g) ?? [];
    expect(enums.length).toBe(6);
    // Cada CREATE TYPE tiene su EXCEPTION detras.
    expect((codigo.match(/EXCEPTION WHEN duplicate_object/g) ?? []).length)
      .toBeGreaterThanOrEqual(enums.length);
  });

  it("los ADD VALUE del enum Role llevan IF NOT EXISTS", () => {
    for (const m of codigo.match(/ALTER TYPE "Role" ADD VALUE[^;]+;/g) ?? []) {
      expect(m).toContain("IF NOT EXISTS");
    }
  });

  // ALTER TYPE ... ADD VALUE no puede correr dentro de una transaccion, asi que
  // no puede quedar envuelto en un bloque DO como los CREATE TYPE.
  it("los ADD VALUE quedan fuera de cualquier bloque DO", () => {
    for (const bloque of codigo.match(/DO \$\$ BEGIN[\s\S]*?END \$\$;/g) ?? []) {
      expect(bloque).not.toContain("ADD VALUE");
    }
  });

  it("no existe ADD CONSTRAINT IF NOT EXISTS: las FK van en bloques DO", () => {
    // PostgreSQL no soporta esa forma; si alguien la escribe, el script revienta
    // en produccion a mitad de camino.
    expect(codigo).not.toContain("ADD CONSTRAINT IF NOT EXISTS");
    for (const fk of codigo.match(/ADD CONSTRAINT "[^"]+" FOREIGN KEY/g) ?? []) {
      expect(fk).toBeTruthy();
    }
    const fks = (codigo.match(/FOREIGN KEY/g) ?? []).length;
    const bloques = (codigo.match(/DO \$\$ BEGIN[\s\S]*?FOREIGN KEY[\s\S]*?END \$\$;/g) ?? []).length;
    expect(bloques).toBe(fks);
  });
});

describe("migrate-muebles.sql — cubre el modulo entero", () => {
  it.each([
    "equipos_muebles",
    "asignaciones_equipo_muebles",
    "ordenes_muebles",
    "lineas_muebles",
    "participantes_orden_muebles",
    "inspectores_muebles",
    "pendientes_muebles",
    "tipos_mueble_plu",
  ])("crea %s", (tabla) => {
    expect(codigo).toContain(`CREATE TABLE IF NOT EXISTS "${tabla}"`);
  });

  // Si el schema gana una tabla del modulo y nadie la mete aqui, produccion se
  // queda sin ella y el modulo revienta al primer uso.
  it("no hay tablas de muebles en el schema que falten en el SQL", () => {
    const schema = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const tablasDelModulo = (schema.match(/@@map\("([a-z_]*muebles?[a-z_]*)"\)/g) ?? [])
      .map((m) => m.replace(/@@map\("|"\)/g, ""))
      // productos_maestro y medidas_* son del maestro, no del modulo.
      .filter((t) => t !== "productos_maestro");
    for (const tabla of tablasDelModulo) {
      expect(codigo).toContain(`"${tabla}"`);
    }
  });
});
