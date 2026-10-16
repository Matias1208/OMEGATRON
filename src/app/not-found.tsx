import Link from "next/link";
import { EmptyState } from "./_components/ui";

export default function NoEncontrado() {
  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <p className="font-mono text-5xl font-semibold text-accent">404</p>
      <EmptyState titulo="Esta pantalla no existe" descripcion="Revisa la dirección o vuelve al centro de control." />
      <Link href="/" className="text-sm text-accent hover:underline">
        Ir al centro de control
      </Link>
    </div>
  );
}
