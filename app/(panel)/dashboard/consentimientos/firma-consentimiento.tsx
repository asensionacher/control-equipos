"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eraser, Loader2, PenLine } from "lucide-react";
import { firmarConsentimiento } from "./actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function FirmaConsentimiento({
  consentimientoJugadorId,
}: {
  consentimientoJugadorId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const drawingRef = useRef(false);
  const [tieneFirma, setTieneFirma] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, rect.width, rect.height);
      context.strokeStyle = "#111827";
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      setTieneFirma(false);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function limpiar() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, rect.width, rect.height);
    setTieneFirma(false);
    setError(null);
    setSuccess(null);
  }

  function firmar() {
    const canvas = canvasRef.current;
    if (!canvas || !tieneFirma) {
      setError("Dibuja tu firma antes de continuar");
      return;
    }
    setError(null);
    setSuccess(null);
    const firma = canvas.toDataURL("image/png");
    startTransition(async () => {
      const result = await firmarConsentimiento(consentimientoJugadorId, firma);
      if (result.error) setError(result.error);
      else {
        setSuccess(result.success ?? "Consentimiento firmado");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <div className="flex items-center gap-2 font-medium">
          <PenLine className="h-4 w-4" />
          Firma
        </div>
        <p className="text-xs text-muted-foreground">
          Firma dentro del recuadro con el dedo, lápiz táctil o ratón.
        </p>
      </div>
      <canvas
        ref={canvasRef}
        className="h-48 w-full touch-none rounded-md border bg-white"
        onPointerDown={(event) => {
          drawingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          const context = event.currentTarget.getContext("2d");
          if (!context) return;
          const point = position(event);
          context.beginPath();
          context.moveTo(point.x, point.y);
        }}
        onPointerMove={(event) => {
          if (!drawingRef.current) return;
          const context = event.currentTarget.getContext("2d");
          if (!context) return;
          const point = position(event);
          context.lineTo(point.x, point.y);
          context.stroke();
          setTieneFirma(true);
        }}
        onPointerUp={(event) => {
          drawingRef.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drawingRef.current = false;
        }}
      />
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert variant="success"><AlertDescription>{success}</AlertDescription></Alert>}
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={limpiar} disabled={isPending}>
          <Eraser className="h-4 w-4" />
          Limpiar
        </Button>
        <Button type="button" onClick={firmar} disabled={isPending || !tieneFirma}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
          Firmar consentimiento
        </Button>
      </div>
    </div>
  );
}
