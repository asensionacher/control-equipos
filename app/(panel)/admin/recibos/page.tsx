import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatearFecha, formatearNumero, formatearNumeroRecibo } from "@/lib/utils";
import Link from "next/link";
import { Plus, FileText, AlertCircle, CheckCircle2, XCircle, Download } from "lucide-react";
import { EquiposAsignadosCeldas } from "@/components/equipos-asignados-celda";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ estado?: string }>;
}

export default async function RecibosPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const { estado } = await searchParams;

  const where: any = {};
  if (estado && ["PENDIENTE", "RECHAZADO", "PAGADO", "ANULADO"].includes(estado)) {
    where.jugadores = { some: { estado } };
  }

  const [recibos, contadores] = await Promise.all([
    prisma.recibo.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        equipo: { include: { temporada: true } },
        equipos: { include: { temporada: true } },
        _count: { select: { jugadores: true } },
        jugadores: {
          select: { estado: true, numero: true },
        },
      },
    }),
    Promise.all([
      prisma.reciboJugador.count({ where: { estado: "PENDIENTE" } }),
      prisma.reciboJugador.count({ where: { estado: "RECHAZADO" } }),
      prisma.reciboJugador.count({ where: { estado: "PAGADO" } }),
      prisma.reciboJugador.count({ where: { estado: "ANULADO" } }),
      prisma.reciboJugador.count(),
    ]),
  ]);

  const [pendientes, rechazados, pagados, anulados, total] = contadores;
  const totalPdfs = recibos.reduce(
    (acumulado, recibo) =>
      acumulado +
      recibo.jugadores.filter((jugador) => !estado || jugador.estado === estado).length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Recibos</h1>
          <p className="text-sm text-muted-foreground">
            Emisión y gestión de recibos a jugadores y equipos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recibos.length > 0 && (
            <Button asChild variant="outline">
              <a
                href={`/api/recibos/zip${estado ? `?estado=${estado}` : ""}`}
                download
              >
                <Download className="h-4 w-4" />
                Descargar{" "}
                Descargar {totalPdfs} PDF{totalPdfs === 1 ? "" : "s"} (ZIP)
              </a>
            </Button>
          )}
          <Button asChild>
            <Link href="/admin/recibos/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo recibo
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Tarjeta title="Total" value={total} icon={<FileText className="h-4 w-4" />} href="/admin/recibos" active={!estado} />
        <Tarjeta title="Pendientes" value={pendientes} icon={<AlertCircle className="h-4 w-4" />} href="/admin/recibos?estado=PENDIENTE" active={estado === "PENDIENTE"} />
        <Tarjeta title="Rechazados" value={rechazados} icon={<XCircle className="h-4 w-4" />} href="/admin/recibos?estado=RECHAZADO" active={estado === "RECHAZADO"} />
        <Tarjeta title="Pagados" value={pagados} icon={<CheckCircle2 className="h-4 w-4" />} href="/admin/recibos?estado=PAGADO" active={estado === "PAGADO"} />
        <Tarjeta title="Anulados" value={anulados} icon={<XCircle className="h-4 w-4" />} href="/admin/recibos?estado=ANULADO" active={estado === "ANULADO"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de recibos</CardTitle>
          <CardDescription>
            {recibos.length} emisión{recibos.length === 1 ? "" : "es"}{" "}
            {estado ? `con recibos ${estadoLabel(estado)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          {recibos.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay recibos {estado ? `con estado ${estadoLabel(estado)}` : ""}.{" "}
              <Link href="/admin/recibos/nuevo" className="underline">
                Crea el primero
              </Link>
              .
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº individuales</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="hidden md:table-cell">Asignación</TableHead>
                  <TableHead className="hidden sm:table-cell">Total</TableHead>
                  <TableHead className="hidden sm:table-cell">Emisión</TableHead>
                  <TableHead className="hidden md:table-cell">Pagos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recibos.map((r) => {
                  const totalJugadores = r._count.jugadores;
                  const pagados = r.jugadores.filter((j) => j.estado === "PAGADO").length;
                  const numeros = r.jugadores
                    .map(({ numero }) => numero)
                    .sort((a, b) => a - b);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">
                        {numeros
                          .slice(0, 2)
                          .map(formatearNumeroRecibo)
                          .join(", ")}
                        {numeros.length > 2 && ` +${numeros.length - 2}`}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.concepto}</div>
                        {r.descripcion && (
                          <div className="line-clamp-1 text-xs text-muted-foreground">
                            {r.descripcion}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <EquiposAsignadosCeldas origen={r} fallbackVacio="Individual" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-medium">
                        {formatearNumero(r.total)} €
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {formatearFecha(r.fechaEmision)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {totalJugadores > 0 ? (
                          <span>
                            {pagados}/{totalJugadores}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <EstadoBadge estado={r.estado} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <a
                            href={`/api/recibos/${r.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent"
                            title="Ver resumen PDF de la emisión"
                          >
                            <FileText className="h-4 w-4" />
                          </a>
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/admin/recibos/${r.id}`}>Ver</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Tarjeta({
  title,
  value,
  icon,
  href,
  active,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  href: string;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <Card className={active ? "border-primary" : ""}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    PENDIENTE: { label: "Pendiente", variant: "warning" },
    PAGADO: { label: "Pagado", variant: "success" },
    ANULADO: { label: "Anulado", variant: "destructive" },
  };
  const m = map[estado] ?? { label: estado, variant: "secondary" };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function estadoLabel(estado: string): string {
  if (estado === "PENDIENTE") return "pendientes";
  if (estado === "RECHAZADO") return "rechazados";
  if (estado === "PAGADO") return "pagados";
  if (estado === "ANULADO") return "anulados";
  return estado.toLowerCase();
}