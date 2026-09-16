import { getDatosPersonales } from "@/lib/jugador-sync";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { obtenerFotoJugadorSrc } from "@/lib/imagen-upload";

interface Props {
  jugador: {
    id: string;
    nombre: string;
    apellidos: string;
    fechaNacimiento: Date;
    dniNie: string | null;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
    fotoUrl: string | null;
    sexo: "MASCULINO" | "FEMENINO" | "OTRO" | null;
    usuario?: { id: string; nombre: string; email: string } | null;
  };
  href?: string;
  showAvatar?: boolean;
  showDetails?: boolean;
}

/**
 * Componente que muestra los datos personales sincronizados del Jugador.
 * Si el Jugador tiene Usuario propio (cuenta), muestra los datos del Usuario.
 * Si no, los del propio Jugador (que pueden estar sincronizados desde un tutor).
 */
export async function JugadorDatosPersonales({ jugador, href, showAvatar = true, showDetails = false }: Props) {
  const datos = await getDatosPersonales(jugador.id);

  const contenido = (
    <div className="flex items-center gap-3">
      {showAvatar && (
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={obtenerFotoJugadorSrc(jugador)} alt={datos.nombre} />
          <AvatarFallback>
            {datos.nombre.charAt(0)}
            {datos.apellidos.charAt(0)}
          </AvatarFallback>
        </Avatar>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {datos.nombre} {datos.apellidos}
        </div>
        {showDetails ? (
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {datos.email && <div className="truncate">{datos.email}</div>}
            {datos.telefono && <div>{datos.telefono}</div>}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {datos.email || datos.telefono || "Sin contacto"}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:bg-accent rounded-lg transition-colors p-1 -m-1">
        {contenido}
      </Link>
    );
  }

  return contenido;
}
