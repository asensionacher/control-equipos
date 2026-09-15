import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LogOut, Menu, User } from "lucide-react";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Verificar que el usuario de la sesión realmente existe en la BD.
  // Esto cubre el caso de JWT obsoleto tras un reset de BD.
  const usuarioExiste = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { id: true, rol: true },
  });
  if (!usuarioExiste || usuarioExiste.rol !== session.user.rol) {
    // Sesión inválida: redirigir a login
    redirect("/login?expired=1");
  }

  const esAdmin = session.user.rol === "ADMIN";

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={esAdmin ? "/admin" : "/dashboard"} className="text-lg font-bold">
              Control de Equipos
            </Link>
            <span className="hidden rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground sm:inline-block">
              {esAdmin ? "Administrador" : "Jugador"}
            </span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {esAdmin ? (
              <>
                <Link
                  href="/admin"
                  className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Dashboard
                </Link>
                <Link
                  href="/admin/jugadores"
                  className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Jugadores
                </Link>
                <Link
                  href="/admin/padres"
                  className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Padres
                </Link>
                <Link
                  href="/admin/equipos"
                  className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Equipos
                </Link>
                <Link
                  href="/admin/temporadas"
                  className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Temporadas
                </Link>
                <Link
                  href="/admin/usuarios"
                  className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Admins
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Mis jugadores
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/perfil">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Perfil</span>
              </Link>
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:inline">
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
            <details className="relative md:hidden">
              <summary className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-accent">
                <Menu className="h-5 w-5" />
              </summary>
              <div className="absolute right-0 top-full mt-2 w-48 rounded-md border bg-background p-1 shadow-lg">
                {esAdmin ? (
                  <>
                    <Link href="/admin" className="block rounded-sm px-3 py-2 text-sm hover:bg-accent">
                      Dashboard
                    </Link>
                    <Link href="/admin/jugadores" className="block rounded-sm px-3 py-2 text-sm hover:bg-accent">
                      Jugadores
                    </Link>
                    <Link href="/admin/padres" className="block rounded-sm px-3 py-2 text-sm hover:bg-accent">
                      Padres
                    </Link>
                    <Link href="/admin/equipos" className="block rounded-sm px-3 py-2 text-sm hover:bg-accent">
                      Equipos
                    </Link>
                    <Link href="/admin/temporadas" className="block rounded-sm px-3 py-2 text-sm hover:bg-accent">
                      Temporadas
                    </Link>
                    <Link href="/admin/usuarios" className="block rounded-sm px-3 py-2 text-sm hover:bg-accent">
                      Admins
                    </Link>
                  </>
                ) : (
                  <Link href="/dashboard" className="block rounded-sm px-3 py-2 text-sm hover:bg-accent">
                    Mis jugadores
                  </Link>
                )}
                <Link href="/perfil" className="block rounded-sm px-3 py-2 text-sm hover:bg-accent">
                  Mi perfil
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-6 md:py-8">{children}</main>

      <footer className="border-t bg-background py-4">
        <div className="container text-center text-xs text-muted-foreground">
          Control de Equipos &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
