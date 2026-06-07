import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { put } from "@vercel/blob";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const form = await req.formData();
  const file = form.get("foto") as File | null;
  if (!file) return NextResponse.json({ error: "Sin archivo" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Solo imagenes" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Maximo 5 MB por foto" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `uploads/${Date.now()}-${actor.id.slice(-6)}.${ext}`;

  const blob = await put(filename, file, { access: "public" });
  return NextResponse.json({ success: true, url: blob.url });
}
