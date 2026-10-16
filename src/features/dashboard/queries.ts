import { EstadoAlerta, EstadoEntrega, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DIA_MS, fechaEcuador } from "@/lib/fechas";
import { ESTADOS_EN_USO } from "@/features/dispensa/estados";
import { METAS } from "./config";
import type {
  AnalisisAhorroAreas,
  AreaAnalisis,
  ConsumoDiario,
  ConsumoTurno,
  CostoPorTipo,
  CumplimientoArea,
  InventarioEstado,
  Nivel10,
  RankingIncumplimiento,
  ResultadoQuery,
  Semaforo,
  TopEpp,
} from "./types";

export type Periodo = { desde: Date; hasta: Date };

export const redondear = (n: number, decimales = 2) => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};
const pct = (parte: number, total: number) => (total > 0 ? redondear((parte / total) * 100, 1) : null);

/** "YYYY-MM-DD" del día en Ecuador al que pertenece un instante. */
const diaEcuador = (d: Date) => new Date(d.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Todos los días del período, para que las series no tengan huecos en el gráfico. */
function diasDelPeriodo({ desde, hasta }: Periodo): string[] {
  const dias: string[] = [];
  for (let t = new Date(`${diaEcuador(desde)}T00:00:00Z`).getTime(); t <= hasta.getTime(); t += DIA_MS) {
    const dia = new Date(t).toISOString().slice(0, 10);
    if (dia > diaEcuador(hasta)) break;
    dias.push(dia);
  }
  return dias;
}

const whereConsumo = ({ desde, hasta }: Periodo): Prisma.EntregaWhereInput => ({
  fecha: { gte: desde, lt: hasta },
  estado: { in: ESTADOS_EN_USO },
});

// ─────────────────────────────────────────────
// Totales del período (para KPIs y comparación con el período anterior)
// ─────────────────────────────────────────────

export async function totalesPeriodo(periodo: Periodo) {
  const filas = await prisma.entrega.groupBy({
    by: ["estado"],
    where: whereConsumo(periodo),
    _sum: { costoTotal: true, cantidad: true },
    _count: { _all: true },
  });
  const por = (estado: EstadoEntrega) => filas.find((f) => f.estado === estado)?._count._all ?? 0;
  const verificados = por(EstadoEntrega.VERIFICADO);
  const incumplimientos = por(EstadoEntrega.INCUMPLIMIENTO_EHS);

  return {
    costo: redondear(filas.reduce((acc, f) => acc + Number(f._sum.costoTotal ?? 0), 0)),
    unidades: filas.reduce((acc, f) => acc + (f._sum.cantidad ?? 0), 0),
    entregas: filas.reduce((acc, f) => acc + f._count._all, 0),
    verificados,
    incumplimientos,
    cumplimientoPct: pct(verificados, verificados + incumplimientos),
  };
}

// ─────────────────────────────────────────────
// 1. Consumo diario
// ─────────────────────────────────────────────

export async function getConsumoDiario(periodo: Periodo): Promise<ConsumoDiario[]> {
  const filas = await prisma.$queryRaw<
    { dia: string; costo: number; unidades: number; entregas: number; verificados: number; incumplimientos: number }[]
  >`
    SELECT to_char(("fecha" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD') AS dia,
           COALESCE(SUM("costoTotal"), 0)::float8                                  AS costo,
           COALESCE(SUM("cantidad"), 0)::int                                      AS unidades,
           COUNT(*)::int                                                          AS entregas,
           COUNT(*) FILTER (WHERE "estado" = 'VERIFICADO')::int                   AS verificados,
           COUNT(*) FILTER (WHERE "estado" = 'INCUMPLIMIENTO_EHS')::int           AS incumplimientos
    FROM "Entrega"
    WHERE "fecha" >= ${periodo.desde} AND "fecha" < ${periodo.hasta}
      AND "estado"::text IN (${Prisma.join(ESTADOS_EN_USO)})
    GROUP BY 1`;

  const porDia = new Map(filas.map((f) => [f.dia, f]));
  return diasDelPeriodo(periodo).map((fecha) => {
    const f = porDia.get(fecha);
    return {
      fecha,
      costo: redondear(f?.costo ?? 0),
      unidades: f?.unidades ?? 0,
      entregas: f?.entregas ?? 0,
      cumplimientoPct: f ? pct(f.verificados, f.verificados + f.incumplimientos) : null,
    };
  });
}

// ─────────────────────────────────────────────
// 2. Costo por área vs promedio (análisis de ahorro)
// ─────────────────────────────────────────────

/**
 * Compara el costo de cada área contra el promedio de la empresa y las clasifica en
 * "Proyectos de Ahorro" (≤ promedio) o "Críticas" (> promedio).
 * El promedio se calcula sobre las áreas con consumo en el período.
 */
export async function calcularAnalisisAhorroAreas(periodo: Periodo): Promise<AnalisisAhorroAreas> {
  const where = whereConsumo(periodo);
  const [porArea, operariosPorArea, ehsPorArea] = await Promise.all([
    prisma.entrega.groupBy({ by: ["areaId"], where, _sum: { costoTotal: true, cantidad: true }, _count: { _all: true } }),
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
      const eficiente = costo <= consumoPromedio;
      return {
        areaId: a.areaId,
        area: nombrePorArea.get(a.areaId) ?? "Sin área",
        costo,
        promedio: consumoPromedio,
        diferencia,
        diferenciaPct: consumoPromedio ? redondear((diferencia / consumoPromedio) * 100, 1) : 0,
        unidades: a._sum.cantidad ?? 0,
        entregas: a._count._all,
        operarios,
        costoPorOperario: operarios ? redondear(costo / operarios) : 0,
        incumplimientosEHS: ehsCount.get(a.areaId) ?? 0,
        categoria: eficiente ? ("EFICIENTE" as const) : ("CRITICA" as const),
        etiqueta: eficiente ? "Proyecto de Ahorro" : "Consumo Crítico",
      };
    })
    .sort((a, b) => b.costo - a.costo);

  const areasCriticas = chartData.filter((a) => a.categoria === "CRITICA");
  return {
    periodo: { desde: periodo.desde.toISOString(), hasta: periodo.hasta.toISOString() },
    costoTotalEmpresa,
    consumoPromedio,
    // Ahorro alcanzable si cada área crítica bajara su consumo al promedio.
    potencialAhorro: redondear(areasCriticas.reduce((acc, a) => acc + a.diferencia, 0)),
    chartData,
    areasEficientes: chartData.filter((a) => a.categoria === "EFICIENTE"),
    areasCriticas,
  };
}

/**
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
    return { ok: true, data: await calcularAnalisisAhorroAreas({ desde, hasta }) };
  } catch (error) {
    console.error("[dashboard] Error en getAnalisisAhorroAreas:", error);
    return { ok: false, error: "No se pudo calcular el análisis de ahorro por área." };
  }
}

// ─────────────────────────────────────────────
// 3 y 4. Top EPP y gasto por tipo
// ─────────────────────────────────────────────

export async function getConsumoPorEpp(periodo: Periodo): Promise<{ topEpp: TopEpp[]; costoPorTipo: CostoPorTipo[] }> {
  const filas = await prisma.entrega.groupBy({
    by: ["eppId"],
    where: whereConsumo(periodo),
    _sum: { cantidad: true, costoTotal: true },
  });
  const epps = await prisma.ePP.findMany({
    where: { id: { in: filas.map((f) => f.eppId) } },
    select: { id: true, codigo: true, nombre: true, tipo: true },
  });
  const eppPorId = new Map(epps.map((e) => [e.id, e]));
  const totalUnidades = filas.reduce((acc, f) => acc + (f._sum.cantidad ?? 0), 0);
  const totalCosto = filas.reduce((acc, f) => acc + Number(f._sum.costoTotal ?? 0), 0);

  const topEpp: TopEpp[] = filas
    .map((f) => {
      const epp = eppPorId.get(f.eppId)!;
      const unidades = f._sum.cantidad ?? 0;
      return {
        eppId: f.eppId,
        codigo: epp.codigo,
        epp: epp.nombre,
        tipo: epp.tipo,
        unidades,
        costo: redondear(Number(f._sum.costoTotal ?? 0)),
        participacionPct: pct(unidades, totalUnidades) ?? 0,
      };
    })
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, 10);

  const porTipo = new Map<string, CostoPorTipo>();
  for (const f of filas) {
    const tipo = eppPorId.get(f.eppId)!.tipo;
    const acc = porTipo.get(tipo) ?? { tipo, costo: 0, unidades: 0, participacionPct: 0 };
    acc.costo += Number(f._sum.costoTotal ?? 0);
    acc.unidades += f._sum.cantidad ?? 0;
    porTipo.set(tipo, acc);
  }
  const costoPorTipo = [...porTipo.values()]
    .map((t) => ({ ...t, costo: redondear(t.costo), participacionPct: pct(t.costo, totalCosto) ?? 0 }))
    .sort((a, b) => b.costo - a.costo);

  return { topEpp, costoPorTipo };
}

// ─────────────────────────────────────────────
// 5. Cumplimiento EHS por área
// ─────────────────────────────────────────────

export async function getCumplimientoPorArea(periodo: Periodo): Promise<CumplimientoArea[]> {
  const filas = await prisma.entrega.groupBy({
    by: ["areaId", "estado"],
    where: whereConsumo(periodo),
    _count: { _all: true },
  });
  const areas = await prisma.area.findMany({
    where: { id: { in: [...new Set(filas.map((f) => f.areaId))] } },
    select: { id: true, nombre: true },
  });

  return areas
    .map((area) => {
      const cuenta = (estado: EstadoEntrega) =>
        filas.find((f) => f.areaId === area.id && f.estado === estado)?._count._all ?? 0;
      const verificados = cuenta(EstadoEntrega.VERIFICADO);
      const incumplimientos = cuenta(EstadoEntrega.INCUMPLIMIENTO_EHS);
      return {
        areaId: area.id,
        area: area.nombre,
        verificados,
        incumplimientos,
        pendientes: cuenta(EstadoEntrega.PENDIENTE_VERIFICACION_CAMARA),
        cumplimientoPct: pct(verificados, verificados + incumplimientos),
      };
    })
    .sort((a, b) => (a.cumplimientoPct ?? 101) - (b.cumplimientoPct ?? 101)); // peor primero
}

// ─────────────────────────────────────────────
// 6. Inventario: stock vs mínimo y cobertura
// ─────────────────────────────────────────────

export async function getEstadoInventario(periodo: Periodo): Promise<InventarioEstado[]> {
  const hoy = fechaEcuador();
  const limiteLote = fechaEcuador(METAS.inventario.coberturaMinimaDias);
  const dias = Math.max(1, (periodo.hasta.getTime() - periodo.desde.getTime()) / DIA_MS);

  const [inventarios, consumo] = await Promise.all([
    prisma.inventario.findMany({
      include: {
        epp: { select: { codigo: true, nombre: true } },
        estacion: { select: { codigo: true } },
        lotes: {
          where: { stockActual: { gt: 0 }, OR: [{ fechaVencimiento: null }, { fechaVencimiento: { gte: hoy } }] },
          select: { stockActual: true, fechaVencimiento: true },
        },
      },
    }),
    prisma.entrega.groupBy({
      by: ["estacionId", "eppId"],
      where: whereConsumo(periodo),
      _sum: { cantidad: true },
    }),
  ]);

  return inventarios
    .map((inv) => {
      const stock = inv.lotes.reduce((acc, l) => acc + l.stockActual, 0);
      const usado = consumo.find((c) => c.estacionId === inv.estacionId && c.eppId === inv.eppId)?._sum.cantidad ?? 0;
      const consumoDiarioPromedio = redondear(usado / dias);
      const coberturaDias = consumoDiarioPromedio > 0 ? redondear(stock / consumoDiarioPromedio, 1) : null;

      let estado: Semaforo = "OK";
      if (stock < inv.stockMinimo) estado = "CRITICO";
      else if (coberturaDias !== null && coberturaDias < METAS.inventario.coberturaMinimaDias) estado = "ATENCION";

      return {
        inventarioId: inv.id,
        eppId: inv.eppId,
        codigo: inv.epp.codigo,
        epp: inv.epp.nombre,
        estacion: inv.estacion.codigo,
        slotMotor: inv.slotMotor,
        stock,
        stockMinimo: inv.stockMinimo,
        consumoDiarioPromedio,
        coberturaDias,
        lotesPorVencer: inv.lotes.filter((l) => l.fechaVencimiento && l.fechaVencimiento <= limiteLote).length,
        estado,
      };
    })
    .sort((a, b) => (a.coberturaDias ?? Infinity) - (b.coberturaDias ?? Infinity)); // más urgente primero
}

// ─────────────────────────────────────────────
// 7. Reemplazos programados de EPP durable
// ─────────────────────────────────────────────

export async function getReemplazosProximos(): Promise<Nivel10["reemplazosProximos"]> {
  const ahora = new Date();
  const horizonte = new Date(ahora.getTime() + METAS.horizonteReemplazosDias * DIA_MS);

  const entregas = await prisma.entrega.findMany({
    where: {
      estado: { in: ESTADOS_EN_USO },
      venceUso: { gt: ahora, lte: horizonte },
      epp: { vidaUtilDias: { gte: METAS.vidaUtilDurableDias } },
      operario: { activo: true },
    },
    include: {
      operario: { select: { nombre: true } },
      area: { select: { nombre: true } },
      epp: { select: { nombre: true, costoUnitario: true } },
    },
    orderBy: { venceUso: "asc" },
  });

  const detalle = entregas.map((e) => ({
    entregaId: e.id,
    operario: e.operario.nombre,
    area: e.area.nombre,
    epp: e.epp.nombre,
    venceUso: e.venceUso.toISOString(),
    diasRestantes: Math.ceil((e.venceUso.getTime() - ahora.getTime()) / DIA_MS),
    // A precio actual: es lo que costará reponerlo.
    costoEstimado: redondear(Number(e.epp.costoUnitario) * e.cantidad),
  }));

  const porDia = new Map<string, { fecha: string; cantidad: number; costo: number }>();
  for (const [i, e] of entregas.entries()) {
    const fecha = diaEcuador(e.venceUso);
    const acc = porDia.get(fecha) ?? { fecha, cantidad: 0, costo: 0 };
    acc.cantidad++;
    acc.costo = redondear(acc.costo + detalle[i].costoEstimado);
    porDia.set(fecha, acc);
  }

  return {
    cantidad: detalle.length,
    presupuesto: redondear(detalle.reduce((acc, d) => acc + d.costoEstimado, 0)),
    porDia: [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
    detalle,
  };
}

// ─────────────────────────────────────────────
// 8. Consumo por turno
// ─────────────────────────────────────────────

export async function getConsumoPorTurno(periodo: Periodo): Promise<ConsumoTurno[]> {
  const filas = await prisma.$queryRaw<ConsumoTurno[]>`
    SELECT COALESCE(t."nombre", 'Sin turno')       AS turno,
           COALESCE(SUM(e."costoTotal"), 0)::float8 AS costo,
           COALESCE(SUM(e."cantidad"), 0)::int     AS unidades,
           COUNT(*)::int                           AS entregas
    FROM "Entrega" e
    LEFT JOIN "AsignacionTurno" a ON a."id" = e."asignacionId"
    LEFT JOIN "Turno" t ON t."id" = a."turnoId"
    WHERE e."fecha" >= ${periodo.desde} AND e."fecha" < ${periodo.hasta}
      AND e."estado"::text IN (${Prisma.join(ESTADOS_EN_USO)})
    GROUP BY 1
    ORDER BY costo DESC`;
  return filas.map((f) => ({ ...f, costo: redondear(f.costo) }));
}

// ─────────────────────────────────────────────
// 9. Ranking de incumplimientos EHS por operario
// ─────────────────────────────────────────────

export async function getRankingIncumplimientos(periodo: Periodo): Promise<RankingIncumplimiento[]> {
  const filas = await prisma.entrega.groupBy({
    by: ["operarioId", "estado"],
    where: whereConsumo(periodo),
    _count: { _all: true },
  });

  const porOperario = new Map<string, { entregas: number; verificados: number; incumplimientos: number }>();
  for (const f of filas) {
    const acc = porOperario.get(f.operarioId) ?? { entregas: 0, verificados: 0, incumplimientos: 0 };
    acc.entregas += f._count._all;
    if (f.estado === EstadoEntrega.VERIFICADO) acc.verificados += f._count._all;
    if (f.estado === EstadoEntrega.INCUMPLIMIENTO_EHS) acc.incumplimientos += f._count._all;
    porOperario.set(f.operarioId, acc);
  }

  const top = [...porOperario.entries()]
    .filter(([, v]) => v.incumplimientos > 0)
    .sort(([, a], [, b]) => b.incumplimientos - a.incumplimientos)
    .slice(0, 10);

  const operarios = await prisma.operario.findMany({
    where: { id: { in: top.map(([id]) => id) } },
    select: { id: true, nombre: true, area: { select: { nombre: true } } },
  });
  const opPorId = new Map(operarios.map((o) => [o.id, o]));

  return top.map(([operarioId, v]) => ({
    operarioId,
    operario: opPorId.get(operarioId)?.nombre ?? "—",
    area: opPorId.get(operarioId)?.area?.nombre ?? "Sin área",
    incumplimientos: v.incumplimientos,
    entregas: v.entregas,
    cumplimientoPct: pct(v.verificados, v.verificados + v.incumplimientos),
  }));
}

// ─────────────────────────────────────────────
// 10. Alertas pendientes
// ─────────────────────────────────────────────

export async function getAlertasPendientes(): Promise<Nivel10["alertasPendientes"]> {
  const [porTipo, recientes] = await Promise.all([
    prisma.alerta.groupBy({ by: ["tipo"], where: { estado: EstadoAlerta.PENDIENTE }, _count: { _all: true } }),
    prisma.alerta.findMany({
      where: { estado: EstadoAlerta.PENDIENTE },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, tipo: true, mensaje: true, createdAt: true },
    }),
  ]);
  return {
    total: porTipo.reduce((acc, t) => acc + t._count._all, 0),
    porTipo: porTipo.map((t) => ({ tipo: t.tipo, cantidad: t._count._all })).sort((a, b) => b.cantidad - a.cantidad),
    recientes: recientes.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}
