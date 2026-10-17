import type { Metadata } from "next";
import Link from "next/link";
import {
  BellRing,
  Boxes,
  CalendarClock,
  ChartArea,
  CircleDollarSign,
  Clock,
  HardHat,
  Layers,
  Package,
  ShieldCheck,
  Target,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { getResumenGerencial } from "@/features/dashboard/resumen";
import { getCompartimentos, type Compartimento } from "@/features/inventario/lotes";
import type { KpiEstrategico, Pilar, Semaforo } from "@/features/dashboard/types";
import { etiquetaMotivoLectura } from "@/features/lecturas/motivos";
import { AreaSuave, Sparkline } from "../_components/charts";
import { Gauge } from "../_components/gauge";
import { Badge, Card, DataTable, Delta, ErrorState, Eyebrow, cx, type Tono } from "../_components/ui";
import { BarrasHorizontales, GraficoCostoPorArea, GraficoLecturasArea, GraficoReemplazos } from "./_components/graficos";
import { SERIES_LECTURAS } from "./_components/series";
import { usd } from "./_components/formato";
import { BotonResolver } from "./_components/boton-resolver";
import { IngresoLoteForm } from "./_components/ingreso-lote-form";
import { Panel } from "./_components/panel";

export const metadata: Metadata = { title: "Dashboard gerencial" };
export const dynamic = "force-dynamic";

const PERIODOS = [7, 30, 90] as const;

const ETIQUETA_ESTADO: Record<Semaforo, string> = { OK: "En meta", ATENCION: "Atención", CRITICO: "Crítico" };
const ICONO_PILAR: Record<Pilar, LucideIcon> = { COSTO: CircleDollarSign, ACCESOS: ShieldCheck, INVENTARIO: Package };
const ETIQUETA_ALERTA: Record<string, string> = {
  STOCK_BAJO: "Stock bajo",
  LOTE_POR_VENCER: "Lote por vencer",
  VIDA_UTIL_VENCIDA: "Vida útil cumplida",
  RETIRO_EXCESIVO: "Retiro excesivo",
  FALLA_HARDWARE: "Falla de hardware",
};
const TONO_ALERTA: Record<string, Tono> = {
  STOCK_BAJO: "CRITICO",
  FALLA_HARDWARE: "CRITICO",
  RETIRO_EXCESIVO: "DENEGADO",
  LOTE_POR_VENCER: "ATENCION",
  VIDA_UTIL_VENCIDA: "ATENCION",
};

// Los mensajes de alerta llevan un emoji para Telegram; en la UI lo reemplazan el ícono y la etiqueta.
const sinEmoji = (texto: string) => texto.replace(/^[^\p{L}\p{N}]+/u, "");
const pct = (n: number | null) => (n === null ? "—" : `${n}%`);
const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "medium" }).format(new Date(iso));
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

type Resumen = Extract<Awaited<ReturnType<typeof getResumenGerencial>>, { ok: true }>["data"];

// ─────────────────────────────────────────────
// Nivel 3: tarjeta de pilar
// ─────────────────────────────────────────────

function TarjetaPilar({ kpi }: { kpi: KpiEstrategico }) {
  const Icono = ICONO_PILAR[kpi.pilar];
  const formato = kpi.unidad === "USD" ? "usd" : kpi.pilar === "INVENTARIO" ? "unidades" : "pct";
  return (
    <div className={cx("glass glass-hover flex flex-col gap-4 p-6", kpi.estado === "OK" && "hover:shadow-glow-green")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cx(
              "grid size-11 place-items-center rounded-full",
              kpi.estado === "OK" ? "bg-green/15 text-green shadow-glow-green" : "bg-cyan/15 text-cyan shadow-glow-cyan",
            )}
          >
            <Icono className="size-5" aria-hidden />
          </span>
          <p className="font-display text-sm font-semibold text-white">{kpi.titulo}</p>
        </div>
        <Badge tono={kpi.estado}>{ETIQUETA_ESTADO[kpi.estado]}</Badge>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-4xl font-bold tracking-tight text-white">
          {kpi.unidad === "USD" ? usd(kpi.valor) : `${kpi.valor}%`}
        </p>
        {kpi.meta !== null && (
          <span className="font-mono text-xs text-faint">meta {kpi.unidad === "USD" ? `≤ ${usd(kpi.meta)}` : `${kpi.meta}%`}</span>
        )}
      </div>
      <Delta
        valor={kpi.variacionPct}
        sufijo={kpi.pilar === "ACCESOS" ? " pp" : "%"}
        referencia="vs período anterior"
        subeEsBueno={kpi.pilar !== "COSTO"}
      />
      <Sparkline datos={kpi.tendencia} formato={formato} />
      <p className="text-xs text-muted">{kpi.lectura}</p>
      <div className="mt-auto rounded-xl border border-line bg-cyan/[0.04] p-4">
        <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-cyan uppercase">
          <Target className="size-3.5" aria-hidden /> Acción recomendada
        </p>
        <p className="mt-1.5 text-sm text-white">{kpi.accion}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const { dias: diasParam } = await searchParams;
  const dias = PERIODOS.find((p) => String(p) === diasParam) ?? 30;
  const [resumen, compartimentos] = await Promise.all([
    getResumenGerencial({ dias }),
    getCompartimentos().catch(() => [] as Compartimento[]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado + filtro de período (una fila, arriba de todo lo que filtra) */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Metodología 1-3-10</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">Desempeño EHS y consumo de EPP</h1>
          {resumen.ok && (
            <p className="mt-1 font-mono text-xs text-faint">
              {fecha(resumen.data.periodo.desde)} – {fecha(resumen.data.periodo.hasta)} · actualizado {fechaHora(resumen.data.generadoEn)}
            </p>
          )}
        </div>
        <nav aria-label="Período" className="glass flex shrink-0 self-start rounded-xl p-1 sm:self-auto">
          {PERIODOS.map((p) => (
            <Link
              key={p}
              href={`/dashboard?dias=${p}`}
              aria-current={p === dias ? "page" : undefined}
              className={cx(
                "rounded-lg px-4 py-1.5 text-sm whitespace-nowrap transition-all duration-200",
                p === dias ? "bg-cyan font-semibold text-night" : "text-muted hover:text-white",
              )}
            >
              {p} días
            </Link>
          ))}
        </nav>
      </section>

      {!resumen.ok ? (
        <ErrorState titulo="No se pudo generar el dashboard" descripcion={resumen.error} />
      ) : (
        <Contenido data={resumen.data} compartimentos={compartimentos} />
      )}
    </div>
  );
}

function Contenido({ data, compartimentos }: { data: Resumen; compartimentos: Compartimento[] }) {
  const { nivel1, nivel3, nivel10: n } = data;
  const accesos = nivel3.find((k) => k.pilar === "ACCESOS")!;
  const ok = nivel1.estado === "OK";

  return (
    <>
      {/* NIVEL 1 — estado, titular y la decisión de hoy */}
      <section aria-labelledby="nivel1" className="grid gap-4 lg:grid-cols-12">
        <div
          className={cx(
            "glass relative min-w-0 overflow-hidden p-6 sm:p-8 lg:col-span-8",
            ok ? "border-green/40 shadow-glow-green" : "border-cyan/50 shadow-glow-cyan",
          )}
        >
          <div aria-hidden className={cx("pointer-events-none absolute -top-28 -left-20 size-80 rounded-full blur-3xl", ok ? "bg-green/15" : "bg-cyan/20")} />
          <p id="nivel1" className="font-mono text-[11px] tracking-[0.2em] text-cyan uppercase">
            Nivel 1 · Estado general
          </p>
          <div className="mt-4">
            <Badge tono={nivel1.estado} pulso={!ok}>
              {ETIQUETA_ESTADO[nivel1.estado]}
            </Badge>
          </div>
          <p className="mt-4 max-w-3xl font-display text-2xl font-semibold text-balance text-white">{nivel1.titular}</p>
          <div className="mt-6 rounded-xl border border-line bg-night/60 p-4">
            <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em] text-cyan uppercase">
              <Target className="size-3.5" aria-hidden /> Decisión prioritaria
            </p>
            <p className="mt-1.5 text-sm text-white">{nivel1.decisionPrioritaria}</p>
          </div>
        </div>
        <Card className="flex flex-col justify-center lg:col-span-4">
          <Gauge
            id="gauge-accesos-dashboard"
            valor={accesos.valor}
            meta={accesos.meta ?? undefined}
            etiqueta="Accesos concedidos"
            detalle="Lecturas RFID concedidas sobre el total"
          />
        </Card>
      </section>

      {/* NIVEL 3 — los tres pilares */}
      <section aria-labelledby="nivel3" className="flex flex-col gap-3">
        <Eyebrow>
          <span id="nivel3">Nivel 3 · Pilares estratégicos</span>
        </Eyebrow>
        <div className="grid gap-4 lg:grid-cols-3">
          {nivel3.map((kpi) => (
            <TarjetaPilar key={kpi.pilar} kpi={kpi} />
          ))}
        </div>
      </section>

      {/* NIVEL 10 — diagnóstico */}
      <section aria-labelledby="nivel10" className="flex flex-col gap-3">
        <Eyebrow>
          <span id="nivel10">Nivel 10 · Diagnóstico</span>
        </Eyebrow>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            numero={1}
            titulo="Gasto diario en EPP"
            descripcion="Costo de las entregas por día (USD)"
            icono={ChartArea}
            vacio={n.consumoDiario.every((d) => d.entregas === 0)}
            className="lg:col-span-2"
            tabla={{
              columnas: ["Fecha", "Costo", "Unidades", "Concedidas %"],
              filas: n.consumoDiario.map((d) => [d.fecha, usd(d.costo), d.unidades, pct(d.concedidasPct)]),
            }}
          >
            <AreaSuave datos={n.consumoDiario} x="fecha" y="costo" formato="usd" nombre="costo" />
          </Panel>

          <Panel
            id="areas"
            numero={2}
            titulo="Costo por área vs promedio"
            descripcion={`Potencial de ahorro: ${usd(n.costoPorArea.potencialAhorro)} si las áreas críticas bajan al promedio`}
            icono={TrendingUp}
            vacio={n.costoPorArea.chartData.length === 0}
            accion={
              <span className="flex gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-green" aria-hidden /> Ahorro
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-cyan" aria-hidden /> Crítica
                </span>
              </span>
            }
            tabla={{
              columnas: ["Área", "Costo", "vs promedio", "Costo/operario", "Clasificación"],
              filas: n.costoPorArea.chartData.map((a) => [
                a.area,
                usd(a.costo),
                `${a.diferenciaPct > 0 ? "+" : ""}${a.diferenciaPct}%`,
                usd(a.costoPorOperario),
                a.etiqueta,
              ]),
            }}
          >
            <GraficoCostoPorArea datos={n.costoPorArea.chartData} promedio={n.costoPorArea.consumoPromedio} />
          </Panel>

          <Panel
            numero={3}
            titulo="EPP más dispensados"
            descripcion="Unidades entregadas en el período"
            icono={HardHat}
            vacio={n.topEpp.length === 0}
            tabla={{
              columnas: ["EPP", "Unidades", "Costo", "Participación"],
              filas: n.topEpp.map((e) => [e.epp, e.unidades, usd(e.costo), `${e.participacionPct}%`]),
            }}
          >
            <BarrasHorizontales
              datos={n.topEpp.map((e) => ({ ...e, detalle: `${e.epp} · ${e.participacionPct}% de las unidades` }))}
              categoria="codigo"
              valor="unidades"
              formato="unidades"
              detalle="detalle"
            />
          </Panel>

          <Panel
            numero={4}
            titulo="Gasto por tipo de EPP"
            descripcion="Dónde se va el presupuesto"
            icono={Layers}
            vacio={n.costoPorTipo.length === 0}
            tabla={{
              columnas: ["Tipo", "Costo", "Unidades", "Participación"],
              filas: n.costoPorTipo.map((t) => [t.tipo, usd(t.costo), t.unidades, `${t.participacionPct}%`]),
            }}
          >
            <BarrasHorizontales
              datos={n.costoPorTipo.map((t) => ({
                ...t,
                tipo: t.tipo.replace("_", " ").toLowerCase(),
                detalle: `${t.participacionPct}% del gasto`,
              }))}
              categoria="tipo"
              valor="costo"
              formato="usd"
              detalle="detalle"
            />
          </Panel>

          <Panel
            id="lecturas-por-area"
            numero={5}
            titulo="Lecturas por área"
            descripcion="Accesos concedidos, denegados y errores por área"
            icono={ShieldCheck}
            vacio={n.lecturasPorArea.length === 0}
            accion={
              <ul className="flex flex-col gap-1 text-[11px] text-muted" aria-label="Leyenda">
                {SERIES_LECTURAS.map((s) => (
                  <li key={s.clave} className="flex items-center gap-1.5">
                    <span className={cx("size-2.5 rounded-sm", s.claseLeyenda)} aria-hidden />
                    {s.nombre}
                  </li>
                ))}
              </ul>
            }
            tabla={{
              columnas: ["Área", "Concedidas", "Denegadas", "Errores", "Concedidas %"],
              filas: n.lecturasPorArea.map((a) => [a.area, a.concedidas, a.denegadas, a.errores, pct(a.concedidasPct)]),
            }}
          >
            <GraficoLecturasArea datos={n.lecturasPorArea} />
          </Panel>

          <Panel
            numero={6}
            titulo="Gasto por turno"
            descripcion="Consumo según el turno asignado"
            icono={Clock}
            vacio={n.consumoPorTurno.length === 0}
            tabla={{
              columnas: ["Turno", "Costo", "Unidades", "Entregas"],
              filas: n.consumoPorTurno.map((t) => [t.turno, usd(t.costo), t.unidades, t.entregas]),
            }}
          >
            <BarrasHorizontales
              datos={n.consumoPorTurno.map((t) => ({ ...t, detalle: `${t.unidades} unidades` }))}
              categoria="turno"
              valor="costo"
              formato="usd"
              detalle="detalle"
            />
          </Panel>

          <Panel
            id="reemplazos"
            numero={7}
            titulo="Reemplazos programados"
            descripcion="EPP durable que cumple su vida útil en los próximos 7 días"
            icono={CalendarClock}
            accion={
              <div className="text-right">
                <p className="font-display text-xl font-bold text-white">{usd(n.reemplazosProximos.presupuesto)}</p>
                <p className="font-mono text-[11px] text-faint">{n.reemplazosProximos.cantidad} reemplazos</p>
              </div>
            }
            tabla={{
              columnas: ["Operario", "Área", "EPP", "Vence en", "Costo"],
              filas: n.reemplazosProximos.detalle.map((r) => [r.operario, r.area, r.epp, `${r.diasRestantes} d`, usd(r.costoEstimado)]),
            }}
          >
            {n.reemplazosProximos.cantidad === 0 ? (
              <p className="text-sm text-muted">No hay reemplazos de EPP durable en los próximos 7 días.</p>
            ) : (
              <GraficoReemplazos datos={n.reemplazosProximos.porDia} />
            )}
          </Panel>

          {/* Inventario: tabla con medidor (más legible que un gráfico para filas con estado) */}
          <Panel
            id="inventario"
            numero={8}
            titulo="Inventario y cobertura"
            descripcion="Stock vigente vs mínimo y días de consumo cubiertos"
            icono={Boxes}
            vacio={n.inventario.length === 0}
            className="lg:col-span-2"
          >
            <DataTable
              filas={n.inventario}
              clave={(i) => i.inventarioId}
              columnas={[
                {
                  titulo: "EPP",
                  celda: (i) => (
                    <div>
                      <p className="text-white">{i.epp}</p>
                      <p className="font-mono text-[11px] text-faint">
                        {i.codigo} · compartimento #{i.slotMotor}
                        {i.lotesPorVencer > 0 && ` · ${i.lotesPorVencer} lote por vencer`}
                      </p>
                    </div>
                  ),
                },
                { titulo: "Estación", mono: true, celda: (i) => i.estacion },
                {
                  titulo: "Stock vs mínimo",
                  className: "w-1/3",
                  celda: (i) => {
                    // El mínimo se dibuja al 25% de la barra; más allá de 4× el mínimo, barra llena.
                    const lleno = Math.min(100, (i.stock / Math.max(1, i.stockMinimo * 4)) * 100);
                    return (
                      <div>
                        <div className="relative h-2 rounded-full bg-cyan/10" aria-hidden>
                          <div
                            className={cx("h-2 rounded-full", i.estado === "OK" ? "bg-green" : "bg-cyan shadow-glow-cyan")}
                            style={{ width: `${Math.max(3, lleno)}%` }}
                          />
                          <span className="absolute -top-1 left-1/4 h-4 w-px bg-white/70" title="Stock mínimo" />
                        </div>
                        <p className="tabular mt-1 font-mono text-[11px] text-muted">
                          {i.stock} u. · mín. {i.stockMinimo}
                        </p>
                      </div>
                    );
                  },
                },
                { titulo: "Cobertura", mono: true, celda: (i) => (i.coberturaDias === null ? "sin consumo" : `${i.coberturaDias} días`) },
                {
                  titulo: "Estado",
                  alinear: "derecha",
                  celda: (i) => (
                    <Badge tono={i.estado}>{i.estado === "CRITICO" ? "Bajo mínimo" : i.estado === "ATENCION" ? "Reponer pronto" : "OK"}</Badge>
                  ),
                },
              ]}
            />
            {compartimentos.length > 0 && <IngresoLoteForm compartimentos={compartimentos} />}
          </Panel>

          <Panel numero={9} titulo="Operarios con más lecturas denegadas" descripcion="Motivo más frecuente por operario" icono={UsersRound}>
            <DataTable
              filas={n.rankingDenegaciones}
              clave={(r) => r.operarioId}
              compacta
              vacio="Ninguna lectura denegada en el período"
              columnas={[
                {
                  titulo: "Operario",
                  celda: (r) => (
                    <div>
                      <p className="text-white">{r.operario}</p>
                      <p className="text-[11px] text-faint">{r.area}</p>
                    </div>
                  ),
                },
                { titulo: "Denegadas", mono: true, alinear: "derecha", celda: (r) => <span className="text-cyan">{r.denegadas}</span> },
                { titulo: "Motivo principal", celda: (r) => etiquetaMotivoLectura(r.motivoPrincipal) },
              ]}
            />
          </Panel>

          <Panel
            id="alertas"
            numero={10}
            titulo="Alertas pendientes"
            descripcion={`${n.alertasPendientes.total} sin resolver · también se envían por Telegram`}
            icono={BellRing}
          >
            {n.alertasPendientes.total === 0 ? (
              <p className="flex items-center gap-2 text-sm text-green">
                <ShieldCheck className="size-4" aria-hidden /> No hay alertas pendientes.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {n.alertasPendientes.porTipo.map((t) => (
                    <Badge key={t.tipo} tono={TONO_ALERTA[t.tipo] ?? "NEUTRO"}>
                      {ETIQUETA_ALERTA[t.tipo] ?? t.tipo} · {t.cantidad}
                    </Badge>
                  ))}
                </div>
                <ul className="flex flex-col gap-2">
                  {n.alertasPendientes.recientes.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-4 rounded-xl bg-white/[0.025] p-4 transition-colors duration-150 hover:bg-cyan/[0.05]">
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <Badge tono={TONO_ALERTA[a.tipo] ?? "NEUTRO"}>{ETIQUETA_ALERTA[a.tipo] ?? a.tipo}</Badge>
                          <span className="font-mono text-[11px] text-faint">{fechaHora(a.createdAt)}</span>
                        </div>
                        <p className="font-mono text-xs leading-relaxed text-white/90">{sinEmoji(a.mensaje)}</p>
                      </div>
                      <BotonResolver id={a.id} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}
