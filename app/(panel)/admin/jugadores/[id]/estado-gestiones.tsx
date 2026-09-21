import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ReceiptText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearFecha, formatearNumeroRecibo } from "@/lib/utils";

interface Recibo {
  id: string;
  reciboId: number;
  numero: number;
  concepto: string;
  fechaEmision: Date;
  total: string;
  estado: "PENDIENTE" | "RECHAZADO" | "PAGADO" | "ANULADO";
}

interface Documento {
  id: string;
  solicitudId: string;
  nombre: string;
  createdAt: Date;
  estado: "PENDIENTE" | "SUBIDO" | "VALIDADO";
}

interface Consentimiento {
  id: string;
  consentimientoId: string;
  titulo: string;
  createdAt: Date;
  estado: "PENDIENTE" | "FIRMADO";
  revocadoAt: Date | null;
}

interface Props {
  recibos: Recibo[];
  documentos: Documento[];
  consentimientos: Consentimiento[];
}

export function EstadoGestionesJugador({
  recibos,
  documentos,
  consentimientos,
}: Props) {
  const recibosPendientes = recibos.filter(
    ({ estado }) => estado !== "PAGADO" && estado !== "ANULADO"
  );
  const recibosHechos = recibos.filter(
    ({ estado }) => estado === "PAGADO" || estado === "ANULADO"
  );
  const documentosPendientes = documentos.filter(({ estado }) => estado !== "VALIDADO");
  const documentosHechos = documentos.filter(({ estado }) => estado === "VALIDADO");
  const consentimientosPendientes = consentimientos.filter(
    ({ estado, revocadoAt }) => estado !== "FIRMADO" || Boolean(revocadoAt)
  );
  const consentimientosHechos = consentimientos.filter(
    ({ estado, revocadoAt }) => estado === "FIRMADO" && !revocadoAt
  );

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Estado de gestiones</h2>
        <p className="text-sm text-muted-foreground">
          Vista rápida de lo que falta y lo que ya está resuelto.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <EstadoCard
          titulo="Recibos"
          icono={<ReceiptText className="h-5 w-5" />}
          pendientes={recibosPendientes.map((recibo) => (
            <Link
              key={recibo.id}
              href={`/admin/recibos/${recibo.reciboId}`}
              className="block rounded-md border border-amber-200 bg-amber-50 p-3 transition-colors hover:bg-amber-100"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">
                  {formatearNumeroRecibo(recibo.numero)} · {recibo.concepto}
                </div>
                <Badge variant={recibo.estado === "RECHAZADO" ? "destructive" : "warning"}>
                  {recibo.estado === "RECHAZADO" ? "Rechazado" : "Pendiente"}
                </Badge>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{formatearFecha(recibo.fechaEmision)}</span>
                <span className="font-semibold text-foreground">{recibo.total} €</span>
              </div>
            </Link>
          ))}
          hechos={recibosHechos.map((recibo) => (
            <Link
              key={recibo.id}
              href={`/admin/recibos/${recibo.reciboId}`}
              className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-accent"
            >
              <span className="truncate">
                {formatearNumeroRecibo(recibo.numero)} · {recibo.concepto}
              </span>
              <Badge variant={recibo.estado === "PAGADO" ? "success" : "destructive"}>
                {recibo.estado === "PAGADO" ? "Pagado" : "Anulado"}
              </Badge>
            </Link>
          ))}
        />

        <EstadoCard
          titulo="Documentos"
          icono={<FileText className="h-5 w-5" />}
          pendientes={documentosPendientes.map((documento) => (
            <Link
              key={documento.id}
              href={`/admin/documentos/${documento.solicitudId}#documento-${documento.id}`}
              className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 transition-colors hover:bg-amber-100"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{documento.nombre}</div>
                <div className="text-xs text-muted-foreground">
                  {formatearFecha(documento.createdAt)}
                </div>
              </div>
              <Badge variant={documento.estado === "SUBIDO" ? "secondary" : "warning"}>
                {documento.estado === "SUBIDO" ? "Validar" : "Falta subir"}
              </Badge>
            </Link>
          ))}
          hechos={documentosHechos.map((documento) => (
            <Link
              key={documento.id}
              href={`/admin/documentos/${documento.solicitudId}#documento-${documento.id}`}
              className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-accent"
            >
              <span className="truncate">{documento.nombre}</span>
              <Badge variant="success">Validado</Badge>
            </Link>
          ))}
        />

        <EstadoCard
          titulo="Consentimientos"
          icono={<ClipboardCheck className="h-5 w-5" />}
          pendientes={consentimientosPendientes.map((consentimiento) => (
            <Link
              key={consentimiento.id}
              href={`/admin/consentimientos/${consentimiento.consentimientoId}`}
              className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 transition-colors hover:bg-amber-100"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{consentimiento.titulo}</div>
                <div className="text-xs text-muted-foreground">
                  {formatearFecha(consentimiento.createdAt)}
                </div>
              </div>
              <Badge variant="warning">
                {consentimiento.revocadoAt ? "Revocado" : "Falta firmar"}
              </Badge>
            </Link>
          ))}
          hechos={consentimientosHechos.map((consentimiento) => (
            <Link
              key={consentimiento.id}
              href={`/admin/consentimientos/${consentimiento.consentimientoId}`}
              className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-accent"
            >
              <span className="truncate">{consentimiento.titulo}</span>
              <Badge variant="success">Firmado</Badge>
            </Link>
          ))}
        />
      </div>
    </section>
  );
}

function EstadoCard({
  titulo,
  icono,
  pendientes,
  hechos,
}: {
  titulo: string;
  icono: React.ReactNode;
  pendientes: React.ReactNode[];
  hechos: React.ReactNode[];
}) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icono}
          {titulo}
        </CardTitle>
        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="rounded-md bg-amber-100 px-2 py-2 text-amber-900">
            <div className="text-xl font-bold">{pendientes.length}</div>
            <div>Pendientes</div>
          </div>
          <div className="rounded-md bg-green-100 px-2 py-2 text-green-900">
            <div className="text-xl font-bold">{hechos.length}</div>
            <div>Hechos</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Falta por hacer
          </div>
          {pendientes.length > 0 ? (
            pendientes
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              Nada pendiente
            </div>
          )}
        </div>
        {hechos.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-green-700">
              Ver hechos ({hechos.length})
            </summary>
            <div className="mt-2 space-y-2">{hechos}</div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
