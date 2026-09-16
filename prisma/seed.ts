import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed...");

  // Crear admin
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.usuario.create({
    data: {
      email: "admin@controldeequipos.es",
      passwordHash: adminPassword,
      nombre: "Admin",
      apellidos: "Principal",
      rol: "ADMIN",
      emailVerificado: true,
    },
  });

  // Configuración del club (singleton)
  await prisma.configuracionClub.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nombre: "Club Deportivo de Prueba",
      nif: "G12345678",
      direccion: "Calle del Deporte, 1",
      codigoPostal: "28001",
      ciudad: "Madrid",
      provincia: "Madrid",
      pais: "España",
      telefono: "910000000",
      email: "info@controldeequipos.es",
      web: "https://controldeequipos.es",
      ivaPorDefecto: 21,
      prefijoRecibo: "R",
    },
  });

  // Crear temporadas
  const tempActual = await prisma.temporada.create({
    data: {
      nombre: "2026/2027",
      fechaInicio: new Date("2026-09-01"),
      fechaFin: new Date("2027-06-30"),
      activa: true,
    },
  });

  const tempAnterior = await prisma.temporada.create({
    data: {
      nombre: "2025/2026",
      fechaInicio: new Date("2025-09-01"),
      fechaFin: new Date("2026-06-30"),
      activa: false,
    },
  });

  // Crear equipos
  const alevinA = await prisma.equipo.create({
    data: {
      nombre: "Alevín A",
      categoria: "Alevín",
      descripcion: "Equipo alevín masculino",
      urlLiga: "https://competicion.federacion.es/alevin-a",
      temporadaId: tempActual.id,
    },
  });

  const benjaminB = await prisma.equipo.create({
    data: {
      nombre: "Benjamín B",
      categoria: "Benjamín",
      descripcion: "Equipo benjamín mixto",
      temporadaId: tempActual.id,
    },
  });

  const cadete = await prisma.equipo.create({
    data: {
      nombre: "Cadete",
      categoria: "Cadete",
      temporadaId: tempActual.id,
    },
  });

  // Equipo histórico de la temporada anterior
  await prisma.equipo.create({
    data: {
      nombre: "Prebenjamines",
      categoria: "Prebenjamín",
      temporadaId: tempAnterior.id,
    },
  });

  // Crear padre
  const padrePassword = await bcrypt.hash("padre123", 10);
  const padre = await prisma.usuario.create({
    data: {
      email: "padre@example.com",
      passwordHash: padrePassword,
      nombre: "Juan",
      apellidos: "García López",
      telefono: "600111222",
      rol: "USUARIO",
      emailVerificado: true,
    },
  });

  // Padre que también es jugador
  const padreJugadorPassword = await bcrypt.hash("padrejugador123", 10);
  const padreJugador = await prisma.usuario.create({
    data: {
      email: "maria@example.com",
      passwordHash: padreJugadorPassword,
      nombre: "María",
      apellidos: "Martínez Sanz",
      telefono: "600333444",
      rol: "USUARIO",
      emailVerificado: true,
    },
  });

  // Jugadores vinculados al primer padre
  const jugador1 = await prisma.jugador.create({
    data: {
      nombre: "Pablo",
      apellidos: "García Ruiz",
      fechaNacimiento: new Date("2013-05-12"),
      dniNie: "12345678A",
    },
  });

  await prisma.tutoria.create({
    data: {
      jugadorId: jugador1.id,
      usuarioId: padre.id,
      parentesco: "Padre",
      esPrincipal: true,
    },
  });

  const jugador2 = await prisma.jugador.create({
    data: {
      nombre: "Lucía",
      apellidos: "García Ruiz",
      fechaNacimiento: new Date("2015-09-20"),
      dniNie: "87654321B",
    },
  });

  await prisma.tutoria.create({
    data: {
      jugadorId: jugador2.id,
      usuarioId: padre.id,
      parentesco: "Padre",
      esPrincipal: true,
    },
  });

  // Padre-jugador (María): tiene un hijo y es ella misma jugadora
  const jugador3 = await prisma.jugador.create({
    data: {
      nombre: "Diego",
      apellidos: "Martínez Sanz",
      fechaNacimiento: new Date("2017-01-15"),
      dniNie: "11223344C",
    },
  });

  await prisma.tutoria.create({
    data: {
      jugadorId: jugador3.id,
      usuarioId: padreJugador.id,
      parentesco: "Madre",
      esPrincipal: true,
    },
  });

  // Crear el registro de jugador para María (también es jugadora)
  const jugadorMaria = await prisma.jugador.create({
    data: {
      nombre: "María",
      apellidos: "Martínez Sanz",
      fechaNacimiento: new Date("1990-06-20"),
      dniNie: "55667788D",
      usuarioId: padreJugador.id,
    },
  });

  // Jugador sin tutor
  await prisma.jugador.create({
    data: {
      nombre: "Carlos",
      apellidos: "Ruiz Gómez",
      fechaNacimiento: new Date("2012-08-10"),
      dniNie: "99887766E",
    },
  });

  // Asignaciones temporada actual
  await prisma.asignacionEquipo.create({
    data: { jugadorId: jugador1.id, equipoId: alevinA.id },
  });

  await prisma.asignacionEquipo.create({
    data: { jugadorId: jugador2.id, equipoId: benjaminB.id },
  });

  await prisma.asignacionEquipo.create({
    data: { jugadorId: jugador3.id, equipoId: benjaminB.id },
  });

  // María como jugadora en cadete
  await prisma.asignacionEquipo.create({
    data: { jugadorId: jugadorMaria.id, equipoId: cadete.id },
  });

  console.log("Seed completado:");
  console.log("");
  console.log("Cuentas de acceso:");
  console.log("  Admin:      admin@controldeequipos.es / admin123");
  console.log("  Padre:      padre@example.com / padre123");
  console.log("  P/Jugadora: maria@example.com / padrejugador123");
  console.log("");
  console.log("Datos:");
  console.log(`- 2 temporadas creadas (2026/2027 activa, 2025/2026 histórica)`);
  console.log(`- 4 equipos creados`);
  console.log(`- 5 jugadores (1 sin tutor, 4 con padre, María es también jugadora)`);
  console.log(`- Configuración del club inicializada (editable desde /admin/configuracion)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
