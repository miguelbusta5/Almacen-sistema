// Los SQL de inventarios ciclicos y stretch film.
//
// Las tablas ya estaban en produccion (se aplicaron con `prisma db push`) y estos
// scripts son el registro que faltaba: tienen que poder correrse contra la base
// viva sin tocar nada, y levantar una base vacia identica a la que espera Prisma.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const inventarios = leer("prisma/migrate-inventarios-ciclicos.sql");
const stretch = leer("prisma/migrate-stretch-film.sql");
const schema = leer("prisma/schema.prisma");
/** Solo las sentencias: los comentarios de cabecera hablan de DROP y ALTER. */
const soloSql = (sql: string) =>
  sql.split(/\r?\n/).filter((l) => !l.trimStart().startsWith("--")).join("\n");

const TABLAS = {
  "prisma/migrate-inventarios-ciclicos.sql": [
    "inventario_cronogramas", "inventario_maestro_versiones", "inventario_productos_pvp",
    "inventario_ciclicos", "inventario_tareas", "inventario_conteos", "inventario_casos",
    "inventario_accesos",
  ],
  "prisma/migrate-stretch-film.sql": [
    "stretch_accesos", "stretch_stock", "stretch_pedidos", "stretch_movimientos", "stretch_sesiones",
  ],
} as const;

describe("SQL de inventarios y stretch", () => {
  it("son aditivos: no borran ni modifican nada que ya viva", () => {
    for (const completo of [inventarios, stretch]) {
      const sql = soloSql(completo);
      expect(sql).not.toMatch(/\bDROP\b/i);
      expect(sql).not.toMatch(/\bTRUNCATE\b/i);
      // "ON DELETE RESTRICT" de una clave foranea si esta permitido.
      expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
      // El unico ALTER permitido es agregar una clave foranea.
      for (const alter of sql.match(/ALTER TABLE[^;]+;/g) ?? []) {
        expect(alter).toContain("ADD CONSTRAINT");
      }
    }
  });

  it("se pueden correr dos veces sin fallar", () => {
    for (const sql of [inventarios, stretch]) {
      for (const crear of sql.match(/CREATE TABLE[^(]+/g) ?? []) {
        expect(crear).toContain("IF NOT EXISTS");
      }
      for (const indice of sql.match(/CREATE (?:UNIQUE )?INDEX[^(]+/g) ?? []) {
        expect(indice).toContain("IF NOT EXISTS");
      }
      // Una clave foranea no admite IF NOT EXISTS: va envuelta.
      const fks = (sql.match(/ADD CONSTRAINT/g) ?? []).length;
      expect((sql.match(/EXCEPTION WHEN duplicate_object/g) ?? []).length).toBe(fks);
    }
  });

  it("crean todas las tablas de su modulo", () => {
    for (const [archivo, tablas] of Object.entries(TABLAS)) {
      const sql = leer(archivo);
      for (const tabla of tablas) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "${tabla}"`);
        // Y el schema de Prisma sigue apuntando a esa misma tabla.
        expect(schema).toContain(`@@map("${tabla}")`);
      }
    }
  });

  it("dicen como se aplican y que no se deben borrar", () => {
    for (const sql of [inventarios, stretch]) {
      expect(sql).toContain("ON_ERROR_STOP=1");
      expect(sql).toContain("NO borrar estas tablas");
    }
  });
});

describe("el administrador entra a inventarios y stretch", () => {
  it("no necesita darse acceso a si mismo", () => {
    const inv = leer("nuxt-app/server/utils/inventarios.ts");
    expect(inv).toContain("if (usuario.role === 'ADMIN') return true");
    // Gestionar si; contar no, para no salir en la lista de quien cuenta.
    expect(inv).toContain("gestionar: admin || !!p?.gestionar, contar: !!p?.contar");
    const str = leer("nuxt-app/server/utils/stretch.ts");
    // Una sola regla para el actor y para quien creó la pantalla compartida: con
    // dos copias, la sesión de un admin sin fila quedaba en 403 al activarla.
    expect(str).toContain("export function permisoDeStretch");
    expect(str).toContain("permisoDeStretch(u, acceso).gestionar");
    expect(str).toContain("gestionar: admin || !!acceso?.gestionar, solicitar: admin || !!acceso?.solicitar");
  });

  it("el menu sigue pidiendo el permiso, que ahora el admin tiene", () => {
    const layout = leer("nuxt-app/app/layouts/default.vue");
    expect(layout).toContain("!!me.value?.can.gestionarInventarios || !!me.value?.can.contarInventarios");
    expect(layout).toContain("!!me.value?.can.stretch?.gestionar || !!me.value?.can.stretch?.solicitar");
  });
});
