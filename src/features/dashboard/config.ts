/**
 * Metas y umbrales del semáforo gerencial. Ajustables por cliente sin tocar la lógica.
 */
export const METAS = {
  costo: {
    /** Variación vs período anterior hasta la cual el costo sigue "OK". */
    variacionOkPct: 0,
    /** Por encima de esto el costo es "CRITICO". Entre ambos: "ATENCION". */
    variacionCriticaPct: 10,
  },
  seguridad: {
    /** % de entregas verificadas por cámara sobre el total con veredicto. */
    cumplimientoMetaPct: 95,
    cumplimientoCriticoPct: 85,
  },
  inventario: {
    /** Cobertura (días de consumo cubiertos por el stock) bajo la cual hay que reponer. */
    coberturaMinimaDias: 7,
  },
  /** Solo los EPP durables entran a "reemplazos programados" (los desechables se renuevan a diario). */
  vidaUtilDurableDias: 7,
  horizonteReemplazosDias: 7,
} as const;
