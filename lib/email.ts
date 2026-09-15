import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Control de Equipos <noreply@example.com>";

interface EnviarEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function enviarEmail({ to, subject, html }: EnviarEmailParams): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY no configurada. Email no enviado:", { to, subject });
    return { ok: false, error: "Servicio de email no configurado" };
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
    if (error) {
      console.error("[email] Error enviando:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] Excepción:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Error desconocido" };
  }
}
