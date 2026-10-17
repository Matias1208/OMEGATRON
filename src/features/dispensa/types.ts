import type { NivelRiesgo, Tarea, TipoEPP } from "@prisma/client";

/** Turno/tarea que rige la dispensación (ver obtenerAsignacionActual). */
export type AsignacionVigente = {
  asignacionId: string | null; // null si viene de la tarea habitual (no se vincula a un día pasado)
  tarea: Tarea;
  turno: string;
  origen: "TURNO_ACTUAL" | "TAREA_HABITUAL";
};

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
  tipo: TipoEPP;
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
  | "ESTACION_SIN_AREA"
  | "HARDWARE_NO_DISPONIBLE"
  | "ERROR_INTERNO";

export type ResultadoDispensacion =
  | {
      ok: true;
      operario: { id: string; nombre: string; cargo: string };
      area: { id: string; nombre: string };
      estacion: { id: string; codigo: string };
      tarea: { id: string; nombre: string; nivelRiesgo: NivelRiesgo } | null;
      turno: string | null;
      origenTarea: AsignacionVigente["origen"] | null;
      entregas: EntregaCreada[];
      /** EPP requeridos que no se entregan porque el operario aún tiene uno vigente. */
      bloqueados: EppBloqueado[];
      sinStock: EppSinStock[];
      /** EPP que sale por el motor (solo cuando la dispensación pasa por una estación física). */
      comandoMotor?: { motor: number; entregaId: string; epp: string };
    }
  | {
      ok: false;
      codigo: CodigoRechazo;
      mensaje: string;
      bloqueados?: EppBloqueado[];
      sinStock?: EppSinStock[];
    };
