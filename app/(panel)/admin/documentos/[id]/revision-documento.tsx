"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { rechazarDocumento, validarDocumento } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  documentoId: string;
  estado: string;
  archivoNombre: string | null;
}

export function RevisionDocumento({ documentoId, estado, archivoNombre }: Props) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (estado !== "SUBIDO") return null;

  function validar() {
    setError(null);
    startTransition(async () => {
      const result = await validarDocumento(documentoId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function rechazar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("motivo", motivo);
    startTransition(async () => {
      const result = await rechazarDocumento(documentoId, formData);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      <a
        href={`/api/documentos/${documentoId}/archivo`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ExternalLink className="h-4 w-4" />
        Ver {archivoNombre ?? "documento PDF"}
      </a>
      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}
      <div className="flex flex-col gap-3 lg:flex-row">
        <Button type="button" onClick={validar} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirmar correcto
        </Button>
        <form onSubmit={rechazar} className="flex flex-1 flex-col gap-2 sm:flex-row">
          <Input
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            placeholder="Motivo del rechazo"
            required
            minLength={3}
          />
          <Button type="submit" variant="destructive" disabled={isPending}>
            <XCircle className="h-4 w-4" />
            Rechazar y eliminar
          </Button>
        </form>
      </div>
    </div>
  );
}
