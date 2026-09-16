import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ExternalLink,
  FileCheck2,
  FileText,
  Receipt,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  formatearFecha,
  formatearFechaHora,
  formatearNumero,
  formatearNumeroRecibo,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RevisionDocumento } from "../documentos/[id]/revision-documento";
import { RechazarPago } from "../recibos/[id]/rechazar-pago";

export const dynamic = "force-dynamic";

export default async function PendientesAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const [pagosPendientes, documentosPendientes] = await Promise.all([
    prisma.reciboJugador.findMany({
      where: {
        estado: "PENDIENTE",
        pagoDeclaradoAt: { not: null },
      },
      include: {
        recibo: {
          select: {
            id: true,
            concepto: true,
            total: true,
            fechaEmision: true,
          },
        },
        jugador: {
          select: { id: true, nombre: true, apellidos: true },
        },
      },
      orderBy: { pagoDeclaradoAt: "asc" },
    }),
    prisma.solicitudDocumentoJugador.findMany({
      where: {
        estado: "SUBIDO",
        archivoKey: { not: null },
      },
      include: {
        solicitud: { select: { id: true, nombre: true } },
        jugador: {
          select: { id: true, nombre: true, apellidos: true },
        },
      },
      orderBy: { archivoSubidoAt: "asc" },
    }),
  ]);

  const total = pagosPendientes.length + documentosPendientes.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Pendientes de revisión
        </h1>
        <p className="text-sm text-muted-foreground">
          Pagos declarados y documentos subidos por jugadores o tutores.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Resumen
          titulo="Total"
          valor={total}
          descripcion="Gestiones pendientes"
          icono={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
        />
        <Resumen
          titulo="Pagos"
          valor={pagosPendientes.length}
          descripcion="Pendientes de confirmar"
          icono={<Receipt className="h-4 w-4 text-muted-foreground" />}
        />
        <Resumen
          titulo="Documentos"
          valor={documentosPendientes.length}
          descripcion="Pendientes de revisar"
          icono={<FileCheck2 className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pagos pendientes de confirmar</CardTitle>
          <CardDescription>
            Cada fila corresponde al recibo individual de un jugador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pagosPendientes.length === 0 ? (
            <Vacio texto="No hay pagos pendientes de confirmación." />
          ) : (
            pagosPendientes.map((pago) => (
              <div
                key={pago.id}
                className="space-y-3 rounded-lg border p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatearNumeroRecibo(pago.numero)}
                      </span>
                      <span className="font-medium">
                        {pago.jugador.nombre} {pago.jugador.apellidos}
                      </span>
                      <Badge variant="secondary">Pendiente de confirmar</Badge>
                    </div>
                    <p className="mt-1 text-sm">{pago.recibo.concepto}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatearNumero(pago.recibo.total)} € · Emitido el{" "}
                      {formatearFecha(pago.recibo.fechaEmision)}
                      {pago.pagoDeclaradoAt &&
                        ` · Marcado como pagado el ${formatearFechaHora(
                          pago.pagoDeclaradoAt
                        )}`}
                    </p>
                    {pago.pagoDeclaradoPorNombre && (
                      <p className="text-xs text-muted-foreground">
                        Declarado por {pago.pagoDeclaradoPorEsTutor ? "el tutor " : ""}
                        {pago.pagoDeclaradoPorNombre}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pago.justificanteKey && (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/api/recibos/jugador/${pago.id}/justificante`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Ver justificante
                        </a>
                      </Button>
                    )}
                    <Button asChild size="sm">
                      <Link
                        href={`/admin/recibos/${pago.reciboId}#recibo-jugador-${pago.id}`}
                      >
                        Revisar y confirmar
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <RechazarPago reciboJugadorId={pago.id} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos pendientes de revisar</CardTitle>
          <CardDescription>
            Todos los archivos recibidos, independientemente de la solicitud de origen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {documentosPendientes.length === 0 ? (
            <Vacio texto="No hay documentos pendientes de revisión." />
          ) : (
            documentosPendientes.map((documento) => (
              <div key={documento.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="font-medium">{documento.solicitud.nombre}</span>
                      <Badge variant="secondary">Por revisar</Badge>
                    </div>
                    <p className="mt-1 text-sm">
                      {documento.jugador.nombre} {documento.jugador.apellidos}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {documento.archivoSubidoAt
                        ? `Subido el ${formatearFechaHora(documento.archivoSubidoAt)}`
                        : "Documento recibido"}
                      {documento.archivoSubidoPorNombre &&
                        ` por ${documento.archivoSubidoPorEsTutor ? "el tutor " : ""}${
                          documento.archivoSubidoPorNombre
                        }`}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      href={`/admin/documentos/${documento.solicitudId}#documento-${documento.id}`}
                    >
                      Ver solicitud
                    </Link>
                  </Button>
                </div>
                <RevisionDocumento
                  documentoId={documento.id}
                  estado={documento.estado}
                  archivoNombre={documento.archivoNombre}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Resumen({
  titulo,
  valor,
  descripcion,
  icono,
}: {
  titulo: string;
  valor: number;
  descripcion: string;
  icono: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
        {icono}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{valor}</div>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </CardContent>
    </Card>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{texto}</p>;
}
