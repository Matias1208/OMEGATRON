"use client";

import { useRef, useState, useTransition } from "react";
import { dispensarEnKiosco, simularVeredictoCamara } from "@/features/dispensa/actions";
import type { DatosKiosco } from "@/features/dispensa/queries";
import type { CodigoRechazo, ResultadoDispensacion } from "@/features/dispensa/types";
import { Badge, Card, CardHeader, EmptyState, cx, type Tono } from "./ui";

type Veredicto = { estado: "VERIFICADO" | "INCUMPLIMIENTO_EHS"; entregas: number } | { error: string };

const RECHAZOS: Record<CodigoRechazo, { titulo: string; tono: Tono }> = {
  RETIRO_EXCESIVO: { titulo: "Retiro bloqueado: EPP aún vigente", tono: "ATENCION" },
  OPERARIO_NO_ENCONTRADO: { titulo: "Credencial no registrada", tono: "CRITICO" },
  OPERARIO_INACTIVO: { titulo: "Operario inactivo", tono: "CRITICO" },
  SIN_STOCK: { titulo: "Sin stock del EPP requerido", tono: "CRITICO" },
  SIN_EPP_ASIGNADO: { titulo: "Sin EPP configurado para su cargo/tarea", tono: "ATENCION" },
  ESTACION_NO_ENCONTRADA: { titulo: "Estación no disponible", tono: "CRITICO" },
  ESTACION_SIN_AREA: { titulo: "Estación sin área asignada", tono: "CRITICO" },
  AREA_NO_ENCONTRADA: { titulo: "Área no registrada", tono: "CRITICO" },
  HARDWARE_NO_DISPONIBLE: { titulo: "El dispensador no respondió", tono: "CRITICO" },
  DATOS_INVALIDOS: { titulo: "Credencial ilegible", tono: "ATENCION" },
  ERROR_INTERNO: { titulo: "Error interno", tono: "CRITICO" },
};

const RIESGO_TONO: Record<string, Tono> = { BAJO: "OK", MEDIO: "ACENTO", ALTO: "ATENCION", CRITICO: "CRITICO" };

const usd = (n: number) => `$${n.toFixed(2)}`;
const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );

export function KioscoPanel({ datos, simulacionCamara }: { datos: DatosKiosco; simulacionCamara: boolean }) {
  const [estacion, setEstacion] = useState(datos.estaciones[0]?.codigo ?? "");
  const [rfid, setRfid] = useState("");
  const [resultado, setResultado] = useState<ResultadoDispensacion | null>(null);
  const [veredicto, setVeredicto] = useState<Veredicto | null>(null);
  const [pendiente, iniciar] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function dispensar(uid: string) {
    if (!uid.trim() || !estacion) return;
    setVeredicto(null);
    iniciar(async () => {
      try {
        setResultado(await dispensarEnKiosco(uid, estacion));
      } catch {
        setResultado({ ok: false, codigo: "ERROR_INTERNO", mensaje: "No se pudo contactar al servidor." });
      }
      setRfid("");
      inputRef.current?.focus(); // listo para la siguiente credencial
    });
  }

  function enviarVeredicto(entregaId: string, detectado: boolean) {
    iniciar(async () => {
      const r = await simularVeredictoCamara(entregaId, detectado);
      setVeredicto(r.ok ? { estado: r.estado as "VERIFICADO" | "INCUMPLIMIENTO_EHS", entregas: r.entregasActualizadas } : { error: r.error });
    });
  }

  if (datos.estaciones.length === 0) {
    return (
      <Card>
        <CardHeader titulo="Estación de dispensación" />
        <EmptyState titulo="No hay estaciones activas" descripcion="Registra una estación para poder dispensar EPP." />
      </Card>
    );
  }

  return (
    <Card className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* Entrada de credencial */}
      <div className="flex flex-col gap-4">
        <CardHeader
          titulo="Estación de dispensación"
          descripcion="Acerque la credencial al lector USB o escriba el UID. Mismo flujo que la ESP32."
        />

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            dispensar(rfid);
          }}
        >
          {datos.estaciones.length > 1 && (
            <label className="flex flex-col gap-1 text-xs text-muted">
              Estación
              <select
                value={estacion}
                onChange={(e) => setEstacion(e.target.value)}
                className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink"
              >
                {datos.estaciones.map((e) => (
                  <option key={e.codigo} value={e.codigo}>
                    {e.codigo} · {e.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-xs text-muted">
            Credencial RFID
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={rfid}
                onChange={(e) => setRfid(e.target.value.toUpperCase())}
                placeholder="Ej. D21CF01B"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                className="min-w-0 flex-1 rounded-md border border-line-strong bg-surface-2 px-3 py-2 font-mono text-base tracking-widest text-ink placeholder:text-faint focus:border-accent/60"
              />
              <button
                type="submit"
                disabled={pendiente || !rfid.trim()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pendiente ? "Validando…" : "Dispensar"}
              </button>
            </div>
          </label>
        </form>

        <div>
          <p className="mb-2 text-xs text-faint">Credenciales registradas</p>
          <div className="flex flex-wrap gap-2">
            {datos.operarios.map((o) => (
              <button
                key={o.rfid}
                type="button"
                disabled={pendiente}
                onClick={() => dispensar(o.rfid)}
                title={`${o.cargo}${o.activo ? "" : " · inactivo"}`}
                className={cx(
                  "rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors disabled:opacity-50",
                  o.activo
                    ? "border-line-strong bg-surface-2 text-ink hover:border-accent/50"
                    : "border-line bg-transparent text-faint hover:border-danger/40",
                )}
              >
                <span className="block font-medium">{o.nombre}</span>
                <span className="block font-mono text-[11px] text-muted">{o.rfid}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div aria-live="polite" className="min-h-64 rounded-lg border border-line bg-canvas/60 p-4">
        {pendiente && !resultado ? (
          <p className="text-sm text-muted">Validando operario, turno y vida útil…</p>
        ) : !resultado ? (
          <EmptyState titulo="Esperando credencial" descripcion="El resultado de la validación EHS aparecerá aquí." />
        ) : resultado.ok ? (
          <div className={cx("flex flex-col gap-4", pendiente && "opacity-60")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-ink">{resultado.operario.nombre}</p>
                <p className="text-xs text-muted">
                  {resultado.operario.cargo} · {resultado.area.nombre}
                </p>
              </div>
              {resultado.comandoMotor && (
                <Badge tono="OK" pulso>
                  Motor {resultado.comandoMotor.motor} · {resultado.comandoMotor.epp}
                  {resultado.comandoMotor.simulado && " (simulado)"}
                </Badge>
              )}
            </div>

            {resultado.tarea ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>
                  Tarea: <span className="text-ink">{resultado.tarea.nombre}</span>
                  {resultado.turno && ` · turno ${resultado.turno}`}
                </span>
                <Badge tono={RIESGO_TONO[resultado.tarea.nivelRiesgo] ?? "NEUTRO"}>Riesgo {resultado.tarea.nivelRiesgo.toLowerCase()}</Badge>
                {resultado.origenTarea === "TAREA_HABITUAL" && <Badge tono="NEUTRO">Tarea habitual (sin asignación hoy)</Badge>}
              </div>
            ) : (
              <p className="text-xs text-muted">Sin tarea asignada: solo EPP base del cargo.</p>
            )}

            <div>
              <p className="mb-2 text-xs font-medium text-ok">Entregado ({resultado.entregas.length})</p>
              <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
                {resultado.entregas.map((e) => (
                  <li key={e.entregaId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-ink">
                      {e.cantidad > 1 && `${e.cantidad}× `}
                      {e.nombre}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-faint">
                      lote {e.loteCodigo} · {usd(e.costoTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {resultado.bloqueados.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-warn">Aún vigente, no se entrega ({resultado.bloqueados.length})</p>
                <ul className="flex flex-col gap-1 text-xs text-muted">
                  {resultado.bloqueados.map((b) => (
                    <li key={b.eppId}>
                      {b.nombre} <span className="text-faint">· renovable desde {fechaCorta(b.vigenteHasta)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {resultado.sinStock.length > 0 && (
              <p className="text-xs text-danger">Sin stock en esta estación: {resultado.sinStock.map((s) => s.nombre).join(", ")}</p>
            )}

            {/* Verificación por cámara */}
            {resultado.comandoMotor && (
              <div className="border-t border-line pt-3">
                {veredicto ? (
                  "error" in veredicto ? (
                    <p className="text-xs text-danger">{veredicto.error}</p>
                  ) : (
                    <Badge tono={veredicto.estado === "VERIFICADO" ? "OK" : "CRITICO"}>
                      {veredicto.estado === "VERIFICADO" ? "Uso verificado por cámara" : "Incumplimiento EHS: alerta enviada"} ·{" "}
                      {veredicto.entregas} EPP
                    </Badge>
                  )
                ) : simulacionCamara ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">Simular cámara:</span>
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => enviarVeredicto(resultado.comandoMotor!.entregaId, true)}
                      className="rounded-md border border-ok/40 px-2.5 py-1 text-xs text-ok hover:bg-ok/10 disabled:opacity-50"
                    >
                      Se colocó el EPP
                    </button>
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => enviarVeredicto(resultado.comandoMotor!.entregaId, false)}
                      className="rounded-md border border-danger/40 px-2.5 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      No se lo colocó
                    </button>
                  </div>
                ) : (
                  <Badge tono="ACENTO" pulso>
                    Esperando verificación de la cámara
                  </Badge>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className={cx("flex flex-col gap-3", pendiente && "opacity-60")}>
            <Badge tono={RECHAZOS[resultado.codigo].tono}>{RECHAZOS[resultado.codigo].titulo}</Badge>
            <p className="text-sm text-ink">{resultado.mensaje}</p>
            {resultado.bloqueados && resultado.bloqueados.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-muted">
                {resultado.bloqueados.map((b) => (
                  <li key={b.eppId}>
                    {b.nombre} <span className="text-faint">· renovable desde {fechaCorta(b.vigenteHasta)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
