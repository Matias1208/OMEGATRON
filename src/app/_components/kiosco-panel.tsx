"use client";

import { CircleCheck, Clock, CreditCard, ScanLine, ShieldOff, TriangleAlert, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { dispensarEnKiosco } from "@/features/dispensa/actions";
import type { DatosKiosco } from "@/features/dispensa/queries";
import type { CodigoRechazo, ResultadoDispensacion } from "@/features/dispensa/types";
import { Badge, CardHeader, EmptyState, cx, type Tono } from "./ui";
import { Wordmark } from "./wordmark";

// ─────────────────────────────────────────────
// Presentación de cada resultado: color + ícono + etiqueta
// ─────────────────────────────────────────────

type Clase = "CONCEDIDO" | "DENEGADO" | "ALERTA";

const CLASE_RECHAZO: Record<CodigoRechazo, { clase: Clase; titulo: string }> = {
  RETIRO_EXCESIVO: { clase: "DENEGADO", titulo: "EPP aún vigente" },
  OPERARIO_NO_ENCONTRADO: { clase: "DENEGADO", titulo: "Credencial no registrada" },
  OPERARIO_INACTIVO: { clase: "DENEGADO", titulo: "Operario inactivo" },
  SIN_EPP_ASIGNADO: { clase: "DENEGADO", titulo: "Sin EPP para su cargo/tarea" },
  DATOS_INVALIDOS: { clase: "DENEGADO", titulo: "Credencial ilegible" },
  SIN_STOCK: { clase: "DENEGADO", titulo: "Sin stock del EPP requerido" },
  ESTACION_NO_ENCONTRADA: { clase: "ALERTA", titulo: "Estación no disponible" },
  ESTACION_SIN_AREA: { clase: "ALERTA", titulo: "Estación sin área asignada" },
  AREA_NO_ENCONTRADA: { clase: "ALERTA", titulo: "Área no registrada" },
  HARDWARE_NO_DISPONIBLE: { clase: "ALERTA", titulo: "El dispensador no respondió" },
  ERROR_INTERNO: { clase: "ALERTA", titulo: "Error interno" },
};

const PRESENTACION: Record<Clase, { etiqueta: string; icono: LucideIcon; tono: Tono; texto: string; fondo: string }> = {
  CONCEDIDO: {
    etiqueta: "ACCESO CONCEDIDO",
    icono: CircleCheck,
    tono: "OK",
    texto: "text-green",
    fondo: "border-green/50 bg-green/10 shadow-glow-green",
  },
  DENEGADO: {
    etiqueta: "DENEGADO",
    icono: ShieldOff,
    tono: "DENEGADO",
    texto: "text-cyan",
    fondo: "border-cyan/60 bg-cyan/10 shadow-glow-cyan",
  },
  ALERTA: {
    etiqueta: "ALERTA",
    icono: TriangleAlert,
    tono: "ATENCION",
    texto: "text-cyan",
    fondo: "border-cyan/60 bg-cyan/10 shadow-glow-cyan",
  },
};

const RIESGO_TONO: Record<string, Tono> = { BAJO: "OK", MEDIO: "ACENTO", ALTO: "ATENCION", CRITICO: "CRITICO" };

const usd = (n: number) => `$${n.toFixed(2)}`;
const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

function clasificar(r: ResultadoDispensacion): { clase: Clase; titulo: string } {
  return r.ok ? { clase: "CONCEDIDO", titulo: "Retire su EPP" } : CLASE_RECHAZO[r.codigo];
}

/** Lógica compartida entre el panel y la pantalla completa: lectura → server action → resultado. */
function useDispensacion(estacion: string) {
  const [resultado, setResultado] = useState<ResultadoDispensacion | null>(null);
  const [pendiente, iniciar] = useTransition();

  function dispensar(uid: string, alTerminar?: () => void) {
    if (!uid.trim() || !estacion) return;
    iniciar(async () => {
      try {
        setResultado(await dispensarEnKiosco(uid, estacion));
      } catch {
        setResultado({ ok: false, codigo: "ERROR_INTERNO", mensaje: "No se pudo contactar al servidor." });
      }
      alTerminar?.();
    });
  }

  return { resultado, setResultado, pendiente, dispensar };
}

function ListaBloqueados({ bloqueados }: { bloqueados: { eppId: string; nombre: string; vigenteHasta: string }[] }) {
  return (
    <ul className="flex flex-col gap-1 text-xs text-muted">
      {bloqueados.map((b) => (
        <li key={b.eppId}>
          {b.nombre} <span className="font-mono text-faint">· renovable {fechaCorta(b.vigenteHasta)}</span>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────
// Panel (centro de control)
// ─────────────────────────────────────────────

export function KioscoPanel({ datos }: { datos: DatosKiosco }) {
  const [estacion, setEstacion] = useState(datos.estaciones[0]?.codigo ?? "");
  const [rfid, setRfid] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { resultado, pendiente, dispensar } = useDispensacion(estacion);

  if (datos.estaciones.length === 0) {
    return <EmptyState titulo="No hay estaciones activas" descripcion="Registra una estación para poder dispensar EPP." />;
  }

  const enviar = (uid: string) =>
    dispensar(uid, () => {
      setRfid("");
      inputRef.current?.focus();
    });
  const vista = resultado ? clasificar(resultado) : null;
  const pres = vista ? PRESENTACION[vista.clase] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* Entrada */}
      <div className="flex flex-col gap-5">
        <CardHeader
          titulo="Dispensación"
          descripcion="Lector RFID USB o UID manual. Mismo flujo que la estación ESP32."
          icono={ScanLine}
          accion={
            <Link
              href={`/?kiosco=1&estacion=${encodeURIComponent(estacion)}`}
              className="shrink-0 rounded-lg border border-cyan/40 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-cyan transition-all duration-200 hover:bg-cyan/10 hover:shadow-glow-cyan"
            >
              Pantalla completa
            </Link>
          }
        />

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(rfid);
          }}
        >
          {datos.estaciones.length > 1 && (
            <label className="flex flex-col gap-1 text-xs text-muted">
              Estación
              <select
                value={estacion}
                onChange={(e) => setEstacion(e.target.value)}
                className="rounded-xl border border-line bg-white/5 px-3 py-2.5 font-mono text-sm text-white"
              >
                {datos.estaciones.map((e) => (
                  <option key={e.codigo} value={e.codigo} className="bg-night">
                    {e.codigo} · {e.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Credencial RFID
            <div className="flex gap-2">
              <span className="relative min-w-0 flex-1">
                <CreditCard className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-cyan" aria-hidden />
                <input
                  ref={inputRef}
                  value={rfid}
                  onChange={(e) => setRfid(e.target.value.toUpperCase())}
                  placeholder="D21CF01B"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-xl border border-line bg-white/5 py-2.5 pr-3 pl-9 font-mono text-base tracking-[0.2em] text-white placeholder:text-faint transition-colors duration-200 focus:border-cyan/60"
                />
              </span>
              <button
                type="submit"
                disabled={pendiente || !rfid.trim()}
                className="rounded-xl bg-cyan px-5 py-2.5 font-display text-sm font-bold text-night transition-all duration-200 hover:shadow-glow-cyan disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pendiente ? "Validando…" : "Dispensar"}
              </button>
            </div>
          </label>
        </form>

        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.15em] text-faint uppercase">Credenciales registradas</p>
          <div className="flex flex-wrap gap-2">
            {datos.operarios.map((o) => (
              <button
                key={o.rfid}
                type="button"
                disabled={pendiente}
                onClick={() => enviar(o.rfid)}
                title={`${o.cargo}${o.activo ? "" : " · inactivo"}`}
                className={cx(
                  "rounded-xl border px-3 py-2 text-left text-xs transition-all duration-200 disabled:opacity-50",
                  o.activo ? "border-line bg-white/[0.03] hover:border-cyan/50 hover:shadow-glow-cyan" : "border-dashed border-line text-faint",
                )}
              >
                <span className="block font-medium text-white">{o.nombre}</span>
                <span className="block font-mono text-[11px] text-cyan/80">{o.rfid}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div aria-live="polite" className={cx("min-h-72 rounded-2xl border p-5 transition-all duration-200", pres ? pres.fondo : "border-line bg-white/[0.02]")}>
        {!resultado || !pres || !vista ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-cyan/10 text-cyan shadow-glow-cyan">
              <ScanLine className="size-6" aria-hidden />
            </span>
            <p className="font-display text-lg font-semibold text-white">{pendiente ? "Validando reglas EHS…" : "Esperando credencial"}</p>
            <p className="text-xs text-muted">Operario, turno, vida útil y stock se validan en cada lectura.</p>
          </div>
        ) : (
          <div className={cx("flex flex-col gap-4", pendiente && "opacity-60")}>
            <div className="flex items-center gap-3">
              <pres.icono className={cx("size-9 shrink-0", pres.texto)} aria-hidden />
              <div>
                <p className={cx("font-display text-xl font-bold tracking-wide", pres.texto)}>{pres.etiqueta}</p>
                <p className="text-sm text-white">{vista.titulo}</p>
              </div>
            </div>

            {resultado.ok ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-semibold text-white">{resultado.operario.nombre}</span>
                  <span className="text-xs text-muted">
                    {resultado.operario.cargo} · {resultado.area.nombre}
                  </span>
                </div>
                {resultado.tarea ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>
                      Tarea <span className="text-white">{resultado.tarea.nombre}</span>
                      {resultado.turno && ` · turno ${resultado.turno}`}
                    </span>
                    <Badge tono={RIESGO_TONO[resultado.tarea.nivelRiesgo] ?? "NEUTRO"}>Riesgo {resultado.tarea.nivelRiesgo.toLowerCase()}</Badge>
                    {resultado.origenTarea === "TAREA_HABITUAL" && <Badge tono="NEUTRO">Tarea habitual</Badge>}
                  </div>
                ) : (
                  <p className="text-xs text-muted">Sin tarea asignada: solo EPP base del cargo.</p>
                )}

                <ul className="flex flex-col gap-1">
                  {resultado.entregas.map((e) => (
                    <li key={e.entregaId} className="flex items-center justify-between gap-3 rounded-lg bg-night/50 px-3 py-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2 truncate text-white">
                        <CircleCheck className="size-4 shrink-0 text-green" aria-hidden />
                        {e.cantidad > 1 && `${e.cantidad}× `}
                        {e.nombre}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-faint">
                        {e.loteCodigo} · {usd(e.costoTotal)}
                      </span>
                    </li>
                  ))}
                </ul>
                {resultado.bloqueados.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-cyan">Aún vigente, no se entrega</p>
                    <ListaBloqueados bloqueados={resultado.bloqueados} />
                  </div>
                )}
                {resultado.sinStock.length > 0 && (
                  <p className="text-xs text-cyan">Sin stock: {resultado.sinStock.map((s) => s.nombre).join(", ")}</p>
                )}
                {resultado.comandoMotor && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <Badge tono="OK">
                      Motor {resultado.comandoMotor.motor} · {resultado.comandoMotor.epp}
                    </Badge>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-white">{resultado.mensaje}</p>
                {resultado.bloqueados && resultado.bloqueados.length > 0 && <ListaBloqueados bloqueados={resultado.bloqueados} />}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pantalla completa (modo kiosco): para leerse desde lejos
// ─────────────────────────────────────────────

const REINICIO_MS = 7000;

function Reloj() {
  const [hora, setHora] = useState("");
  useEffect(() => {
    const f = () =>
      setHora(new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", hour: "2-digit", minute: "2-digit" }).format(new Date()));
    f();
    const t = setInterval(f, 15_000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-2xl text-muted">{hora}</span>;
}

export function KioscoPantalla({
  estacion,
  nombreEstacion,
  logo,
}: {
  estacion: string;
  nombreEstacion: ReactNode;
  /** Escudo de marca (se resuelve en el servidor). */
  logo?: ReactNode;
}) {
  const [rfid, setRfid] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { resultado, setResultado, pendiente, dispensar } = useDispensacion(estacion);

  // El lector USB "teclea" el UID + Enter: el campo debe tener el foco siempre.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.activeElement !== inputRef.current) inputRef.current?.focus();
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Vuelve a la pantalla de espera tras unos segundos.
  useEffect(() => {
    if (!resultado) return;
    const t = setTimeout(() => setResultado(null), REINICIO_MS);
    return () => clearTimeout(t);
  }, [resultado, setResultado]);

  const vista = resultado ? clasificar(resultado) : null;
  const pres = vista ? PRESENTACION[vista.clase] : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-auto bg-night font-display">
      {/* Fondo de marca */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,color-mix(in_srgb,var(--color-cyan)_18%,transparent),transparent_45%),radial-gradient(circle_at_100%_100%,color-mix(in_srgb,var(--color-cyan)_14%,transparent),transparent_45%)]"
      />

      <header className="relative flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-4">
          {logo}
          <Wordmark className="text-3xl" />
          <span className="font-mono text-sm text-muted">{nombreEstacion}</span>
        </div>
        <div className="flex items-center gap-6">
          <Reloj />
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-muted transition-colors duration-200 hover:border-cyan/50 hover:text-white"
          >
            <X className="size-4" aria-hidden /> Salir del kiosco
          </Link>
        </div>
      </header>

      <main aria-live="assertive" className="relative flex flex-1 items-center justify-center px-8 pb-12">
        {!resultado || !pres || !vista ? (
          <div className="flex flex-col items-center gap-8 text-center">
            <span className="grid size-44 place-items-center rounded-full border-2 border-cyan/50 bg-cyan/10 text-cyan shadow-glow-cyan">
              {pendiente ? <Clock className="size-20 animate-pulse" aria-hidden /> : <ScanLine className="size-20" aria-hidden />}
            </span>
            <div>
              <p className="text-6xl font-bold tracking-tight text-white">{pendiente ? "Validando…" : "Acerque su credencial"}</p>
              <p className="mt-4 text-2xl text-muted">El EPP de su turno se entrega a la altura de su mano.</p>
            </div>
          </div>
        ) : (
          <div className={cx("w-full max-w-4xl rounded-[2rem] border-2 p-12 text-center", pres.fondo)}>
            <pres.icono className={cx("mx-auto size-32", pres.texto)} strokeWidth={1.5} aria-hidden />
            <p className={cx("mt-6 text-7xl font-bold tracking-[0.06em]", pres.texto)}>{pres.etiqueta}</p>
            {resultado.ok ? (
              <>
                <p className="mt-4 text-4xl font-semibold text-white">{resultado.operario.nombre}</p>
                <p className="mt-6 text-2xl text-muted">Retire su EPP:</p>
                <p className="mt-2 text-3xl font-semibold text-white">{resultado.entregas.map((e) => e.nombre).join(" · ")}</p>
                {resultado.bloqueados.length > 0 && (
                  <p className="mt-6 font-mono text-lg text-muted">
                    Aún vigente: {resultado.bloqueados.map((b) => b.nombre).join(", ")}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-4 text-4xl font-semibold text-white">{vista.titulo}</p>
                <p className="mt-4 text-2xl text-muted">{resultado.mensaje}</p>
              </>
            )}
          </div>
        )}
      </main>

      {/* El lector USB escribe aquí el UID + Enter (siempre montado: el siguiente operario no espera). */}
      <footer className="relative flex justify-center pb-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            dispensar(rfid, () => setRfid(""));
          }}
        >
          <input
            ref={inputRef}
            value={rfid}
            onChange={(e) => setRfid(e.target.value.toUpperCase())}
            placeholder="UID de la credencial"
            aria-label="UID de la credencial"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="w-96 max-w-[80vw] rounded-xl border border-line bg-white/5 px-4 py-3 text-center font-mono text-xl tracking-[0.2em] text-white placeholder:tracking-normal placeholder:text-faint focus:border-cyan/60"
          />
        </form>
      </footer>
    </div>
  );
}
