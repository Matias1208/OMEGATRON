import type { ReactNode } from "react";

/** Une clases ignorando valores falsy. */
export function cx(...clases: (string | false | null | undefined)[]) {
  return clases.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────
// Contenedores
// ─────────────────────────────────────────────

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cx(
        "rounded-xl border border-line bg-surface/90 p-5 shadow-[0_1px_0_0_rgb(255_255_255/0.03)_inset] backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-ink">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-xs text-muted">{descripcion}</p>}
      </div>
      {accion}
    </header>
  );
}

/** Rótulo de sección en mayúsculas técnicas, p.ej. "NIVEL 3 · PILARES". */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{children}</p>;
}

// ─────────────────────────────────────────────
// Semáforo EHS
// ─────────────────────────────────────────────

export type Tono = "OK" | "ATENCION" | "CRITICO" | "NEUTRO" | "ACENTO";

const TONOS: Record<Tono, string> = {
  OK: "border-ok/30 bg-ok/10 text-ok",
  ATENCION: "border-warn/30 bg-warn/10 text-warn",
  CRITICO: "border-danger/30 bg-danger/10 text-danger",
  NEUTRO: "border-line-strong bg-surface-2 text-muted",
  ACENTO: "border-accent/30 bg-accent/10 text-accent",
};

const PUNTOS: Record<Tono, string> = {
  OK: "bg-ok",
  ATENCION: "bg-warn",
  CRITICO: "bg-danger",
  NEUTRO: "bg-faint",
  ACENTO: "bg-accent",
};

export function Badge({ tono = "NEUTRO", children, pulso }: { tono?: Tono; children: ReactNode; pulso?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONOS[tono],
      )}
    >
      <span className="relative flex size-1.5">
        {pulso && <span className={cx("absolute inline-flex size-full animate-ping rounded-full opacity-60", PUNTOS[tono])} />}
        <span className={cx("relative inline-flex size-1.5 rounded-full", PUNTOS[tono])} />
      </span>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────
// Métricas
// ─────────────────────────────────────────────

export function Stat({
  etiqueta,
  valor,
  detalle,
  tono,
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: Tono;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{etiqueta}</p>
        {tono && tono !== "NEUTRO" && <span className={cx("size-2 rounded-full", PUNTOS[tono])} aria-hidden />}
      </div>
      <p className="text-3xl font-semibold tracking-tight text-ink">{valor}</p>
      {detalle && <p className="text-xs text-muted">{detalle}</p>}
    </Card>
  );
}

// ─────────────────────────────────────────────
// Estados: vacío, error, carga
// ─────────────────────────────────────────────

export function EmptyState({ titulo, descripcion }: { titulo: string; descripcion?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{titulo}</p>
      {descripcion && <p className="mt-1 max-w-sm text-xs text-muted">{descripcion}</p>}
    </div>
  );
}

export function ErrorState({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children?: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-5">
      <p className="text-sm font-semibold text-danger">{titulo}</p>
      {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-surface-2", className)} />;
}
