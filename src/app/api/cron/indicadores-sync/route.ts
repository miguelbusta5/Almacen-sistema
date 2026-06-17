import { NextRequest, NextResponse } from "next/server";
import { syncIndicadoresFromSheets } from "@/lib/indicadores";

async function runCron(req: NextRequest) {
  const expected = process.env.INDICADORES_SYNC_SECRET ?? process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await syncIndicadoresFromSheets();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No fue posible sincronizar indicadores";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  return runCron(req);
}

export async function POST(req: NextRequest) {
  return runCron(req);
}
