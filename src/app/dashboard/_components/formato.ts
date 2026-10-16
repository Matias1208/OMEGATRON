// Formateadores compartidos entre componentes de servidor y de cliente (sin "use client").

/** Formatos con nombre: los componentes de servidor no pueden pasar funciones a los de cliente. */
export type Formato = "usd" | "unidades" | "pct";

export const usd = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 100 ? 2 : 0 })}`;

export const formatear = (v: number, f: Formato) => (f === "usd" ? usd(v) : f === "pct" ? `${v}%` : `${v} u.`);
