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
      className="shrink-0 rounded-md border border-line-strong px-2.5 py-1 text-xs text-muted transition-colors hover:border-ok/50 hover:text-ok disabled:opacity-50"
    >
      {pendiente ? "…" : error ? "Reintentar" : "Resolver"}
    </button>
  );
}
