"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVEGACION } from "./navegacion";
import { cx } from "./ui";

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex items-center gap-1 overflow-x-auto">
      {NAVEGACION.map(({ href, etiqueta }) => {
        const activo = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={cx(
              "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
              activo ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
