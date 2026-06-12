import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { buildControlLogisticoResumen } from "@/lib/controlLogistico/resumen";

export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const resumen = await buildControlLogisticoResumen(actor);
  return NextResponse.json(resumen);
}

