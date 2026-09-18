"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { cambiarPasswordUsuarioAdmin } from "./actions";

export function CambioPasswordAdmin({ usuarioId }: { usuarioId: string }) {
  const [resultado, setResultado] = useState<{
    error?: string;
    success?: string;
    warning?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResultado(null);
    const formulario = event.currentTarget;
    const formData = new FormData(formulario);

    startTransition(async () => {
      const respuesta = await cambiarPasswordUsuarioAdmin(usuarioId, formData);
      setResultado(respuesta);
      if (respuesta.success) formulario.reset();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>
          Establece una contraseña nueva para este usuario. Se le enviará una notificación
          de seguridad sin incluir la contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="passwordNuevaAdmin">Nueva contraseña</Label>
              <Input
                id="passwordNuevaAdmin"
                name="passwordNueva"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmarPasswordAdmin">Confirmar contraseña</Label>
              <Input
                id="confirmarPasswordAdmin"
                name="confirmarPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
