import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireCan("delete");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;

  await prisma.inspeccionPreoperacional.delete({ where: { id } }).catch(() => {});

  prisma.activityLog.create({
    data: { userId: actor.id, action: "DELETE", module: "preoperacional", recordId: id },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
