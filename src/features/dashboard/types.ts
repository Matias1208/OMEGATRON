import type { TipoAlerta, TipoEPP } from "@prisma/client";

export type ResultadoQuery<T> = { ok: true; data: T } | { ok: false; error: string };

export type Semaforo = "OK" | "ATENCION" | "CRITICO";
export type Pilar = "COSTO" | "SEGURIDAD" | "INVENTARIO";

/** Todas las fechas de series son "YYYY-MM-DD" en hora de Ecuador (eje X de Recharts). */
export type PuntoSerie = { fecha: string; valor: number | null };

// ─────────────────────────────────────────────
// Análisis de ahorro por área (Fase 3)
// ─────────────────────────────────────────────

/** Una barra del gráfico (Recharts: dataKey="costo", eje X dataKey="area"). */
export type AreaAnalisis = {
  areaId: string;
  area: string;
  costo: number;
  promedio: number; // repetido en cada fila para poder dibujarlo como <Line dataKey="promedio" />
  diferencia: number; // costo - promedio (negativo = ahorro)
  diferenciaPct: number;
  unidades: number;
  entregas: number;
  operarios: number;
  costoPorOperario: number;
  incumplimientosEHS: number;
  categoria: "EFICIENTE" | "CRITICA";
  etiqueta: string;
};

export type AnalisisAhorroAreas = {
  periodo: { desde: string; hasta: string };
  costoTotalEmpresa: number;
  consumoPromedio: number;
  potencialAhorro: number;
  chartData: AreaAnalisis[];
  areasEficientes: AreaAnalisis[];
  areasCriticas: AreaAnalisis[];
};

// ─────────────────────────────────────────────
// Metodología 1-3-10
// ─────────────────────────────────────────────

/** NIVEL 1 (1 segundo): ¿estamos bien o mal, y qué decido hoy? */
export type Nivel1 = {
  estado: Semaforo;
  titular: string;
  decisionPrioritaria: string;
  pilarPrioritario: Pilar | null;
};

/** NIVEL 3 (3 segundos): los tres pilares estratégicos. */
export type KpiEstrategico = {
  pilar: Pilar;
  titulo: string;
  valor: number;
  unidad: "USD" | "%";
  meta: number | null;
  valorAnterior: number | null;
  variacionPct: number | null;
  estado: Semaforo;
  /** Qué está pasando, en una frase. */
  lectura: string;
  /** Qué hacer al respecto. */
  accion: string;
  /** Sparkline: <LineChart data={tendencia}><Line dataKey="valor" /></LineChart> */
  tendencia: PuntoSerie[];
};

export type ConsumoDiario = {
  fecha: string;
  costo: number;
  unidades: number;
  entregas: number;
  cumplimientoPct: number | null;
};
export type TopEpp = { eppId: string; codigo: string; epp: string; tipo: TipoEPP; unidades: number; costo: number; participacionPct: number };
export type CostoPorTipo = { tipo: TipoEPP; costo: number; unidades: number; participacionPct: number };
export type CumplimientoArea = {
  areaId: string;
  area: string;
  verificados: number;
  incumplimientos: number;
  pendientes: number;
  cumplimientoPct: number | null;
};
export type InventarioEstado = {
  inventarioId: string;
  eppId: string;
  codigo: string;
  epp: string;
  estacion: string;
  slotMotor: number;
  stock: number;
  stockMinimo: number;
  consumoDiarioPromedio: number;
  coberturaDias: number | null; // null = sin consumo en el período
  lotesPorVencer: number;
  estado: Semaforo;
};
export type ReemplazoProximo = {
  entregaId: string;
  operario: string;
  area: string;
  epp: string;
  venceUso: string;
  diasRestantes: number;
  costoEstimado: number;
};
export type ConsumoTurno = { turno: string; costo: number; unidades: number; entregas: number };
export type RankingIncumplimiento = {
  operarioId: string;
  operario: string;
  area: string;
  incumplimientos: number;
  entregas: number;
  cumplimientoPct: number | null;
};

/** NIVEL 10 (10 segundos): las 10 vistas de diagnóstico. */
export type Nivel10 = {
  /** 1. AreaChart/ComposedChart — costo diario + % cumplimiento */
  consumoDiario: ConsumoDiario[];
  /** 2. BarChart + ReferenceLine — costo por área vs promedio */
  costoPorArea: AnalisisAhorroAreas;
  /** 3. BarChart layout="vertical" — top 10 EPP por unidades */
  topEpp: TopEpp[];
  /** 4. PieChart — distribución del gasto por tipo de EPP */
  costoPorTipo: CostoPorTipo[];
  /** 5. BarChart apilado — verificados / incumplimientos / pendientes por área */
  cumplimientoPorArea: CumplimientoArea[];
  /** 6. BarChart — stock vs mínimo, con cobertura en días */
  inventario: InventarioEstado[];
  /** 7. BarChart por día + tabla — reemplazos de EPP durable y su presupuesto */
  reemplazosProximos: {
    cantidad: number;
    presupuesto: number;
    porDia: { fecha: string; cantidad: number; costo: number }[];
    detalle: ReemplazoProximo[];
  };
  /** 8. BarChart — consumo por turno */
  consumoPorTurno: ConsumoTurno[];
  /** 9. Tabla/BarChart — operarios con más incumplimientos EHS */
  rankingIncumplimientos: RankingIncumplimiento[];
  /** 10. Tabla + PieChart — alertas pendientes */
  alertasPendientes: {
    total: number;
    porTipo: { tipo: TipoAlerta; cantidad: number }[];
    recientes: { id: string; tipo: TipoAlerta; mensaje: string; createdAt: string }[];
  };
};

export type ResumenGerencial = {
  periodo: { desde: string; hasta: string; dias: number };
  generadoEn: string;
  nivel1: Nivel1;
  nivel3: [KpiEstrategico, KpiEstrategico, KpiEstrategico];
  nivel10: Nivel10;
};
