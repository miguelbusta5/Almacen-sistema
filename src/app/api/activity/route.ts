import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// GET /api/activity — registro de auditoría (solo ADMIN)
// Query params: module, action, userId, from (YYYY-MM-DD), to (YYYY-MM-DD), q, page, pageSize
export async function GET(req: NextRequest) {
  const actor = await requireRole(["ADMIN"]);
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const module = sp.get("module") || undefined;
  const action = sp.get("action") || undefined;
  const userId = sp.get("userId") || undefined;
  const from = sp.get("from") || undefined;
  const to = sp.get("to") || undefined;
  const q = (sp.get("q") || "").trim();
  const exportCsv = sp.get("export") === "csv";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(10, parseInt(sp.get("pageSize") || "25", 10) || 25));

  const where: Prisma.ActivityLogWhereInput = {};
  if (module) where.module = module;
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from + "T00:00:00");
    if (to) where.createdAt.lte = new Date(to + "T23:59:59.999");
  }
  if (q) {
    where.OR = [
      { details: { contains: q, mode: "insensitive" } },
      { recordId: { contains: q, mode: "insensitive" } },
    ];
  }

  if (exportCsv) {
    const allRows = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const ACTION_LABEL: Record<string, string> = { CREATE: "Creó", UPDATE: "Editó", DELETE: "Eliminó" };
    const MODULE_LABEL: Record<string, string> = { muebles: "Muebles", transporte: "Transporte", users: "Usuarios" };
    const csvRows = [
      ["Fecha y hora", "Usuario", "Email", "Acción", "Módulo", "Registro", "Detalle"],
      ...allRows.map((r) => [
        r.createdAt.toLocaleString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        r.user?.name ?? "",
        r.user?.email ?? "",
        ACTION_LABEL[r.action] ?? r.action,
        MODULE_LABEL[r.module] ?? r.module,
        r.recordId,
        r.details ?? "",
      ]),
    ];
    const csv = "﻿" + csvRows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const [rows, total, users] = await prisma.$transaction([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.activityLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
  ]);

  const data = rows.map((r) => ({
    id: r.id,
    action: r.action,
    module: r.module,
    recordId: r.recordId,
    details: r.details,
    createdAt: r.createdAt.toISOString(),
    user: r.user ? { id: r.user.id, name: r.user.name, email: r.user.email } : null,
  }));

  return NextResponse.json({
    success: true,
    data,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    users,
  });
}
