"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Loader2 } from "lucide-react";
import { eliminarRecibo } from "../actions";

export function EliminarReciboButton({ reciboId }: { reciboId: number }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (
      !confirm(
        "¿Eliminar este recibo PERMANENTEMENTE? Esto borrará también los PDFs y justificantes asociados. Esta acción no se puede deshacer."
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await eliminarRecibo(reciboId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <Button variant="destructive" onClick={handleClick} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Eliminar
      </Button>
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}