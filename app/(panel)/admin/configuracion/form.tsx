"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import type { ConfiguracionClub } from "@prisma/client";
import { guardarConfiguracionClub } from "./actions";

interface Props {
  club: ConfiguracionClub;
}

export function ConfiguracionClubForm({ club }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await guardarConfiguracionClub(formData);
      if (result?.error) setError(result.error);
      else {
        setSuccess(result.success ?? "Guardado");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales del club (emisor)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nombre">Nombre del club *</Label>
              <Input id="nombre" name="nombre" required defaultValue={club.nombre} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="logo">Escudo o logotipo</Label>
              {club.logoKey && (
                <div className="flex items-center gap-4 rounded-md border p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/api/club/logo"
                    alt={`Escudo de ${club.nombre}`}
                    className="h-20 w-20 object-contain"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="eliminarLogo" />
                    Eliminar escudo actual
                  </label>
                </div>
              )}
              <Input id="logo" name="logo" type="file" accept="image/jpeg,image/png" />
              <p className="text-xs text-muted-foreground">
                JPG o PNG. Máximo 5 MB. El escudo también aparecerá en los PDFs.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="colorPrimario">Color principal</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="colorPrimario"
                  name="colorPrimario"
                  type="color"
                  defaultValue={club.colorPrimario}
                  className="h-10 w-20 p-1"
                />
                <span className="text-sm text-muted-foreground">
                  Se utiliza en la pantalla de acceso y elementos de identidad.
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nif">NIF / CIF</Label>
              <Input id="nif" name="nif" defaultValue={club.nif ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" name="telefono" defaultValue={club.telefono ?? ""} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="direccion">Dirección fiscal</Label>
              <Input id="direccion" name="direccion" defaultValue={club.direccion ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigoPostal">Código postal</Label>
              <Input id="codigoPostal" name="codigoPostal" defaultValue={club.codigoPostal ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input id="ciudad" name="ciudad" defaultValue={club.ciudad ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provincia">Provincia</Label>
              <Input id="provincia" name="provincia" defaultValue={club.provincia ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pais">País</Label>
              <Input id="pais" name="pais" defaultValue={club.pais} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email de contacto</Label>
              <Input id="email" name="email" type="email" defaultValue={club.email ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="web">Web</Label>
              <Input id="web" name="web" type="url" defaultValue={club.web ?? ""} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferencias de recibos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ivaPorDefecto">IVA por defecto (%)</Label>
              <Input
                id="ivaPorDefecto"
                name="ivaPorDefecto"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={Number(club.ivaPorDefecto)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prefijoRecibo">Prefijo del número de recibo</Label>
              <Input
                id="prefijoRecibo"
                name="prefijoRecibo"
                defaultValue={club.prefijoRecibo}
                maxLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                Aparece antes del número (ej. R-001234). No afecta al id autoincremental.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar configuración
        </Button>
      </div>
    </form>
  );
}