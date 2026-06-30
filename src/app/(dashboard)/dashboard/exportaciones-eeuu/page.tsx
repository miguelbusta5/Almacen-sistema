"use client";

import ExportacionesModule from "@/components/exportaciones/ExportacionesModule";
import { PAISES_EXPORT } from "@/lib/exportaciones/paises";

export default function ExportacionesEeuuPage() {
  return <ExportacionesModule cfg={PAISES_EXPORT.eeuu} />;
}
