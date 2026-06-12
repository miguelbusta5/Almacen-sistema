import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import {
  AREA_SOLICITANTE_OPTIONS,
  CIUDAD_OPTIONS,
  PUNTO_RECOGIDA_OPTIONS,
  TIPO_MERCANCIA_OPTIONS,
  TIPO_SERVICIO_OPTIONS,
  TIPO_VENTA_OPTIONS,
  VENTANA_ENTREGA_OPTIONS,
  VOLUMEN_OPTIONS,
  ZONA_OPTIONS,
  puedeCrearSolicitudTransporte,
} from "@/lib/solicitudesTransporte";

export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeCrearSolicitudTransporte(actor.role)) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  return NextResponse.json({
    success: true,
    data: {
      areas: AREA_SOLICITANTE_OPTIONS,
      ciudades: CIUDAD_OPTIONS,
      puntosRecogida: PUNTO_RECOGIDA_OPTIONS,
      tiposVenta: TIPO_VENTA_OPTIONS,
      zonas: ZONA_OPTIONS,
      volumenes: VOLUMEN_OPTIONS,
      tiposMercancia: TIPO_MERCANCIA_OPTIONS,
      ventanasEntrega: VENTANA_ENTREGA_OPTIONS,
      tiposServicio: TIPO_SERVICIO_OPTIONS,
    },
  });
}
