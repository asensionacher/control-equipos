"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { reenviarActivacionPadre } from "../activacion-actions";

export function ReenviarActivacionButton({ usuarioId }: { usuarioId: string }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string; link?: string } | null>(null);

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      const result = await reenviarActivacionPadre(usuarioId);
      if (result.error) {
        setMsg({ tipo: "error", texto: result.error });
        return;
      }
      setMsg({
        tipo: "success",
        texto: result.success ?? "Email enviado",
        link: result.devLink,
      });
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} disabled={isPending} variant="default" className="w-full">
        <Send className="h-4 w-4" />
        {isPending ? "Enviando..." : "Enviar/Reenviar email de activación"}
      </Button>
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
