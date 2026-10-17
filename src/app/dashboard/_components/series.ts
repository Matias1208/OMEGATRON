// Compartido entre servidor (leyenda) y cliente (gráfico): sin "use client".
// Colores = variables CSS de la paleta de marca.

export const SERIES_LECTURAS = [
  { clave: "concedidas", nombre: "Concedidas", color: "var(--color-green)", opacidad: 1, claseLeyenda: "bg-green" },
  { clave: "denegadas", nombre: "Denegadas", color: "var(--color-cyan)", opacidad: 1, claseLeyenda: "bg-cyan" },
  { clave: "errores", nombre: "Errores", color: "var(--color-white)", opacidad: 0.3, claseLeyenda: "bg-white/30" },
] as const;
