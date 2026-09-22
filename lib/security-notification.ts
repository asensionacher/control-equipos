import "server-only";
import { enviarEmail } from "./email";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Control de Equipos";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function notificarCambioSeguridad(params: {
  email: string | null;
  nombre: string;
  descripcion: string;
}): Promise<void> {
  if (!params.email) return;

  const resultado = await enviarEmail({
    to: params.email,
    subject: `Cambio de seguridad en ${APP_NAME}`,
    html: `
      <p>Hola ${escapeHtml(params.nombre)},</p>
      <p>${escapeHtml(params.descripcion)}</p>
      <p>Si no reconoces este cambio, contacta inmediatamente con la administración de ${escapeHtml(APP_NAME)}.</p>
    `,
  });
  if (!resultado.ok) {
    console.error(
      `[security] No se pudo notificar el cambio de seguridad a ${params.email}:`,
      resultado.error
    );
  }
}
