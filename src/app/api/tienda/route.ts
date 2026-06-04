import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { todayISO } from "@/lib/tienda";

const plinSchema = z.object({
  plu:        z.string().min(1).max(100),
  descripcion:z.string().max(255).nullable().optional(),
  unidades:   z.number().int().min(1),
});

const createSchema = z.object({
  centroCostos:              z.string().min(1).max(100),
  numeroDocumento:           z.string().min(1).max(100),
  consecutivo:               z.string().min(1).max(50),
  clienteNombre:             z.string().min(1).max(255),
  clienteDocumento:          z.string().max(50).nullable().optional(),
  clienteTelefono:           z.string().max(30).nullable().optional(),
  fechaCreacion:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(todayISO()),
  fechaEntregaComprometida:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  numeroCajas:               z.number().int().min(1).nullable().optional(),
  plines:                    z.array(plinSchema).optional(),
});

function mapRow(r: any): object {
  return {
    id:               r.id,
    centroCostos:     r.centroCostos,
    numeroDocumento:  r.numeroDocumento,
    consecutivo:      r.consecutivo,
    clienteNombre:    r.clienteNombre,
    clienteDocumento: r.clienteDocumento,
    clienteTelefono:  r.clienteTelefono,
    estado:           r.estado,
    fechaCreacion:    r.fechaCreacion instanceof Date ? r.fechaCreacion.toISOString().slice(0, 10) : r.fechaCreacion,
    fechaEntregaComprometida: r.fechaEntregaComprometida instanceof Date
      ? r.fechaEntregaComprometida.toISOString().slice(0, 10)
      : (r.fechaEntregaComprometida ?? null),
    numeroCajas:   r.numeroCajas ?? null,
    netsuiteId:    r.netsuiteId ?? null,
    // Timestamps
    asignadoRecogidaAt: r.asignadoRecogidaAt ? r.asignadoRecogidaAt.toISOString() : null,
    recibidoAt:         r.recibidoAt    ? r.recibidoAt.toISOString()    : null,
    entregadoCediAt:    r.entregadoCediAt ? r.entregadoCediAt.toISOString() : null,
    enRutaAt:           r.enRutaAt      ? r.enRutaAt.toISOString()      : null,
    despachadoAt:       r.despachadoAt  ? r.despachadoAt.toISOString()  : null,
    novedadAt:          r.novedadAt     ? r.novedadAt.toISOString()     : null,
    // Asignación
    conductorAsignadoId:    r.conductorAsignadoId ?? null,
    conductorAsignadoNombre: r.conductorAsignado?.nombre ?? null,
    vehiculoAsignadoId:     r.vehiculoAsignadoId ?? null,
    vehiculoAsignadoPlaca:  r.vehiculoAsignado?.placa ?? null,
    asignadoPorId:          r.asignadoPorId ?? null,
    rutaId:                 r.rutaId ?? null,
    // Dirección
    direccionEntrega: r.direccionEntrega ?? null,
    barrio:           r.barrio ?? null,
    ciudad:           r.ciudad ?? null,
    departamento:     r.departamento ?? null,
    latitud:          r.latitud ?? null,
    longitud:         r.longitud ?? null,
    contactoEntrega:  r.contactoEntrega ?? null,
    telefonoEntrega:  r.telefonoEntrega ?? null,
    // Evidencias
    fotoRecogidaUrl:    r.fotoRecogidaUrl ?? null,
    fotoCediUrl:        r.fotoCediUrl ?? null,
    recibidoPorCedi:    r.recibidoPorCedi ?? null,
    firmaUrl:           r.firmaUrl ?? null,
    evidenciaUrl:       r.evidenciaUrl ?? null,
    observacionEntrega: r.observacionEntrega ?? null,
    fechaEntregaReal:   r.fechaEntregaReal  ? r.fechaEntregaReal.toISOString()  : null,
    fechaGpsEntrega:    r.fechaGpsEntrega   ? r.fechaGpsEntrega.toISOString()   : null,
    latitudEntrega:     r.latitudEntrega  ?? null,
    longitudEntrega:    r.longitudEntrega ?? null,
    novedad:            r.novedad ?? null,
    creadoPorId:        r.creadoPorId,
    creadoPorNombre:    r.creadoPor?.name ?? null,
    createdAt:          r.createdAt.toISOString(),
    updatedAt:          r.updatedAt.toISOString(),
    plines:             r.plines ?? [],
  };
}

// GET /api/tienda
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const page     = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const pageSize = Math.min(500, Math.max(20, parseInt(sp.get("pageSize") ?? "200") || 200));
  const estado   = sp.get("estado") ?? "";
  const cc       = sp.get("centroCostos") ?? "";
  const q        = sp.get("q")?.trim() ?? "";

  const where: any = {};
  if (estado) where.estado = estado;
  if (cc) where.centroCostos = { contains: cc, mode: "insensitive" };
  if (q) where.OR = [
    { numeroDocumento: { contains: q, mode: "insensitive" } },
    { clienteNombre:   { contains: q, mode: "insensitive" } },
    { consecutivo:     { contains: q, mode: "insensitive" } },
  ];

  const [rows, total] = await prisma.$transaction([
    prisma.despachoTienda.findMany({
      where,
      include: { creadoPor: { select: { id: true, name: true } }, plines: true },
      orderBy: [{ fechaCreacion: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.despachoTienda.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: rows.map(mapRow), total, page, pageSize });
}

// POST /api/tienda
export async function POST(req: NextRequest) {
  const actor = await requireCan("create");
  if (actor instanceof NextResponse) return actor;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const d = parsed.data;

  const row = await prisma.$transaction(async (tx) => {
    const despacho = await tx.despachoTienda.create({
      data: {
        centroCostos:            d.centroCostos,
        numeroDocumento:         d.numeroDocumento,
        consecutivo:             d.consecutivo,
        clienteNombre:           d.clienteNombre,
        clienteDocumento:        d.clienteDocumento ?? null,
        clienteTelefono:         d.clienteTelefono ?? null,
        fechaCreacion:           new Date(d.fechaCreacion + "T00:00:00"),
        fechaEntregaComprometida:d.fechaEntregaComprometida ? new Date(d.fechaEntregaComprometida + "T00:00:00") : null,
        numeroCajas:             d.numeroCajas ?? null,
        creadoPorId:             actor.id,
      },
      include: { creadoPor: { select: { id: true, name: true } }, plines: true },
    });

    if (d.plines && d.plines.length > 0) {
      await tx.plinDespacho.createMany({
        data: d.plines.map((p) => ({
          despachoId:  despacho.id,
          plu:         p.plu,
          descripcion: p.descripcion ?? null,
          unidades:    p.unidades,
        })),
      });
    }

    return tx.despachoTienda.findUnique({
      where: { id: despacho.id },
      include: { creadoPor: { select: { id: true, name: true } }, plines: true },
    });
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "CREATE", module: "tienda", recordId: row!.id, details: `${d.numeroDocumento} · ${d.clienteNombre} · ${d.centroCostos}` },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapRow(row) }, { status: 201 });
}
