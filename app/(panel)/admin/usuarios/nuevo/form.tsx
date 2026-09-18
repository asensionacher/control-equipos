"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearUsuarioWizard } from "./actions";

interface Props {
  equipos: { id: string; nombre: string; categoria: string | null }[];
  jugadoresACargoDisponibles: { id: string; nombre: string; apellidos: string }[];
  jugadoresVinculables: { id: string; nombre: string; apellidos: string; fechaNacimiento: string }[];
  defaults: {
    rolBase: "ADMIN" | "USUARIO";
    esPadre: boolean;
    esJugador: boolean;
    esEntrenador: boolean;
    desdePanelAdmin: boolean;
  };
}

export function WizardUsuarioForm({
  equipos,
  jugadoresACargoDisponibles,
  jugadoresVinculables,
  defaults,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [esPadre, setEsPadre] = useState<boolean>(defaults.esPadre);
  const [esJugador, setEsJugador] = useState<boolean>(defaults.esJugador);
  const [esEntrenador, setEsEntrenador] = useState<boolean>(defaults.esEntrenador);
  const [crearPerfil, setCrearPerfil] = useState<boolean>(true);
  const [equiposJugador, setEquiposJugador] = useState<Set<string>>(new Set());
  const [equiposEntrenador, setEquiposEntrenador] = useState<Set<string>>(new Set());
  const [jugadoresACargo, setJugadoresACargo] = useState<Set<string>>(new Set());
  const [rolBase, setRolBase] = useState<"ADMIN" | "USUARIO">(defaults.rolBase);
  const [isPending, startTransition] = useTransition();

  function toggleSet(
    set: Set<string>,
    setter: (s: Set<string>) => void,
    id: string
  ) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    fd.set("rol", rolBase);
    if (esPadre) {
      fd.set("esPadre", "on");
      jugadoresACargo.forEach((id) => fd.append("jugadoresACargoIds", id));
    } else fd.delete("esPadre");
    if (esJugador) {
      fd.set("esJugador", "on");
      if (crearPerfil) fd.set("crearPerfilJugador", "on");
      else fd.set("crearPerfilJugador", "off");
      equiposJugador.forEach((id) => fd.append("equiposComoJugadorIds", id));
    } else fd.delete("esJugador");
    if (esEntrenador) {
      fd.set("esEntrenador", "on");
      equiposEntrenador.forEach((id) => fd.append("equiposComoEntrenadorIds", id));
    } else fd.delete("esEntrenador");

    startTransition(async () => {
      const result = await crearUsuarioWizard({ formData: fd });
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos personales</CardTitle>
          <CardDescription>
            Obligatorios: nombre y apellidos. El email es opcional (para menores sin
            acceso al portal, déjalo en blanco). Si indicas email, se enviará al usuario
            un email para que active su cuenta y elija su contraseña.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" name="nombre" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos *</Label>
              <Input id="apellidos" name="apellidos" required />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ejemplo@correo.com (opcional para menores)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol">Rol base</Label>
              <Select
                value={rolBase}
                onValueChange={(v) => setRolBase(v as "ADMIN" | "USUARIO")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USUARIO">Usuario</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                ADMIN accede al panel de administración. USUARIO accede a su portal privado.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
              <Input id="fechaNacimiento" name="fechaNacimiento" type="date" />
              <p className="text-xs text-muted-foreground">
                Obligatoria si se marca &ldquo;Es jugador&rdquo;.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dniNie">DNI / NIE</Label>
              <Input id="dniNie" name="dniNie" />
              <p className="text-xs text-muted-foreground">
                Opcional. Si se asigna como jugador, se reutiliza este mismo valor.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" name="telefono" type="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefonoAlternativo">Teléfono alternativo</Label>
              <Input
                id="telefonoAlternativo"
                name="telefonoAlternativo"
                type="tel"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="emailVerificado" />
            Marcar email como verificado (no enviará activación)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles del usuario</CardTitle>
          <CardDescription>
            Activa los roles que apliquen. Cada rol desbloquea su sección inferior para hacer
            asignaciones. Una persona puede combinar varios roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RoleToggle
            label="Es padre / tutor"
            description="Podrá iniciar sesión y acceder a las fichas de los jugadores que le asignes."
            checked={esPadre}
            onChange={setEsPadre}
          />
          <RoleToggle
            label="Es jugador"
            description="Creará (o vinculará) una ficha de Jugador asociada a este usuario y le asignará a los equipos que selecciones."
            checked={esJugador}
            onChange={setEsJugador}
          />
          <RoleToggle
            label="Es entrenador"
            description="Creará un perfil de Entrenador y le asignará a los equipos que selecciones."
            checked={esEntrenador}
            onChange={setEsEntrenador}
          />
        </CardContent>
      </Card>

      {esPadre && (
        <Card>
          <CardHeader>
            <CardTitle>Jugadores a su cargo</CardTitle>
            <CardDescription>
              Elige los jugadores de los que será tutor. Sólo aparecen jugadores activos sin
              tutor principal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jugadoresACargoDisponibles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay jugadores disponibles sin tutor. Crea primero los jugadores.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {jugadoresACargoDisponibles.map((j) => {
                  const checked = jugadoresACargo.has(j.id);
                  return (
                    <label
                      key={j.id}
                      htmlFor={`jc-${j.id}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        checked ? "border-primary bg-primary/5" : "hover:bg-accent"
                      }`}
                    >
                      <Checkbox
                        id={`jc-${j.id}`}
                        checked={checked}
                        onCheckedChange={() =>
                          toggleSet(jugadoresACargo, setJugadoresACargo, j.id)
                        }
                      />
                      <div className="min-w-0">
                        <div className="font-medium">
                          {j.nombre} {j.apellidos}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {esJugador && (
        <Card>
          <CardHeader>
            <CardTitle>Ficha de jugador</CardTitle>
            <CardDescription>
              Se creará automáticamente una ficha de Jugador vinculada a este usuario y se
              asignará a los equipos que selecciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={crearPerfil}
                onCheckedChange={(v) => setCrearPerfil(Boolean(v))}
              />
              Crear ficha de jugador nueva (recomendado)
            </label>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">
                Equipos a los que pertenecerá (opcional)
              </div>
              {equipos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay equipos disponibles.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {equipos.map((eq) => {
                    const checked = equiposJugador.has(eq.id);
                    return (
                      <label
                        key={eq.id}
                        htmlFor={`eqj-${eq.id}`}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          checked ? "border-primary bg-primary/5" : "hover:bg-accent"
                        }`}
                      >
                        <Checkbox
                          id={`eqj-${eq.id}`}
                          checked={checked}
                          onCheckedChange={() =>
                            toggleSet(equiposJugador, setEquiposJugador, eq.id)
                          }
                        />
                        <div className="min-w-0">
                          <div className="font-medium">{eq.nombre}</div>
                          {eq.categoria && (
                            <div className="text-xs text-muted-foreground">
                              {eq.categoria}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {esEntrenador && (
        <Card>
          <CardHeader>
            <CardTitle>Equipos a entrenar</CardTitle>
            <CardDescription>
              Estos son los equipos a los que el nuevo entrenador quedará asignado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {equipos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay equipos disponibles.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {equipos.map((eq) => {
                  const checked = equiposEntrenador.has(eq.id);
                  return (
                    <label
                      key={eq.id}
                      htmlFor={`eqe-${eq.id}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                        checked ? "border-primary bg-primary/5" : "hover:bg-accent"
                      }`}
                    >
                      <Checkbox
                        id={`eqe-${eq.id}`}
                        checked={checked}
                        onCheckedChange={() =>
                          toggleSet(equiposEntrenador, setEquiposEntrenador, eq.id)
                        }
                      />
                      <div className="min-w-0">
                        <div className="font-medium">{eq.nombre}</div>
                        {eq.categoria && (
                          <div className="text-xs text-muted-foreground">
                            {eq.categoria}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Crear usuario
        </Button>
      </div>
    </form>
  );
}

function RoleToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
        checked ? "border-primary bg-primary/5" : "hover:bg-accent"
      }`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </label>
  );
}
