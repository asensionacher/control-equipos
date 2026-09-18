import { prisma } from "./prisma";

export interface DatosPersonalesJugador {
  nombre: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  telefonoAlternativo: string | null;
}

/**
 * Devuelve true si el Jugador puede usar el portal por su cuenta.
 * Reglas:
 *   - Tiene que existir un Usuario vinculado (usuarioId)
 *   - Ese Usuario debe tener un email válido (no vacío ni null)
 *   - El Jugador NO debe tener tutorias activas (si las tiene, lo gestiona el padre)
 */
export async function jugadorTieneAccesoPortalPropio(
  jugadorId: string
): Promise<boolean> {
  const jugador = await prisma.jugador.findUnique({
    where: { id: jugadorId },
    select: {
      usuarioId: true,
      tutorias: { select: { id: true } },
      usuario: { select: { email: true } },
    },
  });
  if (!jugador) return false;
  if (!jugador.usuarioId) return false;
  if (!jugador.usuario?.email) return false;
  if (jugador.tutorias.length > 0) return false;
  return true;
}

/**
 * Obtiene los datos personales canónicos de un Jugador.
 *
 * Si el Jugador tiene una cuenta propia (usuarioId vinculado) y ese Usuario tiene
 * passwordHash (cuenta ya activada), usamos los datos del Usuario.
 *
 * Si el Jugador tiene un tutor principal (Tutoria con esPrincipal=true), usamos
 * los datos del tutor como contacto principal, pero mantenemos nombre y apellidos
 * del Jugador (porque son los nombres deportivos del jugador, no del tutor).
 *
 * Reglas finales:
 * - nombre, apellidos: SIEMPRE del Jugador (son los nombres del jugador)
 * - email, telefono, telefonoAlternativo:
 *    - Si tiene Usuario propio -> del Usuario
 *    - Si no, del tutor principal
 *    - Si no, del Jugador
 */
export async function getDatosPersonales(jugadorId: string): Promise<DatosPersonalesJugador> {
  const jugador = await prisma.jugador.findUnique({
    where: { id: jugadorId },
    include: {
      usuario: true,
      tutorias: {
        where: { esPrincipal: true },
        include: { usuario: true },
        take: 1,
      },
    },
  });

  if (!jugador) {
    return { nombre: "", apellidos: "", email: null, telefono: null, telefonoAlternativo: null };
  }

  const tutorPrincipal = jugador.tutorias[0]?.usuario;
  const usuarioPropio = jugador.usuario;

  // Email y teléfonos vienen del usuario apropiado:
  // - Si tiene cuenta propia -> ese Usuario
  // - Si no -> tutor principal
  // - Si no -> datos del Jugador
  let email: string | null = jugador.email;
  let telefono: string | null = jugador.telefono;
  let telefonoAlternativo: string | null = jugador.telefonoAlternativo;

  if (usuarioPropio && usuarioPropio.passwordHash) {
    email = usuarioPropio.email;
    telefono = usuarioPropio.telefono;
    telefonoAlternativo = usuarioPropio.telefonoAlternativo;
  } else if (tutorPrincipal) {
    email = email ?? tutorPrincipal.email;
    telefono = telefono ?? tutorPrincipal.telefono;
    telefonoAlternativo = telefonoAlternativo ?? tutorPrincipal.telefonoAlternativo;
  }

  return {
    nombre: jugador.nombre,
    apellidos: jugador.apellidos,
    email,
    telefono,
    telefonoAlternativo,
  };
}

/**
 * Sincroniza los datos personales (email, teléfono) entre el Jugador y sus Usuarios asociados.
 * Se debe llamar después de:
 * - Crear/actualizar un Usuario que es tutor
 * - Editar el perfil de un Usuario que tiene cuenta propia y jugador vinculado
 * - Editar el perfil de un Usuario que es tutor de uno o varios jugadores
 */
export async function sincronizarDatosPersonalesUsuario(usuarioId: string): Promise<void> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) return;

  // Sincronizar email/teléfono en:
  // 1. El Jugador vinculado por usuarioId (si existe)
  const jugadorPropio = await prisma.jugador.findUnique({ where: { usuarioId } });
  if (jugadorPropio) {
    await prisma.jugador.update({
      where: { id: jugadorPropio.id },
      data: {
        email: usuario.email,
        telefono: usuario.telefono,
        telefonoAlternativo: usuario.telefonoAlternativo,
      },
    });
  }

  // 2. Los Jugadores donde este Usuario es tutor principal y que NO tienen Usuario propio
  const tutorias = await prisma.tutoria.findMany({
    where: { usuarioId, esPrincipal: true },
    include: { jugador: { include: { usuario: true } } },
  });

  for (const tutoria of tutorias) {
    const jugador = tutoria.jugador;
    // Solo sincronizamos si el jugador NO tiene cuenta propia (porque entonces
    // los datos del jugador son los del Usuario propio, no del tutor)
    if (!jugador.usuario) {
      await prisma.jugador.update({
        where: { id: jugador.id },
        data: {
          // Solo actualizar email/teléfono si están vacíos, para no pisar
          // datos que el admin introdujo manualmente
          ...(jugador.email == null ? { email: usuario.email } : {}),
          ...(jugador.telefono == null ? { telefono: usuario.telefono } : {}),
          ...(jugador.telefonoAlternativo == null
            ? { telefonoAlternativo: usuario.telefonoAlternativo }
            : {}),
        },
      });
    }
  }
}
