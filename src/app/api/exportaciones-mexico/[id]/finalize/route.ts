import { makeFinalizeHandler } from "@/lib/exportaciones/handlersFactory";
import { PAISES_EXPORT } from "@/lib/exportaciones/paises";

export const { POST } = makeFinalizeHandler(PAISES_EXPORT.mexico);
