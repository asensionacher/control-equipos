import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";
import { contentTypeImagenDesdeKey } from "@/lib/imagen-upload";

export const dynamic = "force-dynamic";

export async function GET() {
  const club = await prisma.configuracionClub.findUnique({
    where: { id: 1 },
    select: { logoKey: true },
  });
  if (!club?.logoKey) {
    return NextResponse.json({ error: "El club no tiene escudo" }, { status: 404 });
  }

  try {
    const buffer = await getObjectBuffer(club.logoKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeImagenDesdeKey(club.logoKey),
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[club] Error leyendo el escudo:", error);
    return NextResponse.json({ error: "No se pudo leer el escudo" }, { status: 500 });
  }
}
