import { NuevoAdminForm } from "./form";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NuevoAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Link
        href="/admin/usuarios"
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a usuarios
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nuevo administrador</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea una cuenta con acceso completo al sistema
        </p>
      </div>
      <NuevoAdminForm />
    </div>
  );
}
