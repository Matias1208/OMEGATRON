import Link from "next/link";
import type { ReactNode } from "react";
import { NavLinks } from "./nav-links";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="OMEGATRON, inicio">
      {/* Isotipo: Ω dentro de un hexágono (estación industrial) */}
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <path d="M16 2 28.1 9v14L16 30 3.9 23V9z" fill="rgb(34 211 238 / 0.08)" stroke="#22d3ee" strokeWidth="1.5" />
        <path
          d="M11 21.5h3.2v-1.6a5.2 5.2 0 1 1 3.6 0v1.6H21"
          fill="none"
          stroke="#e6edf5"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="leading-tight">
        <span className="block font-mono text-sm font-semibold tracking-[0.2em] text-ink">OMEGATRON</span>
        <span className="block text-[11px] text-muted">Estación inteligente de EPP</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <div className="h-6 w-px bg-line" aria-hidden />
          <NavLinks />
          <span className="ml-auto hidden font-mono text-[11px] tracking-wider text-faint md:block">
            EXPO CLEAN 2026 · RETO 5
          </span>
        </div>
        {/* Línea de acento */}
        <div className="h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" aria-hidden />
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-faint sm:px-6">
          <span>OMEGATRON · Monitoreo ergonómico y gestión inteligente de EPP</span>
          <span className="font-mono">Hora Ecuador (UTC-5)</span>
        </div>
      </footer>
    </div>
  );
}
