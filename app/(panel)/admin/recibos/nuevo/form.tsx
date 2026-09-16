"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { crearRecibo } from "../actions";

interface Equipo {
  id: string;
  nombre: string;
  categoria: string | null;
  temporada: string;
  jugadoresCount: number;
}

interface Jugador {
  id: string;
  nombre: string;
  apellidos: string;
}

interface Props {
  equipos: Equipo[];
  jugadores: Jugador[];
  ivaPorDefecto: number;
}

export function NuevoReciboForm({ equipos, jugadores, ivaPorDefecto }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [modo, setModo] = useState<"equipo" | "jugadores">("equipo");
  const [equiposSeleccionados, setEquiposSeleccionados] = useState<Set<string>>(new Set());
  const [jugadoresSeleccionados, setJugadoresSeleccionados] = useState<Set<string>>(new Set());
  const [busquedaJugador, setBusquedaJugador] = useState("");
  const [base, setBase] = useState<string>("");
  const [tipoIva, setTipoIva] = useState<string>(String(ivaPorDefecto));
  const [concepto, setConcepto] = useState("");

  const jugadoresFiltrados = useMemo(() => {
    const q = busquedaJugador.toLowerCase().trim();
    if (!q) return jugadores;
    return jugadores.filter(
      (j) =>
        j.nombre.toLowerCase().includes(q) || j.apellidos.toLowerCase().includes(q)
    );
  }, [jugadores, busquedaJugador]);

  const baseNum = parseFloat(base) || 0;
  const tipoIvaNum = parseFloat(tipoIva) || 0;
  const cuotaIva = Math.round(baseNum * (tipoIvaNum / 100) * 100) / 100;
  const total = Math.round((baseNum + cuotaIva) * 100) / 100;

  const equiposElegidos = equipos.filter((equipo) => equiposSeleccionados.has(equipo.id));
  const jugadoresEquipos = equiposElegidos.reduce(
    (total, equipo) => total + equipo.jugadoresCount,
    0
  );

  function toggleJugador(id: string) {
    const next = new Set(jugadoresSeleccionados);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setJugadoresSeleccionados(next);
  }

  function toggleEquipo(id: string) {
    const next = new Set(equiposSeleccionados);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEquiposSeleccionados(next);
  }

  function toggleTodos() {
    const visibles = jugadoresFiltrados.map((j) => j.id);
    const todosMarcados = visibles.every((id) => jugadoresSeleccionados.has(id));
    const next = new Set(jugadoresSeleccionados);
    if (todosMarcados) {
      visibles.forEach((id) => next.delete(id));
    } else {
      visibles.forEach((id) => next.add(id));
    }
    setJugadoresSeleccionados(next);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!concepto.trim()) {
      setError("El concepto es obligatorio");
      return;
    }
    if (baseNum <= 0) {
      setError("La base imponible debe ser mayor que 0");
      return;
    }
    if (modo === "equipo" && equiposSeleccionados.size === 0) {
      setError("Selecciona al menos un equipo");
      return;
    }
    if (modo === "jugadores" && jugadoresSeleccionados.size === 0) {
      setError("Selecciona al menos un jugador");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("modoAsignacion", modo);
    formData.delete("equiposIds");
    if (modo === "equipo") {
      equiposSeleccionados.forEach((id) => formData.append("equiposIds", id));
      formData.delete("jugadoresIds");
    } else {
      // Eliminar anteriores y añadir los actuales
      formData.delete("jugadoresIds");
      jugadoresSeleccionados.forEach((id) => formData.append("jugadoresIds", id));
    }

    startTransition(async () => {
      const result = await crearRecibo(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.reciboId) {
        router.push(`/admin/recibos/${result.reciboId}`);
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

      <Card>
        <CardHeader>
          <CardTitle>Información del recibo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="concepto">Concepto *</Label>
            <Input
              id="concepto"
              name="concepto"
              required
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Cuota temporada 2026/2027"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (opcional)</Label>
            <Textarea
              id="descripcion"
              name="descripcion"
              rows={2}
              placeholder="Información adicional que verá el jugador"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="baseImponible">Base imponible (€) *</Label>
              <Input
                id="baseImponible"
                name="baseImponible"
                type="number"
                step="0.01"
                min="0"
                required
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipoIva">Tipo IVA (%)</Label>
              <select
                id="tipoIva"
                name="tipoIva"
                value={tipoIva}
                onChange={(e) => setTipoIva(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="0">0% (exento)</option>
                <option value="4">4% (superreducido)</option>
                <option value="10">10% (reducido)</option>
                <option value="21">21% (general)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaVencimiento">Vencimiento (opcional)</Label>
              <Input id="fechaVencimiento" name="fechaVencimiento" type="date" />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Base imponible</div>
                <div className="font-medium">{baseNum.toFixed(2)} €</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  IVA ({tipoIvaNum}%)
                </div>
                <div className="font-medium">{cuotaIva.toFixed(2)} €</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-lg font-bold">{total.toFixed(2)} €</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asignación</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={modo} onValueChange={(v) => setModo(v as "equipo" | "jugadores")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="equipo">A equipos</TabsTrigger>
              <TabsTrigger value="jugadores">A jugadores concretos</TabsTrigger>
            </TabsList>

            <TabsContent value="equipo" className="space-y-3">
              <Alert variant="info">
                <AlertDescription>
                  El recibo se asignará a los jugadores actualmente inscritos en los equipos
                  seleccionados, sin duplicar jugadores que estén en más de uno.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Equipos *</Label>
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
                  {equipos.map((e) => (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-muted"
                    >
                      <Checkbox
                        checked={equiposSeleccionados.has(e.id)}
                        onCheckedChange={() => toggleEquipo(e.id)}
                      />
                      <span className="text-sm">
                        {e.nombre} ({e.temporada}) — {e.jugadoresCount} jugador
                        {e.jugadoresCount === 1 ? "" : "es"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {equiposSeleccionados.size > 0 && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="font-medium">
                    {equiposSeleccionados.size} equipo
                    {equiposSeleccionados.size === 1 ? "" : "s"} seleccionado
                    {equiposSeleccionados.size === 1 ? "" : "s"}
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    Hasta {jugadoresEquipos} asignaciones antes de eliminar duplicados
                  </Badge>
                </div>
              )}
            </TabsContent>

            <TabsContent value="jugadores" className="space-y-3">
              <Alert variant="info">
                <AlertDescription>
                  Selecciona uno o más jugadores concretos para asignarles este recibo.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="busqueda">Buscar</Label>
                <Input
                  id="busqueda"
                  value={busquedaJugador}
                  onChange={(e) => setBusquedaJugador(e.target.value)}
                  placeholder="Nombre o apellidos..."
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="todos"
                    checked={
                      jugadoresFiltrados.length > 0 &&
                      jugadoresFiltrados.every((j) => jugadoresSeleccionados.has(j.id))
                    }
                    onCheckedChange={toggleTodos}
                  />
                  <Label htmlFor="todos" className="cursor-pointer">
                    Seleccionar todos ({jugadoresSeleccionados.size} seleccionados)
                  </Label>
                </div>
                <Badge variant="secondary">
                  {jugadoresFiltrados.length} jugador
                  {jugadoresFiltrados.length === 1 ? "" : "es"}
                </Badge>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border">
                {jugadoresFiltrados.length === 0 ? (
                  <p className="p-3 text-center text-sm text-muted-foreground">
                    No hay jugadores que coincidan.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {jugadoresFiltrados.map((j) => (
                      <li
                        key={j.id}
                        className="flex cursor-pointer items-center gap-3 p-2 hover:bg-accent"
                        onClick={() => toggleJugador(j.id)}
                      >
                        <Checkbox
                          checked={jugadoresSeleccionados.has(j.id)}
                          onCheckedChange={() => toggleJugador(j.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm">
                          {j.nombre} {j.apellidos}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Crear recibo
        </Button>
      </div>
    </form>
  );
}