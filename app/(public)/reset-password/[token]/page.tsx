import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ResetPasswordForm } from "./form";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ params }: PageProps) {
  const { token } = await params;

  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { usuario: { select: { email: true, nombre: true } } },
  });

  if (!tokenRecord || tokenRecord.usado || tokenRecord.expiresAt < new Date()) {
    notFound();
  }
  if (!tokenRecord.usuario.email) notFound();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <ResetPasswordForm token={token} email={tokenRecord.usuario.email} />
      </div>
    </main>
  );
}
