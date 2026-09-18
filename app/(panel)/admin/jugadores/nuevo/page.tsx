import { redirect } from "next/navigation";

export default async function JugadoresNuevoRedirect() {
  redirect("/admin/usuarios/nuevo?roles=jugador");
}
