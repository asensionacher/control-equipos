"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { importarEquiposFcf } from "./actions";

interface Props {
  temporadaNombre: string | null;
}

export function ImportarEquiposFcfButton({ temporadaNombre }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<{
    error?: string;
    success?: string;
    warning?: string;
  } | null>(null);

  function importar() {
    setResultado(null);
    startTransition(async () => {
      const respuesta = await importarEquiposFcf();
      setResultado(respuesta);
      if (respuesta.success) router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={isPending || !temporadaNombre}
        onClick={importar}
        title={
          temporadaNombre
            ? `Importar equipos en la temporada ${temporadaNombre}`
            : "Debe existir una temporada activa"
        }
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isPending ? "Importando desde FCF..." : "Importar desde FCF"}
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
      {resultado?.warning && (
        <Alert variant="warning">
          <AlertDescription>{resultado.warning}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
