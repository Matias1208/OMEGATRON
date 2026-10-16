"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AreaAnalisis, ConsumoDiario, CumplimientoArea, PuntoSerie } from "@/features/dashboard/types";
import { formatear, usd, type Formato } from "./formato";

/**
 * Colores de MARCAS (barras, líneas, áreas), validados para el fondo #0d131b con el
 * validador de paletas: banda de luminosidad, croma, separación CVD y contraste.
 * Son más profundos que los tokens de UI (text-ok, text-danger…) a propósito: los
 * tokens claros sirven para texto, no para rellenos sobre fondo oscuro.
 */
export const COLOR = {
  serie: "#0891b2",
  ok: "#059669",
  atencion: "#d97706",
  critico: "#dc2626",
  neutro: "#3a4757",
  tendencia: "#5b6879",
  grilla: "#1d2836",
  eje: "#5b6879",
} as const;

const EJE = { stroke: COLOR.grilla, tick: { fill: COLOR.eje, fontSize: 11 }, tickLine: false, axisLine: false } as const;


const diaCorto = (fecha: string) => {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
};

// ─────────────────────────────────────────────
// Tooltip: valor primero (fuerte), etiqueta después; clave de serie como trazo corto.
// ─────────────────────────────────────────────

type FilaTip = { nombre: string; valor: string; color: string };

function CajaTip({ titulo, filas }: { titulo: string; filas: FilaTip[] }) {
  return (
    <div className="rounded-lg border border-line-strong bg-surface-2 px-3 py-2 shadow-xl">
      <p className="mb-1 text-[11px] text-muted">{titulo}</p>
      {filas.map((f) => (
        <p key={f.nombre} className="flex items-center gap-2 text-sm">
          <span className="h-0.5 w-3 rounded-full" style={{ background: f.color }} aria-hidden />
          <span className="tabular font-semibold text-ink">{f.valor}</span>
          <span className="text-xs text-muted">{f.nombre}</span>
        </p>
      ))}
    </div>
  );
}

type PropsTip = {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{ payload?: unknown }>;
};

/** Crea un tooltip a partir de la fila de datos activa. */
function tooltip<T>(armar: (fila: T, label: string) => { titulo: string; filas: FilaTip[] }) {
  function Contenido({ active, payload, label }: PropsTip) {
    const fila = payload?.[0]?.payload as T | undefined;
    if (!active || !fila) return null;
    return <CajaTip {...armar(fila, String(label ?? ""))} />;
  }
  return Contenido;
}

const CURSOR_BARRA = { fill: "rgb(255 255 255 / 0.04)" };
const CURSOR_LINEA = { stroke: COLOR.eje, strokeWidth: 1 };

// ─────────────────────────────────────────────
// Sparkline (KPIs del nivel 3)
// ─────────────────────────────────────────────

export function Sparkline({ datos, formato }: { datos: PuntoSerie[]; formato: Formato }) {
  const ultimo = [...datos].reverse().find((d) => d.valor !== null);
  const TipSpark = tooltip<PuntoSerie>((f) => ({
    titulo: diaCorto(f.fecha),
    filas: [{ nombre: "", valor: f.valor === null ? "sin datos" : formatear(f.valor, formato), color: COLOR.serie }],
  }));
  return (
    <div className="h-12" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 6, right: 6, bottom: 2, left: 6 }}>
          <Tooltip content={TipSpark} cursor={CURSOR_LINEA} />
          <Line
            dataKey="valor"
            stroke={COLOR.tendencia}
            strokeWidth={2}
            dot={(p: { cx?: number; cy?: number; index?: number }) =>
              p.index === datos.indexOf(ultimo!) && p.cx !== undefined && p.cy !== undefined ? (
                <circle key="ultimo" cx={p.cx} cy={p.cy} r={4} fill={COLOR.serie} stroke="#0d131b" strokeWidth={2} />
              ) : (
                <g key={`d${p.index}`} />
              )
            }
            activeDot={{ r: 4, fill: COLOR.serie, stroke: "#0d131b", strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// 1. Consumo diario (área, una serie)
// ─────────────────────────────────────────────

export function GraficoConsumoDiario({ datos }: { datos: ConsumoDiario[] }) {
  const Tip = tooltip<ConsumoDiario>((f) => ({
    titulo: diaCorto(f.fecha),
    filas: [
      { nombre: "costo", valor: usd(f.costo), color: COLOR.serie },
      { nombre: "unidades", valor: String(f.unidades), color: COLOR.tendencia },
    ],
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={COLOR.grilla} />
          <XAxis dataKey="fecha" tickFormatter={diaCorto} minTickGap={24} {...EJE} />
          <YAxis tickFormatter={(v: number) => usd(v)} width={52} {...EJE} />
          <Tooltip content={Tip} cursor={CURSOR_LINEA} />
          <Area
            dataKey="costo"
            stroke={COLOR.serie}
            strokeWidth={2}
            fill={COLOR.serie}
            fillOpacity={0.1}
            activeDot={{ r: 4, fill: COLOR.serie, stroke: "#0d131b", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// 2. Costo por área vs promedio (estado: eficiente / crítica)
// ─────────────────────────────────────────────

export function GraficoCostoPorArea({ datos, promedio }: { datos: AreaAnalisis[]; promedio: number }) {
  const Tip = tooltip<AreaAnalisis>((f) => ({
    titulo: f.area,
    filas: [
      { nombre: f.etiqueta, valor: usd(f.costo), color: f.categoria === "CRITICA" ? COLOR.critico : COLOR.ok },
      { nombre: "vs promedio", valor: `${f.diferenciaPct > 0 ? "+" : ""}${f.diferenciaPct}%`, color: COLOR.eje },
    ],
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 22, right: 56, bottom: 0, left: 0 }} barCategoryGap={12}>
          <CartesianGrid horizontal={false} stroke={COLOR.grilla} />
          <XAxis type="number" tickFormatter={(v: number) => usd(v)} {...EJE} />
          <YAxis type="category" dataKey="area" width={128} {...EJE} />
          <Tooltip content={Tip} cursor={CURSOR_BARRA} />
          <ReferenceLine
            x={promedio}
            stroke={COLOR.eje}
            label={{ value: `Promedio ${usd(promedio)}`, position: "top", fill: "#8b9aad", fontSize: 11 }}
          />
          <Bar dataKey="costo" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false}>
            {datos.map((d) => (
              <Cell key={d.areaId} fill={d.categoria === "CRITICA" ? COLOR.critico : COLOR.ok} />
            ))}
            <LabelList dataKey="costo" position="right" formatter={(v) => usd(Number(v))} fill="#e6edf5" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Barras horizontales de una sola serie (top EPP, gasto por tipo, turnos)
// ─────────────────────────────────────────────

export function BarrasHorizontales<T extends Record<string, unknown>>({
  datos,
  categoria,
  valor,
  formato,
  detalle,
  alto,
}: {
  datos: T[];
  categoria: keyof T & string;
  valor: keyof T & string;
  formato: Formato;
  /** Campo con un texto ya calculado para la segunda línea del tooltip, p.ej. "54% del gasto". */
  detalle?: keyof T & string;
  alto?: number;
}) {
  const Tip = tooltip<T>((f) => ({
    titulo: String(f[categoria]),
    filas: [
      { nombre: "", valor: formatear(Number(f[valor]), formato), color: COLOR.serie },
      ...(detalle ? [{ nombre: String(f[detalle]), valor: "", color: "transparent" }] : []),
    ],
  }));
  return (
    <div style={{ height: alto ?? Math.max(120, datos.length * 36 + 24) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey={categoria as string} width={150} {...EJE} />
          <Tooltip content={Tip} cursor={CURSOR_BARRA} />
          <Bar dataKey={valor as string} fill={COLOR.serie} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
            <LabelList dataKey={valor as string} position="right" formatter={(v) => formatear(Number(v), formato)} fill="#e6edf5" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// 5. Cumplimiento EHS por área (barras apiladas)
// ─────────────────────────────────────────────

const SERIES_CUMPLIMIENTO = [
  { clave: "verificados", nombre: "Verificado", color: COLOR.ok },
  { clave: "incumplimientos", nombre: "Incumplimiento", color: COLOR.critico },
  { clave: "pendientes", nombre: "Pendiente de cámara", color: COLOR.neutro },
] as const;

export function GraficoCumplimiento({ datos }: { datos: CumplimientoArea[] }) {
  const Tip = tooltip<CumplimientoArea>((f) => ({
    titulo: `${f.area} · ${f.cumplimientoPct ?? "—"}% cumplimiento`,
    filas: SERIES_CUMPLIMIENTO.map((s) => ({ nombre: s.nombre.toLowerCase(), valor: String(f[s.clave]), color: s.color })),
  }));
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-4 text-xs text-muted" aria-label="Leyenda">
        {SERIES_CUMPLIMIENTO.map((s) => (
          <li key={s.clave} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.nombre}
          </li>
        ))}
      </ul>
      <div style={{ height: Math.max(120, datos.length * 40 + 24) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={10}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="area" width={150} {...EJE} />
            <Tooltip content={Tip} cursor={CURSOR_BARRA} />
            {SERIES_CUMPLIMIENTO.map((s, i) => (
              <Bar
                key={s.clave}
                dataKey={s.clave}
                stackId="a"
                fill={s.color}
                stroke="#0d131b"
                strokeWidth={2} // separación de 2px entre segmentos (color de la superficie)
                radius={i === SERIES_CUMPLIMIENTO.length - 1 ? [0, 4, 4, 0] : 0}
                maxBarSize={22}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 7. Reemplazos programados por día (columnas)
// ─────────────────────────────────────────────

export function GraficoReemplazos({ datos }: { datos: { fecha: string; cantidad: number; costo: number }[] }) {
  const Tip = tooltip<{ fecha: string; cantidad: number; costo: number }>((f) => ({
    titulo: diaCorto(f.fecha),
    filas: [
      { nombre: "reemplazos", valor: String(f.cantidad), color: COLOR.serie },
      { nombre: "presupuesto", valor: usd(f.costo), color: COLOR.tendencia },
    ],
  }));
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 18, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="fecha" tickFormatter={diaCorto} {...EJE} />
          <YAxis hide allowDecimals={false} />
          <Tooltip content={Tip} cursor={CURSOR_BARRA} />
          <Bar dataKey="cantidad" fill={COLOR.serie} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
            <LabelList dataKey="cantidad" position="top" fill="#e6edf5" fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
