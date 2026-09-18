"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ShieldAlert } from "lucide-react";
import { eliminarJugadorRGPD } from "../actions";

export function EliminarJugadorRGPDButton({
  id,
  nombre,
}: {
  id: string;
  nombre: string;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText.trim().toUpperCase() === "ELIMINAR";

  function handleConfirm() {
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      const result = await eliminarJugadorRGPD(id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <ShieldAlert className="h-4 w-4" />
          Eliminar (RGPD)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar jugador de forma permanente</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Vas a eliminar a <strong>{nombre}</strong>. Esta acción
                <strong> no se puede deshacer</strong> y anonimizará la ficha del
                jugador.
              </p>
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-900">
                <p className="font-semibold">¿Qué ocurrirá?</p>
                <ul className="mt-1 ml-4 list-disc space-y-1">
                  <li>
                    Nombre, apellidos, email, teléfono, DNI, dirección y foto se
                    anonimizan.
                  </li>
                  <li>
                    La fila del jugador se conserva (es necesaria para mantener
                    la trazabilidad de recibos y consentimientos).
                  </li>
                  <li>
                    Los consentimientos firmados quedan revocados (el PDF
                    firmado se conserva como prueba legal).
                  </li>
                  <li>
                    Recibos, solicitudes de documentos y su historial NO se
                    eliminan.
                  </li>
                  <li>Se registra una entrada de auditoría RGPD inmutable.</li>
                </ul>
              </div>
              <p>
                Si este jugador tiene una cuenta de Usuario vinculada, primero
                elimina el Usuario desde su ficha correspondiente.
              </p>
              <p>
                Para confirmar, escribe{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono">ELIMINAR</code>:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder="Escribe ELIMINAR"
                autoComplete="off"
              />
              {error && (
                <p className="rounded-md border border-red-300 bg-red-50 p-2 text-red-900 dark:bg-red-950/30 dark:text-red-100 dark:border-red-900">
                  {error}
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm || isPending}
            onClick={handleConfirm}
          >
            {isPending ? "Eliminando..." : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
