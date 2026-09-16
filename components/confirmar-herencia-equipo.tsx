"use client";

import { useEffect, useState } from "react";
import { FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ResumenHerenciaEquipo } from "@/app/(panel)/admin/equipos/asignaciones-actions";
import type { SeleccionHerenciaEquipo } from "@/app/(panel)/admin/equipos/asignaciones-actions";

export type OpcionesHerenciaEquipo = SeleccionHerenciaEquipo;

export function ConfirmarHerenciaEquipo({
  open,
  onOpenChange,
  resumen,
  cantidadJugadores,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumen: ResumenHerenciaEquipo | null;
  cantidadJugadores: number;
  onConfirm: (opciones: OpcionesHerenciaEquipo) => void;
  isPending: boolean;
}) {
  const [recibosSeleccionados, setRecibosSeleccionados] = useState<Set<number>>(new Set());
  const [documentosSeleccionados, setDocumentosSeleccionados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && resumen) {
      setRecibosSeleccionados(new Set(resumen.recibos.map((recibo) => recibo.id)));
      setDocumentosSeleccionados(
        new Set(resumen.documentos.map((documento) => documento.id))
      );
    }
  }, [open, resumen]);

  if (!resumen) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignaciones existentes del equipo</DialogTitle>
          <DialogDescription>
            El equipo ya tiene recibos o documentos asignados. Decide cuáles deben heredarse al
            añadir {cantidadJugadores === 1 ? "este jugador" : `estos ${cantidadJugadores} jugadores`}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {resumen.recibos.length > 0 && (
            <div className="rounded-lg border p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={
                    recibosSeleccionados.size === resumen.recibos.length
                      ? true
                      : recibosSeleccionados.size > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) =>
                    setRecibosSeleccionados(
                      checked === true
                        ? new Set(resumen.recibos.map((recibo) => recibo.id))
                        : new Set()
                    )
                  }
                  className="mt-0.5"
                />
                <div className="flex items-center gap-2 font-medium">
                  <Receipt className="h-4 w-4" />
                  Asignar recibos ({recibosSeleccionados.size}/{resumen.recibos.length})
                </div>
              </label>
              <div className="mt-3 space-y-2 border-t pt-3">
                {resumen.recibos.map((recibo) => (
                  <label key={recibo.id} className="flex cursor-pointer items-start gap-2 text-sm">
                    <Checkbox
                      checked={recibosSeleccionados.has(recibo.id)}
                      onCheckedChange={(checked) =>
                        setRecibosSeleccionados((actuales) => {
                          const siguientes = new Set(actuales);
                          if (checked === true) siguientes.add(recibo.id);
                          else siguientes.delete(recibo.id);
                          return siguientes;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      {recibo.concepto}
                      {cantidadJugadores > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {recibo.jugadoresPendientes} nuevos
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {resumen.documentos.length > 0 && (
            <div className="rounded-lg border p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={
                    documentosSeleccionados.size === resumen.documentos.length
                      ? true
                      : documentosSeleccionados.size > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) =>
                    setDocumentosSeleccionados(
                      checked === true
                        ? new Set(resumen.documentos.map((documento) => documento.id))
                        : new Set()
                    )
                  }
                  className="mt-0.5"
                />
                <div className="flex items-center gap-2 font-medium">
                  <FileText className="h-4 w-4" />
                  Asignar documentos ({documentosSeleccionados.size}/{resumen.documentos.length})
                </div>
              </label>
              <div className="mt-3 space-y-2 border-t pt-3">
                {resumen.documentos.map((documento) => (
                  <label key={documento.id} className="flex cursor-pointer items-start gap-2 text-sm">
                    <Checkbox
                      checked={documentosSeleccionados.has(documento.id)}
                      onCheckedChange={(checked) =>
                        setDocumentosSeleccionados((actuales) => {
                          const siguientes = new Set(actuales);
                          if (checked === true) siguientes.add(documento.id);
                          else siguientes.delete(documento.id);
                          return siguientes;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      {documento.nombre}
                      {cantidadJugadores > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · {documento.jugadoresPendientes} nuevos
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onConfirm({
                asignarRecibos: recibosSeleccionados.size > 0,
                asignarDocumentos: documentosSeleccionados.size > 0,
                recibosIds: Array.from(recibosSeleccionados),
                documentosIds: Array.from(documentosSeleccionados),
              })
            }
            disabled={isPending}
          >
            {isPending ? "Asignando..." : "Confirmar asignación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
