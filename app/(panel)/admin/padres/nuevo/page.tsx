import { redirect } from "next/navigation";

export default async function PadresNuevoLegacyRedirect() {
  redirect("/admin/usuarios/nuevo?roles=padre");
}
