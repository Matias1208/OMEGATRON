"use server";

import { revalidatePath } from "next/cache";
import { registrarIngresoLote, type ResultadoIngreso } from "./lotes";

/** Formulario de reposición del dashboard (useActionState). */
export async function ingresarLote(_previo: ResultadoIngreso | null, formData: FormData): Promise<ResultadoIngreso> {
  const resultado = await registrarIngresoLote({
    inventarioId: String(formData.get("inventarioId") ?? ""),
    codigo: String(formData.get("codigo") ?? ""),
    cantidad: String(formData.get("cantidad") ?? ""),
    fechaVencimiento: String(formData.get("fechaVencimiento") ?? ""),
  });
  if (resultado.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/");
  }
  return resultado;
}
