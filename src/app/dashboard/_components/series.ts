// Compartido entre servidor (leyenda) y cliente (gráfico): sin "use client".
// Colores = variables CSS de la paleta de marca.

export const SERIES_CUMPLIMIENTO = [
  { clave: "verificados", nombre: "Verificado", color: "var(--color-green)", opacidad: 1, claseLeyenda: "bg-green" },
  { clave: "incumplimientos", nombre: "Incumplimiento", color: "var(--color-cyan)", opacidad: 1, claseLeyenda: "bg-cyan" },
  { clave: "pendientes", nombre: "Pendiente de cámara", color: "var(--color-white)", opacidad: 0.3, claseLeyenda: "bg-white/30" },
] as const;
