"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { crearConsentimiento } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditorConsentimiento } from "@/components/editor-consentimiento";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NuevoConsentimientoForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await crearConsentimiento(formData);
      if (result.error) setError(result.error);
      else if (result.consentimientoId) {
        router.push(`/admin/consentimientos/${result.consentimientoId}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Contenido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" name="titulo" required />
          </div>
          <EditorConsentimiento />
          <p className="text-sm text-muted-foreground">
            Se asignará automáticamente a todos los jugadores activos y también a los que se
            creen más adelante.
          </p>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear y enviar avisos
        </Button>
      </div>
    </form>
  );
}
