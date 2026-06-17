import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { syncIndicadoresFromSheets } from "@/lib/indicadores";

export async function POST() {
  const actor = await requireRole(["ADMIN", "GERENTE"]);
  if (actor instanceof NextResponse) return actor;

  try {
    const result = await syncIndicadoresFromSheets(actor.id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible sincronizar indicadores";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
