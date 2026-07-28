import { reporteHandler } from '../../utils/exportacionesReporte'

// Un solo endpoint para los tres países: el reporte es consolidado, no por módulo
// (mismo criterio que mover.post.ts, que también vive solo bajo /exportaciones).
export default reporteHandler
