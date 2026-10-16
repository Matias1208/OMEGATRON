"use client";

import { useActionState, useRef, useEffect } from "react";
import { ingresarLote } from "@/features/inventario/actions";
import type { Compartimento } from "@/features/inventario/lotes";

const CAMPO =
  "rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent/60";

/** Reposición de stock: registra un lote nuevo (o suma a uno existente) en un compartimento. */
export function IngresoLoteForm({ compartimentos }: { compartimentos: Compartimento[] }) {
  const [resultado, enviar, pendiente] = useActionState(ingresarLote, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resultado?.ok) form.current?.reset();
  }, [resultado]);

  return (
    <details className="group mt-4 rounded-lg border border-line bg-surface-2/40 p-4 open:bg-surface-2/60">
      <summary className="cursor-pointer text-sm font-medium text-accent select-none">+ Registrar ingreso de lote</summary>
      <form ref={form} action={enviar} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-muted lg:col-span-2">
          Compartimento
          <select name="inventarioId" required className={CAMPO} defaultValue="">
            <option value="" disabled>
              Selecciona el EPP…
            </option>
            {compartimentos.map((c) => (
              <option key={c.inventarioId} value={c.inventarioId}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Código de lote
          <input name="codigo" required maxLength={40} placeholder="L-2026B" className={`${CAMPO} font-mono uppercase`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Cantidad
          <input name="cantidad" type="number" required min={1} max={10000} placeholder="50" className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Vence (opcional)
          <input name="fechaVencimiento" type="date" className={CAMPO} />
        </label>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-5">
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {pendiente ? "Registrando…" : "Registrar ingreso"}
          </button>
          {resultado && (
            <p role="status" className={resultado.ok ? "text-sm text-ok" : "text-sm text-danger"}>
              {resultado.ok ? `${resultado.mensaje} Stock vigente: ${resultado.stockTotal} u.` : resultado.error}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
