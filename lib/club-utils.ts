import { prisma } from "./prisma";

/**
 * Datos del club (singleton id=1).
 * Esta información representa la identidad fiscal del club y se usa por:
 * - PDFs de recibos (emisor)
 * - Datos de contacto mostrados en la app
 *
 * No depende del módulo de recibos: vive aquí porque el club tiene identidad
 * propia independientemente de los recibos que se emitan.
 */
export async function getConfiguracionClub() {
  let club = await prisma.configuracionClub.findUnique({ where: { id: 1 } });
  if (!club) {
    club = await prisma.configuracionClub.create({
      data: { id: 1, nombre: "Club Deportivo", prefijoRecibo: "R" },
    });
  }
  return club;
}