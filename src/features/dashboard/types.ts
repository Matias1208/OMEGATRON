export type ResultadoQuery<T> = { ok: true; data: T } | { ok: false; error: string };

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
