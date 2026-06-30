import { makeItemHandlers } from "@/lib/exportaciones/handlersFactory";
import { PAISES_EXPORT } from "@/lib/exportaciones/paises";

export const { PATCH, DELETE } = makeItemHandlers(PAISES_EXPORT.mexico);
