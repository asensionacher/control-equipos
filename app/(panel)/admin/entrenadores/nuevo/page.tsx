import { redirect } from "next/navigation";

export default async function EntrenadoresNuevoLegacyRedirect() {
  redirect("/admin/usuarios/nuevo?roles=entrenador");
}
