import { LoginForm } from "./form";
import { getConfiguracionClub } from "@/lib/club-utils";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const club = await getConfiguracionClub();

  return (
    <main
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, ${club.colorPrimario}18, ${club.colorPrimario}45)`,
      }}
    >
      <div className="w-full max-w-md">
        <LoginForm
          searchParams={searchParams}
          nombreClub={club.nombre}
          tieneLogo={Boolean(club.logoKey)}
          colorPrimario={club.colorPrimario}
        />
      </div>
    </main>
  );
}
