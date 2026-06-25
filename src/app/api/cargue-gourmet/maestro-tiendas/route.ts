import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMIN", "GERENTE", "OPERACIONES_GOURMET", "TRANSPORTE", "SUPERVISOR_TRANSPORTE"] as const;

const MAX_RESULTS = 50;

function mapRow(r: { codigo: string; tienda: string; ciudad: string; activo: boolean }) {
  return { codigo: r.codigo, tienda: r.tienda, ciudad: r.ciudad, activo: r.activo };
}

// GET /api/cargue-gourmet/maestro-tiendas
export async function GET(req: NextRequest) {
  const actor = await requireRole([...ALLOWED_ROLES]);
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const codigo = sp.get("codigo")?.trim();
  const q = sp.get("q")?.trim();
  const includeInactive = sp.get("includeInactive") === "1" && ["ADMIN", "GERENTE"].includes(actor.role);

  const where: Record<string, unknown> = includeInactive ? {} : { activo: true };

  if (codigo) {
    where.codigo = codigo;
  } else if (q) {
    where.OR = [
      { codigo: { contains: q, mode: "insensitive" } },
      { tienda: { contains: q, mode: "insensitive" } },
      { ciudad: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.maestroTiendaGourmet.findMany({
    where,
    orderBy: { tienda: "asc" },
    take: MAX_RESULTS,
  });

  return NextResponse.json({ success: true, data: rows.map(mapRow) });
}
