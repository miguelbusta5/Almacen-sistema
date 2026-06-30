"use client";

import ExportacionesModule from "@/components/exportaciones/ExportacionesModule";
import { PAISES_EXPORT } from "@/lib/exportaciones/paises";

export default function ExportacionesMexicoPage() {
  return <ExportacionesModule cfg={PAISES_EXPORT.mexico} />;
}
