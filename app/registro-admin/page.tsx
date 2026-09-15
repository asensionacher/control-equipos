import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RegistroAdminForm } from "./form";

export const dynamic = "force-dynamic";

export default async function RegistroAdminPage() {
  const totalAdmins = await prisma.usuario.count({ where: { rol: "ADMIN" } });
  if (totalAdmins > 0) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <RegistroAdminForm />
      </div>
    </main>
  );
}
