"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { actualizarPerfil } from "./actions";

interface Props {
  usuario: { nombre: string; apellidos: string; email: string; telefono: string | null };
}

export function PerfilForm({ usuario }: Props) {
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await actualizarPerfil(formData);
      if (result.error) setMsg({ tipo: "error", texto: result.error });
      else if (result.success) setMsg({ tipo: "success", texto: result.success });
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
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={usuario.email} disabled className="bg-muted" />
        <p className="text-xs text-muted-foreground">
          El email no se puede modificar. Contacta con el administrador del club si necesitas
          cambiarlo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre</Label>
          <Input id="nombre" name="nombre" required defaultValue={usuario.nombre} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="apellidos">Apellidos</Label>
          <Input id="apellidos" name="apellidos" required defaultValue={usuario.apellidos} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefono">Teléfono</Label>
        <Input id="telefono" name="telefono" type="tel" defaultValue={usuario.telefono ?? ""} />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
