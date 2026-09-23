// Número de pedido del contenedor en las recepciones del montacarguista (24-09).
//
// Une cada PLU recibido con su Recepción de Contenedores: m³, PLU, unidades y
// tiempo de almacenamiento por contenedor.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizarPedidoContenedor,
  PEDIDO_RECEPCION_DESDE,
  pidePedido,
  validarApertura,
} from "@/lib/montacargas";

describe("desde el 24-09 la recepción pide el pedido", () => {
  it("solo en RECEPCION y solo desde el 24-09", () => {
    expect(PEDIDO_RECEPCION_DESDE).toBe("2026-09-24");
    expect(pidePedido("RECEPCION", "2026-09-23")).toBe(false);
    expect(pidePedido("RECEPCION", "2026-09-24")).toBe(true);
    expect(pidePedido("MOVIMIENTO", "2026-09-30")).toBe(false);
    expect(pidePedido("RESURTIDO", "2026-09-30")).toBe(false);
  });

  it("la apertura lo exige cuando toca", () => {
    const base = { tipo: "RECEPCION", codigo: "26403" };
    expect(validarApertura({ ...base, dia: "2026-09-24" })).toMatch(/pedido/);
    expect(validarApertura({ ...base, dia: "2026-09-24", numeroPedido: "   " })).toMatch(/pedido/);
    expect(validarApertura({ ...base, dia: "2026-09-24", numeroPedido: "peddm 11887" })).toBeNull();
    expect(validarApertura({ ...base, dia: "2026-09-24", numeroPedido: "X".repeat(51) })).toMatch(/largo/);
    // Antes del 24-09, o sin día, no se exige: no rompe nada de lo anterior.
    expect(validarApertura({ ...base, dia: "2026-09-23" })).toBeNull();
    expect(validarApertura(base)).toBeNull();
    // Un movimiento sigue igual.
    expect(validarApertura({ tipo: "MOVIMIENTO", codigo: "3", ubicacionInicial: "05-B-25-03-01", dia: "2026-09-24" })).toBeNull();
  });

  it("se normaliza igual que en Recepción de Contenedores", () => {
    expect(normalizarPedidoContenedor(" peddm 11887 ")).toBe("PEDDM11887");
    expect(normalizarPedidoContenedor(null)).toBe("");
  });
});

describe("el servidor y la pantalla", () => {
  const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

  it("el servidor valida con el día de Bogotá y guarda el pedido solo en recepción", () => {
    const post = leer("nuxt-app/server/api/montacargas/index.post.ts");
    expect(post).toContain("validarApertura({ ...parsed.data, dia: todayBogota(new Date()).toISOString().slice(0, 10) })");
    expect(post).toContain("numeroPedido: tipo === 'RECEPCION' ? normalizarPedidoContenedor(parsed.data.numeroPedido) || null : null");
  });

  it("el sobrante conserva el pedido y se puede corregir", () => {
    expect(leer("nuxt-app/server/api/montacargas/[id]/ubicacion.post.ts")).toContain("numeroPedido: record.numeroPedido");
    expect(leer("nuxt-app/server/api/montacargas/[id]/index.patch.ts")).toContain("numeroPedido: normalizarPedidoContenedor(d.numeroPedido) || null");
  });

  it("la captura lo pide, no deja iniciar sin él y no lo borra entre PLU", () => {
    const cap = leer("nuxt-app/app/components/montacargas/Captura.vue");
    expect(cap).toContain("const conPedido = computed(() => pidePedido(props.flujo.tipo, hoyBogota()))");
    expect(cap).toContain("(!conPedido.value || Boolean(pedidoNorm.value))");
    // reset() limpia el código, no el pedido.
    const reset = cap.slice(cap.indexOf("function reset()"), cap.indexOf("defineExpose"));
    expect(reset).not.toContain("numeroPedido");
  });

  it("columna aditiva e índice", () => {
    const sql = leer("prisma/migrate-montacargas-numero-pedido.sql");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS numero_pedido VARCHAR(50)");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS movimientos_montacargas_pedido_idx");
    for (const f of ["prisma/schema.prisma", "nuxt-app/prisma/schema.prisma"]) {
      expect(leer(f)).toContain('numeroPedido     String? @map("numero_pedido") @db.VarChar(50)');
    }
  });
});
