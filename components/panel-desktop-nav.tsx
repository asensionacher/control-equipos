"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const gruposAdmin = [
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

const gruposJugador: typeof gruposAdmin = [];

function estaActivo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PanelDesktopNav({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();
  const inicio = esAdmin
    ? { href: "/admin", label: "Inicio" }
    : { href: "/dashboard", label: "Mis jugadores" };
  const grupos = esAdmin ? gruposAdmin : gruposJugador;

  return (
    <nav className="hidden items-center gap-1 xl:flex">
      <Link
        href={inicio.href}
        className={cn(
          "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent",
          pathname === inicio.href && "bg-accent"
        )}
      >
        {inicio.label}
      </Link>
      {grupos.map((grupo) => {
        const activo = grupo.enlaces.some((enlace) => estaActivo(pathname, enlace.href));
        return (
          <DropdownMenu.Root key={grupo.label}>
            <DropdownMenu.Trigger
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent data-[state=open]:bg-accent",
                activo && "bg-accent"
              )}
            >
              {grupo.label}
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={6}
                className="z-50 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              >
                {grupo.enlaces.map((enlace) => (
                  <DropdownMenu.Item key={enlace.href} asChild>
                    <Link
                      href={enlace.href}
                      className={cn(
                        "block cursor-pointer rounded-sm px-3 py-2 text-sm outline-none hover:bg-accent focus:bg-accent",
                        estaActivo(pathname, enlace.href) && "bg-accent"
                      )}
                    >
                      {enlace.label}
                    </Link>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        );
      })}
    </nav>
  );
}
