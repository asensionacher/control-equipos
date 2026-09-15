"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { crearPadreConActivacion } from "../activacion-actions";

export function NuevoPadreForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setDevLink(null);
    const formData = new FormData(e.currentTarget);
    const data = {
      nombre: formData.get("nombre") as string,
      apellidos: formData.get("apellidos") as string,
      email: formData.get("email") as string,
      telefono: ((formData.get("telefono") as string) || "") || undefined,
    };
    startTransition(async () => {
      const result = await crearPadreConActivacion(data);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Padre creado");
      if (result.devLink) setDevLink(result.devLink);
      if (result.usuarioId) {
        setTimeout(() => router.push(`/admin/padres/${result.usuarioId}`), 1500);
      }
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
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
          {devLink && (
            <Alert variant="warning">
              <AlertDescription>
                Email no enviado (sin RESEND_API_KEY). En desarrollo, usa este enlace para
                activar: <br />
                <a href={devLink} className="underline break-all">
                  {devLink}
                </a>
              </AlertDescription>
            </Alert>
          )}
          <Alert variant="info">
            <AlertDescription>
              El padre recibirá un email con un enlace para elegir su contraseña y activar la
              cuenta. No es necesario que introduzcas una contraseña aquí.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" name="nombre" required autoComplete="given-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos</Label>
              <Input id="apellidos" name="apellidos" required autoComplete="family-name" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono (opcional)</Label>
            <Input id="telefono" name="telefono" type="tel" autoComplete="tel" />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando y enviando email...
              </>
            ) : (
              "Crear padre y enviar email de activación"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
