const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const appName = process.env.NEXT_PUBLIC_APP_NAME || "Control de Equipos";
const emailFrom = process.env.EMAIL_FROM || "Control de Equipos <noreply@example.com>";
const resendApiKey = process.env.RESEND_API_KEY || "";
const ventanaConfigurada = Number(process.env.EMAIL_DIGEST_WINDOW_SECONDS || 120);
const intervaloConfigurado = Number(process.env.EMAIL_DIGEST_POLL_SECONDS || 30);
const ventanaSegundos =
  Number.isFinite(ventanaConfigurada) && ventanaConfigurada > 0 ? ventanaConfigurada : 120;
const intervaloSegundos =
  Number.isFinite(intervaloConfigurado) && intervaloConfigurado > 0 ? intervaloConfigurado : 30;
let procesando = false;

function escaparHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function crearHtmlResumen(notificaciones) {
  const elementos = notificaciones
    .map(
      ({ titulo, detalle, url }) => `
        <li style="margin-bottom: 16px;">
          <strong>${escaparHtml(titulo)}</strong><br>
          ${escaparHtml(detalle)}
          ${url ? `<br><a href="${escaparHtml(url)}">Ver en ${escaparHtml(appName)}</a>` : ""}
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

async function enviarEmail({ to, subject, html }) {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to,
        subject,
        html,
      }),
    });
    if (response.ok) return { ok: true };

    const body = await response.text();
    return { ok: false, error: `HTTP ${response.status}: ${body}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

async function procesarNotificacionesPendientes() {
  if (procesando || !resendApiKey) return;
  procesando = true;

  try {
    const destinatarios = await prisma.notificacionPendiente.findMany({
      where: { enviadoAt: null },
      select: { destinatario: true },
      distinct: ["destinatario"],
      take: 100,
    });

    const limite = Date.now() - ventanaSegundos * 1000;
    for (const { destinatario } of destinatarios) {
      const notificaciones = await prisma.notificacionPendiente.findMany({
        where: { destinatario, enviadoAt: null },
        orderBy: { createdAt: "asc" },
      });
      const ultima = notificaciones.at(-1);
      if (!ultima || ultima.createdAt.getTime() > limite) continue;

      const subject =
        notificaciones.length === 1
          ? `${notificaciones[0].titulo} · ${appName}`
          : `${notificaciones.length} novedades · ${appName}`;
      const result = await enviarEmail({
        to: destinatario,
        subject,
        html: crearHtmlResumen(notificaciones),
      });

      if (!result.ok) {
        await prisma.notificacionPendiente.updateMany({
          where: { id: { in: notificaciones.map(({ id }) => id) }, enviadoAt: null },
          data: { intentos: { increment: 1 }, ultimoError: result.error },
        });
        console.error("[email-digest] Error enviando resumen:", result.error);
        continue;
      }

      await prisma.notificacionPendiente.updateMany({
        where: { id: { in: notificaciones.map(({ id }) => id) }, enviadoAt: null },
        data: { enviadoAt: new Date(), ultimoError: null },
      });
    }
  } catch (error) {
    console.error("[email-digest] Error procesando notificaciones:", error);
  } finally {
    procesando = false;
  }
}

function startEmailDigestWorker() {
  if (!resendApiKey) {
    console.warn("[email-digest] RESEND_API_KEY no configurada. Trabajador desactivado.");
    return;
  }

  console.log(
    `[email-digest] Trabajador activo (ventana ${ventanaSegundos}s, intervalo ${intervaloSegundos}s)`
  );
  setInterval(() => void procesarNotificacionesPendientes(), intervaloSegundos * 1000);
  void procesarNotificacionesPendientes();
}

module.exports = { startEmailDigestWorker };
