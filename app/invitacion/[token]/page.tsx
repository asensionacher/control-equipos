import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AceptarInvitacionForm } from "./form";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AceptarInvitacionPage({ params }: PageProps) {
  const { token } = await params;

  const invitacion = await prisma.invitacion.findUnique({
    where: { token },
    include: { jugador: true },
  });

  if (!invitacion || invitacion.usada || invitacion.expirada || invitacion.expiresAt < new Date()) {
    notFound();
  }

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { email: invitacion.emailDestino.toLowerCase() },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <AceptarInvitacionForm
          token={token}
          emailDestino={invitacion.emailDestino}
          nombreJugador={`${invitacion.jugador.nombre} ${invitacion.jugador.apellidos}`}
          tipoInvitacion={invitacion.tipo as "REGISTRO" | "VINCULACION"}
          usuarioExistente={!!usuarioExistente}
        />
      </div>
    </main>
  );
}
