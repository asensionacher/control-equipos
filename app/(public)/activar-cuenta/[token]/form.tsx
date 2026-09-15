"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { activarCuenta } from "@/app/(panel)/admin/padres/activacion-actions";

interface Props {
  token: string;
  nombre: string;
  email: string;
  jugadorVinculado?: string;
  esActivacionDeJugador: boolean;
}

export function ActivarCuentaForm({ token, nombre, email, jugadorVinculado, esActivacionDeJugador }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const titulo = esActivacionDeJugador
    ? "Activa tu cuenta de jugador"
    : "Activa tu cuenta de padre / tutor";
  const descripcion = esActivacionDeJugador
    ? "Elige una contraseña para acceder a tu ficha de jugador."
    : jugadorVinculado
      ? `Gestionarás la ficha de ${jugadorVinculado}.`
      : "Elige una contraseña para acceder a tu panel.";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await activarCuenta(token, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      // Redirigir al login con un mensaje
      router.push("/login?activated=1");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Alert variant="info">
            <AlertDescription>
              Hola <strong>{nombre}</strong>, tu email es <strong>{email}</strong>
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="password">Elige una contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmarPassword">Confirma la contraseña</Label>
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
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Activando...
              </>
            ) : (
              "Activar cuenta e iniciar sesión"
            )}
          </Button>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Volver al inicio
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
