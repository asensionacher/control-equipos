"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { asignarUsuarioComoEntrenador } from "../actions";

interface UsuarioDisponible {
  id: string;
  nombre: string;
  apellidos: string;
  email: string | null;
  tienePerfilEntrenador: boolean;
}

interface Props {
  equipoId: string;
  usuarios: UsuarioDisponible[];
}

export function AsignarEntrenadorModal({ equipoId, usuarios }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usuarioPendiente, setUsuarioPendiente] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const usuariosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return usuarios;
    return usuarios.filter((usuario) =>
      `${usuario.nombre} ${usuario.apellidos} ${usuario.email ?? ""}`
        .toLowerCase()
        .includes(termino)
    );
  }, [busqueda, usuarios]);

  function asignar(usuarioId: string) {
    setError(null);
    setUsuarioPendiente(usuarioId);
    startTransition(async () => {
      const resultado = await asignarUsuarioComoEntrenador(equipoId, usuarioId);
      setUsuarioPendiente(null);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      setBusqueda("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <UserPlus className="h-4 w-4" />
          Añadir entrenador
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir entrenador</DialogTitle>
          <DialogDescription>
            Selecciona un usuario. Si todavía no tiene perfil de entrenador, se creará
            automáticamente.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre o email..."
            className="pl-9"
          />
        </div>

        <div className="max-h-80 overflow-y-auto rounded-md border">
          {usuariosFiltrados.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No hay usuarios disponibles.
            </p>
          ) : (
            <ul className="divide-y">
              {usuariosFiltrados.map((usuario) => (
                <li
                  key={usuario.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {usuario.nombre} {usuario.apellidos}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {usuario.email ?? "Sin email"}
                      {usuario.tienePerfilEntrenador ? " · Entrenador" : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => asignar(usuario.id)}
                  >
                    {usuarioPendiente === usuario.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Seleccionar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
