import { after } from "next/server";
import { EstadoEntrega, TipoAlerta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularVenceUso } from "@/lib/fechas";
import { registrarAlerta, verificarStockBajo } from "@/features/alertas/service";
import { descontarStockFEFO } from "@/features/inventario/stock";
import { ESTADOS_EN_USO } from "./estados";
import { dispensacionSchema } from "./schemas";
import { obtenerAsignacionActual, obtenerEppRequerido } from "./queries";
import type {
  CodigoRechazo,
  EntregaCreada,
  EppBloqueado,
  EppSinStock,
  ResultadoDispensacion,
} from "./types";

function rechazo(codigo: CodigoRechazo, mensaje: string, extra?: Partial<ResultadoDispensacion>) {
  return { ok: false, codigo, mensaje, ...extra } as ResultadoDispensacion;
}

type EntradaDispensacion = {
  rfid: string;
  /** Área física donde está el operario (trazabilidad de ubicación). */
  areaId: string;
  /** Estación concreta que dispensa. Si se omite, se usa la primera estación activa del área. */
  estacionId?: string;
};

/**
 * Flujo completo de dispensación al pasar la tarjeta RFID en una estación.
 * Lo usan la Server Action del kiosco y el endpoint de la ESP32.
 */
export async function ejecutarDispensacion({
  rfid,
  areaId,
  estacionId,
}: EntradaDispensacion): Promise<ResultadoDispensacion> {
  const input = dispensacionSchema.safeParse({ rfid, areaId });
  if (!input.success) {
    return rechazo("DATOS_INVALIDOS", input.error.issues.map((i) => i.message).join(", "));
  }

  try {
    // 1. Operario y ubicación
    const [operario, area] = await Promise.all([
      prisma.operario.findUnique({ where: { rfid: input.data.rfid }, include: { cargo: true } }),
      prisma.area.findUnique({
        where: { id: input.data.areaId },
        include: {
          estaciones: {
            where: { activa: true, ...(estacionId && { id: estacionId }) },
            orderBy: { codigo: "asc" },
            take: 1,
          },
        },
      }),
    ]);

    if (!operario) return rechazo("OPERARIO_NO_ENCONTRADO", "Tarjeta no registrada.");
    if (!operario.activo) return rechazo("OPERARIO_INACTIVO", `${operario.nombre} está inactivo.`);
    if (!area) return rechazo("AREA_NO_ENCONTRADA", "Área no registrada.");
    const estacion = area.estaciones[0];
    if (!estacion) {
      return rechazo("ESTACION_NO_ENCONTRADA", `No hay estación activa${estacionId ? " con ese id" : ""} en ${area.nombre}.`);
    }

    // 2. Turno/tarea actual y reglas de EPP
    const asignacion = await obtenerAsignacionActual(operario.id);
    const requeridos = await obtenerEppRequerido(operario.cargoId, asignacion?.tareaId ?? null);
    if (requeridos.length === 0) {
      return rechazo("SIN_EPP_ASIGNADO", "No hay EPP configurado para tu cargo/tarea de hoy.");
    }

    // 3-5. Validación de vida útil + descuento de stock + registro, todo atómico.
    const resultado = await prisma.$transaction(async (tx) => {
      // Serializa dispensaciones del mismo operario (doble tap en el lector, dos estaciones a la vez).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${operario.id}))`;

      const ahora = new Date();
      const vigentes = await tx.entrega.findMany({
        where: {
          operarioId: operario.id,
          eppId: { in: requeridos.map((r) => r.eppId) },
          estado: { in: ESTADOS_EN_USO },
          venceUso: { gt: ahora },
        },
        orderBy: { venceUso: "desc" },
        distinct: ["eppId"],
        select: { eppId: true, venceUso: true },
      });
      const vigentePorEpp = new Map(vigentes.map((v) => [v.eppId, v.venceUso]));

      const bloqueados: EppBloqueado[] = [];
      const sinStock: EppSinStock[] = [];
      const entregas: EntregaCreada[] = [];
      const inventarioIds: string[] = [];

      for (const epp of requeridos) {
        const vigenteHasta = vigentePorEpp.get(epp.eppId);
        if (vigenteHasta) {
          bloqueados.push({ eppId: epp.eppId, nombre: epp.nombre, motivo: "RETIRO_EXCESIVO", vigenteHasta: vigenteHasta.toISOString() });
          continue;
        }

        const inventario = await tx.inventario.findUnique({
          where: { estacionId_eppId: { estacionId: estacion.id, eppId: epp.eppId } },
          select: { id: true, slotMotor: true },
        });
        const lote = inventario && (await descontarStockFEFO(tx, inventario.id, epp.cantidad));
        if (!inventario || !lote) {
          sinStock.push({ eppId: epp.eppId, nombre: epp.nombre });
          continue;
        }
        inventarioIds.push(inventario.id);

        const costoTotal = Math.round(epp.costoUnitario * epp.cantidad * 100) / 100;
        const entrega = await tx.entrega.create({
          data: {
            operarioId: operario.id,
            eppId: epp.eppId,
            loteId: lote.id,
            estacionId: estacion.id,
            areaId: area.id,
            asignacionId: asignacion?.id,
            cantidad: epp.cantidad,
            costoUnitario: epp.costoUnitario,
            costoTotal,
            estado: EstadoEntrega.PENDIENTE_VERIFICACION_CAMARA,
            fecha: ahora,
            venceUso: calcularVenceUso(ahora, epp.vidaUtilDias),
          },
        });

        entregas.push({
          entregaId: entrega.id,
          eppId: epp.eppId,
          codigo: epp.codigo,
          nombre: epp.nombre,
          tipo: epp.tipo,
          cantidad: epp.cantidad,
          slotMotor: inventario.slotMotor,
          loteCodigo: lote.codigo,
          costoTotal,
        });
      }

      return { bloqueados, sinStock, entregas, inventarioIds };
    });

    const { bloqueados, sinStock, entregas, inventarioIds } = resultado;

    // Alertas después de responder: el kiosco no espera a Telegram.
    if (inventarioIds.length > 0) after(() => verificarStockBajo(inventarioIds));

    if (entregas.length === 0) {
      if (bloqueados.length > 0) {
        // No hay nada nuevo que entregar: el operario intenta un retiro extra.
        const listaEpp = bloqueados.map((b) => b.nombre).join(", ");
        after(() =>
          registrarAlerta({
            tipo: TipoAlerta.RETIRO_EXCESIVO,
            mensaje: `⚠️ ALERTA: El operario ${operario.nombre} intentó retirar ${listaEpp} extra en el área ${area.nombre}. Retiro bloqueado.`,
            metadata: { operarioId: operario.id, areaId: area.id, bloqueados },
          }),
        );
        return rechazo("RETIRO_EXCESIVO", "Ya tienes tu EPP vigente. Retiro bloqueado.", { bloqueados, sinStock });
      }
      return rechazo("SIN_STOCK", "No hay stock disponible del EPP requerido.", { bloqueados, sinStock });
    }

    return {
      ok: true,
      operario: { id: operario.id, nombre: operario.nombre, cargo: operario.cargo.nombre },
      area: { id: area.id, nombre: area.nombre },
      estacion: { id: estacion.id, codigo: estacion.codigo },
      tarea: asignacion
        ? { id: asignacion.tarea.id, nombre: asignacion.tarea.nombre, nivelRiesgo: asignacion.tarea.nivelRiesgo }
        : null,
      turno: asignacion?.turno.nombre ?? null,
      entregas,
      bloqueados,
      sinStock,
    };
  } catch (error) {
    console.error("[dispensa] Error procesando dispensación:", error);
    return rechazo("ERROR_INTERNO", "Error interno al procesar la dispensación. Intenta de nuevo.");
  }
}
