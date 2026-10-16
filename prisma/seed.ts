import { PrismaClient, NivelRiesgo, TipoEPP, EstadoEntrega } from "@prisma/client";

const prisma = new PrismaClient();

const DIA_MS = 24 * 60 * 60 * 1000;

// Fecha "de calendario" de Ecuador (UTC-5) como Date a medianoche UTC, para columnas @db.Date.
function fechaEcuador(offsetDias = 0): Date {
  const ahoraEc = new Date(Date.now() - 5 * 60 * 60 * 1000 + offsetDias * DIA_MS);
  return new Date(Date.UTC(ahoraEc.getUTCFullYear(), ahoraEc.getUTCMonth(), ahoraEc.getUTCDate()));
}

// PRNG determinista para que el historial sea igual en cada seed.
let semilla = 42;
function rand() {
  semilla = (semilla * 1664525 + 1013904223) % 2 ** 32;
  return semilla / 2 ** 32;
}

async function limpiar() {
  await prisma.alerta.deleteMany();
  await prisma.entrega.deleteMany();
  await prisma.lote.deleteMany();
  await prisma.inventario.deleteMany();
  await prisma.estacion.deleteMany();
  await prisma.asignacionTurno.deleteMany();
  await prisma.cargoEPP.deleteMany();
  await prisma.tareaEPP.deleteMany();
  await prisma.operario.deleteMany();
  await prisma.ePP.deleteMany();
  await prisma.tarea.deleteMany();
  await prisma.quimico.deleteMany();
  await prisma.cargo.deleteMany();
  await prisma.turno.deleteMany();
  await prisma.area.deleteMany();
  await prisma.cliente.deleteMany();
}

async function main() {
  await limpiar();

  // ── Organización ──────────────────────────
  const cliente = await prisma.cliente.create({
    data: { nombre: "Expo Clean Demo S.A.", ruc: "1790000000001" },
  });

  const [areaHosp, areaOfi, areaPlanta] = await Promise.all(
    ["Hospital - Quirófanos", "Oficinas Corporativas", "Planta Industrial"].map((nombre) =>
      prisma.area.create({ data: { nombre, clienteId: cliente.id } }),
    ),
  );

  const [turnoManana, turnoTarde, turnoNoche] = await Promise.all([
    prisma.turno.create({ data: { nombre: "Mañana", horaInicio: "06:00", horaFin: "14:00" } }),
    prisma.turno.create({ data: { nombre: "Tarde", horaInicio: "14:00", horaFin: "22:00" } }),
    prisma.turno.create({ data: { nombre: "Noche", horaInicio: "22:00", horaFin: "06:00" } }),
  ]);

  const [cargoAux, cargoInd, cargoSup] = await Promise.all([
    prisma.cargo.create({ data: { nombre: "Auxiliar de Limpieza" } }),
    prisma.cargo.create({ data: { nombre: "Operario Industrial" } }),
    prisma.cargo.create({ data: { nombre: "Supervisor" } }),
  ]);

  // ── Químicos y tareas ─────────────────────
  const [hipoclorito, amonio, desengrasante, detergente] = await Promise.all([
    prisma.quimico.create({ data: { nombre: "Hipoclorito de sodio 5%", nivelRiesgo: NivelRiesgo.ALTO, descripcion: "Corrosivo, vapores irritantes" } }),
    prisma.quimico.create({ data: { nombre: "Amonio cuaternario", nivelRiesgo: NivelRiesgo.MEDIO, descripcion: "Irritante dérmico y ocular" } }),
    prisma.quimico.create({ data: { nombre: "Desengrasante alcalino", nivelRiesgo: NivelRiesgo.ALTO, descripcion: "pH 13, quemaduras químicas" } }),
    prisma.quimico.create({ data: { nombre: "Detergente neutro", nivelRiesgo: NivelRiesgo.BAJO } }),
  ]);

  const [tQuirofano, tOficina, tDesengrase, tBanos] = await Promise.all([
    prisma.tarea.create({ data: { nombre: "Desinfección de quirófanos", nivelRiesgo: NivelRiesgo.CRITICO, quimicoId: hipoclorito.id } }),
    prisma.tarea.create({ data: { nombre: "Limpieza de oficinas", nivelRiesgo: NivelRiesgo.BAJO, quimicoId: detergente.id } }),
    prisma.tarea.create({ data: { nombre: "Desengrase de maquinaria", nivelRiesgo: NivelRiesgo.ALTO, quimicoId: desengrasante.id } }),
    prisma.tarea.create({ data: { nombre: "Limpieza de baños", nivelRiesgo: NivelRiesgo.MEDIO, quimicoId: amonio.id } }),
  ]);

  // ── EPP ───────────────────────────────────
  const eppData = [
    { codigo: "GUA-NIT", nombre: "Guantes de nitrilo desechables", tipo: TipoEPP.GUANTES, costoUnitario: 0.35, vidaUtilDias: 1, especificaciones: { material: "Nitrilo", talla: "M", norma: "EN 455" } },
    { codigo: "GUA-NEO", nombre: "Guantes de neopreno químico", tipo: TipoEPP.GUANTES, costoUnitario: 4.5, vidaUtilDias: 15, especificaciones: { material: "Neopreno", largo_cm: 33, norma: "EN 374-1 Tipo A" } },
    { codigo: "MAS-N95", nombre: "Mascarilla N95", tipo: TipoEPP.MASCARILLA, costoUnitario: 1.2, vidaUtilDias: 1, especificaciones: { filtracion: "95%", norma: "NIOSH N95" } },
    { codigo: "RES-MF", nombre: "Respirador media cara + filtro vapores", tipo: TipoEPP.RESPIRADOR, costoUnitario: 28, vidaUtilDias: 30, especificaciones: { filtro: "ABEK1", norma: "EN 140" } },
    { codigo: "GAF-SEG", nombre: "Gafas de seguridad antiempañe", tipo: TipoEPP.GAFAS, costoUnitario: 3.8, vidaUtilDias: 90, especificaciones: { lente: "Policarbonato", norma: "ANSI Z87.1" } },
    { codigo: "DEL-PVC", nombre: "Delantal de PVC", tipo: TipoEPP.ROPA, costoUnitario: 6.5, vidaUtilDias: 30, especificaciones: { material: "PVC", largo_cm: 110 } },
    { codigo: "BOT-PVC", nombre: "Botas de PVC antideslizantes", tipo: TipoEPP.CALZADO, costoUnitario: 14, vidaUtilDias: 180, especificaciones: { suela: "Antideslizante SRC", norma: "EN ISO 20347" } },
  ];
  const epps = Object.fromEntries(
    await Promise.all(eppData.map(async (e) => [e.codigo, await prisma.ePP.create({ data: e })] as const)),
  );

  // ── Reglas de asignación ──────────────────
  await prisma.cargoEPP.createMany({
    data: [
      { cargoId: cargoAux.id, eppId: epps["GUA-NIT"].id },
      { cargoId: cargoAux.id, eppId: epps["MAS-N95"].id },
      { cargoId: cargoInd.id, eppId: epps["GUA-NIT"].id },
      { cargoId: cargoInd.id, eppId: epps["GAF-SEG"].id },
      { cargoId: cargoInd.id, eppId: epps["BOT-PVC"].id },
      { cargoId: cargoSup.id, eppId: epps["MAS-N95"].id },
    ],
  });
  await prisma.tareaEPP.createMany({
    data: [
      { tareaId: tQuirofano.id, eppId: epps["GUA-NEO"].id },
      { tareaId: tQuirofano.id, eppId: epps["GAF-SEG"].id },
      { tareaId: tQuirofano.id, eppId: epps["DEL-PVC"].id },
      { tareaId: tQuirofano.id, eppId: epps["RES-MF"].id },
      { tareaId: tBanos.id, eppId: epps["GUA-NEO"].id },
      { tareaId: tBanos.id, eppId: epps["GAF-SEG"].id },
      { tareaId: tDesengrase.id, eppId: epps["GUA-NEO"].id },
      { tareaId: tDesengrase.id, eppId: epps["DEL-PVC"].id },
      { tareaId: tDesengrase.id, eppId: epps["RES-MF"].id },
    ],
  });

  // ── Estación e inventario ─────────────────
  const estacion = await prisma.estacion.create({
    data: { codigo: "EST-01", nombre: "Estación Hospital Planta Baja", areaId: areaHosp.id },
  });

  // [codigo EPP, stockMinimo, stockActual, diasHastaVencimiento]
  const cargaInicial: [string, number, number, number | null][] = [
    ["GUA-NIT", 50, 400, 365],
    ["GUA-NEO", 10, 60, 540],
    ["MAS-N95", 30, 200, 6],    // lote por vencer en 6 días → alerta LOTE_POR_VENCER
    ["RES-MF", 5, 3, null],     // stock bajo → alerta STOCK_BAJO
    ["GAF-SEG", 5, 25, null],
    ["DEL-PVC", 5, 20, null],
    ["BOT-PVC", 4, 12, null],
  ];
  const lotesPorEpp: Record<string, string> = {};
  for (const [i, [codigo, stockMinimo, stock, dias]] of cargaInicial.entries()) {
    const inv = await prisma.inventario.create({
      data: { estacionId: estacion.id, eppId: epps[codigo].id, slotMotor: i, stockMinimo },
    });
    const lote = await prisma.lote.create({
      data: {
        inventarioId: inv.id,
        codigo: `L-${codigo}-2026A`,
        cantidadInicial: stock,
        stockActual: stock,
        fechaVencimiento: dias === null ? null : fechaEcuador(dias),
      },
    });
    lotesPorEpp[codigo] = lote.id;
  }

  // ── Operarios (RFID en hex mayúsculas, como lo envía el lector MFRC522) ──
  const operariosData = [
    { nombre: "María Quishpe", cedula: "1712345678", rfid: "A1B2C3D4", cargoId: cargoAux.id, areaId: areaHosp.id, tarea: tQuirofano, turno: turnoManana },
    { nombre: "Luis Chiluisa", cedula: "1723456789", rfid: "B2C3D4E5", cargoId: cargoAux.id, areaId: areaOfi.id, tarea: tOficina, turno: turnoManana },
    { nombre: "Ana Toapanta", cedula: "1734567890", rfid: "C3D4E5F6", cargoId: cargoAux.id, areaId: areaOfi.id, tarea: tBanos, turno: turnoTarde },
    { nombre: "Jorge Caiza", cedula: "1745678901", rfid: "D4E5F6A7", cargoId: cargoInd.id, areaId: areaPlanta.id, tarea: tDesengrase, turno: turnoManana },
    { nombre: "Carmen Guamán", cedula: "1756789012", rfid: "E5F6A7B8", cargoId: cargoSup.id, areaId: areaHosp.id, tarea: tQuirofano, turno: turnoNoche },
  ];

  const hoy = fechaEcuador();
  const operarios = [];
  for (const { tarea, turno, ...data } of operariosData) {
    const op = await prisma.operario.create({ data });
    await prisma.asignacionTurno.create({
      data: { fecha: hoy, operarioId: op.id, turnoId: turno.id, tareaId: tarea.id, areaId: data.areaId },
    });
    operarios.push({ op, tarea });
  }
  // Operario inactivo para probar el rechazo
  await prisma.operario.create({
    data: { nombre: "Pedro Inactivo", cedula: "1767890123", rfid: "FFFFFFFF", cargoId: cargoAux.id, activo: false },
  });

  // ── Historial de 30 días (para el dashboard) ──
  const reglasTarea = await prisma.tareaEPP.findMany();
  const reglasCargo = await prisma.cargoEPP.findMany();
  const eppPorId = Object.fromEntries(Object.values(epps).map((e) => [e.id, e]));
  const ultimaEntrega = new Map<string, number>(); // `${opId}:${eppId}` → ms

  const historial = [];
  for (let d = 30; d >= 1; d--) {
    for (const { op, tarea } of operarios) {
      if (rand() < 0.15) continue; // días libres
      const fecha = new Date(fechaEcuador(-d).getTime() + (11 + Math.floor(rand() * 6)) * 60 * 60 * 1000);
      const eppIds = new Set([
        ...reglasCargo.filter((r) => r.cargoId === op.cargoId).map((r) => r.eppId),
        ...reglasTarea.filter((r) => r.tareaId === tarea.id).map((r) => r.eppId),
      ]);
      for (const eppId of eppIds) {
        const epp = eppPorId[eppId];
        const clave = `${op.id}:${eppId}`;
        const previa = ultimaEntrega.get(clave);
        if (previa && fecha.getTime() < previa + epp.vidaUtilDias * DIA_MS) continue; // respeta vida útil
        ultimaEntrega.set(clave, fecha.getTime());
        const costo = Number(epp.costoUnitario);
        historial.push({
          fecha,
          operarioId: op.id,
          eppId,
          loteId: lotesPorEpp[epp.codigo],
          estacionId: estacion.id,
          areaId: op.areaId!,
          cantidad: 1,
          costoUnitario: costo,
          costoTotal: costo,
          estado: rand() < 0.06 ? EstadoEntrega.INCUMPLIMIENTO_EHS : EstadoEntrega.VERIFICADO,
          venceUso: new Date(fecha.getTime() + epp.vidaUtilDias * DIA_MS),
        });
      }
    }
  }
  await prisma.entrega.createMany({ data: historial });

  console.log(`✅ Seed OK: ${operarios.length + 1} operarios, ${Object.keys(epps).length} EPP, ${historial.length} entregas históricas`);
  console.log("   RFIDs de prueba: A1B2C3D4 (quirófano), B2C3D4E5 (oficinas), D4E5F6A7 (industrial), FFFFFFFF (inactivo)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
