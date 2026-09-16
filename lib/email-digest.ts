import { enviarEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Control de Equipos";
const ventanaConfigurada = Number(process.env.EMAIL_DIGEST_WINDOW_SECONDS ?? 120);
const VENTANA_SEGUNDOS =
  Number.isFinite(ventanaConfigurada) && ventanaConfigurada > 0 ? ventanaConfigurada : 120;

declare global {
  var emailDigestTimer: NodeJS.Timeout | undefined;
}

function escaparHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function crearHtmlResumen(
  notificaciones: Array<{ titulo: string; detalle: string; url: string | null }>
): string {
  const elementos = notificaciones
    .map(
      ({ titulo, detalle, url }) => `
        <li style="margin-bottom: 16px;">
          <strong>${escaparHtml(titulo)}</strong><br>
          ${escaparHtml(detalle)}
          ${url ? `<br><a href="${escaparHtml(url)}">Ver en ${escaparHtml(APP_NAME)}</a>` : ""}
        </li>
      `
    )
    .join("");

  return `
    <p>Hola,</p>
    <p>Tienes ${notificaciones.length === 1 ? "una nueva notificación" : `${notificaciones.length} nuevas notificaciones`}:</p>
    <ul>${elementos}</ul>
    <p>Este correo agrupa los avisos recientes para reducir el número de mensajes recibidos.</p>
  `;
}

export async function procesarNotificacionesPendientes(): Promise<void> {
  const destinatarios = await prisma.notificacionPendiente.findMany({
    where: { enviadoAt: null },
    select: { destinatario: true },
    distinct: ["destinatario"],
    take: 100,
  });

  const limite = Date.now() - VENTANA_SEGUNDOS * 1000;
  for (const { destinatario } of destinatarios) {
    const notificaciones = await prisma.notificacionPendiente.findMany({
      where: { destinatario, enviadoAt: null },
      orderBy: { createdAt: "asc" },
    });
    const ultima = notificaciones.at(-1);
    if (!ultima || ultima.createdAt.getTime() > limite) continue;

    const result = await enviarEmail({
      to: destinatario,
      subject:
        notificaciones.length === 1
          ? `${notificaciones[0].titulo} · ${APP_NAME}`
          : `${notificaciones.length} novedades · ${APP_NAME}`,
      html: crearHtmlResumen(notificaciones),
    });

    if (result.ok) {
      await prisma.notificacionPendiente.updateMany({
        where: { id: { in: notificaciones.map(({ id }) => id) }, enviadoAt: null },
        data: { enviadoAt: new Date(), ultimoError: null },
      });
    } else {
      await prisma.notificacionPendiente.updateMany({
        where: { id: { in: notificaciones.map(({ id }) => id) }, enviadoAt: null },
        data: { intentos: { increment: 1 }, ultimoError: result.error },
      });
    }
  }
}

export function programarProcesamientoNotificacionesEnDesarrollo(): void {
  if (process.env.NODE_ENV === "production") return;
  if (global.emailDigestTimer) clearTimeout(global.emailDigestTimer);

  global.emailDigestTimer = setTimeout(() => {
    global.emailDigestTimer = undefined;
    void procesarNotificacionesPendientes().catch((error) => {
      console.error("[email-digest] Error procesando notificaciones:", error);
    });
  }, VENTANA_SEGUNDOS * 1000);
}
