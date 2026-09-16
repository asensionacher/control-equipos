"use client";

import { useRef } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

const gruposAdmin = [
  {
    label: "Inicio",
    enlaces: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    label: "Plantilla",
    enlaces: [
      { href: "/admin/jugadores", label: "Jugadores" },
      { href: "/admin/padres", label: "Familias" },
      { href: "/admin/equipos", label: "Equipos" },
    ],
  },
  {
    label: "Gestión",
    enlaces: [
      { href: "/admin/pendientes", label: "Pendientes de revisión" },
      { href: "/admin/recibos", label: "Recibos" },
      { href: "/admin/documentos", label: "Documentos" },
      { href: "/admin/consentimientos", label: "Consentimientos" },
    ],
  },
  {
    label: "Club",
    enlaces: [
      { href: "/admin/temporadas", label: "Temporadas" },
      { href: "/admin/configuracion", label: "Configuración" },
      { href: "/admin/usuarios", label: "Administradores" },
    ],
  },
];

const gruposJugador = [
  {
    label: "Inicio",
    enlaces: [{ href: "/dashboard", label: "Mis jugadores" }],
  },
];

export function MobilePanelNav({ esAdmin }: { esAdmin: boolean }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const grupos = esAdmin ? gruposAdmin : gruposJugador;

  function cerrarMenu() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <details ref={detailsRef} className="relative xl:hidden">
      <summary
        aria-label="Abrir menú de navegación"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md hover:bg-accent"
      >
        <Menu className="h-5 w-5" />
      </summary>
      <nav className="absolute right-0 top-full mt-2 max-h-[calc(100vh-5rem)] w-60 overflow-y-auto rounded-md border bg-background p-2 shadow-lg">
        {grupos.map((grupo) => (
          <div
            key={grupo.label}
            className="[&:not(:last-child)]:mb-2 [&:not(:last-child)]:border-b [&:not(:last-child)]:pb-2"
          >
            <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {grupo.label}
            </div>
            {grupo.enlaces.map((enlace) => (
              <Link
                key={enlace.href}
                href={enlace.href}
                onClick={cerrarMenu}
                className="block rounded-sm px-3 py-2 text-sm hover:bg-accent"
              >
                {enlace.label}
              </Link>
            ))}
          </div>
        ))}
        <div className="border-t pt-2">
        <Link
          href="/perfil"
          onClick={cerrarMenu}
          className="block rounded-sm px-3 py-2 text-sm hover:bg-accent"
        >
          Mi perfil
        </Link>
        </div>
      </nav>
    </details>
  );
}
