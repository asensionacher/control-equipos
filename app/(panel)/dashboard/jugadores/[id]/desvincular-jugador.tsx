"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2Off, Loader2 } from "lucide-react";
import { desvincularJugadorAdulto } from "./editar/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DesvincularJugador({
  jugadorId,
  puedeDesvincular,
}: {
  jugadorId: string;
  puedeDesvincular: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function desvincular() {
    if (
      !confirm(
        "¿Desvincular este jugador? Dejarás de acceder a su ficha y sus gestiones."
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await desvincularJugadorAdulto(jugadorId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="destructive"
        disabled={!puedeDesvincular || isPending}
        onClick={desvincular}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Link2Off className="h-4 w-4" />
        )}
        Desvincular jugador
      </Button>
      {!puedeDesvincular && (
        <p className="max-w-xs text-xs text-muted-foreground">
          Asigna y guarda primero el correo personal del jugador para enviarle la
          confirmación.
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
