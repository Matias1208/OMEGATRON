"use client";

import { useActionState, useRef, useEffect } from "react";
import { ingresarLote } from "@/features/inventario/actions";
import type { Compartimento } from "@/features/inventario/lotes";

const CAMPO =
  "rounded-xl border border-line bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-faint transition-colors duration-200 focus:border-cyan/60";

/** Reposición de stock: registra un lote nuevo (o suma a uno existente) en un compartimento. */
export function IngresoLoteForm({ compartimentos }: { compartimentos: Compartimento[] }) {
  const [resultado, enviar, pendiente] = useActionState(ingresarLote, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resultado?.ok) form.current?.reset();
  }, [resultado]);

  return (
    <details className="group mt-5 rounded-2xl border border-line bg-cyan/[0.03] p-5 open:bg-cyan/[0.05]">
      <summary className="cursor-pointer font-display text-sm font-semibold text-cyan select-none">+ Registrar ingreso de lote</summary>
      <form ref={form} action={enviar} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-muted lg:col-span-2">
          Compartimento
          <select name="inventarioId" required className={CAMPO} defaultValue="">
            <option value="" disabled className="bg-night">
              Selecciona el EPP…
            </option>
            {compartimentos.map((c) => (
              <option key={c.inventarioId} value={c.inventarioId} className="bg-night">
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Código de lote
          <input name="codigo" required maxLength={40} placeholder="L-2026B" className={`${CAMPO} font-mono tracking-wider uppercase`} />
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
            className="rounded-xl bg-cyan px-5 py-2.5 font-display text-sm font-bold text-night transition-all duration-200 hover:shadow-glow-cyan disabled:opacity-50"
          >
            {pendiente ? "Registrando…" : "Registrar ingreso"}
          </button>
          {resultado && (
            <p role="status" className={resultado.ok ? "text-sm text-green" : "text-sm text-cyan"}>
              {resultado.ok ? "✓ " : "⚠ "}
              {resultado.ok ? `${resultado.mensaje} Stock vigente: ${resultado.stockTotal} u.` : resultado.error}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
