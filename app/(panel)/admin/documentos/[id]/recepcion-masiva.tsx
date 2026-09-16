"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { validarDocumentos } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function RecepcionMasiva({
  solicitudId,
  documentos,
}: {
  solicitudId: string;
  documentos: Array<{ id: string; nombre: string; apellidos: string }>;
}) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    const next = new Set(seleccionados);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSeleccionados(next);
  }

  function validar() {
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    seleccionados.forEach((id) => formData.append("documentosIds", id));
    startTransition(async () => {
      const result = await validarDocumentos(solicitudId, formData);
      if (result.error) setError(result.error);
      else {
        setSuccess(result.success ?? "Documentos recibidos");
        setSeleccionados(new Set());
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
        {documentos.map((documento) => (
          <label key={documento.id} className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted">
            <Checkbox
              checked={seleccionados.has(documento.id)}
              onCheckedChange={() => toggle(documento.id)}
            />
            <span className="text-sm">{documento.apellidos}, {documento.nombre}</span>
          </label>
        ))}
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert variant="success"><AlertDescription>{success}</AlertDescription></Alert>}
      <div className="flex justify-end">
        <Button onClick={validar} disabled={isPending || seleccionados.size === 0}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Marcar {seleccionados.size || ""} como recibidos
        </Button>
      </div>
    </div>
  );
}
