import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { derivarTipoOrden } from "@/lib/gourmetTipoOrden";
import { CIUDAD_TIENDA_CLIENTE, CODIGO_TIENDA_CLIENTE, NOMBRE_TIENDA_CLIENTE, esCodigoTiendaCliente } from "@/lib/gourmetCliente";

type PedidoListRow = Prisma.GourmetPedidoGetPayload<{
  include: {
    creadoPor: { select: { name: true } };
    estibas: { select: { ubicacion: true; secuencia: true } };
  };
}>;

const ALLOWED_ROLES = ["ADMIN", "GERENTE", "OPERACIONES_GOURMET", "TRANSPORTE", "SUPERVISOR_TRANSPORTE"] as const;
const ROLES_CREAN = ["OPERACIONES_GOURMET", "ADMIN", "GERENTE"] as const;

const SORT_FIELDS = ["createdAt", "orden", "estado", "ciudadDestino", "enviadoTransporteAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

function mapRow(r: PedidoListRow) {
  return {
    id: r.id,
    orden: r.orden,
    tipoOrden: r.tipoOrden,
    codigoTienda: r.codigoTienda,
    nombreTienda: r.nombreTienda,
    ciudadDestino: r.ciudadDestino,
    cajasEsperadas: r.cajasEsperadas,
    estibasEsperadas: r.estibasEsperadas,
    estado: r.estado,
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    ubicacionAsignadaAt: r.ubicacionAsignadaAt,
    enviadoTransporteAt: r.enviadoTransporteAt,
    cargueIniciadoAt: r.cargueIniciadoAt,
    cargueCompletadoAt: r.cargueCompletadoAt,
    esCierreManual: r.esCierreManual,
    // Ubicaciones físicas de las estibas (una por estiba), ordenadas por
    // secuencia y sin repetir, unidas en un texto legible para la tabla.
    // ubicacion es ahora nullable (G1): filtrar nulls antes de unir.
    ubicaciones: Array.from(
      new Set(
        (r.estibas ?? [])
          .slice()
          .sort((a, b) => a.secuencia - b.secuencia)
          .map((e) => e.ubicacion?.trim() ?? "")
          .filter(Boolean)
      )
    ).join(", "),
  };
}

// GET /api/cargue-gourmet
export async function GET(req: NextRequest) {
  const actor = await requireRole([...ALLOWED_ROLES]);
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const ciudad = sp.get("ciudad") ?? undefined;
  const estado = sp.get("estado") ?? undefined;
  const tipoOrden = sp.get("tipoOrden") ?? undefined;
  const q = sp.get("q")?.trim();
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(sp.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  );
  const sortParam = sp.get("sort") ?? "createdAt";
  const sortField: SortField = (SORT_FIELDS as readonly string[]).includes(sortParam)
    ? (sortParam as SortField)
    : "createdAt";

  const where: Record<string, unknown> = {};
  if (ciudad) where.ciudadDestino = ciudad;
  if (estado) where.estado = estado;
  if (tipoOrden) where.tipoOrden = tipoOrden;
  if (q) {
    where.OR = [
      { orden: { contains: q, mode: "insensitive" } },
      { codigoTienda: { contains: q, mode: "insensitive" } },
      { nombreTienda: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.gourmetPedido.count({ where }),
    prisma.gourmetPedido.findMany({
      where,
      orderBy: { [sortField]: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creadoPor: { select: { name: true } },
        estibas: { select: { ubicacion: true, secuencia: true } },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: rows.map(mapRow),
    total,
    page,
    pageSize,
  });
}

// Regex de validación para código de caja: solo dígitos (sin espacios ni letras).
const RE_SOLO_NUMEROS = /^\d+$/;
// Prefijos que identifican una orden (no una caja) — se rechazan con aviso.
const PREFIJOS_ORDEN = ["TSDM", "OVDM"];

function validarCodigoCaja(codigo: string): { ok: true } | { ok: false; error: string } {
  const c = codigo.trim();
  const upper = c.toUpperCase();
  for (const p of PREFIJOS_ORDEN) {
    if (upper.startsWith(p)) {
      return { ok: false, error: `"${c}" parece un código de orden (${p}…), no de caja. Escanea solo el código de la caja física.` };
    }
  }
  if (!RE_SOLO_NUMEROS.test(c)) {
    return { ok: false, error: `"${c}" no es un código de caja válido — solo se permiten dígitos.` };
  }
  if (c.length === 0) {
    return { ok: false, error: "El código de caja no puede estar vacío." };
  }
  return { ok: true };
}

const estibaInputSchema = z.object({
  secuencia: z.number().int().min(1),
  cajas: z.array(z.string().min(1).max(150)).min(1),
});

const createSchema = z.object({
  orden: z.string().min(1).max(100),
  codigoTienda: z.string().min(1).max(50),
  cajasEsperadas: z.number().int().min(1),
  estibasEsperadas: z.number().int().min(1),
  // Estibas con cajas escaneadas (opcional — si no se manda, el pedido se
  // crea en BORRADOR sin cajas, igual que antes de G2).
  estibas: z.array(estibaInputSchema).optional(),
});

// POST /api/cargue-gourmet
export async function POST(req: NextRequest) {
  const actor = await requireRole([...ROLES_CREAN]);
  if (actor instanceof NextResponse) return actor;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  let codigoTienda: string;
  let nombreTienda: string;
  let ciudadDestino: string;

  if (esCodigoTiendaCliente(data.codigoTienda)) {
    codigoTienda = CODIGO_TIENDA_CLIENTE;
    nombreTienda = NOMBRE_TIENDA_CLIENTE;
    ciudadDestino = CIUDAD_TIENDA_CLIENTE;
  } else {
    const tienda = await prisma.maestroTiendaGourmet.findUnique({
      where: { codigo: data.codigoTienda },
    });
    if (!tienda) {
      return NextResponse.json({ error: "El código de tienda no existe en el maestro" }, { status: 400 });
    }
    if (!tienda.activo) {
      return NextResponse.json({ error: "La tienda está inactiva en el maestro" }, { status: 400 });
    }
    codigoTienda = tienda.codigo;
    nombreTienda = tienda.tienda;
    ciudadDestino = tienda.ciudad;
  }

  const tipoOrden = derivarTipoOrden(data.orden);
  const ordenTrim = data.orden.trim();

  // Evita duplicar un pedido por error de captura: si ya existe un pedido con
  // la misma orden (case-insensitive) y no está CANCELADO, se bloquea y se
  // indica el pedido existente para que el usuario lo edite en vez de crear
  // uno nuevo. CANCELADO libera la orden porque representa un pedido anulado.
  const duplicado = await prisma.gourmetPedido.findFirst({
    where: { orden: { equals: ordenTrim, mode: "insensitive" }, estado: { not: "CANCELADO" } },
    select: { id: true, estado: true },
  });
  if (duplicado) {
    return NextResponse.json(
      {
        error: `Ya existe un pedido con la orden "${ordenTrim}" (estado: ${duplicado.estado}). Si fue un error de captura, edita ese pedido en vez de crear uno nuevo.`,
        code: "ORDEN_DUPLICADA",
        data: { id: duplicado.id, estado: duplicado.estado },
      },
      { status: 409 }
    );
  }

  // ── Validación de estibas y cajas escaneadas (solo si se manda) ──────────
  const estibasInput = data.estibas ?? [];
  if (estibasInput.length > 0) {
    // 1. Número de estibas debe coincidir con estibasEsperadas.
    if (estibasInput.length !== data.estibasEsperadas) {
      return NextResponse.json(
        { error: `Se esperan ${data.estibasEsperadas} estiba(s) pero se enviaron ${estibasInput.length}.` },
        { status: 400 }
      );
    }
    // 2. Secuencias únicas.
    const secs = estibasInput.map((e) => e.secuencia);
    if (new Set(secs).size !== secs.length) {
      return NextResponse.json({ error: "No se permiten estibas con la misma secuencia." }, { status: 400 });
    }
    // 3. Validar cada código de caja y colectar todos los códigos para chequeo global.
    const todosLosCodigos: string[] = [];
    for (const estiba of estibasInput) {
      for (const rawCodigo of estiba.cajas) {
        const r = validarCodigoCaja(rawCodigo);
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
        todosLosCodigos.push(rawCodigo.trim());
      }
    }
    // 4. Sin duplicados entre todas las estibas.
    if (new Set(todosLosCodigos).size !== todosLosCodigos.length) {
      return NextResponse.json(
        { error: "Hay códigos de caja repetidos entre estibas. Cada caja solo puede escanearse una vez." },
        { status: 400 }
      );
    }
    // 5. Total de cajas = cajasEsperadas.
    if (todosLosCodigos.length !== data.cajasEsperadas) {
      return NextResponse.json(
        { error: `Se escanearon ${todosLosCodigos.length} caja(s) pero el pedido espera ${data.cajasEsperadas}. Completa el escaneo antes de crear el pedido.` },
        { status: 400 }
      );
    }
  }

  // ── Crear pedido (fuera de transacción para compatibilidad con mocks) ────
  const p = await prisma.gourmetPedido.create({
    data: {
      orden: data.orden,
      tipoOrden,
      codigoTienda,
      nombreTienda,
      ciudadDestino,
      cajasEsperadas: data.cajasEsperadas,
      estibasEsperadas: data.estibasEsperadas,
      estado: "BORRADOR",
      creadoPorId: actor.id,
    },
  });

  // ── Crear estibas + cajas en transacción (solo si se escanearon cajas) ───
  if (estibasInput.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const estibaData of estibasInput) {
        const estiba = await prisma.gourmetPedidoEstiba.create({
          data: {
            pedidoId: p.id,
            secuencia: estibaData.secuencia,
            // ubicacion se deja null hasta el paso "Asignar ubicación".
            ubicacion: null,
          },
        });
        if (estibaData.cajas.length > 0) {
          await tx.gourmetPedidoCaja.createMany({
            data: estibaData.cajas.map((codigo, idx) => ({
              pedidoId: p.id,
              estibaId: estiba.id,
              codigoCaja: codigo.trim(),
              numeroSecuencia: idx + 1,
              generadaPorEscaneo: true,
            })),
          });
        }
      }
    });
  }

  const pedido = await prisma.gourmetPedido.findUniqueOrThrow({
    where: { id: p.id },
    include: {
      creadoPor: { select: { name: true } },
      estibas: { select: { ubicacion: true, secuencia: true } },
    },
  });

  prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "CREATE",
      module: "cargue-gourmet",
      recordId: pedido.id,
      details: `${tipoOrden} ${data.orden} — tienda ${nombreTienda}${estibasInput.length > 0 ? ` (${estibasInput.length} estiba(s) escaneadas)` : ""}`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapRow(pedido) }, { status: 201 });
}
