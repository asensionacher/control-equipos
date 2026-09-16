"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Ban, Loader2 } from "lucide-react";
import { anularRecibo } from "../actions";

export function AnularReciboButton({ reciboId }: { reciboId: number }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm("¿Anular este recibo? Los jugadores dejarán de verlo como pendiente, pero seguirá en el historial.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await anularRecibo(reciboId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={handleClick} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
        Anular
      </Button>
      {error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}