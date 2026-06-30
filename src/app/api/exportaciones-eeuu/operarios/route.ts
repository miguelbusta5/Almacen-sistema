import { makeOperariosHandler } from "@/lib/exportaciones/handlersFactory";
import { PAISES_EXPORT } from "@/lib/exportaciones/paises";

export const { GET } = makeOperariosHandler(PAISES_EXPORT.eeuu);
