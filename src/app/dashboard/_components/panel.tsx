import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { Card, CardHeader, EmptyState, cx } from "@/app/_components/ui";

export type Tabla = { columnas: string[]; filas: (string | number)[][] };

/**
 * Panel del nivel 10: título con el número de vista, el gráfico y, debajo, la tabla con
 * los mismos datos (accesible sin hover, legible por lectores de pantalla).
 */
export function Panel({
  id,
  numero,
  titulo,
  descripcion,
  icono,
  vacio,
  tabla,
  accion,
  className,
  children,
}: {
  /** Ancla para el buscador de la barra superior. */
  id?: string;
  numero: number;
  titulo: string;
  descripcion?: string;
  icono?: ComponentType<LucideProps>;
  vacio?: boolean;
  tabla?: Tabla;
  accion?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className={cx("flex flex-col", className)}>
      <CardHeader
        titulo={`${String(numero).padStart(2, "0")} · ${titulo}`}
        descripcion={descripcion}
        icono={icono}
        accion={accion}
      />
      <div className="flex-1">
        {vacio ? <EmptyState titulo="Sin datos en el período" descripcion="Prueba con un rango de fechas más amplio." /> : children}
      </div>
      {tabla && !vacio && tabla.filas.length > 0 && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer font-mono text-[11px] tracking-wider text-faint uppercase select-none transition-colors duration-150 hover:text-cyan">
            Ver datos en tabla
          </summary>
          <div className="mt-3 max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-night text-faint">
                <tr>
                  {tabla.columnas.map((c) => (
                    <th key={c} scope="col" className="py-1.5 pr-3 font-mono font-medium tracking-wider uppercase">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line font-mono text-muted">
                {tabla.filas.map((fila, i) => (
                  <tr key={i}>
                    {fila.map((celda, j) => (
                      <td key={j} className={cx("py-1.5 pr-3", j === 0 && "font-sans text-white")}>
                        {celda}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </Card>
  );
}
