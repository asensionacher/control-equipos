import { TemporadaForm } from "../form";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NuevaTemporadaPage() {
  const session = await auth();
  if (!session?.user || session.user.rol !== "ADMIN") redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Nueva temporada</h1>
      <TemporadaForm />
    </div>
  );
}
