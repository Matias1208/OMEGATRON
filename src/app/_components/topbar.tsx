"use client";

import { ChevronRight, Search, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DESTINOS_BUSQUEDA, TITULO_RUTA } from "./navegacion";

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function Reloj() {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    setAhora(new Date());
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!ahora) return null;
  return (
    <span className="font-mono text-[11px] text-faint">
      {new Intl.DateTimeFormat("es-EC", {
        timeZone: "America/Guayaquil",
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(ahora)}
    </span>
  );
}

/** Barra superior: breadcrumb, buscador de secciones y usuario. */
export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [consulta, setConsulta] = useState("");
  const [sinResultado, setSinResultado] = useState(false);
  const titulo = TITULO_RUTA[pathname] ?? "HARKAI";

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = normalizar(consulta.trim());
    const destino = q && DESTINOS_BUSQUEDA.find((d) => normalizar(d.etiqueta).includes(q));
    if (!destino) {
      setSinResultado(true);
      return;
    }
    setSinResultado(false);
    setConsulta("");
    router.push(destino.href);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-night/70 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-8">
        <div className="min-w-0">
          <nav aria-label="Ruta" className="flex items-center gap-1 text-xs text-faint">
            <span>HARKAI</span>
            <ChevronRight className="size-3" aria-hidden />
            <span className="truncate text-muted">{titulo}</span>
          </nav>
          <p className="truncate font-display text-sm font-semibold text-white">{titulo}</p>
        </div>

        <form role="search" onSubmit={buscar} className="ml-auto hidden md:block">
          <label className="relative block">
            <span className="sr-only">Buscar sección</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              list="destinos-busqueda"
              value={consulta}
              onChange={(e) => {
                setConsulta(e.target.value);
                setSinResultado(false);
              }}
              placeholder="Buscar: inventario, alertas, kiosco…"
              aria-invalid={sinResultado}
              className="w-72 rounded-xl border border-line bg-white/5 py-2 pr-3 pl-9 text-sm text-white placeholder:text-faint transition-colors duration-200 focus:border-cyan/60 focus:bg-white/[0.07]"
            />
            <datalist id="destinos-busqueda">
              {DESTINOS_BUSQUEDA.map((d) => (
                <option key={d.href} value={d.etiqueta} />
              ))}
            </datalist>
          </label>
          {sinResultado && <p className="absolute mt-1 text-[11px] text-cyan">Sin coincidencias</p>}
        </form>

        <div className="ml-auto flex items-center gap-3 md:ml-0">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">Supervisor EHS</p>
            <Reloj />
          </div>
          <span className="grid size-9 place-items-center rounded-full border border-cyan/40 bg-cyan/10 text-cyan">
            <UserRound className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </header>
  );
}
