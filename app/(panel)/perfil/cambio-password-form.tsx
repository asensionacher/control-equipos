"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { cambiarPassword } from "./actions";

export function CambioPasswordForm() {
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await cambiarPassword(formData);
      if (result.error) setMsg({ tipo: "error", texto: result.error });
      else if (result.success) {
        setMsg({ tipo: "success", texto: result.success });
        e.currentTarget?.reset?.();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {msg && (
        <Alert variant={msg.tipo === "error" ? "destructive" : "success"}>
          <AlertDescription>{msg.texto}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="passwordActual">Contraseña actual</Label>
        <Input
          id="passwordActual"
          name="passwordActual"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="passwordNueva">Nueva contraseña</Label>
          <Input
            id="passwordNueva"
            name="passwordNueva"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmarPassword">Confirmar nueva contraseña</Label>
          <Input
            id="confirmarPassword"
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
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}
