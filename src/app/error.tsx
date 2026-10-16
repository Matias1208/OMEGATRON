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
        className="rounded-xl border border-cyan/50 px-4 py-2 text-sm font-medium text-cyan transition-all duration-200 hover:bg-cyan/10 hover:shadow-glow-cyan"
      >
        Reintentar
      </button>
    </ErrorState>
  );
}
