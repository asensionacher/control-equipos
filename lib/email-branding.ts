import "server-only";
import { prisma } from "@/lib/prisma";

const APP_URL =
  process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function getLogoClubEmailUrl(): Promise<string | undefined> {
  const club = await prisma.configuracionClub.findUnique({
    where: { id: 1 },
    select: { logoKey: true },
  });

  return club?.logoKey ? `${APP_URL}/api/club/logo` : undefined;
}
