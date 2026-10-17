import { Suspense, type ReactNode } from "react";
import { Logo } from "./logo";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/* useSearchParams en el sidebar requiere un límite de Suspense */}
      <Suspense>
        <Sidebar logoCompleto={<Logo variante="completo" />} logoEscudo={<Logo variante="escudo" />} />
      </Suspense>

      <div className="flex min-h-dvh flex-col pl-[76px] lg:pl-64">
        <Topbar />
        <main className="w-full flex-1 px-4 py-8 sm:px-8">{children}</main>
        <footer className="border-t border-line px-4 py-4 text-xs text-faint sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>HARKAI · Control de acceso a EPP con RFID y alertas EHS</span>
            <span className="font-mono">Hora Ecuador (UTC-5)</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
