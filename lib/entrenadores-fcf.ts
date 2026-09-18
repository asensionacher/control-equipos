import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

function getEmailFicticio(equipo: { id: string; codigoFcf: string | null }) {
  return `entrenador.${equipo.codigoFcf ?? equipo.id}@example.invalid`.toLowerCase();
}

export async function asegurarEntrenadoresFicticios({
  temporadaId,
  creadoPorId,
}: {
  temporadaId: string;
  creadoPorId: string;
}): Promise<{ equiposCubiertos: number; cuentasCreadas: number }> {
  const password = process.env.FCF_TRAINER_DEFAULT_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error(
      "Configura FCF_TRAINER_DEFAULT_PASSWORD con al menos 8 caracteres"
    );
  }

  const equipos = await prisma.equipo.findMany({
    where: { temporadaId, activo: true },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      codigoFcf: true,
      entrenadoresAsignaciones: {
        take: 1,
        select: { id: true },
      },
    },
  });
  const sinEntrenador = equipos.filter(
    ({ entrenadoresAsignaciones }) => entrenadoresAsignaciones.length === 0
  );
  if (sinEntrenador.length === 0) {
    return { equiposCubiertos: 0, cuentasCreadas: 0 };
  }

  const emails = sinEntrenador.map(getEmailFicticio);
  const usuariosExistentes = await prisma.usuario.findMany({
    where: { email: { in: emails } },
    select: {
      id: true,
      email: true,
      entrenadorComoUsuario: { select: { id: true } },
    },
  });
  const usuariosPorEmail = new Map(
    usuariosExistentes.flatMap((usuario) =>
      usuario.email ? [[usuario.email, usuario] as const] : []
    )
  );
  const passwordHash = await bcrypt.hash(password, 10);
  let cuentasCreadas = 0;

  const operaciones = sinEntrenador.map((equipo) => {
    const email = getEmailFicticio(equipo);
    const usuario = usuariosPorEmail.get(email);
    const nombre = "Entrenador";
    const apellidos = `FCF ${equipo.codigoFcf ?? equipo.id}`;
    const observaciones = `Cuenta ficticia creada automáticamente para ${equipo.nombre}.`;

    if (usuario?.entrenadorComoUsuario) {
      return prisma.entrenadorEquipo.create({
        data: {
          entrenadorId: usuario.entrenadorComoUsuario.id,
          equipoId: equipo.id,
          temporadaId,
          rol: "ENTRENADOR_PRINCIPAL",
        },
      });
    }

    if (usuario) {
      return prisma.entrenador.create({
        data: {
          nombre,
          apellidos,
          email,
          observaciones,
          usuarioId: usuario.id,
          creadoPorId,
          equipos: {
            create: {
              equipoId: equipo.id,
              temporadaId,
              rol: "ENTRENADOR_PRINCIPAL",
            },
          },
        },
      });
    }

    cuentasCreadas++;
    return prisma.usuario.create({
      data: {
        email,
        passwordHash,
        nombre,
        apellidos,
        rol: "USUARIO",
        emailVerificado: true,
        entrenadorComoUsuario: {
          create: {
            nombre,
            apellidos,
            email,
            observaciones,
            creadoPorId,
            equipos: {
              create: {
                equipoId: equipo.id,
                temporadaId,
                rol: "ENTRENADOR_PRINCIPAL",
              },
            },
          },
        },
      },
    });
  });

  await prisma.$transaction(operaciones);
  return { equiposCubiertos: sinEntrenador.length, cuentasCreadas };
}
