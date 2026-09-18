import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JugadorForm } from "../../form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function EditarJugadorPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const [jugador, tutores] = await Promise.all([
    prisma.jugador.findUnique({
      where: { id },
      include: {
        tutorias: {
          include: { usuario: { select: { id: true, nombre: true, apellidos: true, email: true } } },
          where: { esPrincipal: true },
        },
      },
    }),
    prisma.usuario.findMany({
      where: { rol: "USUARIO" },
      orderBy: [{ apellidos: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, apellidos: true, email: true },
    }),
  ]);

  if (!jugador) notFound();

  const tutoriaPrincipal = jugador.tutorias[0];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Editar jugador</h1>
      <JugadorForm
        tutores={tutores}
        jugador={{
          id: jugador.id,
          nombre: jugador.nombre,
          apellidos: jugador.apellidos,
          fechaNacimiento: jugador.fechaNacimiento.toISOString().split("T")[0],
          dniNie: jugador.dniNie,
          email: jugador.email,
          telefono: jugador.telefono,
          telefonoAlternativo: jugador.telefonoAlternativo,
          direccion: jugador.direccion,
          fotoUrl: jugador.fotoUrl,
          sexo: jugador.sexo,
          tutorUsuarioId: tutoriaPrincipal?.usuarioId ?? null,
          parentescoTutor: tutoriaPrincipal?.parentesco ?? null,
          emailContactoTutor: null,
          telefonoContactoTutor: null,
        }}
      />
    </div>
  );
}
