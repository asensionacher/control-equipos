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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";
import { eliminarUsuarioRGPD } from "./actions";

export function EliminarUsuarioRGPDButton({
  usuarioId,
  nombre,
  email,
}: {
  usuarioId: string;
  nombre: string;
  email: string | null;
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
      const result = await eliminarUsuarioRGPD(usuarioId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <ShieldAlert className="h-5 w-5" />
          Zona peligrosa
        </CardTitle>
        <CardDescription>
          Acción irreversible. Cumplimiento RGPD: anonimiza la cuenta y desvinculará
          las fichas asociadas. Los recibos y consentimientos firmados se conservan
          como prueba legal; los consentimientos firmados pasarán a estado revocado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              Eliminar usuario (RGPD)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar usuario de forma permanente</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>
                    Vas a eliminar a <strong>{nombre}</strong>
                    {email && <> ({email})</>}. Esta acción <strong>no se puede deshacer</strong>.
                  </p>
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-900">
                    <p className="font-semibold">¿Qué ocurrirá?</p>
                    <ul className="mt-1 ml-4 list-disc space-y-1">
                      <li>La cuenta de acceso queda eliminada (no podrá iniciar sesión).</li>
                      <li>
                        Si tenía ficha de Jugador o Entrenador vinculada, se anonimiza
                        (nombre, apellidos, email, teléfono, DNI, foto).
                      </li>
                      <li>Las tutorías del usuario se eliminan.</li>
                      <li>
                        Los consentimientos firmados por este usuario quedan revocados
                        (el PDF firmado original se conserva como prueba legal).
                      </li>
                      <li>
                        Recibos, documentos solicitados y fotos históricas en S3 ya
                        emitidos NO se modifican.
                      </li>
                      <li>Se registra una entrada de auditoría RGPD inmutable.</li>
                    </ul>
                  </div>
                  <p>
                    Para confirmar, escribe <code className="rounded bg-muted px-1.5 py-0.5 font-mono">ELIMINAR</code> en el campo:
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
      </CardContent>
    </Card>
  );
}
