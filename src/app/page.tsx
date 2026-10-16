import { Activity, BellRing, ChartArea, ChartColumn, History, Radio, Router, ScanLine, Users } from "lucide-react";
import Link from "next/link";
import { DIA_MS } from "@/lib/fechas";
import { getConsumoDiario, getConsumoPorTurno, totalesPeriodo } from "@/features/dashboard/queries";
import { getEstadoSistema, type LecturaReciente } from "@/features/dashboard/sistema";
import { getDatosKiosco } from "@/features/dispensa/queries";
import type { EstadoEntrega } from "@prisma/client";
import { AreaSuave, BarrasFinas } from "./_components/charts";
import { Gauge } from "./_components/gauge";
import { Logo } from "./_components/logo";
import { KioscoPanel, KioscoPantalla } from "./_components/kiosco-panel";
import { Badge, Card, CardHeader, DataTable, Delta, EmptyState, ErrorState, StatCard, type Tono } from "./_components/ui";

// Datos en vivo de la base: nunca prerenderizar en el build.
export const dynamic = "force-dynamic";

const ESTADO_LECTURA: Record<EstadoEntrega, { tono: Tono; etiqueta: string }> = {
  VERIFICADO: { tono: "OK", etiqueta: "VERIFICADO" },
  PENDIENTE_VERIFICACION_CAMARA: { tono: "PENDIENTE", etiqueta: "PENDIENTE CÁMARA" },
  INCUMPLIMIENTO_EHS: { tono: "CRITICO", etiqueta: "INCUMPLIMIENTO" },
  FALLIDA: { tono: "NEUTRO", etiqueta: "FALLIDA" },
  ANULADA: { tono: "NEUTRO", etiqueta: "ANULADA" },
};

const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

function saludo() {
  const h = Number(new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", hour: "2-digit", hour12: false }).format(new Date()));
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export default async function CentroDeControl({
  searchParams,
}: {
  searchParams: Promise<{ kiosco?: string; estacion?: string }>;
}) {
  const { kiosco, estacion: estacionParam } = await searchParams;
  const estado = await getEstadoSistema();

  if (!estado.ok) {
    return (
      <ErrorState titulo="Sin conexión con la base de datos" descripcion={estado.error}>
        <p className="font-mono text-xs text-muted">
          Verifica que Docker Desktop esté abierto y ejecuta <span className="text-white">npm run db:up</span>.
        </p>
      </ErrorState>
    );
  }
  const d = estado.data;

  // Modo kiosco: pantalla completa sobre la misma ruta.
  if (kiosco === "1") {
    const est = d.estaciones.find((e) => e.codigo === estacionParam) ?? d.estaciones[0];
    if (!est) return <EmptyState titulo="No hay estaciones activas" descripcion="Registra una estación para usar el kiosco." />;
    return (
      <KioscoPantalla
        estacion={est.codigo}
        nombreEstacion={`${est.codigo} · ${est.area ?? est.nombre}`}
        logo={<Logo variante="escudo" className="h-12" />}
      />
    );
  }

  const hasta = new Date();
  const [datosKiosco, consumo14, turnos, totales] = await Promise.all([
    getDatosKiosco().catch(() => null),
    getConsumoDiario({ desde: new Date(hasta.getTime() - 14 * DIA_MS), hasta }).catch(() => []),
    getConsumoPorTurno({ desde: new Date(hasta.getTime() - 30 * DIA_MS), hasta }).catch(() => []),
    totalesPeriodo({ desde: new Date(hasta.getTime() - 30 * DIA_MS), hasta }).catch(() => null),
  ]);

  const variacionHoy =
    d.entregasAyerMismaHora > 0 ? Math.round(((d.entregasHoy - d.entregasAyerMismaHora) / d.entregasAyerMismaHora) * 100) : null;
  const enLinea = d.estaciones.filter((e) => e.enLinea).length;

  const columnasLecturas = [
    { titulo: "Hora", mono: true, celda: (l: LecturaReciente) => hora(l.fecha) },
    { titulo: "Credencial", mono: true, celda: (l: LecturaReciente) => <span className="text-cyan">{l.rfid}</span> },
    { titulo: "Operario", className: "whitespace-nowrap", celda: (l: LecturaReciente) => l.operario },
    { titulo: "EPP", celda: (l: LecturaReciente) => <span className="text-muted">{l.epp}</span> },
    { titulo: "Estación", mono: true, celda: (l: LecturaReciente) => l.estacion },
    {
      titulo: "Estado",
      alinear: "derecha" as const,
      celda: (l: LecturaReciente) => <Badge tono={ESTADO_LECTURA[l.estado].tono}>{ESTADO_LECTURA[l.estado].etiqueta}</Badge>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs */}
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          etiqueta="EPP entregados hoy"
          valor={d.entregasHoy}
          icono={Activity}
          detalle={<Delta valor={variacionHoy} referencia="vs ayer a esta hora" />}
        />
        <StatCard
          etiqueta="Operarios atendidos"
          valor={d.operariosAtendidosHoy}
          icono={Users}
          resaltado="ok"
          detalle={<span className="text-xs text-faint">de {d.operariosActivos} con credencial activa</span>}
        />
        <StatCard
          etiqueta="Alertas activas"
          valor={d.alertasPendientes}
          icono={BellRing}
          detalle={
            <span className={d.alertasCriticas > 0 ? "text-xs font-medium text-cyan" : "text-xs text-faint"}>
              {d.alertasCriticas} críticas · {d.pendientesCamara} sin verificar
            </span>
          }
        />
        <StatCard
          etiqueta="Lectores en línea"
          valor={`${enLinea}/${d.estaciones.length}`}
          icono={Radio}
          resaltado={enLinea > 0 ? "ok" : undefined}
          detalle={<span className="text-xs text-faint">reporte en los últimos 10 min</span>}
        />
      </section>

      {/* Bienvenida + gauge + estado de integraciones */}
      <section className="grid gap-4 lg:grid-cols-12">
        <div className="glass relative min-w-0 overflow-hidden p-6 sm:p-8 lg:col-span-7">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-cyan/20 blur-3xl" />
          <p className="font-mono text-xs tracking-[0.2em] text-cyan uppercase">Bienvenido de vuelta</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{saludo()}, Supervisor</h1>
          <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
            Hoy se entregaron <span className="font-semibold text-white">{d.entregasHoy} EPP</span> a{" "}
            <span className="font-semibold text-white">{d.operariosAtendidosHoy} operarios</span>
            {d.alertasPendientes > 0 ? (
              <>
                {" "}y hay <span className="font-semibold text-cyan">{d.alertasPendientes} alertas</span> por atender.
              </>
            ) : (
              " sin alertas pendientes."
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/?kiosco=1"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan px-4 py-2.5 font-display text-sm font-bold text-night transition-all duration-200 hover:shadow-glow-cyan"
            >
              <ScanLine className="size-4" aria-hidden /> Abrir kiosco
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-line-strong px-4 py-2.5 text-sm text-white transition-all duration-200 hover:border-cyan/60"
            >
              Ver dashboard
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge tono="OK">Base de datos</Badge>
            <Badge tono={d.integraciones.firebase ? "OK" : "ATENCION"}>Firebase{d.integraciones.firebase ? "" : " · sin configurar"}</Badge>
            <Badge tono={d.integraciones.telegram ? "OK" : "ATENCION"}>Telegram{d.integraciones.telegram ? "" : " · sin configurar"}</Badge>
            {d.integraciones.hardwareSimulado && <Badge tono="ACENTO">Hardware simulado</Badge>}
            {d.integraciones.modoPruebas && <Badge tono="CRITICO">Modo pruebas · sin límite de EPP</Badge>}
          </div>
        </div>

        <Card className="flex flex-col justify-center lg:col-span-5">
          <Gauge
            id="gauge-cumplimiento-home"
            valor={totales?.cumplimientoPct ?? null}
            meta={95}
            etiqueta="Uso correcto del EPP"
            detalle={totales ? `Últimos 30 días · ${totales.verificados} verificados, ${totales.incumplimientos} incumplimientos` : undefined}
          />
        </Card>
      </section>

      {/* Tendencias */}
      <section className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader titulo="EPP entregados por día" descripcion="Últimos 14 días" icono={ChartArea} />
          {consumo14.every((x) => x.unidades === 0) ? (
            <EmptyState titulo="Sin entregas en el período" />
          ) : (
            <AreaSuave datos={consumo14} x="fecha" y="unidades" formato="unidades" nombre="entregados" />
          )}
        </Card>
        <Card className="lg:col-span-4">
          <CardHeader titulo="Actividad por turno" descripcion="Unidades, últimos 30 días" icono={ChartColumn} />
          {turnos.length === 0 ? (
            <EmptyState titulo="Sin actividad" />
          ) : (
            <BarrasFinas datos={turnos} x="turno" y="unidades" formato="unidades" nombre="unidades" />
          )}
        </Card>
      </section>

      {/* Dispensación */}
      {datosKiosco && (
        <Card id="dispensacion">
          <KioscoPanel datos={datosKiosco} simulacionCamara={d.integraciones.hardwareSimulado} />
        </Card>
      )}

      {/* Logs + estaciones */}
      <section className="grid gap-4 lg:grid-cols-12">
        <Card id="lecturas" className="lg:col-span-8">
          <CardHeader titulo="Lecturas recientes" descripcion="Últimas entregas registradas por las estaciones" icono={History} />
          <DataTable columnas={columnasLecturas} filas={d.ultimasLecturas} clave={(l) => l.id} vacio="Aún no hay lecturas" />
        </Card>

        <Card id="estaciones" className="lg:col-span-4">
          <CardHeader titulo="Estaciones" descripcion="Dispensadores ESP32 registrados" icono={Router} />
          {d.estaciones.length === 0 ? (
            <EmptyState titulo="Sin estaciones activas" />
          ) : (
            <ul className="flex flex-col gap-3">
              {d.estaciones.map((e) => (
                <li key={e.id} className="rounded-xl border border-line bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm font-semibold text-white">{e.codigo}</p>
                    <Badge tono={e.enLinea ? "OK" : "NEUTRO"} pulso={e.enLinea}>
                      {e.enLinea ? "En línea" : "Sin señal"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {e.nombre}
                    {e.area && ` · ${e.area}`}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-faint">
                    {e.compartimentos} compartimentos · {e.ultimoPing ? `último reporte ${fechaHora(e.ultimoPing)}` : "nunca reportó"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
