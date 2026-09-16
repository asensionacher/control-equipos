import { prisma } from "@/lib/prisma";
import { programarProcesamientoNotificacionesEnDesarrollo } from "@/lib/email-digest";

export function getAppUrl(): string {
  return process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function escaparHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function esEmailReservadoDePrueba(email: string): boolean {
  const dominio = email.trim().toLowerCase().split("@").at(-1);
  return (
    dominio === "example" ||
    Boolean(dominio?.endsWith(".example")) ||
    ["example.com", "example.net", "example.org"].some(
      (reservado) => dominio === reservado || dominio?.endsWith(`.${reservado}`)
    )
  );
}

export async function encolarNotificacion({
  destinatario,
  titulo,
  detalle,
  url,
}: {
  destinatario: string;
  titulo: string;
  detalle: string;
  url?: string;
}): Promise<void> {
  if (esEmailReservadoDePrueba(destinatario)) return;
  await prisma.notificacionPendiente.create({
    data: { destinatario, titulo, detalle, url },
  });
  programarProcesamientoNotificacionesEnDesarrollo();
}

export async function enviarNotificacionAJugadores({
  jugadoresIds,
  crearNotificacion,
}: {
  jugadoresIds: string[];
  crearNotificacion: (jugador: {
    id: string;
    nombre: string;
    apellidos: string;
  }) => {
    titulo: string;
    detalle: string;
    url?: string;
  };
}): Promise<void> {
  const jugadores = await prisma.jugador.findMany({
    where: { id: { in: jugadoresIds } },
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      usuario: { select: { email: true } },
      tutorias: { select: { usuario: { select: { email: true } } } },
    },
  });

  const notificaciones = jugadores.flatMap((jugador) => {
    const destinatarios = new Set<string>();
    if (jugador.usuario?.email) destinatarios.add(jugador.usuario.email);
    jugador.tutorias.forEach(({ usuario }) => destinatarios.add(usuario.email));

    if (destinatarios.size === 0) {
      console.warn("[notificacion] Jugador sin destinatarios:", jugador.id);
      return [];
    }

    const notificacion = crearNotificacion(jugador);
    return Array.from(destinatarios)
      .filter((destinatario) => !esEmailReservadoDePrueba(destinatario))
      .map((destinatario) => ({
        destinatario,
        ...notificacion,
      }));
  });

  if (notificaciones.length === 0) return;

  await prisma.notificacionPendiente.createMany({ data: notificaciones });
  programarProcesamientoNotificacionesEnDesarrollo();
}
