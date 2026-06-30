// SERVER-ONLY. Factories de handlers Next para los módulos de exportación.
// La lógica es idéntica a las rutas originales de /api/exportaciones, pero
// parametrizada por país (delegate de Prisma + module key para ActivityLog).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { workbookBuffer } from "@/lib/excel";
import {
  calcularDuracionMinutos,
  formatDateOnly,
  normalizePlu,
  puedeGestionarExportaciones,
  puedeUsarExportaciones,
  todayBogota,
  validarCapturaExportacion,
} from "@/lib/exportaciones";
import { getExportDelegate } from "@/lib/exportaciones/delegate";
import { mapExportacion } from "@/lib/exportaciones/map";
import type { PaisConfig } from "@/lib/exportaciones/paises";

const INCLUDE = {
  creadoPor: { select: { name: true } },
  actualizadoPor: { select: { name: true } },
} as const;

// ── GET (lista) + POST (crear) ────────────────────────────
export function makeListCreateHandlers(cfg: PaisConfig) {
  const delegate = getExportDelegate(cfg.pais);

  const createSchema = z.object({
    numeroCaja:    z.string().min(1).max(100),
    plu:           z.string().min(1).max(100),
    unidadEmpaque: z.number().int().min(1),
  });

  async function GET(req: NextRequest) {
    const actor = await requireAuth();
    if (actor instanceof NextResponse) return actor;
    if (!puedeUsarExportaciones(actor.role)) {
      return NextResponse.json({ error: "Sin acceso a Exportaciones" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const fecha = url.searchParams.get("fecha")?.trim();
    const usuarioId = url.searchParams.get("usuarioId")?.trim();
    const estado = url.searchParams.get("estado")?.trim();
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || 40)));
    const isGestor = puedeGestionarExportaciones(actor.role);

    const where: Prisma.EtiquetadoExportacionWhereInput = {
      deletedAt: null,
      ...(isGestor ? {} : { creadoPorId: actor.id }),
      ...(isGestor && usuarioId ? { creadoPorId: usuarioId } : {}),
      ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
      ...(estado === "en-curso" ? { horaFinalizacion: null } : {}),
      ...(estado === "finalizado" ? { horaFinalizacion: { not: null } } : {}),
      ...(q ? {
        OR: [
          { numeroCaja: { contains: q, mode: "insensitive" } },
          { plu: { contains: q, mode: "insensitive" } },
          { descripcion: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    };

    const [items, total] = await Promise.all([
      delegate.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ horaInicio: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      delegate.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: items.map(mapExportacion), total, page, pageSize });
  }

  async function POST(req: NextRequest) {
    const actor = await requireAuth();
    if (actor instanceof NextResponse) return actor;
    if (!puedeUsarExportaciones(actor.role)) {
      return NextResponse.json({ error: "Sin acceso a Exportaciones" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const validation = validarCapturaExportacion(parsed.data);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });

    const plu = normalizePlu(parsed.data.plu);
    const producto = await prisma.productoMaestro.findUnique({
      where: { plu },
      select: { descripcion: true },
    });
    if (!producto?.descripcion?.trim()) {
      return NextResponse.json({ error: "PLU no encontrado en maestro" }, { status: 400 });
    }
    const descripcion = producto.descripcion.trim();

    const now = new Date();
    // Auto-finaliza el registro abierto del usuario y crea el nuevo en una sola
    // transacción (forma de array: el create no depende del resultado del updateMany).
    const [, created] = await prisma.$transaction([
      delegate.updateMany({
        where: { creadoPorId: actor.id, horaFinalizacion: null, deletedAt: null },
        data: { horaFinalizacion: now },
      }),
      delegate.create({
        data: {
          numeroCaja:    parsed.data.numeroCaja.trim(),
          plu,
          descripcion,
          unidadEmpaque: parsed.data.unidadEmpaque,
          fecha: todayBogota(now),
          horaInicio: now,
          creadoPorId: actor.id,
        },
        include: INCLUDE,
      }),
    ]);

    await prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: "CREATE",
        module: cfg.moduleKey,
        recordId: created.id,
        details: `Caja ${created.numeroCaja} PLU ${created.plu}`,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: mapExportacion(created) }, { status: 201 });
  }

  return { GET, POST };
}

// ── PATCH + DELETE (por id) ───────────────────────────────
export function makeItemHandlers(cfg: PaisConfig) {
  const delegate = getExportDelegate(cfg.pais);

  const patchSchema = z.object({
    numeroCaja:       z.string().min(1).max(100).optional(),
    plu:              z.string().min(1).max(100).optional(),
    unidadEmpaque:    z.number().int().min(1).optional(),
    horaInicio:       z.string().datetime().optional(),
    horaFinalizacion: z.string().datetime().optional().nullable(),
    motivoCorreccion: z.string().min(5).optional(),
  });

  async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await requireAuth();
    if (actor instanceof NextResponse) return actor;
    if (!puedeUsarExportaciones(actor.role)) {
      return NextResponse.json({ error: "Sin acceso a Exportaciones" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const d = parsed.data;

    const current = await delegate.findUnique({
      where: { id },
      select: { deletedAt: true, creadoPorId: true },
    });
    if (!current || current.deletedAt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const isGestor = puedeGestionarExportaciones(actor.role);
    const isOwner = current.creadoPorId === actor.id;
    if (!isGestor && !isOwner) {
      return NextResponse.json({ error: "Solo puedes editar tus propios registros" }, { status: 403 });
    }

    const cambiaHoras = d.horaInicio !== undefined || d.horaFinalizacion !== undefined;
    if (cambiaHoras && !isGestor) {
      return NextResponse.json({ error: "Solo gestores pueden modificar las horas" }, { status: 403 });
    }
    if (cambiaHoras && !d.motivoCorreccion?.trim()) {
      return NextResponse.json({ error: "Motivo de correccion obligatorio para modificar horas" }, { status: 400 });
    }

    const data: Prisma.EtiquetadoExportacionUncheckedUpdateInput = {
      actualizadoPorId: actor.id,
      ...(d.numeroCaja !== undefined && { numeroCaja: d.numeroCaja.trim() }),
      ...(d.unidadEmpaque !== undefined && { unidadEmpaque: d.unidadEmpaque }),
      ...(d.horaInicio !== undefined && { horaInicio: new Date(d.horaInicio) }),
      ...(d.horaFinalizacion !== undefined && { horaFinalizacion: d.horaFinalizacion ? new Date(d.horaFinalizacion) : null }),
      ...(d.motivoCorreccion !== undefined && { motivoCorreccion: d.motivoCorreccion.trim() }),
    };

    if (d.plu !== undefined) {
      const plu = normalizePlu(d.plu);
      const producto = await prisma.productoMaestro.findUnique({ where: { plu }, select: { descripcion: true } });
      if (!producto?.descripcion?.trim()) {
        return NextResponse.json({ error: "PLU no encontrado en maestro" }, { status: 400 });
      }
      data.plu = plu;
      data.descripcion = producto.descripcion.trim();
    }

    const row = await delegate.update({ where: { id }, data, include: INCLUDE });

    await prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: "UPDATE",
        module: cfg.moduleKey,
        recordId: id,
        details: d.motivoCorreccion ?? "Correccion de registro exportaciones",
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: mapExportacion(row) });
  }

  async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await requireAuth();
    if (actor instanceof NextResponse) return actor;
    if (!puedeGestionarExportaciones(actor.role)) {
      return NextResponse.json({ error: "Solo gestion puede eliminar Exportaciones" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.motivoCorreccion === "string" && body.motivoCorreccion.trim()
      ? body.motivoCorreccion.trim()
      : "Borrado logico";

    const current = await delegate.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!current || current.deletedAt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const row = await delegate.update({
      where: { id },
      data: { deletedAt: new Date(), actualizadoPorId: actor.id, motivoCorreccion: reason },
      include: INCLUDE,
    });

    await prisma.activityLog.create({
      data: { userId: actor.id, action: "DELETE", module: cfg.moduleKey, recordId: id, details: reason },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: mapExportacion(row) });
  }

  return { PATCH, DELETE };
}

// ── POST finalize ─────────────────────────────────────────
export function makeFinalizeHandler(cfg: PaisConfig) {
  const delegate = getExportDelegate(cfg.pais);

  async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await requireAuth();
    if (actor instanceof NextResponse) return actor;
    if (!puedeUsarExportaciones(actor.role)) {
      return NextResponse.json({ error: "Sin acceso a Exportaciones" }, { status: 403 });
    }

    const { id } = await params;

    const record = await delegate.findUnique({
      where: { id },
      select: { creadoPorId: true, horaFinalizacion: true, deletedAt: true },
    });

    if (!record || record.deletedAt) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    if (record.creadoPorId !== actor.id) {
      return NextResponse.json({ error: "Solo puedes finalizar tus propios registros" }, { status: 403 });
    }
    if (record.horaFinalizacion) {
      return NextResponse.json({ error: "El registro ya está finalizado" }, { status: 409 });
    }

    const updated = await delegate.update({
      where: { id },
      data: { horaFinalizacion: new Date(), actualizadoPorId: actor.id },
      include: INCLUDE,
    });

    await prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: "UPDATE",
        module: cfg.moduleKey,
        recordId: id,
        details: "Rotulación finalizada manualmente",
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: mapExportacion(updated) });
  }

  return { POST };
}

// ── GET operarios ─────────────────────────────────────────
export function makeOperariosHandler(cfg: PaisConfig) {
  const delegate = getExportDelegate(cfg.pais);

  async function GET() {
    const actor = await requireAuth();
    if (actor instanceof NextResponse) return actor;
    if (!puedeGestionarExportaciones(actor.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const rows = await delegate.findMany({
      where: { deletedAt: null },
      distinct: ["creadoPorId"],
      select: { creadoPorId: true, creadoPor: { select: { name: true } } },
    });

    const data = rows
      .map((r) => ({ id: r.creadoPorId, nombre: r.creadoPor?.name ?? "Usuario" }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    return NextResponse.json({ success: true, data });
  }

  return { GET };
}

// ── GET stats (productividad) ─────────────────────────────
export function makeStatsHandler(cfg: PaisConfig) {
  const delegate = getExportDelegate(cfg.pais);

  async function GET(req: NextRequest) {
    const actor = await requireAuth();
    if (actor instanceof NextResponse) return actor;
    if (!puedeGestionarExportaciones(actor.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const parseDay = (value: string | null): Date | null => {
      if (!value) return null;
      const d = new Date(`${value}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const fechaParam = searchParams.get("fecha");
    const today = todayBogota();
    let desde = parseDay(searchParams.get("desde")) ?? parseDay(fechaParam) ?? today;
    let hasta = parseDay(searchParams.get("hasta")) ?? parseDay(fechaParam) ?? today;
    if (desde.getTime() > hasta.getTime()) [desde, hasta] = [hasta, desde];

    const registros = await delegate.findMany({
      where: { fecha: { gte: desde, lte: hasta }, deletedAt: null },
      select: {
        plu: true,
        unidadEmpaque: true,
        horaInicio: true,
        horaFinalizacion: true,
        creadoPorId: true,
        creadoPor: { select: { name: true } },
      },
    });

    const byUser = new Map<string, {
      nombre: string;
      cajas: number;
      plusSet: Set<string>;
      duracionTotal: number;
      finalizadas: number;
      totalUnidades: number;
    }>();

    for (const r of registros) {
      if (!byUser.has(r.creadoPorId)) {
        byUser.set(r.creadoPorId, {
          nombre: r.creadoPor.name ?? "Usuario",
          cajas: 0,
          plusSet: new Set(),
          duracionTotal: 0,
          finalizadas: 0,
          totalUnidades: 0,
        });
      }
      const u = byUser.get(r.creadoPorId)!;
      u.cajas++;
      u.plusSet.add(r.plu);
      u.totalUnidades += Math.round(r.unidadEmpaque);
      if (r.horaFinalizacion) {
        u.finalizadas++;
        const min = calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion);
        if (min) u.duracionTotal += min;
      }
    }

    const data = Array.from(byUser.entries())
      .map(([id, u]) => ({
        id,
        nombre: u.nombre,
        cajas: u.cajas,
        plusDistintos: u.plusSet.size,
        totalUnidades: Math.round(u.totalUnidades),
        finalizadas: u.finalizadas,
        duracionTotalMin: u.duracionTotal,
        promedioPorCajaMin:
          u.finalizadas > 0
            ? Math.round((u.duracionTotal / u.finalizadas) * 10) / 10
            : null,
      }))
      .sort((a, b) => b.cajas - a.cajas);

    const rango = {
      desde: desde.toISOString().slice(0, 10),
      hasta: hasta.toISOString().slice(0, 10),
    };

    return NextResponse.json({ success: true, data, rango });
  }

  return { GET };
}

// ── GET export (Excel con columna País destino) ───────────
export function makeExportHandler(cfg: PaisConfig) {
  const delegate = getExportDelegate(cfg.pais);

  const fmtHora = (d: Date): string =>
    new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }).format(d);

  async function GET(req: NextRequest) {
    const actor = await requireAuth();
    if (actor instanceof NextResponse) return actor;
    if (!puedeGestionarExportaciones(actor.role)) {
      return NextResponse.json({ error: "Sin permiso para exportar" }, { status: 403 });
    }

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const fecha = url.searchParams.get("fecha")?.trim();
    const usuarioId = url.searchParams.get("usuarioId")?.trim();
    const estado = url.searchParams.get("estado")?.trim();

    const where: Prisma.EtiquetadoExportacionWhereInput = {
      deletedAt: null,
      ...(usuarioId ? { creadoPorId: usuarioId } : {}),
      ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
      ...(estado === "en-curso" ? { horaFinalizacion: null } : {}),
      ...(estado === "finalizado" ? { horaFinalizacion: { not: null } } : {}),
      ...(q ? {
        OR: [
          { numeroCaja: { contains: q, mode: "insensitive" } },
          { plu: { contains: q, mode: "insensitive" } },
          { descripcion: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    };

    const registros = await delegate.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ horaInicio: "desc" }],
      take: 5000,
    });

    const headers = [
      "País destino", "Fecha", "N° Caja", "PLU", "Descripción", "Unidad empaque",
      "Hora inicio", "Hora finalización", "Duración (min)", "Estado",
      "Reguero", "Cantidad reguero", "Motivo corrección", "Creado por", "Actualizado por",
    ];

    const rows: (string | number | null)[][] = registros.map((r) => [
      cfg.paisLabel,
      formatDateOnly(r.fecha) ?? "",
      r.numeroCaja,
      r.plu,
      r.descripcion,
      r.unidadEmpaque,
      fmtHora(r.horaInicio),
      r.horaFinalizacion ? fmtHora(r.horaFinalizacion) : "",
      calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion) ?? "",
      r.horaFinalizacion ? "Finalizado" : "En curso",
      r.hayReguero ? "Sí" : "No",
      r.cantidadReguero ?? "",
      r.motivoCorreccion ?? "",
      r.creadoPor?.name ?? "",
      r.actualizadoPor?.name ?? "",
    ]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Exportaciones ${cfg.paisLabel}`);
    ws.addRows([headers, ...rows]);
    ws.columns = [16, 12, 14, 12, 32, 14, 18, 18, 14, 12, 9, 14, 28, 22, 22].map((width) => ({ width }));

    const buf = await workbookBuffer(wb);
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="exportaciones-${cfg.pais}-${today}.xlsx"`,
      },
    });
  }

  return { GET };
}
