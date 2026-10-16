import { cx } from "./ui";

/**
 * Medidor circular (arco de 270°) para porcentajes. El arco va de cian a verde y la
 * meta se marca con un trazo blanco. Componente SVG puro: funciona en servidor.
 */
export function Gauge({
  id,
  valor,
  meta,
  etiqueta,
  detalle,
  className,
}: {
  /** Único por página (id del degradado SVG). */
  id: string;
  valor: number | null;
  meta?: number;
  etiqueta: string;
  detalle?: string;
  className?: string;
}) {
  const r = 80;
  const circ = 2 * Math.PI * r;
  const arco = circ * 0.75; // 270°
  const pct = Math.max(0, Math.min(100, valor ?? 0));
  const angulo = (p: number) => ((135 + (p / 100) * 270) * Math.PI) / 180;
  const marca = meta === undefined ? null : { a: angulo(meta) };
  const enMeta = valor !== null && meta !== undefined && valor >= meta;

  return (
    <figure className={cx("flex flex-col items-center", className)}>
      <div className="relative w-full max-w-[220px]">
        <svg viewBox="0 0 200 200" className="w-full" role="img" aria-label={`${etiqueta}: ${valor ?? "sin datos"}%`}>
          <defs>
            <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-cyan)" />
              <stop offset="100%" stopColor="var(--color-green)" />
            </linearGradient>
          </defs>
          {/* Pista */}
          <circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="var(--color-cyan)"
            strokeOpacity={0.12}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${arco} ${circ}`}
            transform="rotate(135 100 100)"
          />
          {/* Valor */}
          {valor !== null && (
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={`url(#${id})`}
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${(arco * pct) / 100} ${circ}`}
              transform="rotate(135 100 100)"
              style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--color-cyan) 55%, transparent))" }}
            />
          )}
          {/* Meta */}
          {marca && (
            <line
              x1={100 + Math.cos(marca.a) * (r - 12)}
              y1={100 + Math.sin(marca.a) * (r - 12)}
              x2={100 + Math.cos(marca.a) * (r + 12)}
              y2={100 + Math.sin(marca.a) * (r + 12)}
              stroke="var(--color-white)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="font-display text-4xl font-bold tracking-tight text-white">
            {valor === null ? "—" : `${valor}%`}
          </span>
          {meta !== undefined && (
            <span className={cx("mt-1 font-mono text-[11px]", enMeta ? "text-green" : "text-cyan")}>
              meta {meta}% · {enMeta ? "cumple" : "bajo meta"}
            </span>
          )}
        </div>
      </div>
      <figcaption className="mt-1 text-center">
        <p className="font-display text-sm font-semibold text-white">{etiqueta}</p>
        {detalle && <p className="mt-0.5 text-xs text-muted">{detalle}</p>}
      </figcaption>
    </figure>
  );
}
