import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  CircleCheck,
  Clock,
  Minus,
  ShieldAlert,
  ShieldOff,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  type LucideProps,
} from "lucide-react";

/** Une clases ignorando valores falsy. */
export function cx(...clases: (string | false | null | undefined)[]) {
  return clases.filter(Boolean).join(" ");
}

type Icono = ComponentType<LucideProps>;

// ─────────────────────────────────────────────
// Contenedores
// ─────────────────────────────────────────────

/** Tarjeta glassmorphism (fondo translúcido, borde cian fino, brillo en hover). */
export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx("glass glass-hover min-w-0 scroll-mt-24 p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  titulo,
  descripcion,
  accion,
  icono: IconoTitulo,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  icono?: Icono;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {IconoTitulo && (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-cyan/10 text-cyan">
            <IconoTitulo className="size-4" aria-hidden />
          </span>
        )}
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-xs text-muted">{descripcion}</p>}
        </div>
      </div>
      {accion}
    </header>
  );
}

/** Rótulo técnico de sección, p.ej. "NIVEL 3 · PILARES". */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] font-medium tracking-[0.2em] text-cyan uppercase">{children}</p>;
}

// ─────────────────────────────────────────────
// Estados: color + ícono + etiqueta (nunca solo color)
// ─────────────────────────────────────────────

export type Tono = "OK" | "ATENCION" | "CRITICO" | "DENEGADO" | "PENDIENTE" | "NEUTRO" | "ACENTO";

const TONOS: Record<Tono, { clase: string; icono: Icono }> = {
  OK: { clase: "border-green/35 bg-green/10 text-green", icono: CircleCheck },
  ATENCION: { clase: "border-cyan/35 bg-cyan/8 text-cyan", icono: TriangleAlert },
  // Crítico: mismo cian que la alerta, pero relleno más intenso + escudo (se distingue sin color).
  CRITICO: { clase: "border-cyan/60 bg-cyan/20 text-cyan shadow-glow-cyan", icono: ShieldAlert },
  DENEGADO: { clase: "border-cyan/60 bg-cyan/15 text-cyan", icono: ShieldOff },
  PENDIENTE: { clase: "border-cyan/30 border-dashed bg-transparent text-cyan", icono: Clock },
  NEUTRO: { clase: "border-line-strong bg-white/5 text-muted", icono: Minus },
  ACENTO: { clase: "border-cyan/35 bg-cyan/10 text-cyan", icono: Activity },
};

export function Badge({ tono = "NEUTRO", children, pulso }: { tono?: Tono; children: ReactNode; pulso?: boolean }) {
  const { clase, icono: IconoTono } = TONOS[tono];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        clase,
        pulso && "animate-pulse",
      )}
    >
      <IconoTono className="size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
// KPIs
// ─────────────────────────────────────────────

/** Variación con flecha + texto; `subeEsBueno` define si subir se pinta verde (bueno) o cian (alerta). */
export function Delta({
  valor,
  sufijo = "%",
  referencia,
  subeEsBueno = true,
}: {
  valor: number | null;
  sufijo?: string;
  referencia: string;
  subeEsBueno?: boolean;
}) {
  if (valor === null) return <span className="text-xs text-faint">Sin dato comparable</span>;
  const sube = valor > 0;
  const bueno = valor === 0 || sube === subeEsBueno;
  const IconoDelta = valor === 0 ? Minus : sube ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={cx("inline-flex items-center gap-0.5 font-semibold", bueno ? "text-green" : "text-cyan")}>
        <IconoDelta className="size-3.5" aria-hidden />
        {sube ? "+" : valor < 0 ? "−" : ""}
        {Math.abs(valor)}
        {sufijo}
      </span>
      <span className="text-faint">{referencia}</span>
    </span>
  );
}

/** Tarjeta pequeña de KPI: valor grande, etiqueta, variación e ícono en círculo cian. */
export function StatCard({
  etiqueta,
  valor,
  detalle,
  icono: IconoKpi,
  resaltado,
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  icono: Icono;
  /** "ok" = brillo verde, "alerta" = brillo cian. */
  resaltado?: "ok" | "alerta";
}) {
  return (
    <div
      className={cx(
        "glass glass-hover flex min-w-0 items-center justify-between gap-4 p-5",
        resaltado === "ok" && "hover:shadow-glow-green",
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{etiqueta}</p>
        <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">{valor}</p>
        {detalle && <div className="mt-1.5">{detalle}</div>}
      </div>
      <span
        className={cx(
          "grid size-12 shrink-0 place-items-center rounded-full",
          resaltado === "ok"
            ? "bg-green/15 text-green shadow-glow-green"
            : "bg-cyan/15 text-cyan shadow-glow-cyan",
        )}
      >
        <IconoKpi className="size-5" aria-hidden />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tabla de datos (logs): filas sutiles, datos técnicos en JetBrains Mono
// ─────────────────────────────────────────────

export type Columna<T> = {
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** Datos técnicos (UID, timestamps, IDs) en monoespaciada. */
  mono?: boolean;
  alinear?: "izquierda" | "derecha";
  className?: string;
};

export function DataTable<T>({
  columnas,
  filas,
  clave,
  vacio = "Sin registros",
  compacta,
}: {
  columnas: Columna<T>[];
  filas: T[];
  clave: (fila: T) => string;
  vacio?: string;
  /** Sin ancho mínimo: para tablas de pocas columnas dentro de tarjetas angostas. */
  compacta?: boolean;
}) {
  if (filas.length === 0) return <EmptyState titulo={vacio} />;
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className={cx("w-full border-separate border-spacing-y-1 px-2 text-left text-sm", !compacta && "min-w-[560px]")}>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th
                key={c.titulo}
                scope="col"
                className={cx(
                  "px-3 pb-2 font-mono text-[10px] font-medium tracking-[0.15em] text-faint uppercase",
                  c.alinear === "derecha" && "text-right",
                )}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={clave(fila)} className="bg-white/[0.025] transition-colors duration-150 hover:bg-cyan/[0.06]">
              {columnas.map((c, i) => (
                <td
                  key={c.titulo}
                  className={cx(
                    "px-3 py-2.5 align-middle",
                    i === 0 && "rounded-l-lg",
                    i === columnas.length - 1 && "rounded-r-lg",
                    c.mono ? "tabular font-mono text-xs text-muted" : "text-ink",
                    c.alinear === "derecha" && "text-right",
                    c.className,
                  )}
                >
                  {c.celda(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// Estados vacíos, de error y de carga
// ─────────────────────────────────────────────

export function EmptyState({ titulo, descripcion }: { titulo: string; descripcion?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-xs text-muted">{descripcion}</p>}
    </div>
  );
}

export function ErrorState({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children?: ReactNode }) {
  return (
    <div role="alert" className="glass flex gap-4 border-cyan/50 p-6">
      <ShieldAlert className="size-6 shrink-0 text-cyan" aria-hidden />
      <div>
        <p className="font-display font-semibold text-cyan">{titulo}</p>
        {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-[var(--radius-card)] bg-white/5", className)} />;
}
