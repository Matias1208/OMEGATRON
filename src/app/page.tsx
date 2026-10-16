import { getEstadoSistema, type EstadoSistema } from "@/features/dashboard/sistema";
import { getDatosKiosco } from "@/features/dispensa/queries";
import { KioscoPanel } from "./_components/kiosco-panel";
import { Badge, Card, CardHeader, EmptyState, ErrorState, Eyebrow, Stat } from "./_components/ui";

// Datos en vivo de la base: nunca prerenderizar en el build.
export const dynamic = "force-dynamic";

const FLUJO = [
  { paso: "01", titulo: "Lectura RFID", detalle: "El operario acerca su credencial a la estación." },
  { paso: "02", titulo: "Reglas EHS", detalle: "EPP según cargo + tarea del turno y el químico asociado." },
  { paso: "03", titulo: "Vida útil", detalle: "Bloquea retiros excesivos mientras el EPP siga vigente." },
  { paso: "04", titulo: "Stock FEFO", detalle: "Descuenta del lote que vence primero, en una transacción." },
  { paso: "05", titulo: "Dispensación", detalle: "Orden al motor vía Firebase; a la altura del operario." },
  { paso: "06", titulo: "Verificación", detalle: "La cámara confirma el uso; si no, alerta EHS a Telegram." },
];

const horaEcuador = (iso: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );

function Integraciones({ integraciones }: { integraciones: EstadoSistema["integraciones"] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tono="OK">Base de datos</Badge>
      <Badge tono={integraciones.firebase ? "OK" : "ATENCION"}>
        Firebase {integraciones.firebase ? "" : "· sin configurar"}
      </Badge>
      <Badge tono={integraciones.telegram ? "OK" : "ATENCION"}>
        Telegram {integraciones.telegram ? "" : "· sin configurar"}
      </Badge>
      {integraciones.hardwareSimulado && <Badge tono="ACENTO">Hardware simulado</Badge>}
    </div>
  );
}

export default async function CentroDeControl() {
  const estado = await getEstadoSistema();
  // Si la base está caída, getEstadoSistema ya lo informa; el kiosco simplemente no se muestra.
  const datosKiosco = estado.ok ? await getDatosKiosco().catch(() => null) : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Encabezado */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <Eyebrow>Centro de control</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            EPP correcto, a la persona correcta, <span className="text-accent">sin agacharse.</span>
          </h1>
          <p className="mt-3 text-sm text-pretty text-muted sm:text-base">
            Estación inteligente que entrega el equipo de protección según cargo, tarea y químico del turno, controla su
            vida útil e inventario por lote, y verifica su uso con visión artificial.
          </p>
        </div>
        {estado.ok && <Integraciones integraciones={estado.data.integraciones} />}
      </section>

      {!estado.ok ? (
        <ErrorState titulo="Sin conexión con la base de datos" descripcion={estado.error}>
          <p className="font-mono text-xs text-muted">
            Verifica que Docker Desktop esté abierto y ejecuta <span className="text-ink">npm run db:up</span>.
          </p>
        </ErrorState>
      ) : (
        <>
          {/* Indicadores del momento */}
          <section aria-label="Indicadores" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat etiqueta="Entregas de hoy" valor={estado.data.entregasHoy} detalle="EPP dispensados desde las 00:00" />
            <Stat
              etiqueta="Pendientes de cámara"
              valor={estado.data.pendientesCamara}
              detalle="Esperando verificación de uso"
              tono={estado.data.pendientesCamara > 0 ? "ATENCION" : "OK"}
            />
            <Stat
              etiqueta="Alertas pendientes"
              valor={estado.data.alertasPendientes}
              detalle={`${estado.data.alertasCriticas} críticas (stock, EHS, hardware)`}
              tono={estado.data.alertasCriticas > 0 ? "CRITICO" : estado.data.alertasPendientes > 0 ? "ATENCION" : "OK"}
            />
            <Stat etiqueta="Operarios activos" valor={estado.data.operariosActivos} detalle="Con credencial RFID habilitada" />
          </section>

          {datosKiosco && (
            <section aria-label="Dispensación" className="flex flex-col gap-3">
              <Eyebrow>Dispensación en vivo</Eyebrow>
              <KioscoPanel datos={datosKiosco} simulacionCamara={estado.data.integraciones.hardwareSimulado} />
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-5">
            {/* Estaciones */}
            <Card className="lg:col-span-2">
              <CardHeader titulo="Estaciones" descripcion="Dispensadores ESP32 registrados" />
              {estado.data.estaciones.length === 0 ? (
                <EmptyState titulo="Sin estaciones activas" descripcion="Registra una estación para empezar a dispensar." />
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {estado.data.estaciones.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-ink">{e.codigo}</p>
                        <p className="truncate text-xs text-muted">
                          {e.nombre}
                          {e.area && ` · ${e.area}`} · {e.compartimentos} compartimentos
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge tono={e.enLinea ? "OK" : "NEUTRO"} pulso={e.enLinea}>
                          {e.enLinea ? "En línea" : "Sin señal"}
                        </Badge>
                        <span className="text-[11px] text-faint">
                          {e.ultimoPing ? `Último reporte ${horaEcuador(e.ultimoPing)}` : "Nunca reportó"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Flujo */}
            <Card className="lg:col-span-3">
              <CardHeader titulo="Flujo de dispensación" descripcion="Lo que ocurre en cada lectura de credencial" />
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {FLUJO.map((f) => (
                  <li key={f.paso} className="rounded-lg border border-line bg-surface-2/60 p-3">
                    <span className="font-mono text-xs font-semibold text-accent">{f.paso}</span>
                    <p className="mt-1 text-sm font-medium text-ink">{f.titulo}</p>
                    <p className="mt-0.5 text-xs text-muted">{f.detalle}</p>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
