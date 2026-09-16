"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, FileText, ExternalLink, CheckCircle2, XCircle, Undo2 } from "lucide-react";
import { formatearFecha, iniciales } from "@/lib/utils";
import { formatearNumeroRecibo } from "@/lib/utils";
import { METODOS_PAGO } from "@/lib/recibo-utils";
import { marcarJugadorPagado, desmarcarJugadorPagado } from "../actions";
import { DesasignarJugadorButton } from "@/components/desasignar-jugador-button";
import { RechazarPago } from "./rechazar-pago";

interface Props {
  reciboJugadorId: string;
  numero: number;
  reciboId: number;
  jugador: {
    id: string;
    nombre: string;
    apellidos: string;
    dniNie: string | null;
  };
  estado: string;
  fechaPago: Date | null;
  metodoPago: string | null;
  referenciaPago: string | null;
  notasPago: string | null;
  justificanteNombre: string | null;
  justificanteSubidoAt: Date | null;
  pagoDeclaradoAt: Date | null;
  pagoDeclaradoPorNombre: string | null;
  pagoDeclaradoPorEsTutor: boolean | null;
  pagoRechazadoAt: Date | null;
  ultimoMotivoRechazoPago: string | null;
  reciboAnulado: boolean;
}

export function JugadorReciboRow(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [metodoPago, setMetodoPago] = useState(props.metodoPago ?? "Transferencia bancaria");
  const [fechaPago, setFechaPago] = useState<string>(
    props.fechaPago
      ? props.fechaPago.toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [referenciaPago, setReferenciaPago] = useState(props.referenciaPago ?? "");
  const [notasPago, setNotasPago] = useState(props.notasPago ?? "");

  const isPagado = props.estado === "PAGADO";
  const isAnulado = props.estado === "ANULADO" || props.reciboAnulado;
  const isRechazado = props.estado === "RECHAZADO";
  const pendienteConfirmacion =
    props.estado === "PENDIENTE" && Boolean(props.pagoDeclaradoAt);

  function handleMarcarPagado(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("metodoPago", metodoPago);
    formData.set("fechaPago", fechaPago);
    formData.set("referenciaPago", referenciaPago);
    formData.set("notasPago", notasPago);

    startTransition(async () => {
      const result = await marcarJugadorPagado(props.reciboJugadorId, formData);
      if (result?.error) setError(result.error);
      else {
        setSuccess(result.success ?? "Pago registrado");
        setExpanded(false);
      }
    });
  }

  function handleDesmarcar() {
    if (!confirm("¿Desmarcar el pago de este jugador?")) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await desmarcarJugadorPagado(props.reciboJugadorId);
      if (result?.error) setError(result.error);
      else setSuccess(result.success ?? "Pago deshecho");
    });
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback>{iniciales(props.jugador.nombre, props.jugador.apellidos)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-medium">
              <span className="mr-2 font-mono text-xs text-muted-foreground">
                {formatearNumeroRecibo(props.numero)}
              </span>
              {props.jugador.nombre} {props.jugador.apellidos}
              {props.jugador.dniNie && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {props.jugador.dniNie}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {isPagado && props.fechaPago && (
                <>
                  Pagado el {formatearFecha(props.fechaPago)}
                  {props.metodoPago && ` · ${props.metodoPago}`}
                  {props.referenciaPago && ` · Ref: ${props.referenciaPago}`}
                </>
              )}
              {pendienteConfirmacion && (
                <>
                  Marcado como pagado
                  {props.pagoDeclaradoAt &&
                    ` el ${formatearFecha(props.pagoDeclaradoAt)}`}
                  {props.pagoDeclaradoPorNombre &&
                    ` por ${props.pagoDeclaradoPorEsTutor ? "el tutor " : ""}${
                      props.pagoDeclaradoPorNombre
                    }`}
                </>
              )}
              {props.estado === "PENDIENTE" &&
                !pendienteConfirmacion &&
                !isAnulado &&
                "Pendiente de pago"}
              {isRechazado && "Pago rechazado; pendiente de una nueva declaración"}
              {isAnulado && "Anulado"}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isPagado ? (
            <Badge variant="success">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Pagado
            </Badge>
          ) : isAnulado ? (
            <Badge variant="destructive">Anulado</Badge>
          ) : pendienteConfirmacion ? (
            <Badge variant="secondary">Pendiente de confirmar</Badge>
          ) : isRechazado ? (
            <Badge variant="destructive">Rechazado</Badge>
          ) : (
            <Badge variant="warning">Pendiente</Badge>
          )}

          <a
            href={`/api/recibos/${props.reciboId}/pdf?jugadorId=${props.jugador.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
            title="Ver PDF"
          >
            <FileText className="h-4 w-4" />
          </a>
        </div>
      </div>

      {(props.justificanteNombre || props.justificanteSubidoAt) && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-blue-50 p-2 text-xs">
          <FileText className="h-3.5 w-3.5 text-blue-600" />
          <span className="flex-1 truncate">
            Justificante subido por el jugador
            {props.justificanteSubidoAt && (
              <> el {formatearFecha(props.justificanteSubidoAt)}</>
            )}

            {isRechazado && props.ultimoMotivoRechazoPago && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>
                  Rechazado
                  {props.pagoRechazadoAt &&
                    ` el ${formatearFecha(props.pagoRechazadoAt)}`}
                  : {props.ultimoMotivoRechazoPago}
                </AlertDescription>
              </Alert>
            )}

            {pendienteConfirmacion && (
              <div className="mt-3 border-t pt-3">
                <RechazarPago reciboJugadorId={props.reciboJugadorId} />
              </div>
            )}
            : <strong>{props.justificanteNombre ?? "fichero"}</strong>
          </span>
          <a
            href={`/api/recibos/jugador/${props.reciboJugadorId}/justificante`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-700 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Ver
          </a>
        </div>
      )}

      {success && (
        <Alert variant="success" className="mt-2">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isAnulado && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!isPagado && !expanded && (
            <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
              <CheckCircle2 className="h-4 w-4" />
              {pendienteConfirmacion ? "Confirmar pago" : "Marcar pagado"}
            </Button>
          )}
          {!isPagado && expanded && (
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>
              Cancelar
            </Button>
          )}
          {isPagado && (
            <Button size="sm" variant="ghost" onClick={handleDesmarcar} disabled={isPending}>
              <Undo2 className="h-4 w-4" />
              Deshacer pago
            </Button>
          )}
          {isPagado && !expanded && (
            <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
              Editar datos de pago
            </Button>
          )}
          <DesasignarJugadorButton tipo="recibo" asignacionId={props.reciboJugadorId} />
        </div>
      )}

      {expanded && !isAnulado && (
        <form onSubmit={handleMarcarPagado} className="mt-3 space-y-3 rounded-md bg-muted/30 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`metodo-${props.reciboJugadorId}`}>Método de pago</Label>
              <select
                id={`metodo-${props.reciboJugadorId}`}
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`fecha-${props.reciboJugadorId}`}>Fecha de pago</Label>
              <Input
                id={`fecha-${props.reciboJugadorId}`}
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`ref-${props.reciboJugadorId}`}>Referencia (opcional)</Label>
            <Input
              id={`ref-${props.reciboJugadorId}`}
              value={referenciaPago}
              onChange={(e) => setReferenciaPago(e.target.value)}
              placeholder="Ej. número de transferencia, Bizum, etc."
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`notas-${props.reciboJugadorId}`}>Notas (opcional)</Label>
            <Textarea
              id={`notas-${props.reciboJugadorId}`}
              rows={2}
              value={notasPago}
              onChange={(e) => setNotasPago(e.target.value)}
              placeholder="Notas internas sobre el pago"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isPagado
                ? "Actualizar"
                : pendienteConfirmacion
                  ? "Confirmar pago"
                  : "Marcar pagado"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}