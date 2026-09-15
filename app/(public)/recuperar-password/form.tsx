"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { solicitarResetPassword } from "@/app/(public)/password-reset/actions";

export function RecuperarPasswordForm() {
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await solicitarResetPassword(formData);
      if (result.error) setMsg({ tipo: "error", texto: result.error });
      else if (result.success) setMsg({ tipo: "success", texto: result.success });
    });
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
        <CardDescription>
          Introduce tu email y te enviaremos un enlace para crear una nueva contraseña
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {msg && (
            <Alert variant={msg.tipo === "error" ? "destructive" : "success"}>
              <AlertDescription>{msg.texto}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@email.com"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar enlace de recuperación"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
