"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { subirDocumento } from "./actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const MAX_SIZE = 10 * 1024 * 1024;

export function SubirDocumento({
  documentoId,
  tieneArchivo,
}: {
  documentoId: string;
  tieneArchivo: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function seleccionar(selected: File | null) {
    setError(null);
    setSuccess(null);
    if (!selected) return setFile(null);
    if (selected.type !== "application/pdf") {
      setFile(null);
      return setError("Solo se permiten archivos PDF");
    }
    if (selected.size > MAX_SIZE) {
      setFile(null);
      return setError("El archivo es demasiado grande (máx. 10 MB)");
    }
    setFile(selected);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Selecciona un archivo PDF");
    const formData = new FormData();
    formData.set("archivo", file);
    startTransition(async () => {
      const result = await subirDocumento(documentoId, formData);
      if (result.error) setError(result.error);
      else {
        setSuccess(result.success ?? "Documento subido");
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-start gap-2">
        <Upload className="h-5 w-5 text-blue-600" />
        <div>
          <div className="text-sm font-medium">
            {tieneArchivo ? "Sustituir el PDF antes de validarlo" : "Subir documento"}
          </div>
          <div className="text-xs text-muted-foreground">Solo PDF · máximo 10 MB</div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => seleccionar(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-md border p-4 text-sm hover:bg-muted"
      >
        <FileText className="h-4 w-4" />
        {file ? file.name : "Seleccionar PDF"}
      </button>
      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {success && (
        <Alert variant="success"><AlertDescription>{success}</AlertDescription></Alert>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!file || isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Subir PDF
        </Button>
      </div>
    </form>
  );
}
