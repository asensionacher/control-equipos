"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") throw new Error("No autorizado");
}

export async function toggleAsignacionEquipo(jugadorId: string, equipoId: string, asignar: boolean) {
  await requireAdmin();

  if (asignar) {
    await prisma.asignacionEquipo.upsert({
      where: { jugadorId_equipoId: { jugadorId, equipoId } },
      create: { jugadorId, equipoId },
      update: {},
    });
  } else {
    await prisma.asignacionEquipo.deleteMany({
      where: { jugadorId, equipoId },
    });
  }

  revalidatePath(`/admin/jugadores/${jugadorId}`);
}

export async function asignarJugadoresMasivo(equipoId: string, jugadorIds: string[]) {
  await requireAdmin();

  if (!equipoId || jugadorIds.length === 0) return;

  const operaciones = jugadorIds.map((jugadorId) =>
    prisma.asignacionEquipo.upsert({
      where: { jugadorId_equipoId: { jugadorId, equipoId } },
      create: { jugadorId, equipoId },
      update: {},
    })
  );

  await Promise.all(operaciones);

  revalidatePath(`/admin/equipos/${equipoId}`);
}

export async function desasignarJugadoresMasivo(equipoId: string, jugadorIds: string[]) {
  await requireAdmin();

  if (!equipoId || jugadorIds.length === 0) return;

  await prisma.asignacionEquipo.deleteMany({
    where: { equipoId, jugadorId: { in: jugadorIds } },
  });

  revalidatePath(`/admin/equipos/${equipoId}`);
}
