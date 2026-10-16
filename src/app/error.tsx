"use client";

import { useEffect } from "react";
import { ErrorState } from "./_components/ui";

export default function ErrorPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      titulo="Algo salió mal al cargar esta pantalla"
      descripcion="El error quedó registrado en el servidor. Puedes reintentar; si persiste, revisa que la base de datos esté levantada."
    >
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent/50 hover:text-accent"
      >
        Reintentar
      </button>
    </ErrorState>
  );
}
