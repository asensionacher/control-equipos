import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { MobilePanelNav } from "@/components/mobile-panel-nav";
import { PanelDesktopNav } from "@/components/panel-desktop-nav";
import { LogOut, User } from "lucide-react";
import { getConfiguracionClub } from "@/lib/club-utils";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Verificar que el usuario de la sesión realmente existe en la BD.
  // Esto cubre el caso de JWT obsoleto tras un reset de BD.
  const [usuarioExiste, club] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, rol: true, totpEnabled: true },
    }),
    getConfiguracionClub(),
  ]);
  if (!usuarioExiste || usuarioExiste.rol !== session.user.rol) {
    // Sesión inválida: redirigir a login
    redirect("/login?expired=1");
  }

  const esAdmin = session.user.rol === "ADMIN";

  // Los administradores deben tener verificación en dos pasos activada para
  // acceder a cualquier ruta protegida. Forzamos paso por /perfil para que la
  // activen antes de poder seguir navegando.
  if (esAdmin && !usuarioExiste.totpEnabled) {
    redirect("/perfil?forceTotp=1");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={esAdmin ? "/admin" : "/dashboard"}
              className="flex min-w-0 max-w-[45vw] items-center gap-2 truncate text-base font-bold sm:text-lg xl:max-w-64"
              style={{ color: club.colorPrimario }}
            >
              {club.logoKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/api/club/logo"
                  alt=""
                  className="h-9 w-9 shrink-0 object-contain"
                />
              )}
              <span className="truncate">{club.nombre}</span>
            </Link>
            <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground 2xl:inline-block">
              {esAdmin ? "Administrador" : "Jugador"}
            </span>
          </div>

          <PanelDesktopNav esAdmin={esAdmin} />

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/perfil">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Perfil</span>
              </Link>
            </Button>
            <span className="hidden text-sm text-muted-foreground 2xl:inline">
              {session.user.nombre}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </Button>
            </form>
            <MobilePanelNav esAdmin={esAdmin} />
          </div>
        </div>
      </header>

      <main className="container flex-1 py-6 md:py-8">{children}</main>

      <footer className="border-t bg-background py-4">
        <div className="container text-center text-xs text-muted-foreground">
          {club.nombre} &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
