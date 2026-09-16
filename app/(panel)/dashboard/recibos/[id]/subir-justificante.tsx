"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, FileText, Save, X } from "lucide-react";
import { subirJustificante } from "../actions";

interface Props {
  reciboJugadorId: string;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export function SubirJustificante({ reciboJugadorId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  function handleSelect(f: File | null) {
    setError(null);
    setSuccess(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("El archivo es demasiado grande (máx. 10 MB)");
      return;
    }
    if (!ALLOWED.includes(f.type)) {
      setError("Tipo de archivo no permitido (PDF o imagen)");
      return;
    }
    setFile(f);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Selecciona un archivo primero");
      return;
    }

    const formData = new FormData();
    formData.set("archivo", file);

    startTransition(async () => {
      const result = await subirJustificante(reciboJugadorId, formData);
      if (result?.error) setError(result.error);
      else {
        setSuccess(result.success ?? "Subido");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/30 p-4">
      <div className="flex items-start gap-2">
        <Upload className="h-5 w-5 shrink-0 text-blue-600" />
        <div className="flex-1 text-sm">
          <div className="font-medium">Sube el justificante de pago</div>
          <div className="text-xs text-muted-foreground">
            PDF o imagen (JPG, PNG, WEBP) · máximo 10 MB. Lo validará el administrador.
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED.join(",")}
        className="hidden"
        onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
      />

      {!file ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleSelect(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`flex w-full items-center justify-center rounded-md border-2 border-dashed p-6 text-sm transition-colors ${
            dragOver ? "border-blue-500 bg-blue-100" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          <span className="text-muted-foreground">
            Arrastra un archivo o haz clic para seleccionarlo
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-md border bg-white p-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="truncate font-medium">{file.name}</div>
            <div className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB · {file.type}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs text-blue-600 hover:underline"
        >
          Cambiar archivo
        </button>
        <Button
          type="submit"
          size="sm"
          className="w-full sm:w-auto"
          disabled={isPending || !file}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar justificante
        </Button>
      </div>
    </form>
  );
}