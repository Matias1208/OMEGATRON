const ETIQUETAS_MOTIVO: Record<string, string> = {
  DATOS_INVALIDOS: "Credencial ilegible",
  OPERARIO_NO_ENCONTRADO: "Credencial no registrada",
  OPERARIO_INACTIVO: "Operario inactivo",
  AREA_NO_ENCONTRADA: "Área no registrada",
  ESTACION_NO_ENCONTRADA: "Estación no disponible",
  SIN_EPP_ASIGNADO: "Sin EPP asignado",
  RETIRO_EXCESIVO: "EPP aún vigente",
  SIN_STOCK: "Sin stock",
  ESTACION_SIN_AREA: "Estación sin área asignada",
  HARDWARE_NO_DISPONIBLE: "Dispensador sin respuesta",
  ERROR_INTERNO: "Error interno",
};

export function etiquetaMotivoLectura(motivo: string | null): string {
  return motivo ? (ETIQUETAS_MOTIVO[motivo] ?? motivo.replaceAll("_", " ").toLowerCase()) : "—";
}
