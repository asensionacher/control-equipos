import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JugadorEditTutorForm } from "./form";
import { formatearFechaInput } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function EditarJugadorTutorPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const jugador = await prisma.jugador.findUnique({
    where: { id },
    include: {
      tutorias: { where: { usuarioId: session.user.id } },
    },
  });

  if (!jugador) notFound();
  const esPropia = jugador.usuarioId === session.user.id;
  const esTutor = jugador.tutorias.length > 0;
  if (!esTutor && !esPropia) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/dashboard/jugadores/${jugador.id}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a la ficha
      </Link>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Editar jugador</h1>

      <JugadorEditTutorForm
        jugador={{
          id: jugador.id,
          nombre: jugador.nombre,
          apellidos: jugador.apellidos,
          fechaNacimiento: formatearFechaInput(jugador.fechaNacimiento),
          dniNie: jugador.dniNie,
          email: jugador.email,
          telefono: jugador.telefono,
          direccion: jugador.direccion,
          fotoUrl: jugador.fotoUrl,
          sexo: jugador.sexo,
        }}
      />
    </div>
  );
}
