"use client";

import { useState, useTransition } from "react";
import { resolverAlerta } from "@/features/alertas/actions";

export function BotonResolver({ id }: { id: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState(false);

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          const { ok } = await resolverAlerta(id);
          setError(!ok);
        })
      }
      className="shrink-0 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 hover:border-green/60 hover:text-green hover:shadow-glow-green disabled:opacity-50"
    >
      {pendiente ? "…" : error ? "Reintentar" : "Resolver"}
    </button>
  );
}
