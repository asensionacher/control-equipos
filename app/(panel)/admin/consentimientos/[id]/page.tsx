import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatearFechaHora } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContenidoConsentimiento } from "@/components/contenido-consentimiento";
import { RevocarConsentimientoButton } from "./revocar-button";

export const dynamic = "force-dynamic";

export default async function DetalleConsentimientoAdmin({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");
  const { id } = await params;
  const consentimiento = await prisma.consentimiento.findUnique({
    where: { id },
    include: {
      jugadores: {
        include: { jugador: true },
        orderBy: [{ jugador: { apellidos: "asc" } }, { jugador: { nombre: "asc" } }],
      },
    },
  });
  if (!consentimiento) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/consentimientos" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a consentimientos
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {consentimiento.titulo}
        </h1>
        <p className="text-sm text-muted-foreground">
          {consentimiento.jugadores.filter(({ estado }) => estado === "FIRMADO").length}/
          {consentimiento.jugadores.length} firmados
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Texto del consentimiento</CardTitle></CardHeader>
        <CardContent>
          <ContenidoConsentimiento contenido={consentimiento.descripcion} className="text-sm" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Todos los jugadores</CardTitle>
          <CardDescription>
            La firma resuelve el consentimiento automáticamente. Puedes revocarla manualmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {consentimiento.jugadores.map((asignacion) => (
            <div key={asignacion.id} className="rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-medium">
                    {asignacion.jugador.nombre} {asignacion.jugador.apellidos}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {asignacion.firmadoAt
                      ? `Firmado por ${asignacion.firmadoPorNombre} el ${formatearFechaHora(
                          asignacion.firmadoAt
                        )}`
                      : "Pendiente de firma"}
                  </div>
                </div>
                <Badge variant={asignacion.estado === "FIRMADO" ? "success" : "warning"}>
                  {asignacion.estado === "FIRMADO" ? "Firmado" : "Pendiente"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                {asignacion.pdfKey ? (
                  <a
                    href={`/api/consentimientos/${asignacion.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver PDF firmado
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">Sin PDF firmado</span>
                )}
                {asignacion.estado === "FIRMADO" && (
                  <RevocarConsentimientoButton asignacionId={asignacion.id} />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
