import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function NoEncontrado() {
  return (
    <div className="flex flex-col items-center gap-5 py-20 text-center">
      <span className="grid size-20 place-items-center rounded-full border border-cyan/40 bg-cyan/10 text-cyan shadow-glow-cyan">
        <ShieldOff className="size-9" aria-hidden />
      </span>
      <p className="font-display text-6xl font-bold tracking-tight text-white">404</p>
      <p className="text-muted">Esta pantalla no existe en HARKAI.</p>
      <Link
        href="/"
        className="rounded-xl bg-cyan px-5 py-2.5 font-display text-sm font-bold text-night transition-all duration-200 hover:shadow-glow-cyan"
      >
        Ir al centro de control
      </Link>
    </div>
  );
}
