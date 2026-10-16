import { cx } from "./ui";

/** Nombre del producto con los colores de marca: HARK blanco, AI cian. Sin dependencias de servidor. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("font-display font-bold tracking-[0.12em]", className)}>
      <span className="text-white">HARK</span>
      <span className="text-cyan">AI</span>
    </span>
  );
}
