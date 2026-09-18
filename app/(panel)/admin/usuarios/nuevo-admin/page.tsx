import { redirect } from "next/navigation";

export default async function NuevoAdminLegacyRedirect() {
  redirect("/admin/usuarios/nuevo?rol=ADMIN");
}
