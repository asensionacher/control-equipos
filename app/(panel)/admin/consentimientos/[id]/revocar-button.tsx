"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { revocarConsentimiento } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function RevocarConsentimientoButton({ asignacionId }: { asignacionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function revocar() {
    if (!confirm("¿Revocar esta firma? El PDF firmado se eliminará definitivamente.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await revocarConsentimiento(asignacionId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={revocar}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        Revocar firma
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
