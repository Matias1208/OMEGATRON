"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { NAVEGACION } from "./navegacion";
import { cx } from "./ui";

/**
 * Sidebar fijo. En pantallas grandes muestra el logo completo y las etiquetas; en
 * pantallas chicas se colapsa a un riel de íconos con solo el escudo.
 * Los logos llegan como props porque se resuelven en el servidor (ver Logo).
 */
export function Sidebar({ logoCompleto, logoEscudo }: { logoCompleto: ReactNode; logoEscudo: ReactNode }) {
  const pathname = usePathname();
  const kiosco = useSearchParams().get("kiosco") === "1";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[76px] flex-col border-r border-line bg-night/80 backdrop-blur-xl lg:w-64">
      <Link href="/" aria-label="HARKAI, centro de control" className="flex items-center justify-center px-4 py-6">
        <span className="hidden lg:block">{logoCompleto}</span>
        <span className="lg:hidden">{logoEscudo}</span>
      </Link>

      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-cyan/40 to-transparent" aria-hidden />

      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1.5 p-3 lg:p-4">
        <p className="hidden px-3 pt-2 pb-1 font-mono text-[10px] tracking-[0.2em] text-faint uppercase lg:block">Navegación</p>
        {NAVEGACION.map(({ href, etiqueta, icono: Icono }) => {
          const esKiosco = href.includes("kiosco");
          const activo = esKiosco ? kiosco : !kiosco && (href === "/" ? pathname === "/" : pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              title={etiqueta}
              aria-current={activo ? "page" : undefined}
              className={cx(
                "group flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 lg:justify-start",
                activo
                  ? "bg-cyan/12 font-medium text-white shadow-glow-cyan"
                  : "text-muted hover:bg-white/5 hover:text-white",
              )}
            >
              <span
                className={cx(
                  "grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-200",
                  activo ? "bg-cyan text-night" : "bg-white/5 text-cyan group-hover:bg-cyan/15",
                )}
              >
                <Icono className="size-4" aria-hidden />
              </span>
              <span className="hidden lg:inline">{etiqueta}</span>
            </Link>
          );
        })}
      </nav>

      <div className="m-3 hidden rounded-2xl border border-line bg-gradient-to-br from-cyan/15 to-transparent p-4 lg:block">
        <p className="font-display text-sm font-semibold text-white">Estación EST-01</p>
        <p className="mt-1 text-xs text-muted">Credencial RFID · control de acceso · alertas Telegram</p>
      </div>
    </aside>
  );
}
