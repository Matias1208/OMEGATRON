import { EstadoEntrega } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DIA_MS } from "@/lib/fechas";
import type { AnalisisAhorroAreas, AreaAnalisis, ResultadoQuery } from "./types";

// Entregas que representan consumo real (excluye fallas de hardware y anulaciones).
const ESTADOS_CONSUMO = [
  EstadoEntrega.PENDIENTE_VERIFICACION_CAMARA,
  EstadoEntrega.VERIFICADO,
  EstadoEntrega.INCUMPLIMIENTO_EHS,
];

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * KPIs gerenciales de consumo de EPP por área.
 * Compara el costo de cada área contra el promedio de la empresa y las clasifica en
 * "Proyectos de Ahorro" (≤ promedio) o "Críticas" (> promedio).
 * El promedio se calcula sobre las áreas con consumo en el período.
 *
 * Uso en Recharts:
 *   <BarChart data={data.chartData}>
 *     <Bar dataKey="costo">{data.chartData.map(d => <Cell key={d.areaId} fill={d.categoria === "CRITICA" ? rojo : verde} />)}</Bar>
 *     <ReferenceLine y={data.consumoPromedio} label="Promedio" />
 */
export async function getAnalisisAhorroAreas(
  opciones: { desde?: Date; hasta?: Date } = {},
): Promise<ResultadoQuery<AnalisisAhorroAreas>> {
  const hasta = opciones.hasta ?? new Date();
  const desde = opciones.desde ?? new Date(hasta.getTime() - 30 * DIA_MS);

  try {
    const where = { fecha: { gte: desde, lte: hasta }, estado: { in: ESTADOS_CONSUMO } };

    const [porArea, operariosPorArea, ehsPorArea] = await Promise.all([
      prisma.entrega.groupBy({
        by: ["areaId"],
        where,
        _sum: { costoTotal: true, cantidad: true },
        _count: { _all: true },
      }),
      prisma.entrega.groupBy({ by: ["areaId", "operarioId"], where }),
      prisma.entrega.groupBy({
        by: ["areaId"],
        where: { ...where, estado: EstadoEntrega.INCUMPLIMIENTO_EHS },
        _count: { _all: true },
      }),
    ]);

    const areas = await prisma.area.findMany({
      where: { id: { in: porArea.map((a) => a.areaId) } },
      select: { id: true, nombre: true },
    });
    const nombrePorArea = new Map(areas.map((a) => [a.id, a.nombre]));

    const operariosCount = new Map<string, number>();
    for (const { areaId } of operariosPorArea) {
      operariosCount.set(areaId, (operariosCount.get(areaId) ?? 0) + 1);
    }
    const ehsCount = new Map(ehsPorArea.map((e) => [e.areaId, e._count._all]));

    const costoTotalEmpresa = redondear(porArea.reduce((acc, a) => acc + Number(a._sum.costoTotal ?? 0), 0));
    const consumoPromedio = porArea.length ? redondear(costoTotalEmpresa / porArea.length) : 0;

    const chartData: AreaAnalisis[] = porArea
      .map((a) => {
        const costo = redondear(Number(a._sum.costoTotal ?? 0));
        const operarios = operariosCount.get(a.areaId) ?? 0;
        const diferencia = redondear(costo - consumoPromedio);
        return {
          areaId: a.areaId,
          area: nombrePorArea.get(a.areaId) ?? "Sin área",
          costo,
          promedio: consumoPromedio,
          diferencia,
          diferenciaPct: consumoPromedio ? redondear((diferencia / consumoPromedio) * 100) : 0,
          unidades: a._sum.cantidad ?? 0,
          entregas: a._count._all,
          operarios,
          costoPorOperario: operarios ? redondear(costo / operarios) : 0,
          incumplimientosEHS: ehsCount.get(a.areaId) ?? 0,
          categoria: costo <= consumoPromedio ? ("EFICIENTE" as const) : ("CRITICA" as const),
          etiqueta: costo <= consumoPromedio ? "Proyecto de Ahorro" : "Consumo Crítico",
        };
      })
      .sort((a, b) => b.costo - a.costo);

    const areasCriticas = chartData.filter((a) => a.categoria === "CRITICA");
    const areasEficientes = chartData.filter((a) => a.categoria === "EFICIENTE");

    return {
      ok: true,
      data: {
        periodo: { desde: desde.toISOString(), hasta: hasta.toISOString() },
        costoTotalEmpresa,
        consumoPromedio,
        // Ahorro alcanzable si cada área crítica bajara su consumo al promedio.
        potencialAhorro: redondear(areasCriticas.reduce((acc, a) => acc + a.diferencia, 0)),
        chartData,
        areasEficientes,
        areasCriticas,
      },
    };
  } catch (error) {
    console.error("[dashboard] Error en getAnalisisAhorroAreas:", error);
    return { ok: false, error: "No se pudo calcular el análisis de ahorro por área." };
  }
}
