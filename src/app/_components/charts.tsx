"use client";

import { useId } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatear, type Formato } from "@/app/dashboard/_components/formato";

/**
 * Gráficos compartidos de HARKAI (Recharts). Los colores son SIEMPRE variables CSS
 * de la paleta de marca; ningún hex vive en este archivo.
 */
export const C = {
  cian: "var(--color-cyan)",
  verde: "var(--color-green)",
  blanco: "var(--color-white)",
  noche: "var(--color-night)",
} as const;

export const EJE = {
  tick: { fill: C.blanco, fillOpacity: 0.55, fontSize: 11, fontFamily: "var(--font-jetbrains-mono)" },
  tickLine: false,
  axisLine: false,
} as const;

export const GRILLA = { stroke: C.cian, strokeOpacity: 0.08, vertical: false } as const;
export const CURSOR_BARRA = { fill: C.cian, fillOpacity: 0.06 };
export const CURSOR_LINEA = { stroke: C.cian, strokeOpacity: 0.5, strokeWidth: 1 };

export const diaCorto = (fecha: string) => {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
};

// ─────────────────────────────────────────────
// Tooltip: valor primero (fuerte), etiqueta después
// ─────────────────────────────────────────────

export type FilaTip = { nombre: string; valor: string; color: string };

export function CajaTip({ titulo, filas }: { titulo: string; filas: FilaTip[] }) {
  return (
    <div className="rounded-xl border border-cyan/30 bg-night/95 px-3 py-2 shadow-glow-cyan backdrop-blur">
      <p className="mb-1 font-mono text-[11px] text-faint">{titulo}</p>
      {filas.map((f) => (
        <p key={f.nombre + f.valor} className="flex items-center gap-2 text-sm">
          <span className="h-0.5 w-3 rounded-full" style={{ background: f.color }} aria-hidden />
          <span className="tabular font-display font-semibold text-white">{f.valor}</span>
          <span className="text-xs text-muted">{f.nombre}</span>
        </p>
      ))}
    </div>
  );
}

type PropsTip = { active?: boolean; label?: string | number; payload?: ReadonlyArray<{ payload?: unknown }> };

/** Crea un tooltip a partir de la fila de datos activa. */
export function tooltip<T>(armar: (fila: T, label: string) => { titulo: string; filas: FilaTip[] }) {
  function Contenido({ active, payload, label }: PropsTip) {
    const fila = payload?.[0]?.payload as T | undefined;
    if (!active || !fila) return null;
    return <CajaTip {...armar(fila, String(label ?? ""))} />;
  }
  return Contenido;
}

// ─────────────────────────────────────────────
// Área con curva suave y degradado cian que se desvanece al fondo
// ─────────────────────────────────────────────

export function AreaSuave<T extends Record<string, unknown>>({
  datos,
  x,
  y,
  formato,
  nombre,
  alto = 260,
}: {
  datos: T[];
  x: keyof T & string;
  y: keyof T & string;
  formato: Formato;
  nombre: string;
  alto?: number;
}) {
  const gid = useId().replace(/:/g, "");
  const Tip = tooltip<T>((f) => ({
    titulo: diaCorto(String(f[x])),
    filas: [{ nombre, valor: formatear(Number(f[y]), formato), color: C.cian }],
  }));
  return (
    <div style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.cian} stopOpacity={0.45} />
              <stop offset="100%" stopColor={C.cian} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRILLA} />
          <XAxis dataKey={x as string} tickFormatter={diaCorto} minTickGap={28} {...EJE} />
          <YAxis tickFormatter={(v: number) => formatear(v, formato)} width={56} {...EJE} />
          <Tooltip content={Tip} cursor={CURSOR_LINEA} />
          <Area
            type="monotone"
            dataKey={y as string}
            stroke={C.cian}
            strokeWidth={2.5}
            fill={`url(#${gid})`}
            activeDot={{ r: 5, fill: C.cian, stroke: C.noche, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Columnas finas (actividad por día / turno)
// ─────────────────────────────────────────────

export function BarrasFinas<T extends Record<string, unknown>>({
  datos,
  x,
  y,
  formato,
  nombre,
  alto = 220,
}: {
  datos: T[];
  x: keyof T & string;
  y: keyof T & string;
  formato: Formato;
  nombre: string;
  alto?: number;
}) {
  const Tip = tooltip<T>((f) => ({
    titulo: String(f[x]),
    filas: [{ nombre, valor: formatear(Number(f[y]), formato), color: C.blanco }],
  }));
  return (
    <div style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 22, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid {...GRILLA} />
          <XAxis dataKey={x as string} {...EJE} />
          <YAxis hide />
          <Tooltip content={Tip} cursor={CURSOR_BARRA} />
          <Bar dataKey={y as string} fill={C.blanco} radius={[6, 6, 0, 0]} maxBarSize={10} isAnimationActive={false}>
            <LabelList
              dataKey={y as string}
              position="top"
              // Sobre una barra fina la unidad no cabe: solo el número (la unidad va en el título).
              formatter={(v) => (formato === "unidades" ? String(v) : formatear(Number(v), formato))}
              fill={C.blanco}
              fillOpacity={0.8}
              fontSize={11}
              fontFamily="var(--font-jetbrains-mono)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sparkline (KPIs)
// ─────────────────────────────────────────────

export function Sparkline({ datos, formato }: { datos: { fecha: string; valor: number | null }[]; formato: Formato }) {
  const ultimo = [...datos].reverse().find((d) => d.valor !== null);
  const iUltimo = ultimo ? datos.indexOf(ultimo) : -1;
  const Tip = tooltip<{ fecha: string; valor: number | null }>((f) => ({
    titulo: diaCorto(f.fecha),
    filas: [{ nombre: "", valor: f.valor === null ? "sin datos" : formatear(f.valor, formato), color: C.cian }],
  }));
  return (
    <div className="h-12" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 6, right: 6, bottom: 2, left: 6 }}>
          <Tooltip content={Tip} cursor={CURSOR_LINEA} />
          <Line
            type="monotone"
            dataKey="valor"
            stroke={C.blanco}
            strokeOpacity={0.45}
            strokeWidth={2}
            dot={(p: { cx?: number; cy?: number; index?: number }) =>
              p.index === iUltimo && p.cx !== undefined && p.cy !== undefined ? (
                <circle key="ultimo" cx={p.cx} cy={p.cy} r={4} fill={C.cian} stroke={C.noche} strokeWidth={2} />
              ) : (
                <g key={`d${p.index}`} />
              )
            }
            activeDot={{ r: 4, fill: C.cian, stroke: C.noche, strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
