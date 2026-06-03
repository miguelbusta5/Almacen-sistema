import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// GET /api/transporte/sin-contacto
// Guardados activos que no tienen ningún registro en contactos_guardado
export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  // Obtener todos los client_ids que tienen al menos un contacto
  const conContacto = await prisma.contactoGuardado.findMany({
    select: { guardadoClientId: true },
    distinct: ["guardadoClientId"],
  });
  const idsConContacto = new Set(conContacto.map((c) => c.guardadoClientId));

  // Guardados activos sin ningún contacto registrado
  const activos = await prisma.transporteGuardado.findMany({
    where: { estado: "PENDIENTE DESPACHO" },
    select: { client_id: true, documento: true, fecha: true, ubicacion: true },
    orderBy: { fecha: "asc" },
  });

  const sinContacto = activos.filter((g) => !idsConContacto.has(g.client_id));

  return NextResponse.json({
    success: true,
    count: sinContacto.length,
    items: sinContacto.slice(0, 20).map((g) => ({
      clientId: g.client_id,
      documento: g.documento,
      fecha: g.fecha instanceof Date ? g.fecha.toISOString().slice(0, 10) : String(g.fecha),
    })),
  });
}
