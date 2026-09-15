"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { crearActivacionParaJugadorExistente } from "@/app/(panel)/admin/padres/activacion-actions";

interface Props {
  jugadorId: string;
  email: string;
}

export function CrearActivacionJugador({ jugadorId, email }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string; link?: string } | null>(null);

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      const result = await crearActivacionParaJugadorExistente(jugadorId, email);
      if (result.error) {
        setMsg({ tipo: "error", texto: result.error });
        return;
      }
      setMsg({
        tipo: "success",
        texto: result.success ?? "Email enviado",
        link: result.devLink,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          Se enviará a <strong>{email}</strong>
        </div>
        <Button onClick={handleClick} disabled={isPending}>
          <Send className="h-4 w-4" />
          {isPending ? "Enviando..." : "Enviar email de activación"}
        </Button>
      </div>
      {msg && (
        <div
          className={`rounded-md border p-3 text-sm ${
            msg.tipo === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"
          }`}
        >
          <p>{msg.texto}</p>
          {msg.link && (
            <p className="mt-1 break-all text-xs">
              <strong>Enlace de desarrollo:</strong> {msg.link}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
