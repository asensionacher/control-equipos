import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NuevoPadreForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NuevoPadrePage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/admin/padres"
        className="inline-flex items-center text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver a padres
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nuevo padre / tutor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea una cuenta para un padre o tutor. Luego podrás vincularle jugadores.
        </p>
      </div>
      <NuevoPadreForm />
    </div>
  );
}
