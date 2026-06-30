import { prisma } from "@/lib/prisma";
import { canSeeModule, getVisibleModules, type ModuleKey } from "@/lib/modulePermissions";
import { getModuleTheme } from "@/lib/moduleTheme";
import { getHomeActionsByRole } from "@/config/homeActions";
import type { SessionUser } from "@/lib/authz";
import type {
  ControlFlowStage,
  ControlLogisticoResumen,
  ControlModuleSignal,
  ControlPriority,
  ControlStatus,
} from "@/lib/controlLogistico/types";

function statusFrom(count: number, warningAt = 1, criticalAt = 5): ControlStatus {
  if (count >= criticalAt) return "critical";
  if (count >= warningAt) return "warning";
  return "ok";
}

function moduleSignal(key: ModuleKey, count: number | undefined, status: ControlStatus, href: string): ControlModuleSignal {
  const theme = getModuleTheme(key);
  return {
    key,
    label: theme.label,
    description: theme.description,
    count,
    status,
    href,
  };
}

export async function buildControlLogisticoResumen(actor: SessionUser): Promise<ControlLogisticoResumen> {
  const role = actor.role;
  const visibleModules = getVisibleModules(role);
  const see = (key: ModuleKey) => canSeeModule(role, key);

  const [
    novedadesPendientes,
    novedadesCriticas,
    guardadosPendientes,
    tiendaCreados,
    tiendaRechazados,
    tiendaNovedad,
    tiendaCedi,
    tiendaEnviados,
    pendientesGuardado,
    solicitudesPendientes,
    solicitudesAlertas,
    exportacionesEnCurso,
    integracionesPendientes,
    notifNoLeidas,
    preopBloqueadas,
    exportacionesMexicoEnCurso,
    exportacionesEeuuEnCurso,
  ] = await Promise.all([
    see("inventario") ? prisma.novedad.count({ where: { estado: "PENDIENTE" } }) : 0,
    see("inventario") ? prisma.novedad.count({
      where: {
        estado: "PENDIENTE",
        fecha: { lt: new Date(Date.now() - 30 * 86_400_000) },
      },
    }) : 0,
    see("transporte") ? prisma.transporteGuardado.count({ where: { estado: "PENDIENTE DESPACHO" } }) : 0,
    see("tienda") ? prisma.despachoTienda.count({ where: { estado: "CREADO_TIENDA" } }) : 0,
    see("tienda") ? prisma.despachoTienda.count({ where: { estado: "RECHAZADO" } }) : 0,
    see("tienda") ? prisma.despachoTienda.count({ where: { estado: "CON_NOVEDAD" } }) : 0,
    see("tienda") ? prisma.despachoTienda.count({ where: { estado: "ENTREGADO_CEDI" } }) : 0,
    see("tienda") ? prisma.despachoTienda.count({ where: { estado: "ENVIADO_CLIENTE" } }) : 0,
    see("transporte") ? prisma.guardadoPendienteTienda.count({
      where: {
        estado: "PENDIENTE",
        ...(role === "TRANSPORTE" ? { asignadoAId: actor.id } : {}),
      },
    }) : 0,
    see("solicitudes-transporte") ? prisma.solicitudTransporte.count({
      where: {
        estado: { in: ["PENDIENTE", "REENVIADA"] },
        ...(role === "SUPERVISOR_TRANSPORTE" || role === "GERENTE" || role === "ADMIN" ? {} : { creadoPorId: actor.id }),
      },
    }) : 0,
    see("solicitudes-transporte") ? prisma.solicitudTransporte.count({
      where: {
        semaforo: { in: ["VENCIDO", "ALERTA"] },
        ...(role === "SUPERVISOR_TRANSPORTE" || role === "GERENTE" || role === "ADMIN" ? {} : { creadoPorId: actor.id }),
      },
    }) : 0,
    see("exportaciones") ? prisma.etiquetadoExportacion.count({
      where: {
        deletedAt: null,
        horaFinalizacion: null,
        ...(role === "ETIQUETADO" ? { creadoPorId: actor.id } : {}),
      },
    }) : 0,
    see("integracion") ? prisma.integracionPedido.count({ where: { estado: { not: "COMPLETADA" } } }) : 0,
    see("mis-tareas") ? prisma.notificacion.count({ where: { userId: actor.id, leida: false } }) : 0,
    see("preoperacional") && role !== "TRANSPORTISTA"
      ? prisma.inspeccionPreoperacional.count({ where: { estado: "BLOQUEADA", vigente: true } })
      : 0,
    see("exportaciones-mexico") ? prisma.etiquetadoExportacionMexico.count({
      where: {
        deletedAt: null,
        horaFinalizacion: null,
        ...(role === "ETIQUETADO" ? { creadoPorId: actor.id } : {}),
      },
    }) : 0,
    see("exportaciones-eeuu") ? prisma.etiquetadoExportacionEeuu.count({
      where: {
        deletedAt: null,
        horaFinalizacion: null,
        ...(role === "ETIQUETADO" ? { creadoPorId: actor.id } : {}),
      },
    }) : 0,
  ]);

  const priorities: ControlPriority[] = [];

  if (see("tienda") && tiendaRechazados > 0) {
    priorities.push({
      id: "tienda-rechazados",
      moduleKey: "tienda",
      level: "critical",
      title: `${tiendaRechazados} despacho${tiendaRechazados === 1 ? "" : "s"} rechazado${tiendaRechazados === 1 ? "" : "s"}`,
      context: "Tienda debe corregir y re-enviar",
      href: "/dashboard/tienda",
    });
  }
  if (see("tienda") && tiendaNovedad > 0) {
    priorities.push({
      id: "tienda-novedad",
      moduleKey: "tienda",
      level: "warning",
      title: `${tiendaNovedad} despacho${tiendaNovedad === 1 ? "" : "s"} con novedad`,
      context: "Requiere seguimiento de transporte",
      href: "/dashboard/tienda",
    });
  }
  if (see("inventario") && novedadesCriticas > 0) {
    priorities.push({
      id: "inventario-criticas",
      moduleKey: "inventario",
      level: "critical",
      title: `${novedadesCriticas} novedad${novedadesCriticas === 1 ? "" : "es"} critica${novedadesCriticas === 1 ? "" : "s"}`,
      context: "Mas de 30 dias sin resolver",
      href: "/dashboard/inventario",
    });
  }
  if (see("transporte") && pendientesGuardado > 0) {
    priorities.push({
      id: "guardado-tienda",
      moduleKey: "transporte",
      level: "warning",
      title: `${pendientesGuardado} despacho${pendientesGuardado === 1 ? "" : "s"} pendiente${pendientesGuardado === 1 ? "" : "s"} por guardar`,
      context: role === "TRANSPORTE" ? "Asignado a tu usuario" : "Asignado a operarios de transporte",
      href: "/dashboard/transporte",
    });
  }
  if (see("solicitudes-transporte") && solicitudesAlertas > 0) {
    priorities.push({
      id: "solicitudes-transporte-alerta",
      moduleKey: "solicitudes-transporte",
      level: "warning",
      title: `${solicitudesAlertas} solicitud${solicitudesAlertas === 1 ? "" : "es"} en alerta`,
      context: "Promesa vencida o cercana",
      href: "/dashboard/solicitudes-transporte",
    });
  }
  if (see("integracion") && integracionesPendientes > 0) {
    priorities.push({
      id: "integracion-pendiente",
      moduleKey: "integracion",
      level: "info",
      title: `${integracionesPendientes} integracion${integracionesPendientes === 1 ? "" : "es"} pendiente${integracionesPendientes === 1 ? "" : "s"}`,
      context: "Picking coordinado OVDM/TSDM",
      href: "/dashboard/integracion",
    });
  }
  if (see("preoperacional") && preopBloqueadas > 0) {
    priorities.push({
      id: "preop-bloqueadas",
      moduleKey: "preoperacional",
      level: "critical",
      title: `${preopBloqueadas} inspeccion${preopBloqueadas === 1 ? "" : "es"} bloqueada${preopBloqueadas === 1 ? "" : "s"}`,
      context: "Vehiculos no aptos para operar",
      href: "/dashboard/preoperacional",
    });
  }

  const flow: ControlFlowStage[] = [
    ...(see("inventario") ? [{
      key: "inventario",
      label: "Inventario",
      value: novedadesPendientes,
      status: statusFrom(novedadesCriticas, 1, 3),
      href: "/dashboard/inventario",
    } satisfies ControlFlowStage] : []),
    ...(see("tienda") ? [{
      key: "tienda",
      label: "Tienda",
      value: tiendaCreados,
      status: statusFrom(tiendaRechazados + tiendaNovedad, 1, 5),
      href: "/dashboard/tienda",
    } satisfies ControlFlowStage] : []),
    ...(see("tienda") || see("transporte") ? [{
      key: "cedi",
      label: "CEDI",
      value: tiendaCedi,
      status: statusFrom(pendientesGuardado, 1, 5),
      href: see("tienda") ? "/dashboard/tienda" : "/dashboard/transporte",
    } satisfies ControlFlowStage] : []),
    ...(see("transporte") ? [{
      key: "guardados",
      label: "Guardados",
      value: guardadosPendientes + pendientesGuardado,
      status: statusFrom(guardadosPendientes + pendientesGuardado, 1, 10),
      href: "/dashboard/transporte",
    } satisfies ControlFlowStage] : []),
    ...(see("tienda") ? [{
      key: "cliente",
      label: "Cliente",
      value: tiendaEnviados,
      status: "ok" as ControlStatus,
      href: "/dashboard/tienda",
    } satisfies ControlFlowStage] : []),
  ];

  const modules: ControlModuleSignal[] = [
    ...(see("inventario") ? [moduleSignal("inventario", novedadesPendientes, statusFrom(novedadesCriticas, 1, 3), "/dashboard/inventario")] : []),
    ...(see("tienda") ? [moduleSignal("tienda", tiendaCreados + tiendaRechazados + tiendaNovedad, statusFrom(tiendaRechazados + tiendaNovedad, 1, 5), "/dashboard/tienda")] : []),
    ...(see("transporte") ? [moduleSignal("transporte", guardadosPendientes + pendientesGuardado, statusFrom(guardadosPendientes + pendientesGuardado, 1, 10), "/dashboard/transporte")] : []),
    ...(see("solicitudes-transporte") ? [moduleSignal("solicitudes-transporte", solicitudesPendientes, statusFrom(solicitudesAlertas, 1, 5), "/dashboard/solicitudes-transporte")] : []),
    ...(see("exportaciones") ? [moduleSignal("exportaciones", exportacionesEnCurso, statusFrom(exportacionesEnCurso, 1, 20), "/dashboard/exportaciones")] : []),
    ...(see("exportaciones-mexico") ? [moduleSignal("exportaciones-mexico", exportacionesMexicoEnCurso, statusFrom(exportacionesMexicoEnCurso, 1, 20), "/dashboard/exportaciones-mexico")] : []),
    ...(see("exportaciones-eeuu") ? [moduleSignal("exportaciones-eeuu", exportacionesEeuuEnCurso, statusFrom(exportacionesEeuuEnCurso, 1, 20), "/dashboard/exportaciones-eeuu")] : []),
    ...(see("preoperacional") ? [moduleSignal("preoperacional", preopBloqueadas, statusFrom(preopBloqueadas, 1, 2), "/dashboard/preoperacional")] : []),
    ...(see("integracion") ? [moduleSignal("integracion", integracionesPendientes, statusFrom(integracionesPendientes, 1, 8), "/dashboard/integracion")] : []),
    ...(see("usuarios") ? [moduleSignal("usuarios", undefined, "neutral", "/dashboard/usuarios")] : []),
    ...(see("auditoria") ? [moduleSignal("auditoria", undefined, "neutral", "/dashboard/auditoria")] : []),
    ...(see("centro-control") ? [moduleSignal("centro-control", undefined, "neutral", "/dashboard/centro-control")] : []),
    ...(see("mis-tareas") ? [moduleSignal("mis-tareas", notifNoLeidas, statusFrom(notifNoLeidas, 1, 10), "/dashboard/mis-tareas")] : []),
  ];

  const critical = priorities.filter((p) => p.level === "critical").length;
  const warning = priorities.filter((p) => p.level === "warning").length;
  const pending = novedadesPendientes + guardadosPendientes + tiendaCreados + tiendaNovedad + tiendaRechazados + pendientesGuardado + solicitudesPendientes + exportacionesEnCurso + exportacionesMexicoEnCurso + exportacionesEeuuEnCurso + integracionesPendientes + notifNoLeidas + preopBloqueadas;

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    user: { id: actor.id, name: actor.name, role },
    visibleModules,
    headline: {
      status: critical > 0 ? "critical" : warning > 0 ? "warning" : "ok",
      critical,
      pending,
      completedToday: tiendaEnviados,
    },
    priorities: priorities.slice(0, 8),
    flow,
    modules,
    actions: getHomeActionsByRole(role, 6).map((action) => ({
      id: action.id,
      label: action.title,
      href: action.href,
      moduleKey: action.moduleKey,
    })),
  };
}
