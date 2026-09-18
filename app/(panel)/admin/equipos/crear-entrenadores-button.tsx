"use client";

import { useState, useTransition } from "react";
import { UserRoundPlus, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { crearEntrenadoresFicticiosEquipos } from "./actions";

export function CrearEntrenadoresButton() {
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{
    error?: string;
    success?: string;
  } | null>(null);

  function crear() {
    setResultado(null);
    startTransition(async () => {
      setResultado(await crearEntrenadoresFicticiosEquipos());
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" disabled={isPending} onClick={crear}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserRoundPlus className="h-4 w-4" />
        )}
        {isPending ? "Creando entrenadores..." : "Crear entrenadores ficticios"}
      </Button>
      {resultado?.error && (
        <Alert variant="destructive">
          <AlertDescription>{resultado.error}</AlertDescription>
        </Alert>
      )}
      {resultado?.success && (
        <Alert variant="success">
          <AlertDescription>{resultado.success}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
