"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, X } from "lucide-react";
import { asignarTutorias, quitarTutoria } from "./actions";
import { calcularEdad, formatearFecha } from "@/lib/utils";

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
  fechaNacimiento?: string | Date;
}

interface Props {
  usuarioId: string;
  tutoriasActuales: TutoriaItem[];
  jugadoresDisponibles: JugadorSinTutor[];
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function PanelPadre({
  usuarioId,
  tutoriasActuales,
  jugadoresDisponibles,
}: Props) {
  const router = useRouter();
  const [seleccionado, setSeleccionado] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const disponiblesFiltrados = useMemo(
    () =>
      jugadoresDisponibles.filter(
        (j) => !tutoriasActuales.some((t) => t.jugadorId === j.id)
      ),
    [jugadoresDisponibles, tutoriasActuales]
  );

  const coincidencias = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return disponiblesFiltrados;
    return disponiblesFiltrados.filter((j) => {
      const nombre = normalizar(`${j.nombre} ${j.apellidos}`);
      const apellido = normalizar(`${j.apellidos} ${j.nombre}`);
      return (
        nombre.includes(q) ||
        apellido.includes(q) ||
        normalizar(j.nombre).includes(q) ||
        normalizar(j.apellidos).includes(q)
      );
    });
  }, [busqueda, disponiblesFiltrados]);

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
        setBusqueda("");
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
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar jugador por nombre o apellidos…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 pr-8"
                aria-label="Buscar jugador"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {busqueda
                ? `${coincidencias.length} de ${disponiblesFiltrados.length} jugador${
                    disponiblesFiltrados.length === 1 ? "" : "es"
                  } coinciden`
                : `${disponiblesFiltrados.length} jugador${
                    disponiblesFiltrados.length === 1 ? "" : "es"
                  } disponible${disponiblesFiltrados.length === 1 ? "" : "s"}`}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1">
                <Select
                  value={seleccionado || "none"}
                  onValueChange={(v) => setSeleccionado(v === "none" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un jugador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Selecciona —</SelectItem>
                    {coincidencias.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.nombre} {j.apellidos}
                        {j.fechaNacimiento
                          ? ` (${formatearFecha(
                              typeof j.fechaNacimiento === "string"
                                ? new Date(j.fechaNacimiento)
                                : j.fechaNacimiento
                            )} · ${calcularEdad(j.fechaNacimiento)}a)`
                          : ""}
                      </SelectItem>
                    ))}
                    {coincidencias.length === 0 && (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                        Sin coincidencias.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={handleAsignar}
                disabled={isPending || !seleccionado}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Asignar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

