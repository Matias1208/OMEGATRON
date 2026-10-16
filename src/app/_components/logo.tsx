import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { cx } from "./ui";
import { Wordmark } from "./wordmark";

export { Wordmark };

/**
 * Logo oficial de HARKAI (escudo cian con montaña + "HARK" blanco / "AI" cian).
 * NO se redibuja: se usan los archivos de marca colocados en public/brand/:
 *   - harkai-logo.(svg|png)    → versión completa (sidebar expandido)
 *   - harkai-escudo.(svg|png)  → solo el escudo (sidebar colapsado, favicon)
 * Mientras no existan, se muestra el nombre en texto con los colores de marca.
 */
const ARCHIVOS = {
  completo: ["harkai-logo.svg", "harkai-logo.png"],
  escudo: ["harkai-escudo.svg", "harkai-escudo.png"],
} as const;

function buscar(variante: keyof typeof ARCHIVOS) {
  const dir = path.join(process.cwd(), "public", "brand");
  const archivo = ARCHIVOS[variante].find((a) => existsSync(path.join(dir, a)));
  return archivo ? `/brand/${archivo}` : null;
}

export function Logo({ variante = "completo", className }: { variante?: "completo" | "escudo"; className?: string }) {
  const src = buscar(variante);
  if (src) {
    return variante === "completo" ? (
      <Image src={src} alt="HARKAI" width={168} height={64} priority className={cx("h-14 w-auto", className)} />
    ) : (
      <Image src={src} alt="HARKAI" width={40} height={40} priority className={cx("size-10", className)} />
    );
  }
  // Sin archivo de marca todavía: solo texto (no se inventa el escudo).
  return variante === "completo" ? (
    <Wordmark className={cx("text-2xl", className)} />
  ) : (
    <Wordmark className={cx("text-[11px] tracking-[0.05em]", className)} />
  );
}
