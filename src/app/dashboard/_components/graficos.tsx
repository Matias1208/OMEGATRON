"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AreaAnalisis, CumplimientoArea } from "@/features/dashboard/types";
import { C, CURSOR_BARRA, EJE, diaCorto, tooltip } from "@/app/_components/charts";
import { formatear, usd, type Formato } from "./formato";
import { SERIES_CUMPLIMIENTO } from "./series";

/*
 * Gráficos específicos del dashboard. Regla de color de marca:
 *   verde = estado OK / ahorro / verificado
 *   cian  = alerta / crítico / incumplimiento (y la serie principal)
 *   blanco translúcido = neutro / pendiente
 * El estado nunca depende solo del color: leyendas, etiquetas y tooltips lo nombran.
 */

const ETIQUETA_VALOR = { fill: C.blanco, fontSize: 12, fontFamily: "var(--font-jetbrains-mono)" } as const;

// ─────────────────────────────────────────────
// Costo por área vs promedio
// ─────────────────────────────────────────────

export function GraficoCostoPorArea({ datos, promedio }: { datos: AreaAnalisis[]; promedio: number }) {
  const Tip = tooltip<AreaAnalisis>((f) => ({
    titulo: f.area,
    filas: [
      { nombre: f.etiqueta, valor: usd(f.costo), color: f.categoria === "CRITICA" ? C.cian : C.verde },
      { nombre: "vs promedio", valor: `${f.diferenciaPct > 0 ? "+" : ""}${f.diferenciaPct}%`, color: C.blanco },
    ],
  }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 24, right: 60, bottom: 0, left: 0 }} barCategoryGap={14}>
          <CartesianGrid stroke={C.cian} strokeOpacity={0.08} horizontal={false} />
          <XAxis type="number" tickFormatter={(v: number) => usd(v)} {...EJE} />
          <YAxis type="category" dataKey="area" width={130} {...EJE} />
          <Tooltip content={Tip} cursor={CURSOR_BARRA} />
          <ReferenceLine
            x={promedio}
            stroke={C.blanco}
            strokeOpacity={0.6}
            label={{ value: `Promedio ${usd(promedio)}`, position: "top", fill: C.blanco, fontSize: 11 }}
          />
          <Bar dataKey="costo" radius={[0, 8, 8, 0]} maxBarSize={18} isAnimationActive={false}>
            {datos.map((d) => (
              <Cell key={d.areaId} fill={d.categoria === "CRITICA" ? C.cian : C.verde} />
            ))}
            <LabelList dataKey="costo" position="right" formatter={(v) => usd(Number(v))} {...ETIQUETA_VALOR} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Barras horizontales de una serie (top EPP, gasto por tipo, turnos)
// ─────────────────────────────────────────────

export function BarrasHorizontales<T extends Record<string, unknown>>({
  datos,
  categoria,
  valor,
  formato,
  detalle,
}: {
  datos: T[];
  categoria: keyof T & string;
  valor: keyof T & string;
  formato: Formato;
  /** Campo con un texto ya calculado para la segunda línea del tooltip. */
  detalle?: keyof T & string;
}) {
  const Tip = tooltip<T>((f) => ({
    titulo: String(f[categoria]),
    filas: [
      { nombre: "", valor: formatear(Number(f[valor]), formato), color: C.cian },
      ...(detalle ? [{ nombre: String(f[detalle]), valor: "", color: "transparent" }] : []),
    ],
  }));
  return (
    <div style={{ height: Math.max(120, datos.length * 38 + 16) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey={categoria as string} width={150} {...EJE} />
          <Tooltip content={Tip} cursor={CURSOR_BARRA} />
          <Bar dataKey={valor as string} fill={C.cian} radius={[0, 8, 8, 0]} maxBarSize={14} isAnimationActive={false}>
            <LabelList dataKey={valor as string} position="right" formatter={(v) => formatear(Number(v), formato)} {...ETIQUETA_VALOR} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Cumplimiento EHS por área (barras apiladas)
// ─────────────────────────────────────────────

export function GraficoCumplimiento({ datos }: { datos: CumplimientoArea[] }) {
  const Tip = tooltip<CumplimientoArea>((f) => ({
    titulo: `${f.area} · ${f.cumplimientoPct ?? "—"}% cumplimiento`,
    filas: SERIES_CUMPLIMIENTO.map((s) => ({ nombre: s.nombre.toLowerCase(), valor: String(f[s.clave]), color: s.color })),
  }));
  return (
    <div style={{ height: Math.max(120, datos.length * 42 + 16) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barCategoryGap={12}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="area" width={150} {...EJE} />
          <Tooltip content={Tip} cursor={CURSOR_BARRA} />
          {SERIES_CUMPLIMIENTO.map((s, i) => (
            <Bar
              key={s.clave}
              dataKey={s.clave}
              stackId="a"
              fill={s.color}
              fillOpacity={s.opacidad}
              stroke={C.noche}
              strokeWidth={2} // separación de 2px entre segmentos
              radius={i === SERIES_CUMPLIMIENTO.length - 1 ? [0, 8, 8, 0] : 0}
              maxBarSize={16}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Reemplazos programados por día
// ─────────────────────────────────────────────

export function GraficoReemplazos({ datos }: { datos: { fecha: string; cantidad: number; costo: number }[] }) {
  const Tip = tooltip<{ fecha: string; cantidad: number; costo: number }>((f) => ({
    titulo: diaCorto(f.fecha),
    filas: [
      { nombre: "reemplazos", valor: String(f.cantidad), color: C.cian },
      { nombre: "presupuesto", valor: usd(f.costo), color: C.blanco },
    ],
  }));
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 22, right: 4, bottom: 0, left: 4 }}>
          <XAxis dataKey="fecha" tickFormatter={diaCorto} {...EJE} />
          <YAxis hide allowDecimals={false} />
          <Tooltip content={Tip} cursor={CURSOR_BARRA} />
          <Bar dataKey="cantidad" fill={C.cian} radius={[6, 6, 0, 0]} maxBarSize={12} isAnimationActive={false}>
            <LabelList dataKey="cantidad" position="top" {...ETIQUETA_VALOR} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
