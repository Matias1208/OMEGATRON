import { DIA_MS } from "@/lib/fechas";
import { METAS } from "./config";
import {
  calcularAnalisisAhorroAreas,
  getAlertasPendientes,
  getConsumoDiario,
  getConsumoPorEpp,
  getConsumoPorTurno,
  getEstadoInventario,
  getLecturasPeriodo,
  getLecturasPorArea,
  getRankingDenegaciones,
  getReemplazosProximos,
  redondear,
  totalesPeriodo,
} from "./queries";
import type {
  KpiEstrategico,
  LecturasPeriodo,
  Nivel1,
  Nivel10,
  Pilar,
  ResultadoQuery,
  ResumenGerencial,
  Semaforo,
} from "./types";

const GRAVEDAD: Record<Semaforo, number> = { OK: 0, ATENCION: 1, CRITICO: 2 };
// Ante empate de gravedad, se prioriza la vida de las personas, luego la operación, luego el costo.
const PRIORIDAD_PILAR: Pilar[] = ["ACCESOS", "INVENTARIO", "COSTO"];

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const variacion = (actual: number, anterior: number) =>
  anterior > 0 ? redondear(((actual - anterior) / anterior) * 100, 1) : null;
const signo = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// ─────────────────────────────────────────────
// NIVEL 3: los tres pilares
// ─────────────────────────────────────────────

function kpiCosto(
  actual: number,
  anterior: number,
  ahorro: ResumenGerencial["nivel10"]["costoPorArea"],
  serie: Nivel10["consumoDiario"],
): KpiEstrategico {
  const variacionPct = variacion(actual, anterior);
  const estado: Semaforo =
    variacionPct === null || variacionPct <= METAS.costo.variacionOkPct
      ? "OK"
      : variacionPct <= METAS.costo.variacionCriticaPct
        ? "ATENCION"
        : "CRITICO";

  const peor = ahorro.areasCriticas[0];
  const mejor = ahorro.areasEficientes.at(-1);
  const accion = peor
    ? `Auditar el consumo de ${peor.area} (${signo(peor.diferenciaPct)}% sobre el promedio). ` +
      `Llevar las áreas críticas al promedio ahorraría ${usd(ahorro.potencialAhorro)} por período.`
    : `Consumo homogéneo entre áreas: mantener el estándar${mejor ? ` y replicar las prácticas de ${mejor.area}` : ""}.`;

  return {
    pilar: "COSTO",
    titulo: "Costo de EPP",
    valor: actual,
    unidad: "USD",
    meta: anterior > 0 ? anterior : null, // meta: no superar el gasto del período anterior
    valorAnterior: anterior,
    variacionPct,
    estado,
    lectura:
      `Gasto de ${usd(actual)} en el período` +
      (variacionPct !== null ? ` (${signo(variacionPct)}% vs período anterior).` : "."),
    accion,
    tendencia: serie.map((d) => ({ fecha: d.fecha, valor: d.costo })),
  };
}

function kpiAccesos(
  actual: LecturasPeriodo,
  anterior: LecturasPeriodo,
  ranking: Nivel10["rankingDenegaciones"],
  serie: Nivel10["consumoDiario"],
): KpiEstrategico {
  const motivos = new Map(actual.porMotivo.map(({ motivo, cantidad }) => [motivo, cantidad]));
  const problematicas =
    actual.errores + (motivos.get("SIN_STOCK") ?? 0) + (motivos.get("OPERARIO_NO_ENCONTRADO") ?? 0);
  const total = actual.concedidas + actual.denegadas + actual.errores;
  const problematicaRatio = total ? problematicas / total : 0;
  const problematicaPct = redondear(problematicaRatio * 100, 1);
  const estado: Semaforo =
    problematicas === 0
      ? "OK"
      : problematicaRatio <= METAS.accesos.problemasMaxPct / 100
        ? "ATENCION"
        : "CRITICO";
  const valor = actual.concedidasPct ?? 100;
  const sinStock = motivos.get("SIN_STOCK") ?? 0;
  const credencialesDesconocidas = motivos.get("OPERARIO_NO_ENCONTRADO") ?? 0;
  const motivoFrecuente = actual.porMotivo[0];
  const reincidente = ranking[0];
  const accion = sinStock
    ? `Reponer el EPP sin stock (${sinStock} lectura(s) afectada(s)).`
    : actual.errores
      ? `Revisar el dispensador y la conexión de las estaciones: ${actual.errores} lectura(s) terminaron en error.`
      : credencialesDesconocidas
        ? `Registrar o corregir las credenciales desconocidas (${credencialesDesconocidas} lectura(s)).`
        : problematicas
          ? `Revisar las lecturas problemáticas del período (${problematicaPct}% del total).`
          : motivoFrecuente
            ? `Los rechazos se deben principalmente a ${motivoFrecuente.motivo} (${motivoFrecuente.cantidad}); verificar la asignación y el uso de credenciales.` +
              (reincidente ? ` Revisar el caso de ${reincidente.operario}.` : "")
            : "Los accesos problemáticos son 0; mantener las reglas de dispensación.";

  return {
    pilar: "ACCESOS",
    titulo: "Accesos concedidos",
    valor,
    unidad: "%",
    meta: null,
    valorAnterior: anterior.concedidasPct,
    variacionPct:
      actual.concedidasPct !== null && anterior.concedidasPct !== null
        ? redondear(actual.concedidasPct - anterior.concedidasPct, 1)
        : null,
    estado,
    lectura:
      `${valor}% de accesos concedidos; ${actual.denegadas} denegados y ${actual.errores} errores.` +
      (problematicas ? ` ${problematicas} lectura(s) problemática(s) (${problematicaPct}%).` : ""),
    accion,
    tendencia: serie.map((d) => ({ fecha: d.fecha, valor: d.concedidasPct })),
  };
}

function kpiInventario(
  inventario: Nivel10["inventario"],
  reemplazos: Nivel10["reemplazosProximos"],
  serie: Nivel10["consumoDiario"],
): KpiEstrategico {
  const total = inventario.length;
  const sobreMinimo = inventario.filter((i) => i.stock >= i.stockMinimo).length;
  const valor = total ? redondear((sobreMinimo / total) * 100, 1) : 100;
  const bajoMinimo = inventario.filter((i) => i.estado === "CRITICO");
  const coberturaBaja = inventario.filter((i) => i.estado === "ATENCION");
  const lotesPorVencer = inventario.reduce((acc, i) => acc + i.lotesPorVencer, 0);

  const estado: Semaforo = bajoMinimo.length ? "CRITICO" : coberturaBaja.length ? "ATENCION" : "OK";

  // inventario ya viene ordenado por cobertura: el primero es el más urgente.
  const urgentes = [...bajoMinimo, ...coberturaBaja].slice(0, 3);
  const accionReposicion = urgentes.length
    ? `Reponer ${urgentes
        .map((i) => `${i.epp} (${i.stock} u.${i.coberturaDias !== null ? `, ${i.coberturaDias} días de cobertura` : ""})`)
        .join(", ")}.`
    : "Stock sobre el mínimo en todas las estaciones.";
  const accionPresupuesto = reemplazos.cantidad
    ? ` Presupuestar ${usd(reemplazos.presupuesto)} para ${reemplazos.cantidad} reemplazos programados en ${METAS.horizonteReemplazosDias} días.`
    : "";

  return {
    pilar: "INVENTARIO",
    titulo: "Disponibilidad de EPP",
    valor,
    unidad: "%",
    meta: 100,
    valorAnterior: null,
    variacionPct: null,
    estado,
    lectura:
      (bajoMinimo.length
        ? `${bajoMinimo.length} de ${total} EPP bajo stock mínimo (${bajoMinimo.map((i) => i.epp).join(", ")})`
        : `Los ${total} EPP están sobre su stock mínimo`) +
      (coberturaBaja.length ? `; ${coberturaBaja.length} con menos de ${METAS.inventario.coberturaMinimaDias} días de cobertura` : "") +
      (lotesPorVencer ? `; ${lotesPorVencer} lote(s) por vencer` : "") +
      ".",
    accion: accionReposicion + accionPresupuesto,
    tendencia: serie.map((d) => ({ fecha: d.fecha, valor: d.unidades })), // unidades dispensadas por día
  };
}

// ─────────────────────────────────────────────
// NIVEL 1: un estado, un titular, una decisión
// ─────────────────────────────────────────────

function nivel1(kpis: KpiEstrategico[]): Nivel1 {
  const peorGravedad = Math.max(...kpis.map((k) => GRAVEDAD[k.estado]));
  if (peorGravedad === 0) {
    return {
      estado: "OK",
      titular: "Operación bajo control: costo, accesos e inventario dentro de meta.",
      decisionPrioritaria: kpis.find((k) => k.pilar === "COSTO")!.accion,
      pilarPrioritario: null,
    };
  }

  const prioritario = PRIORIDAD_PILAR.map((p) => kpis.find((k) => k.pilar === p)!).find(
    (k) => GRAVEDAD[k.estado] === peorGravedad,
  )!;
  const enRiesgo = kpis.filter((k) => k.estado !== "OK").length;

  return {
    estado: prioritario.estado,
    titular:
      `${prioritario.titulo} ${prioritario.estado === "CRITICO" ? "requiere acción inmediata" : "requiere atención"}: ` +
      prioritario.lectura.replace(/\.$/, "") +
      (enRiesgo > 1 ? ` (${enRiesgo} de 3 pilares fuera de meta).` : "."),
    decisionPrioritaria: prioritario.accion,
    pilarPrioritario: prioritario.pilar,
  };
}

// ─────────────────────────────────────────────
// Resumen completo 1-3-10
// ─────────────────────────────────────────────

/**
 * Tablero gerencial con la metodología 1-3-10:
 *  - 1 s:  nivel1  → estado global, titular y la decisión prioritaria.
 *  - 3 s:  nivel3  → costo, accesos y disponibilidad, con meta, variación y acción.
 *  - 10 s: nivel10 → las 10 vistas de diagnóstico, listas para Recharts.
 */
export async function getResumenGerencial(opciones: { dias?: number } = {}): Promise<ResultadoQuery<ResumenGerencial>> {
  const dias = Math.min(Math.max(Math.round(opciones.dias ?? 30), 1), 365);
  const hasta = new Date();
  const periodo = { desde: new Date(hasta.getTime() - dias * DIA_MS), hasta };
  const anterior = { desde: new Date(periodo.desde.getTime() - dias * DIA_MS), hasta: periodo.desde };

  try {
    const [
      totales,
      totalesAnt,
      consumoDiario,
      costoPorArea,
      { topEpp, costoPorTipo },
      lecturasPorArea,
      inventario,
      reemplazosProximos,
      consumoPorTurno,
      rankingDenegaciones,
      alertasPendientes,
      lecturas,
      lecturasAnt,
    ] = await Promise.all([
      totalesPeriodo(periodo),
      totalesPeriodo(anterior),
      getConsumoDiario(periodo),
      calcularAnalisisAhorroAreas(periodo),
      getConsumoPorEpp(periodo),
      getLecturasPorArea(periodo),
      getEstadoInventario(periodo),
      getReemplazosProximos(),
      getConsumoPorTurno(periodo),
      getRankingDenegaciones(periodo),
      getAlertasPendientes(),
      getLecturasPeriodo(periodo),
      getLecturasPeriodo(anterior),
    ]);

    const nivel3: ResumenGerencial["nivel3"] = [
      kpiCosto(totales.costo, totalesAnt.costo, costoPorArea, consumoDiario),
      kpiAccesos(lecturas, lecturasAnt, rankingDenegaciones, consumoDiario),
      kpiInventario(inventario, reemplazosProximos, consumoDiario),
    ];

    return {
      ok: true,
      data: {
        periodo: { desde: periodo.desde.toISOString(), hasta: periodo.hasta.toISOString(), dias },
        generadoEn: new Date().toISOString(),
        nivel1: nivel1(nivel3),
        nivel3,
        nivel10: {
          consumoDiario,
          costoPorArea,
          topEpp,
          costoPorTipo,
          lecturasPorArea,
          inventario,
          reemplazosProximos,
          consumoPorTurno,
          rankingDenegaciones,
          alertasPendientes,
        },
      },
    };
  } catch (error) {
    console.error("[dashboard] Error en getResumenGerencial:", error);
    return { ok: false, error: "No se pudo generar el resumen gerencial." };
  }
}
