import { makeListCreateHandlers } from "@/lib/exportaciones/handlersFactory";
import { PAISES_EXPORT } from "@/lib/exportaciones/paises";

export const { GET, POST } = makeListCreateHandlers(PAISES_EXPORT.mexico);
