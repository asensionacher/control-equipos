"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import { asignarTutorias, quitarTutoria } from "./actions";

export interface TutoriaItem {
  id: string;
  jugadorId: string;
  jugadorNombre: string;
  jugadorApellidos: string;
  parentesco: string | null;
  esPrincipal: boolean;
}

export interface JugadorSinTutor {
  id: string;
  nombre: string;
  apellidos: string;
}

interface Props {
  usuarioId: string;
  tutoriasActuales: TutoriaItem[];
  jugadoresDisponibles: JugadorSinTutor[];
}

export function PanelPadre({
  usuarioId,
  tutoriasActuales,
  jugadoresDisponibles,
}: Props) {
  const router = useRouter();
  const [seleccionado, setSeleccionado] = useState<string>("");
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const disponiblesFiltrados = jugadoresDisponibles.filter(
    (j) => !tutoriasActuales.some((t) => t.jugadorId === j.id)
  );

  function handleAsignar() {
    setMsg(null);
    if (!seleccionado) {
      setMsg({ tipo: "error", texto: "Selecciona un jugador" });
      return;
    }
    startTransition(async () => {
      const result = await asignarTutorias(usuarioId, [seleccionado]);
      if (result.error) setMsg({ tipo: "error", texto: result.error });
      else {
        setMsg({ tipo: "success", texto: "Tutoría creada" });
        setSeleccionado("");
        router.refresh();
      }
    });
  }

  function handleQuitar(tutoriaId: string, jugadorNombre: string, jugadorApellidos: string) {
    setMsg(null);
    const nombreCompleto = `${jugadorNombre} ${jugadorApellidos}`.trim();
    const confirmado = window.confirm(
      `¿Confirmas que ya no eres tutor${nombreCompleto ? ` de ${nombreCompleto}` : ""}?\n\n` +
        "Se eliminará la tutoría. Si el jugador tiene email y cuenta propia, podrá entonces\n" +
        "acceder al portal por sí mismo como mayor de edad."
    );
    if (!confirmado) return;
    startTransition(async () => {
      const result = await quitarTutoria(usuarioId, tutoriaId);
      if (result.error) setMsg({ tipo: "error", texto: result.error });
      else {
        setMsg({ tipo: "success", texto: "Tutoría eliminada" });
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Rol: Padre / tutor</span>
          <span className="text-xs font-normal text-muted-foreground">
            {tutoriasActuales.length} jugador
            {tutoriasActuales.length === 1 ? "" : "es"} a cargo
          </span>
        </CardTitle>
        <CardDescription>
          Jugadores a los que este usuario tutoriza. Desde aquí puedes añadir nuevos o
          desvincular existentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <Alert variant={msg.tipo === "error" ? "destructive" : "success"}>
            <AlertDescription>{msg.texto}</AlertDescription>
          </Alert>
        )}

        {tutoriasActuales.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este usuario aún no tiene jugadores a su cargo.
          </p>
        ) : (
          <ul className="space-y-2">
            {tutoriasActuales.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {t.jugadorNombre} {t.jugadorApellidos}
                  </div>
                  {t.parentesco && (
                    <div className="text-xs text-muted-foreground">{t.parentesco}</div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleQuitar(t.id, t.jugadorNombre, t.jugadorApellidos)}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}

        {disponiblesFiltrados.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay más jugadores disponibles para asignar.
          </p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Vincular jugador existente
              </div>
              <Select
                value={seleccionado || "none"}
                onValueChange={(v) => setSeleccionado(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un jugador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Selecciona —</SelectItem>
                  {disponiblesFiltrados.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.nombre} {j.apellidos}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={handleAsignar} disabled={isPending || !seleccionado}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Asignar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
