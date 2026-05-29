import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const [transporteRes, novedadesRes] = await Promise.all([
      fetch(`${API}/transporte`, { next: { revalidate: 60 } }),
      fetch(`${API}/novedades`, { next: { revalidate: 60 } }),
    ]);

    const transporteData = transporteRes.ok ? await transporteRes.json() : { data: [] };
    const novedadesData = novedadesRes.ok ? await novedadesRes.json() : { data: [] };

    const guardados = transporteData.data ?? [];
    const novedades = novedadesData.data ?? [];

    // Stats transporte
    const transporte = {
      total: guardados.length,
      pendientes: guardados.filter((g: any) => g.estado === "PENDIENTE DESPACHO").length,
      despachados: guardados.filter((g: any) => g.estado === "DESPACHADO").length,
      alertas: guardados.filter((g: any) => {
        if (g.estado === "DESPACHADO") return false;
        const m = (g.nota || "").match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (!m) return false;
        const entrega = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        const dias = Math.floor((new Date(entrega).getTime() - Date.now()) / 86400000);
        return dias <= 5;
      }).length,
    };

    // Stats muebles
    const muebles = {
      total: novedades.length,
      pendientes: novedades.filter((n: any) => n.estado === "PENDIENTE").length,
      enProceso: novedades.filter((n: any) => n.estado === "EN PROCESO").length,
      solucionados: novedades.filter((n: any) => n.estado === "SOLUCIONADO").length,
      impactoTotal: novedades.reduce((s: number, n: any) => s + Math.abs(n.costoIncidencia ?? 0), 0),
      plusUnicos: new Set(novedades.map((n: any) => n.plu)).size,
      fabricantes: new Set(novedades.map((n: any) => n.fabricante)).size,
    };

    return NextResponse.json({ success: true, transporte, muebles });
  } catch {
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 });
  }
}
