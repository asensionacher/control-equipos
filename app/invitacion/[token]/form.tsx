"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { aceptarInvitacionRegistro, aceptarInvitacionVinculacion } from "./actions";
import { signIn } from "next-auth/react";

interface Props {
  token: string;
  emailDestino: string;
  nombreJugador: string;
  tipoInvitacion: "REGISTRO" | "VINCULACION";
  usuarioExistente: boolean;
}

export function AceptarInvitacionForm({ token, emailDestino, nombreJugador, tipoInvitacion, usuarioExistente }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRegistro(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await aceptarInvitacionRegistro(token, formData);
      if (result?.error) setError(result.error);
    });
  }

  async function handleVinculacion() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await aceptarInvitacionVinculacion(token);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess("¡Vinculación completada! Ahora puedes iniciar sesión.");
      setTimeout(() => router.push("/login"), 1500);
    });
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">
          {tipoInvitacion === "REGISTRO" ? "Crear cuenta" : "Vincular jugador"}
        </CardTitle>
        <CardDescription>
          {tipoInvitacion === "REGISTRO" ? (
            <>
              Has sido invitado para gestionar la ficha de <strong>{nombreJugador}</strong>
            </>
          ) : (
            <>
              El jugador <strong>{nombreJugador}</strong> ha sido vinculado a tu cuenta
            </>
          )}
        </CardDescription>
      </CardHeader>

      {tipoInvitacion === "REGISTRO" && (
        <form onSubmit={handleRegistro}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Alert variant="info">
              <AlertDescription>
                Tu email será <strong>{emailDestino}</strong>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono (opcional)</Label>
                <Input id="telefono" name="telefono" type="tel" autoComplete="tel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefonoAlternativo">Teléfono alternativo (opcional)</Label>
                <Input
                  id="telefonoAlternativo"
                  name="telefonoAlternativo"
                  type="tel"
                  autoComplete="tel"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmarPassword">Confirmar contraseña</Label>
              <Input
                id="confirmarPassword"
                name="confirmarPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                "Crear cuenta y vincular jugador"
              )}
            </Button>
          </CardFooter>
        </form>
      )}

      {tipoInvitacion === "VINCULACION" && (
        <CardContent className="space-y-4">
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
          {usuarioExistente ? (
            <>
              <Alert variant="info">
                <AlertDescription>
                  Ya tienes una cuenta asociada a <strong>{emailDestino}</strong>. Inicia sesión y
                  vincularemos automáticamente al jugador a tu perfil.
                </AlertDescription>
              </Alert>
              <div className="flex flex-col gap-2">
                <Button onClick={handleVinculacion} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    "Vincular jugador a mi cuenta"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => signIn(undefined, { callbackUrl: "/dashboard" })}
                  disabled={isPending}
                >
                  Solo iniciar sesión
                </Button>
              </div>
            </>
          ) : (
            <Alert variant="warning">
              <AlertDescription>
                No tienes cuenta todavía. Pide al administrador que te envíe una invitación de
                registro en su lugar, o contacta con él.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}
    </Card>
  );
}
