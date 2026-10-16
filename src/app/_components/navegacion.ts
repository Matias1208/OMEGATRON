import { BarChart3, LayoutDashboard, ScanLine } from "lucide-react";

/**
 * Secciones del sidebar. Solo rutas que existen: el kiosco es un modo de pantalla
 * completa de "/" (/?kiosco=1), no una ruta aparte.
 */
export const NAVEGACION = [
  { href: "/", etiqueta: "Centro de control", icono: LayoutDashboard },
  { href: "/dashboard", etiqueta: "Dashboard", icono: BarChart3 },
  { href: "/?kiosco=1", etiqueta: "Modo kiosco", icono: ScanLine },
] as const;

/** Destinos del buscador de la barra superior (secciones y paneles con ancla). */
export const DESTINOS_BUSQUEDA = [
  { etiqueta: "Centro de control", href: "/" },
  { etiqueta: "Lecturas recientes", href: "/#lecturas" },
  { etiqueta: "Dispensación", href: "/#dispensacion" },
  { etiqueta: "Estaciones", href: "/#estaciones" },
  { etiqueta: "Modo kiosco", href: "/?kiosco=1" },
  { etiqueta: "Dashboard gerencial", href: "/dashboard" },
  { etiqueta: "Costo por área", href: "/dashboard#areas" },
  { etiqueta: "Cumplimiento EHS", href: "/dashboard#cumplimiento" },
  { etiqueta: "Inventario y reposición", href: "/dashboard#inventario" },
  { etiqueta: "Reemplazos programados", href: "/dashboard#reemplazos" },
  { etiqueta: "Alertas pendientes", href: "/dashboard#alertas" },
] as const;

export const TITULO_RUTA: Record<string, string> = {
  "/": "Centro de control",
  "/dashboard": "Dashboard gerencial",
};
