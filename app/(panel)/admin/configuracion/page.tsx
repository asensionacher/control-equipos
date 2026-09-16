import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getConfiguracionClub } from "@/lib/club-utils";
import { ConfiguracionClubForm } from "./form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionClubPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  const club = await getConfiguracionClub();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configuración del club</h1>
        <p className="text-sm text-muted-foreground">
          Personaliza el nombre, el escudo y el color del club, además de sus datos fiscales.
          Cambiar el IVA por defecto solo afecta a nuevos recibos.
        </p>
      </div>
      <ConfiguracionClubForm club={club} />
    </div>
  );
}