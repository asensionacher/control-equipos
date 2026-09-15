import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ActivarCuentaForm } from "./form";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

export default async function ActivarCuentaPage({ params }: PageProps) {
  const { token } = await params;

  const pending = await prisma.pendingRegistration.findUnique({
    where: { token },
    include: {
      jugador: { select: { nombre: true, apellidos: true } },
    },
  });

  if (!pending || pending.usado || pending.expiresAt < new Date()) {
    notFound();
  }

  const nombreJugador = pending.jugador
    ? `${pending.jugador.nombre} ${pending.jugador.apellidos}`
    : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <ActivarCuentaForm
          token={token}
          nombre={`${pending.nombre} ${pending.apellidos}`}
          email={pending.email}
          jugadorVinculado={pending.jugadorId ? nombreJugador : undefined}
          esActivacionDeJugador={!!pending.jugadorId}
        />
      </div>
    </main>
  );
}
