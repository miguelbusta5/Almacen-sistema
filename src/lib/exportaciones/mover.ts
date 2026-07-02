// SERVER-ONLY. Traslada registros de un módulo de Exportaciones (país) a otro,
// preservando todos sus datos. Solo ADMIN puede invocar esta acción (ver route.ts).
// Los 3 modelos tienen forma idéntica (delegate.ts), así que "mover" = copiar la
// fila al modelo destino + borrado lógico en el modelo origen.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { getExportDelegate } from "@/lib/exportaciones/delegate";
import { PAISES_EXPORT, type PaisExport } from "@/lib/exportaciones/paises";

const paisSchema = z.enum(["ecuador", "mexico", "eeuu"]);

const bodySchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
    origenPais: paisSchema,
    destinoPais: paisSchema,
    motivo: z.string().min(5),
  })
  .refine((d) => d.origenPais !== d.destinoPais, {
    message: "El país destino debe ser distinto al país origen",
    path: ["destinoPais"],
  });

export async function POST(req: NextRequest) {
  const actor = await requireRole(["ADMIN"]);
  if (actor instanceof NextResponse) return actor;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { ids, origenPais, destinoPais, motivo } = parsed.data;

  const origenCfg = PAISES_EXPORT[origenPais as PaisExport];
  const destinoCfg = PAISES_EXPORT[destinoPais as PaisExport];
  const origenDelegate = getExportDelegate(origenPais as PaisExport);
  const destinoDelegate = getExportDelegate(destinoPais as PaisExport);

  const registros = await Promise.all(
    ids.map((id) => origenDelegate.findUnique({ where: { id } })),
  );

  const motivoTexto = motivo.trim();
  const newIds: string[] = [];
  const notFound: string[] = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const record = registros[i] as {
      id: string;
      numeroCaja: string;
      plu: string;
      descripcion: string;
      unidadEmpaque: number;
      fecha: Date;
      horaInicio: Date;
      horaFinalizacion: Date | null;
      hayReguero: boolean;
      cantidadReguero: number | null;
      creadoPorId: string;
      deletedAt: Date | null;
    } | null;

    if (!record || record.deletedAt) {
      notFound.push(id);
      continue;
    }

    const [created] = await prisma.$transaction([
      destinoDelegate.create({
        data: {
          numeroCaja: record.numeroCaja,
          plu: record.plu,
          descripcion: record.descripcion,
          unidadEmpaque: record.unidadEmpaque,
          fecha: record.fecha,
          horaInicio: record.horaInicio,
          horaFinalizacion: record.horaFinalizacion,
          hayReguero: record.hayReguero,
          cantidadReguero: record.cantidadReguero,
          creadoPorId: record.creadoPorId,
          actualizadoPorId: actor.id,
          motivoCorreccion: motivoTexto,
        },
      }),
      origenDelegate.update({
        where: { id },
        data: { deletedAt: new Date(), actualizadoPorId: actor.id, motivoCorreccion: motivoTexto },
      }),
    ]);

    newIds.push(created.id);

    await prisma.activityLog.createMany({
      data: [
        {
          userId: actor.id,
          action: "MOVE",
          module: origenCfg.moduleKey,
          recordId: id,
          details: `Movido a Exportaciones ${destinoCfg.paisLabel}: ${motivoTexto}`,
        },
        {
          userId: actor.id,
          action: "MOVE",
          module: destinoCfg.moduleKey,
          recordId: created.id,
          details: `Recibido desde Exportaciones ${origenCfg.paisLabel}: ${motivoTexto}`,
        },
      ],
    }).catch(() => {});
  }

  if (newIds.length === 0) {
    return NextResponse.json({ error: "Ningún registro pudo moverse (no encontrado o ya borrado)" }, { status: 404 });
  }

  return NextResponse.json({ success: true, moved: newIds.length, newIds, notFound });
}
