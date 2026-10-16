import type { NivelRiesgo, TipoEPP } from "@prisma/client";

export type OrigenRegla = "CARGO" | "TAREA" | "CARGO+TAREA";

export type EppRequerido = {
  eppId: string;
  codigo: string;
  nombre: string;
  tipo: TipoEPP;
  cantidad: number;
  costoUnitario: number;
  vidaUtilDias: number;
  origen: OrigenRegla;
};

export type EppBloqueado = {
  eppId: string;
  nombre: string;
  motivo: "RETIRO_EXCESIVO";
  vigenteHasta: string; // ISO
};

export type EppSinStock = { eppId: string; nombre: string };

/** Lo que el kiosco muestra y lo que la ESP32 necesita para activar cada motor. */
export type EntregaCreada = {
  entregaId: string;
  eppId: string;
  codigo: string;
  nombre: string;
  cantidad: number;
  slotMotor: number;
  loteCodigo: string;
  costoTotal: number;
};

export type CodigoRechazo =
  | "DATOS_INVALIDOS"
  | "OPERARIO_NO_ENCONTRADO"
  | "OPERARIO_INACTIVO"
  | "AREA_NO_ENCONTRADA"
  | "ESTACION_NO_ENCONTRADA"
  | "SIN_EPP_ASIGNADO"
  | "RETIRO_EXCESIVO"
  | "SIN_STOCK"
  | "ERROR_INTERNO";

export type ResultadoDispensacion =
  | {
      ok: true;
      operario: { id: string; nombre: string; cargo: string };
      area: { id: string; nombre: string };
      estacion: { id: string; codigo: string };
      tarea: { id: string; nombre: string; nivelRiesgo: NivelRiesgo } | null;
      turno: string | null;
      entregas: EntregaCreada[];
      /** EPP requeridos que no se entregan porque el operario aún tiene uno vigente. */
      bloqueados: EppBloqueado[];
      sinStock: EppSinStock[];
    }
  | {
      ok: false;
      codigo: CodigoRechazo;
      mensaje: string;
      bloqueados?: EppBloqueado[];
      sinStock?: EppSinStock[];
    };
