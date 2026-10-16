import type { Metadata } from "next";
import Link from "next/link";
import { getResumenGerencial } from "@/features/dashboard/resumen";
import { getCompartimentos, type Compartimento } from "@/features/inventario/lotes";
import type { KpiEstrategico, Semaforo } from "@/features/dashboard/types";
import { Badge, Card, ErrorState, Eyebrow, cx, type Tono } from "../_components/ui";
import {
  BarrasHorizontales,
  GraficoConsumoDiario,
  GraficoCostoPorArea,
  GraficoCumplimiento,
  GraficoReemplazos,
  Sparkline,
} from "./_components/graficos";
import { usd } from "./_components/formato";
import { BotonResolver } from "./_components/boton-resolver";
import { IngresoLoteForm } from "./_components/ingreso-lote-form";
import { Panel } from "./_components/panel";

export const metadata: Metadata = { title: "Dashboard gerencial" };
export const dynamic = "force-dynamic";

const PERIODOS = [7, 30, 90] as const;

const ETIQUETA_ESTADO: Record<Semaforo, string> = { OK: "En meta", ATENCION: "Atención", CRITICO: "Crítico" };
const ETIQUETA_ALERTA: Record<string, string> = {
  STOCK_BAJO: "Stock bajo",
  LOTE_POR_VENCER: "Lote por vencer",
  VIDA_UTIL_VENCIDA: "Vida útil cumplida",
  RETIRO_EXCESIVO: "Retiro excesivo",
  INCUMPLIMIENTO_EHS: "Incumplimiento EHS",
  FALLA_HARDWARE: "Falla de hardware",
};
const TONO_ALERTA: Record<string, Tono> = {
  STOCK_BAJO: "CRITICO",
  INCUMPLIMIENTO_EHS: "CRITICO",
  FALLA_HARDWARE: "CRITICO",
  RETIRO_EXCESIVO: "ATENCION",
  LOTE_POR_VENCER: "ATENCION",
  VIDA_UTIL_VENCIDA: "ATENCION",
};

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);
const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "medium" }).format(new Date(iso));
const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "short" }).format(
    new Date(iso),
  );

// ─────────────────────────────────────────────
// Nivel 3: tarjeta de KPI
// ─────────────────────────────────────────────

function Delta({ kpi }: { kpi: KpiEstrategico }) {
  if (kpi.variacionPct === null) return <span className="text-xs text-faint">Sin período anterior comparable</span>;
  // En costo subir es malo; en cumplimiento subir es bueno.
  const subeEsBueno = kpi.pilar !== "COSTO";
  const sube = kpi.variacionPct > 0;
  const bueno = kpi.variacionPct === 0 || sube === subeEsBueno;
  const unidad = kpi.pilar === "SEGURIDAD" ? " pp" : "%";
  return (
    <span className={cx("text-xs font-medium", bueno ? "text-ok" : "text-danger")}>
      {sube ? "▲" : kpi.variacionPct < 0 ? "▼" : "■"} {Math.abs(kpi.variacionPct)}
      {unidad} <span className="font-normal text-faint">vs período anterior</span>
    </span>
  );
}

function TarjetaKpi({ kpi }: { kpi: KpiEstrategico }) {
  const formato = kpi.unidad === "USD" ? "usd" : kpi.pilar === "INVENTARIO" ? "unidades" : "pct";
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted">{kpi.titulo}</p>
        <Badge tono={kpi.estado}>{ETIQUETA_ESTADO[kpi.estado]}</Badge>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-4xl font-semibold tracking-tight text-ink">
          {kpi.unidad === "USD" ? usd(kpi.valor) : `${kpi.valor}%`}
        </p>
        {kpi.meta !== null && (
          <span className="text-xs text-faint">meta {kpi.unidad === "USD" ? `≤ ${usd(kpi.meta)}` : `${kpi.meta}%`}</span>
        )}
      </div>
      <Delta kpi={kpi} />
      <Sparkline datos={kpi.tendencia} formato={formato} />
      <p className="text-xs text-muted">{kpi.lectura}</p>
      <div className="mt-auto rounded-md border border-line bg-surface-2/60 p-3">
        <p className="font-mono text-[10px] tracking-widest text-accent uppercase">Acción recomendada</p>
        <p className="mt-1 text-sm text-ink">{kpi.accion}</p>
      </div>
    </Card>
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
    <div className="flex flex-col gap-8">
      {/* Encabezado + filtro de período (una fila, arriba de todo lo que filtra) */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Dashboard gerencial · metodología 1-3-10</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Desempeño EHS y de consumo de EPP</h1>
          {resumen.ok && (
            <p className="mt-1 text-sm text-muted">
              {fecha(resumen.data.periodo.desde)} – {fecha(resumen.data.periodo.hasta)} · actualizado{" "}
              {fechaHora(resumen.data.generadoEn)}
            </p>
          )}
        </div>
        <nav aria-label="Período" className="flex shrink-0 self-start rounded-lg border border-line bg-surface p-1 sm:self-auto">
          {PERIODOS.map((p) => (
            <Link
              key={p}
              href={`/dashboard?dias=${p}`}
              aria-current={p === dias ? "page" : undefined}
              className={cx(
                "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                p === dias ? "bg-accent/15 font-medium text-accent" : "text-muted hover:text-ink",
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

function Contenido({
  data,
  compartimentos,
}: {
  data: Extract<Awaited<ReturnType<typeof getResumenGerencial>>, { ok: true }>["data"];
  compartimentos: Compartimento[];
}) {
  const { nivel1, nivel3, nivel10: n } = data;
  const tonoNivel1: Record<Semaforo, string> = {
    OK: "border-ok/30 from-ok/10",
    ATENCION: "border-warn/30 from-warn/10",
    CRITICO: "border-danger/30 from-danger/10",
  };

  return (
    <>
      {/* NIVEL 1 — 1 segundo: estado, titular y la decisión de hoy */}
      <section aria-labelledby="nivel1" className="flex flex-col gap-3">
        <Eyebrow>
          <span id="nivel1">Nivel 1 · Estado general</span>
        </Eyebrow>
        <div className={cx("rounded-xl border bg-gradient-to-r to-transparent p-6", tonoNivel1[nivel1.estado])}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <Badge tono={nivel1.estado} pulso={nivel1.estado !== "OK"}>
                {ETIQUETA_ESTADO[nivel1.estado]}
              </Badge>
              <p className="mt-3 text-xl font-semibold text-balance text-ink">{nivel1.titular}</p>
            </div>
            <div className="rounded-lg border border-line bg-canvas/60 p-4 lg:max-w-md">
              <p className="font-mono text-[10px] tracking-widest text-accent uppercase">Decisión prioritaria</p>
              <p className="mt-1 text-sm text-ink">{nivel1.decisionPrioritaria}</p>
            </div>
          </div>
        </div>
      </section>

      {/* NIVEL 3 — 3 segundos: los tres pilares */}
      <section aria-labelledby="nivel3" className="flex flex-col gap-3">
        <Eyebrow>
          <span id="nivel3">Nivel 3 · Pilares estratégicos</span>
        </Eyebrow>
        <div className="grid gap-4 lg:grid-cols-3">
          {nivel3.map((kpi) => (
            <TarjetaKpi key={kpi.pilar} kpi={kpi} />
          ))}
        </div>
      </section>

      {/* NIVEL 10 — 10 segundos: diagnóstico */}
      <section aria-labelledby="nivel10" className="flex flex-col gap-3">
        <Eyebrow>
          <span id="nivel10">Nivel 10 · Diagnóstico</span>
        </Eyebrow>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            numero={1}
            titulo="Gasto diario en EPP"
            descripcion="Costo de las entregas por día (USD)"
            vacio={n.consumoDiario.every((d) => d.entregas === 0)}
            className="lg:col-span-2"
            tabla={{
              columnas: ["Fecha", "Costo", "Unidades", "Cumplimiento"],
              filas: n.consumoDiario.map((d) => [d.fecha, usd(d.costo), d.unidades, pct(d.cumplimientoPct)]),
            }}
          >
            <GraficoConsumoDiario datos={n.consumoDiario} />
          </Panel>

          <Panel
            numero={2}
            titulo="Costo por área vs promedio"
            descripcion={`Potencial de ahorro: ${usd(n.costoPorArea.potencialAhorro)} si las áreas críticas bajan al promedio`}
            vacio={n.costoPorArea.chartData.length === 0}
            accion={
              <span className="flex gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-[#059669]" aria-hidden /> Ahorro
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-[#dc2626]" aria-hidden /> Crítica
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
            numero={5}
            titulo="Cumplimiento EHS por área"
            descripcion="Veredictos de la cámara sobre el uso del EPP"
            vacio={n.cumplimientoPorArea.length === 0}
            tabla={{
              columnas: ["Área", "Verificados", "Incumplimientos", "Pendientes", "Cumplimiento"],
              filas: n.cumplimientoPorArea.map((a) => [a.area, a.verificados, a.incumplimientos, a.pendientes, pct(a.cumplimientoPct)]),
            }}
          >
            <GraficoCumplimiento datos={n.cumplimientoPorArea} />
          </Panel>

          {/* 6. Inventario: tabla con medidor (más legible que un gráfico para 7+ filas con estado) */}
          <Panel
            numero={6}
            titulo="Inventario y cobertura"
            descripcion="Stock vigente vs mínimo y días de consumo cubiertos"
            vacio={n.inventario.length === 0}
            className="lg:col-span-2"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-faint">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">EPP</th>
                    <th scope="col" className="pb-2 font-medium">Estación</th>
                    <th scope="col" className="w-1/3 pb-2 font-medium">Stock vs mínimo</th>
                    <th scope="col" className="pb-2 font-medium">Cobertura</th>
                    <th scope="col" className="pb-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {n.inventario.map((i) => {
                    // Medidor: el mínimo se dibuja al 25% de la barra; más allá del 4× el mínimo, barra llena.
                    const lleno = Math.min(100, (i.stock / Math.max(1, i.stockMinimo * 4)) * 100);
                    return (
                      <tr key={i.inventarioId}>
                        <td className="py-2.5 pr-3">
                          <p className="text-ink">{i.epp}</p>
                          <p className="font-mono text-[11px] text-faint">
                            {i.codigo} · compartimento #{i.slotMotor}
                            {i.lotesPorVencer > 0 && ` · ${i.lotesPorVencer} lote por vencer`}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-muted">{i.estacion}</td>
                        <td className="py-2.5 pr-3">
                          <div className="relative h-2 rounded-full bg-surface-2" aria-hidden>
                            <div
                              className={cx(
                                "h-2 rounded-full",
                                i.estado === "CRITICO" ? "bg-[#dc2626]" : i.estado === "ATENCION" ? "bg-[#d97706]" : "bg-[#0891b2]",
                              )}
                              style={{ width: `${Math.max(2, lleno)}%` }}
                            />
                            <span className="absolute top-[-3px] left-1/4 h-3.5 w-px bg-muted" title="Stock mínimo" />
                          </div>
                          <p className="tabular mt-1 text-xs text-muted">
                            {i.stock} u. · mín. {i.stockMinimo}
                          </p>
                        </td>
                        <td className="tabular py-2.5 pr-3 text-xs text-muted">
                          {i.coberturaDias === null ? "Sin consumo" : `${i.coberturaDias} días`}
                        </td>
                        <td className="py-2.5">
                          <Badge tono={i.estado}>
                            {i.estado === "CRITICO" ? "Bajo mínimo" : i.estado === "ATENCION" ? "Reponer pronto" : "OK"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {compartimentos.length > 0 && <IngresoLoteForm compartimentos={compartimentos} />}
          </Panel>

          <Panel
            numero={7}
            titulo="Reemplazos programados"
            descripcion="EPP durable que cumple su vida útil en los próximos 7 días"
            accion={
              <div className="text-right">
                <p className="text-lg font-semibold text-ink">{usd(n.reemplazosProximos.presupuesto)}</p>
                <p className="text-[11px] text-faint">{n.reemplazosProximos.cantidad} reemplazos</p>
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

          <Panel
            numero={8}
            titulo="Gasto por turno"
            descripcion="Consumo según el turno asignado"
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

          <Panel numero={9} titulo="Incumplimientos EHS por operario" descripcion="Para capacitación focalizada">
            {n.rankingIncumplimientos.length === 0 ? (
              <p className="text-sm text-muted">Ningún incumplimiento registrado en el período.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-faint">
                  <tr>
                    <th scope="col" className="pb-2 font-medium">Operario</th>
                    <th scope="col" className="pb-2 text-right font-medium">Incumpl.</th>
                    <th scope="col" className="pb-2 text-right font-medium">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {n.rankingIncumplimientos.map((r) => (
                    <tr key={r.operarioId}>
                      <td className="py-2 pr-3">
                        <p className="text-ink">{r.operario}</p>
                        <p className="text-[11px] text-faint">{r.area}</p>
                      </td>
                      <td className="tabular py-2 text-right text-ink">{r.incumplimientos}</td>
                      <td className="tabular py-2 text-right text-muted">{pct(r.cumplimientoPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel
            numero={10}
            titulo="Alertas pendientes"
            descripcion={`${n.alertasPendientes.total} sin resolver`}
          >
            {n.alertasPendientes.total === 0 ? (
              <p className="text-sm text-muted">No hay alertas pendientes.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {n.alertasPendientes.porTipo.map((t) => (
                    <Badge key={t.tipo} tono={TONO_ALERTA[t.tipo] ?? "NEUTRO"}>
                      {ETIQUETA_ALERTA[t.tipo] ?? t.tipo} · {t.cantidad}
                    </Badge>
                  ))}
                </div>
                <ul className="flex flex-col divide-y divide-line">
                  {n.alertasPendientes.recientes.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{a.mensaje}</p>
                        <p className="text-[11px] text-faint">
                          {ETIQUETA_ALERTA[a.tipo] ?? a.tipo} · {fechaHora(a.createdAt)}
                        </p>
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
