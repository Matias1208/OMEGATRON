/**
 * Cron interno para la demo local: si CRON_INTERNO_MINUTOS está definido, ejecuta las
 * revisiones de alertas al arrancar el servidor y luego cada N minutos.
 * En producción (Vercel) usar /api/cron/alertas con Vercel Cron en su lugar.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const minutos = Number(process.env.CRON_INTERNO_MINUTOS);
  if (!minutos || minutos <= 0) return;

  // Evita intervalos duplicados con el hot-reload de desarrollo.
  const g = globalThis as unknown as { __omegatronCron?: NodeJS.Timeout };
  if (g.__omegatronCron) return;

  const { ejecutarRevisionesProgramadas } = await import("./features/alertas/cron");
  const ejecutar = () => ejecutarRevisionesProgramadas().catch((e) => console.error("[cron interno]", e));

  setTimeout(ejecutar, 10_000); // primera revisión poco después de arrancar
  g.__omegatronCron = setInterval(ejecutar, minutos * 60 * 1000);
  console.log(`[cron interno] Revisiones de alertas cada ${minutos} min`);
}
