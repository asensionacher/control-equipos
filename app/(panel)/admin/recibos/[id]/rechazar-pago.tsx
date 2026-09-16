"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { rechazarPagoJugador } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RechazarPago({
  reciboJugadorId,
}: {
  reciboJugadorId: string;
}) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function rechazar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("motivo", motivo);
    startTransition(async () => {
      const result = await rechazarPagoJugador(reciboJugadorId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={rechazar} className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          placeholder="Motivo del rechazo"
          required
          minLength={3}
          disabled={isPending}
        />
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          Rechazar pago
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        El justificante se eliminará completamente y el motivo se notificará al jugador.
      </p>
    </form>
  );
}
