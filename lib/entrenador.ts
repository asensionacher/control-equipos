import { prisma } from "./prisma";

/**
 * Devuelve el Entrenador vinculado al usuario de la sesión (a través de Entrenador.usuarioId).
 * Si el usuario no es un entrenador, devuelve null.
 */
export async function getEntrenadorDeUsuario(usuarioId: string) {
  return prisma.entrenador.findUnique({
    where: { usuarioId },
    include: {
      usuario: { select: { id: true, email: true } },
      jugador: {
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          fechaNacimiento: true,
          fotoUrl: true,
        },
      },
      equipos: {
        include: {
          equipo: {
            select: {
              id: true,
              nombre: true,
              categoria: true,
              activo: true,
              temporada: { select: { id: true, nombre: true, activa: true } },
              horariosEntrenamiento: {
                select: {
                  id: true,
                  diaSemana: true,
                  minutoInicio: true,
                  minutoFin: true,
                },
                orderBy: [
                  { diaSemana: "asc" },
                  { minutoInicio: "asc" },
                ],
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Equipos en los que el usuario está apuntado como Jugador (es decir, también juega).
 * Se usa para la vista unificada "entrenos como jugador".
 */
export async function getEquiposComoJugador(usuarioId: string) {
  const jugador = await prisma.jugador.findUnique({
    where: { usuarioId },
    include: {
      asignaciones: {
        include: {
          equipo: {
            select: {
              id: true,
              nombre: true,
              categoria: true,
              activo: true,
              temporada: { select: { id: true, nombre: true, activa: true } },
              horariosEntrenamiento: {
                select: {
                  id: true,
                  diaSemana: true,
                  minutoInicio: true,
                  minutoFin: true,
                },
                orderBy: [
                  { diaSemana: "asc" },
                  { minutoInicio: "asc" },
                ],
              },
            },
          },
        },
        orderBy: { fechaAsignacion: "desc" },
      },
    },
  });
  if (!jugador) return [];
  return jugador.asignaciones.map((a) => a.equipo);
}
