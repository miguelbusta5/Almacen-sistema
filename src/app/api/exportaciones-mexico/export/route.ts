import { makeExportHandler } from "@/lib/exportaciones/handlersFactory";
import { PAISES_EXPORT } from "@/lib/exportaciones/paises";

export const { GET } = makeExportHandler(PAISES_EXPORT.mexico);
