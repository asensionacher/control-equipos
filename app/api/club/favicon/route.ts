import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/s3";
import { contentTypeImagenDesdeKey } from "@/lib/imagen-upload";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const club = await prisma.configuracionClub.findUnique({
    where: { id: 1 },
    select: { logoKey: true },
  });
  if (!club?.logoKey) {
    return NextResponse.json(
      { error: "El club no tiene escudo" },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const etag = `"${Buffer.from(club.logoKey).toString("base64url")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "no-cache, must-revalidate",
      },
    });
  }

  try {
    const buffer = await getObjectBuffer(club.logoKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentTypeImagenDesdeKey(club.logoKey),
        "Cache-Control": "no-cache, must-revalidate",
        ETag: etag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[club] Error leyendo el favicon:", error);
    return NextResponse.json(
      { error: "No se pudo leer el favicon" },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
