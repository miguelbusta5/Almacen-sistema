import { makeStatsHandler } from "@/lib/exportaciones/handlersFactory";
import { PAISES_EXPORT } from "@/lib/exportaciones/paises";

export const { GET } = makeStatsHandler(PAISES_EXPORT.eeuu);
