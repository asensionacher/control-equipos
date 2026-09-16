"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  eliminarJustificante,
  marcarPagoParaConfirmar,
} from "../actions";

export function AccionesPago({
  reciboJugadorId,
  tieneJustificante,
  pagoDeclarado,
}: {
  reciboJugadorId: string;
  tieneJustificante: boolean;
  pagoDeclarado: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ejecutar(
    accion: () => Promise<{ error?: string; success?: string }>
  ) {
    setError(null);
    startTransition(async () => {
      const result = await accion();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {tieneJustificante && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              if (!confirm("¿Eliminar el justificante de pago subido?")) return;
              ejecutar(() => eliminarJustificante(reciboJugadorId));
            }}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar justificante
          </Button>
        )}
        {!pagoDeclarado && (
          <Button
            type="button"
            disabled={isPending}
            onClick={() => ejecutar(() => marcarPagoParaConfirmar(reciboJugadorId))}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Marcar como pagado
          </Button>
        )}
      </div>
    </div>
  );
}
