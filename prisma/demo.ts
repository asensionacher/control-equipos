import { EstadoReciboJugador, PrismaClient, Sexo } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL es obligatorio para ejecutar prisma/demo.ts");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const DEMO_PASSWORD = "DemoFutbol2026!";

const familias = [
  {
    email: "laura.martin@demo.example",
    nombre: "Laura",
    apellidos: "Martín Vega",
    telefono: "600100001",
    jugadores: [
      ["Mateo", "Martín López", "2016-02-14", Sexo.MASCULINO],
      ["Sofía", "Martín López", "2018-07-03", Sexo.FEMENINO],
    ],
  },
  {
    email: "daniel.romero@demo.example",
    nombre: "Daniel",
    apellidos: "Romero Gil",
    telefono: "600100002",
    jugadores: [["Hugo", "Romero Pérez", "2017-11-21", Sexo.MASCULINO]],
  },
  {
    email: "carmen.navarro@demo.example",
    nombre: "Carmen",
    apellidos: "Navarro León",
    telefono: "600100003",
    jugadores: [
      ["Alba", "Navarro León", "2015-05-09", Sexo.FEMENINO],
      ["Marcos", "Navarro León", "2012-09-18", Sexo.MASCULINO],
    ],
  },
  {
    email: "sergio.ortega@demo.example",
    nombre: "Sergio",
    apellidos: "Ortega Ruiz",
    telefono: "600100004",
    jugadores: [["Leo", "Ortega Campos", "2019-01-30", Sexo.MASCULINO]],
  },
  {
    email: "patricia.molina@demo.example",
    nombre: "Patricia",
    apellidos: "Molina Sanz",
    telefono: "600100005",
    jugadores: [["Valeria", "Molina Sanz", "2014-12-11", Sexo.FEMENINO]],
  },
  {
    email: "andres.castillo@demo.example",
    nombre: "Andrés",
    apellidos: "Castillo Rey",
    telefono: "600100006",
    jugadores: [
      ["Martín", "Castillo Rey", "2013-04-07", Sexo.MASCULINO],
      ["Lucas", "Castillo Rey", "2016-10-25", Sexo.MASCULINO],
    ],
  },
  {
    email: "elena.fuentes@demo.example",
    nombre: "Elena",
    apellidos: "Fuentes Vidal",
    telefono: "600100007",
    jugadores: [["Daniela", "Fuentes Vidal", "2011-08-16", Sexo.FEMENINO]],
  },
  {
    email: "roberto.santos@demo.example",
    nombre: "Roberto",
    apellidos: "Santos Cano",
    telefono: "600100008",
    jugadores: [["Adrián", "Santos Cano", "2010-03-22", Sexo.MASCULINO]],
  },
  {
    email: "isabel.torres@demo.example",
    nombre: "Isabel",
    apellidos: "Torres Mora",
    telefono: "600100009",
    jugadores: [
      ["Emma", "Torres Mora", "2018-06-12", Sexo.FEMENINO],
      ["Nicolás", "Torres Mora", "2013-09-02", Sexo.MASCULINO],
    ],
  },
  {
    email: "miguel.herrera@demo.example",
    nombre: "Miguel",
    apellidos: "Herrera Soler",
    telefono: "600100010",
    jugadores: [["Alejandro", "Herrera Soler", "2009-11-05", Sexo.MASCULINO]],
  },
] as const;

const equipos = [
  {
    nombre: "Prebenjamín A",
    categoria: "Prebenjamín",
    descripcion: "Iniciación al fútbol y desarrollo motriz.",
    horarios: [
      [2, 17 * 60 + 15, 18 * 60 + 30],
      [4, 17 * 60 + 15, 18 * 60 + 30],
    ],
  },
  {
    nombre: "Benjamín A",
    categoria: "Benjamín",
    descripcion: "Fútbol formativo para jugadores de categoría benjamín.",
    horarios: [
      [1, 17 * 60 + 30, 19 * 60],
      [3, 17 * 60 + 30, 19 * 60],
      [5, 17 * 60 + 30, 18 * 60 + 45],
    ],
  },
  {
    nombre: "Alevín A",
    categoria: "Alevín",
    descripcion: "Equipo alevín de competición territorial.",
    horarios: [
      [2, 18 * 60 + 30, 20 * 60],
      [4, 18 * 60 + 30, 20 * 60],
      [6, 10 * 60 + 25, 11 * 60 + 45],
    ],
  },
  {
    nombre: "Infantil A",
    categoria: "Infantil",
    descripcion: "Equipo infantil de fútbol 11.",
    horarios: [
      [1, 19 * 60, 20 * 60 + 30],
      [3, 19 * 60, 20 * 60 + 30],
      [5, 19 * 60, 20 * 60 + 30],
    ],
  },
  {
    nombre: "Cadete A",
    categoria: "Cadete",
    descripcion: "Equipo cadete de competición.",
    horarios: [
      [2, 20 * 60, 21 * 60 + 30],
      [4, 20 * 60, 21 * 60 + 30],
      [6, 11 * 60 + 30, 13 * 60],
    ],
  },
  {
    nombre: "Juvenil A",
    categoria: "Juvenil",
    descripcion: "Equipo juvenil de liga territorial.",
    horarios: [
      [1, 20 * 60 + 30, 22 * 60],
      [3, 20 * 60 + 30, 22 * 60],
      [5, 20 * 60 + 30, 22 * 60],
    ],
  },
] as const;

function estadoPago(indice: number, patron: number): EstadoReciboJugador {
  return indice % patron === 0 ? "PENDIENTE" : "PAGADO";
}

async function crearReciboDemo({
  concepto,
  descripcion,
  total,
  fechaEmision,
  fechaVencimiento,
  equiposIds,
  jugadores,
  estadoParaJugador,
  creadoPorId,
}: {
  concepto: string;
  descripcion: string;
  total: number;
  fechaEmision: Date;
  fechaVencimiento: Date;
  equiposIds: string[];
  jugadores: { id: string; equipoId: string }[];
  estadoParaJugador: (indice: number) => EstadoReciboJugador;
  creadoPorId: string;
}) {
  const existente = await prisma.recibo.findFirst({
    where: { concepto, descripcion },
    select: { id: true },
  });
  if (existente) return;

  const estados = jugadores.map((_, indice) => estadoParaJugador(indice));
  const todoPagado = estados.every((estado) => estado === "PAGADO");
  const recibo = await prisma.recibo.create({
    data: {
      concepto,
      descripcion,
      baseImponible: total,
      tipoIva: 0,
      cuotaIva: 0,
      total,
      fechaEmision,
      fechaVencimiento,
      estado: todoPagado ? "PAGADO" : "PENDIENTE",
      fechaPago: todoPagado ? new Date(fechaEmision.getTime() + 2 * 86400000) : null,
      metodoPago: todoPagado ? "Domiciliación bancaria" : null,
      referenciaPago: todoPagado ? `DEMO-${fechaEmision.getTime()}` : null,
      creadoPorId,
      equipos: { connect: equiposIds.map((id) => ({ id })) },
    },
  });

  for (const [indice, jugador] of jugadores.entries()) {
    const estado = estados[indice];
    await prisma.reciboJugador.create({
      data: {
        reciboId: recibo.id,
        jugadorId: jugador.id,
        estado,
        asignadoDirectamente: false,
        fechaPago: estado === "PAGADO" ? new Date(fechaEmision.getTime() + (indice % 5) * 86400000) : null,
        metodoPago:
          estado === "PAGADO"
            ? ["Domiciliación bancaria", "Transferencia", "Tarjeta"][indice % 3]
            : null,
        referenciaPago: estado === "PAGADO" ? `DEMO-PAGO-${recibo.id}-${indice + 1}` : null,
        equiposOrigen: { connect: [{ id: jugador.equipoId }] },
      },
    });
  }
}

async function main() {
  const admin = await prisma.usuario.findFirst({
    where: { rol: "ADMIN" },
    select: { id: true },
  });
  if (!admin) throw new Error("Debe existir al menos un administrador antes de crear la demo");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const temporada = await prisma.temporada.upsert({
    where: { nombre: "2026/2027" },
    update: { activa: true },
    create: {
      nombre: "2026/2027",
      fechaInicio: new Date("2026-09-01T00:00:00.000Z"),
      fechaFin: new Date("2027-06-30T00:00:00.000Z"),
      activa: true,
    },
  });

  const equiposCreados = new Map<string, string>();
  for (const [indice, datos] of equipos.entries()) {
    const codigoFcf = String(900001 + indice);
    const equipo = await prisma.equipo.upsert({
      where: {
        nombre_temporadaId: {
          nombre: datos.nombre,
          temporadaId: temporada.id,
        },
      },
      update: {
        codigoFcf,
        categoria: datos.categoria,
        descripcion: datos.descripcion,
        activo: true,
      },
      create: {
        nombre: datos.nombre,
        codigoFcf,
        categoria: datos.categoria,
        descripcion: datos.descripcion,
        temporadaId: temporada.id,
      },
    });
    equiposCreados.set(datos.nombre, equipo.id);
    await prisma.horarioEntrenamiento.deleteMany({ where: { equipoId: equipo.id } });
    await prisma.horarioEntrenamiento.createMany({
      data: datos.horarios.map(([diaSemana, minutoInicio, minutoFin]) => ({
        equipoId: equipo.id,
        diaSemana,
        minutoInicio,
        minutoFin,
      })),
    });
  }

  const nombresEquiposPorAnio: Record<number, string> = {
    2019: "Prebenjamín A",
    2018: "Benjamín A",
    2017: "Benjamín A",
    2016: "Alevín A",
    2015: "Alevín A",
    2014: "Infantil A",
    2013: "Infantil A",
    2012: "Cadete A",
    2011: "Cadete A",
    2010: "Juvenil A",
    2009: "Juvenil A",
  };
  const jugadoresCreados: { id: string; equipoId: string }[] = [];

  let numeroJugador = 1;
  for (const familia of familias) {
    const usuario = await prisma.usuario.upsert({
      where: { email: familia.email },
      update: {
        nombre: familia.nombre,
        apellidos: familia.apellidos,
        telefono: familia.telefono,
        passwordHash,
        emailVerificado: true,
      },
      create: {
        email: familia.email,
        nombre: familia.nombre,
        apellidos: familia.apellidos,
        telefono: familia.telefono,
        passwordHash,
        rol: "USUARIO",
        emailVerificado: true,
      },
    });

    for (const [nombre, apellidos, fechaNacimiento, sexo] of familia.jugadores) {
      const dniNie = `DEMO-${String(numeroJugador).padStart(4, "0")}`;
      numeroJugador++;
      const jugador = await prisma.jugador.upsert({
        where: { dniNie },
        update: {
          nombre,
          apellidos,
          fechaNacimiento: new Date(`${fechaNacimiento}T00:00:00.000Z`),
          sexo,
          activo: true,
        },
        create: {
          nombre,
          apellidos,
          fechaNacimiento: new Date(`${fechaNacimiento}T00:00:00.000Z`),
          dniNie,
          sexo,
          direccion: "Avenida del Estadio, 12",
          activo: true,
        },
      });
      await prisma.tutoria.upsert({
        where: {
          jugadorId_usuarioId: {
            jugadorId: jugador.id,
            usuarioId: usuario.id,
          },
        },
        update: { parentesco: "Padre/Madre", esPrincipal: true },
        create: {
          jugadorId: jugador.id,
          usuarioId: usuario.id,
          parentesco: "Padre/Madre",
          esPrincipal: true,
        },
      });

      const anio = Number(fechaNacimiento.slice(0, 4));
      const equipoId = equiposCreados.get(nombresEquiposPorAnio[anio]);
      if (!equipoId) throw new Error(`No hay equipo de demo para el año ${anio}`);
      await prisma.asignacionEquipo.upsert({
        where: { jugadorId_equipoId: { jugadorId: jugador.id, equipoId } },
        update: {},
        create: { jugadorId: jugador.id, equipoId },
      });
      jugadoresCreados.push({ id: jugador.id, equipoId });
    }
  }

  const todosEquiposIds = Array.from(new Set(jugadoresCreados.map((jugador) => jugador.equipoId)));
  await crearReciboDemo({
    concepto: "Cuota de inscripción 2026/2027",
    descripcion: "[DEMO] Matrícula anual y ficha federativa.",
    total: 55,
    fechaEmision: new Date("2026-08-20T00:00:00.000Z"),
    fechaVencimiento: new Date("2026-09-05T00:00:00.000Z"),
    equiposIds: todosEquiposIds,
    jugadores: jugadoresCreados,
    estadoParaJugador: () => "PAGADO",
    creadoPorId: admin.id,
  });
  await crearReciboDemo({
    concepto: "Cuota mensual - septiembre 2026",
    descripcion: "[DEMO] Cuota deportiva correspondiente al mes de septiembre.",
    total: 42,
    fechaEmision: new Date("2026-09-01T00:00:00.000Z"),
    fechaVencimiento: new Date("2026-09-10T00:00:00.000Z"),
    equiposIds: todosEquiposIds,
    jugadores: jugadoresCreados,
    estadoParaJugador: (indice) => estadoPago(indice, 6),
    creadoPorId: admin.id,
  });
  await crearReciboDemo({
    concepto: "Equipación oficial 2026/2027",
    descripcion: "[DEMO] Camiseta, pantalón, medias y chándal oficial.",
    total: 89.5,
    fechaEmision: new Date("2026-09-04T00:00:00.000Z"),
    fechaVencimiento: new Date("2026-09-25T00:00:00.000Z"),
    equiposIds: todosEquiposIds,
    jugadores: jugadoresCreados,
    estadoParaJugador: (indice) => estadoPago(indice, 3),
    creadoPorId: admin.id,
  });
  const torneoJugadores = jugadoresCreados.filter(
    (jugador) =>
      jugador.equipoId === equiposCreados.get("Alevín A") ||
      jugador.equipoId === equiposCreados.get("Infantil A")
  );
  await crearReciboDemo({
    concepto: "Torneo de otoño",
    descripcion: "[DEMO] Inscripción y desplazamiento al torneo amistoso de octubre.",
    total: 27.5,
    fechaEmision: new Date("2026-09-12T00:00:00.000Z"),
    fechaVencimiento: new Date("2026-09-30T00:00:00.000Z"),
    equiposIds: Array.from(new Set(torneoJugadores.map((jugador) => jugador.equipoId))),
    jugadores: torneoJugadores,
    estadoParaJugador: () => "PENDIENTE",
    creadoPorId: admin.id,
  });

  const documentoExistente = await prisma.solicitudDocumento.findFirst({
    where: { nombre: "Fotografía para ficha federativa", descripcion: { startsWith: "[DEMO]" } },
  });
  if (!documentoExistente) {
    await prisma.solicitudDocumento.create({
      data: {
        nombre: "Fotografía para ficha federativa",
        descripcion: "[DEMO] Documento pendiente para comprobar el flujo de solicitudes.",
        creadoPorId: admin.id,
        equipos: { connect: todosEquiposIds.map((id) => ({ id })) },
        jugadores: {
          create: jugadoresCreados.map((jugador) => ({
            jugadorId: jugador.id,
            asignadoDirectamente: false,
            equiposOrigen: { connect: [{ id: jugador.equipoId }] },
          })),
        },
      },
    });
  }

  const consentimientoExistente = await prisma.consentimiento.findFirst({
    where: { titulo: "Autorización de desplazamientos", descripcion: { startsWith: "[DEMO]" } },
  });
  if (!consentimientoExistente) {
    await prisma.consentimiento.create({
      data: {
        titulo: "Autorización de desplazamientos",
        descripcion:
          "[DEMO] Autorizo al jugador a desplazarse con el club para partidos y torneos durante la temporada.",
        creadoPorId: admin.id,
        equipos: { connect: todosEquiposIds.map((id) => ({ id })) },
        jugadores: {
          create: jugadoresCreados.map((jugador) => ({
            jugadorId: jugador.id,
            asignadoDirectamente: false,
            equiposOrigen: { connect: [{ id: jugador.equipoId }] },
          })),
        },
      },
    });
  }

  const notificacionesDemo = await prisma.notificacionPendiente.deleteMany({
    where: { destinatario: { endsWith: "@demo.example" }, enviadoAt: null },
  });

  // === Entrenadores de demo ===
  // 1) Carlos: entrenador principal de Alevín A y Cadete A, también tiene cuenta para entrar al portal.
  // 2) Lucía: entrenadora de Infantil A, sin cuenta propia en el sistema.
  const entrenadoresDemo: Array<{
    email: string;
    nombre: string;
    apellidos: string;
    telefono: string;
    telefonoAlternativo?: string;
    equiposNombres: string[];
  }> = [
    {
      email: "carlos.entrenador@demo.example",
      nombre: "Carlos",
      apellidos: "Domínguez Pino",
      telefono: "600200001",
      telefonoAlternativo: "911223344",
      equiposNombres: ["Alevín A", "Cadete A"],
    },
    {
      email: "lucia.entrenador@demo.example",
      nombre: "Lucía",
      apellidos: "Vidal Crespo",
      telefono: "600200002",
      equiposNombres: ["Infantil A"],
    },
  ];

  let entrenadoresCreados = 0;
  for (const ent of entrenadoresDemo) {
    const usuario = await prisma.usuario.upsert({
      where: { email: ent.email },
      update: {
        nombre: ent.nombre,
        apellidos: ent.apellidos,
        telefono: ent.telefono,
        telefonoAlternativo: ent.telefonoAlternativo ?? null,
        passwordHash,
        emailVerificado: true,
      },
      create: {
        email: ent.email,
        nombre: ent.nombre,
        apellidos: ent.apellidos,
        telefono: ent.telefono,
        telefonoAlternativo: ent.telefonoAlternativo ?? null,
        passwordHash,
        rol: "USUARIO",
        emailVerificado: true,
      },
    });

    const entrenador = await prisma.entrenador.upsert({
      where: { usuarioId: usuario.id },
      update: {
        nombre: ent.nombre,
        apellidos: ent.apellidos,
        email: ent.email,
        telefono: ent.telefono,
        telefonoAlternativo: ent.telefonoAlternativo ?? null,
        activo: true,
      },
      create: {
        nombre: ent.nombre,
        apellidos: ent.apellidos,
        email: ent.email,
        telefono: ent.telefono,
        telefonoAlternativo: ent.telefonoAlternativo ?? null,
        usuarioId: usuario.id,
        creadoPorId: admin.id,
      },
    });
    entrenadoresCreados++;

    for (const nombreEq of ent.equiposNombres) {
      const equipoId = equiposCreados.get(nombreEq);
      if (!equipoId) continue;
      await prisma.entrenadorEquipo.upsert({
        where: {
          entrenadorId_equipoId_rol: {
            entrenadorId: entrenador.id,
            equipoId,
            rol: "ENTRENADOR_PRINCIPAL",
          },
        },
        update: {},
        create: {
          entrenadorId: entrenador.id,
          equipoId,
          rol: "ENTRENADOR_PRINCIPAL",
          temporadaId: temporada.id,
        },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        familias: familias.length,
        jugadores: jugadoresCreados.length,
        equipos: equipos.length,
        recibosDemo: 4,
        entrenadoresDemo: entrenadoresCreados,
        notificacionesEliminadas: notificacionesDemo.count,
        accesoDemo: {
          emails: "Cualquier dirección @demo.example creada por este script",
          password: DEMO_PASSWORD,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
