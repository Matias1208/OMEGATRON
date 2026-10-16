import type { ReactNode } from "react";
import { Card, CardHeader, EmptyState, cx } from "@/app/_components/ui";

export type Tabla = { columnas: string[]; filas: (string | number)[][] };

/**
 * Panel del nivel 10: título con el número de vista, el gráfico y, debajo, la tabla con
 * los mismos datos (accesible sin hover, legible por lectores de pantalla).
 */
export function Panel({
  numero,
  titulo,
  descripcion,
  vacio,
  tabla,
  accion,
  className,
  children,
}: {
  numero: number;
  titulo: string;
  descripcion?: string;
  /** Si es true, muestra el estado vacío en lugar del gráfico. */
  vacio?: boolean;
  tabla?: Tabla;
  accion?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cx("flex flex-col", className)}>
      <CardHeader
        titulo={`${String(numero).padStart(2, "0")} · ${titulo}`}
        descripcion={descripcion}
        accion={accion}
      />
      <div className="flex-1">
        {vacio ? <EmptyState titulo="Sin datos en el período" descripcion="Prueba con un rango de fechas más amplio." /> : children}
      </div>
      {tabla && !vacio && tabla.filas.length > 0 && (
        <details className="group mt-3 border-t border-line pt-2">
          <summary className="cursor-pointer text-xs text-faint select-none hover:text-muted">Ver datos en tabla</summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface text-faint">
                <tr>
                  {tabla.columnas.map((c) => (
                    <th key={c} scope="col" className="py-1.5 pr-3 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line text-muted">
                {tabla.filas.map((fila, i) => (
                  <tr key={i}>
                    {fila.map((celda, j) => (
                      <td key={j} className={cx("py-1.5 pr-3", j === 0 && "text-ink")}>
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
