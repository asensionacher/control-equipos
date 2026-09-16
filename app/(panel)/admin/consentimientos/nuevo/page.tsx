import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NuevoConsentimientoForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NuevoConsentimientoPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Nuevo consentimiento
        </h1>
        <p className="text-sm text-muted-foreground">
          Se asignará automáticamente a todos los jugadores actuales y futuros.
        </p>
      </div>
      <NuevoConsentimientoForm />
    </div>
  );
}
