"use server";

import { revalidatePath } from "next/cache";
import { resolverAlertaPorId } from "./service";

/** Marca una alerta como atendida desde el dashboard. */
export async function resolverAlerta(id: string): Promise<{ ok: boolean }> {
  if (typeof id !== "string" || id.length === 0 || id.length > 40) return { ok: false };
  const ok = await resolverAlertaPorId(id);
  if (ok) {
    revalidatePath("/dashboard");
    revalidatePath("/");
  }
  return { ok };
}
