"use client";

import { useState, useTransition } from "react";
import { Loader2, UserMinus } from "lucide-react";
import { desasignarJugadorRecibo } from "@/app/(panel)/admin/recibos/actions";
import { desasignarJugadorDocumento } from "@/app/(panel)/admin/documentos/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DesasignarJugadorButton({
  tipo,
  asignacionId,
}: {
  tipo: "recibo" | "documento";
  asignacionId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function desasignar() {
    if (!confirm("¿Desasignar a este jugador? Se eliminará también su archivo asociado.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result =
        tipo === "recibo"
          ? await desasignarJugadorRecibo(asignacionId)
          : await desasignarJugadorDocumento(asignacionId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={desasignar}
        disabled={isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
        Desasignar
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
