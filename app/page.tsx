import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getConfiguracionClub } from "@/lib/club-utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.rol === "ADMIN" ? "/admin" : "/dashboard");
  }

  const [totalAdmins, club] = await Promise.all([
    prisma.usuario.count({ where: { rol: "ADMIN" } }),
    getConfiguracionClub(),
  ]);
  const mostrarRegistro = totalAdmins === 0;

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          {club.logoKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/api/club/logo"
              alt={`Escudo de ${club.nombre}`}
              className="mx-auto mb-6 h-28 w-28 object-contain"
            />
          )}
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl md:text-5xl lg:text-6xl">
            {club.nombre}
          </h1>
          <p className="mt-4 text-base text-gray-600 sm:mt-6 sm:text-lg md:text-xl">
            Sistema completo de gestión de equipos, jugadores y temporadas
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
            >
              Iniciar sesión
            </Link>
            {mostrarRegistro && (
              <Link
                href="/registro-admin"
                className="inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent sm:w-auto"
              >
                Registrar primer administrador
              </Link>
            )}
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:mt-20 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Gestión de jugadores</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Registra jugadores con sus datos personales y vincúlalos a sus tutores legales.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Temporadas</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Crea temporadas y organiza los equipos que componen cada una de ellas.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Seguro y privado</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Datos protegidos con encriptación. Los jugadores sólo ven su propia información.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
