"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { crearSolicitudDocumento } from "../actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  equipos: Array<{ id: string; nombre: string; temporada: string; jugadoresCount: number }>;
  jugadores: Array<{ id: string; nombre: string; apellidos: string }>;
}

export function NuevaSolicitudDocumentoForm({ equipos, jugadores }: Props) {
  const router = useRouter();
  const [modo, setModo] = useState<"equipo" | "jugadores">("equipo");
  const [equiposSeleccionados, setEquiposSeleccionados] = useState<Set<string>>(new Set());
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    if (!query) return jugadores;
    return jugadores.filter((jugador) =>
      `${jugador.nombre} ${jugador.apellidos}`.toLowerCase().includes(query)
    );
  }, [busqueda, jugadores]);

  function toggle(id: string) {
    setSeleccionados((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  }

  function toggleEquipo(id: string) {
    setEquiposSeleccionados((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(id)) siguientes.delete(id);
      else siguientes.add(id);
      return siguientes;
    });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("modoAsignacion", modo);
    formData.delete("jugadoresIds");
    formData.delete("equiposIds");
    if (modo === "equipo") {
      equiposSeleccionados.forEach((id) => formData.append("equiposIds", id));
    } else {
      seleccionados.forEach((id) => formData.append("jugadoresIds", id));
    }

    startTransition(async () => {
      const result = await crearSolicitudDocumento(formData);
      if (result.error) setError(result.error);
      else if (result.solicitudId) router.push(`/admin/documentos/${result.solicitudId}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}
      <Card>
        <CardHeader><CardTitle>Documento requerido</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input id="nombre" name="nombre" required placeholder="Ej. Certificado médico" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Instrucciones (opcional)</Label>
            <Textarea
              id="descripcion"
              name="descripcion"
              rows={3}
              placeholder="Indica qué debe contener el documento."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Asignación</CardTitle></CardHeader>
        <CardContent>
          <Tabs value={modo} onValueChange={(value) => setModo(value as typeof modo)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="equipo">A equipos</TabsTrigger>
              <TabsTrigger value="jugadores">A jugadores concretos</TabsTrigger>
            </TabsList>
            <TabsContent value="equipo" className="space-y-2">
              <Label>Equipos *</Label>
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
                {equipos.map((equipo) => (
                  <label
                    key={equipo.id}
                    className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted"
                  >
                    <Checkbox
                      checked={equiposSeleccionados.has(equipo.id)}
                      onCheckedChange={() => toggleEquipo(equipo.id)}
                    />
                    <span className="text-sm">
                      {equipo.nombre} ({equipo.temporada}) — {equipo.jugadoresCount} jugadores
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {equiposSeleccionados.size} equipo
                {equiposSeleccionados.size === 1 ? "" : "s"} seleccionado
                {equiposSeleccionados.size === 1 ? "" : "s"}
              </p>
            </TabsContent>
            <TabsContent value="jugadores" className="space-y-3">
              <Input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar por nombre..."
              />
              <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
                {filtrados.map((jugador) => (
                  <label
                    key={jugador.id}
                    className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted"
                  >
                    <Checkbox
                      checked={seleccionados.has(jugador.id)}
                      onCheckedChange={() => toggle(jugador.id)}
                    />
                    <span className="text-sm">
                      {jugador.apellidos}, {jugador.nombre}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {seleccionados.size} jugador{seleccionados.size === 1 ? "" : "es"} seleccionado
                {seleccionados.size === 1 ? "" : "s"}
              </p>
            </TabsContent>
          </Tabs>
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
