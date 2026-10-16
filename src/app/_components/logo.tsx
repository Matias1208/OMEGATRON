import Image from "next/image";
import { cx } from "./ui";
import { Wordmark } from "./wordmark";

export { Wordmark };

/**
 * Logo oficial de HARKAI (archivos de marca en public/brand/, no se redibujan):
 *   - harkai-logo.png   (438×532) escudo + "HARKAI" → sidebar expandido
 *   - harkai-escudo.png (158×193) solo el escudo     → sidebar colapsado, kiosco
 * Se sirven como archivos estáticos: funciona igual en local y desplegado.
 */
export function Logo({ variante = "completo", className }: { variante?: "completo" | "escudo"; className?: string }) {
  return variante === "completo" ? (
    <Image
      src="/brand/harkai-logo.png"
      alt="HARKAI"
      width={438}
      height={532}
      priority
      className={cx("h-28 w-auto", className)}
    />
  ) : (
    <Image
      src="/brand/harkai-escudo.png"
      alt="HARKAI"
      width={158}
      height={193}
      priority
      className={cx("h-10 w-auto", className)}
    />
  );
}
