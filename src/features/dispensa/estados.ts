import { EstadoEntrega } from "@prisma/client";

/** Entregas que salieron físicamente: el operario tiene el EPP y cuentan como consumo real. */
export const ESTADOS_EN_USO: EstadoEntrega[] = [
  EstadoEntrega.PENDIENTE_VERIFICACION_CAMARA,
  EstadoEntrega.VERIFICADO,
  EstadoEntrega.INCUMPLIMIENTO_EHS,
];
