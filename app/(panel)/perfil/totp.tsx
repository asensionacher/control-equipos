"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import {
  confirmarTotp,
  desactivarTotpPropio,
  iniciarSetupTotp,
} from "./actions";

export function TotpPanel({
  inicial,
  nombreClub,
  forzado,
}: {
  inicial: { totpEnabled: boolean };
  nombreClub: string;
  forzado: boolean;
}) {
  const [estado, setEstado] = useState<"off" | "setup" | "verifying" | "on">(
    inicial.totpEnabled ? "on" : "off"
  );
  const [setup, setSetup] = useState<
    { qrDataUrl: string; secret: string } | null
  >(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  function handleIniciar() {
    setMsg(null);
    startTransition(async () => {
      const res = await iniciarSetupTotp();
      if (res.error) {
        setMsg({ tipo: "error", texto: res.error });
        return;
      }
      if (res.setup) {
        setSetup({ qrDataUrl: res.setup.qrDataUrl, secret: res.setup.secret });
        setEstado("setup");
      }
    });
  }

  function handleVerificar() {
    if (code.replace(/\D/g, "").length !== 6) {
      setMsg({ tipo: "error", texto: "Introduce los 6 dígitos" });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await confirmarTotp(code);
      if (res.error) {
        setMsg({ tipo: "error", texto: res.error });
        return;
      }
      setMsg({ tipo: "success", texto: res.success ?? "Activado" });
      setEstado("on");
      setSetup(null);
      setCode("");
    });
  }

  function handleDesactivar() {
    setMsg(null);
    if (!password) {
      setMsg({ tipo: "error", texto: "Introduce tu contraseña para confirmar" });
      return;
    }
    if (
      !window.confirm(
        "¿Desactivar la verificación en dos pasos? Tu cuenta volverá a estar protegida solo por contraseña."
      )
    ) {
      return;
    }
    const fd = new FormData();
    fd.set("passwordActual", password);
    startTransition(async () => {
      const res = await desactivarTotpPropio(fd);
      if (res.error) {
        setMsg({ tipo: "error", texto: res.error });
        return;
      }
      setMsg({ tipo: "success", texto: res.success ?? "Desactivado" });
      setEstado("off");
      setPassword("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {estado === "on" ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          Verificación en dos pasos
        </CardTitle>
        <CardDescription>
          {estado === "on"
            ? "Activada. Cada vez que inicies sesión tendrás que introducir un código de 6 dígitos además de la contraseña."
            : forzado
              ? `Como administrador, debes activar la verificación en dos pasos para acceder a ${nombreClub}. Es rápida y protege tu cuenta.`
              : "Añade un código de un solo uso desde una app autenticadora (Google Authenticator, Authy, 1Password, etc.) como segunda capa de seguridad. Opcional para tu rol."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <Alert variant={msg.tipo === "error" ? "destructive" : "success"}>
            <AlertDescription>{msg.texto}</AlertDescription>
          </Alert>
        )}

        {estado === "off" && (
          <Button onClick={handleIniciar} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Activar verificación en dos pasos
          </Button>
        )}

        {estado === "setup" && setup && (
          <div className="space-y-4">
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                Abre tu app autenticadora y escanea este código QR.
              </li>
              <li>
                Si no puedes escanearlo, introduce este secreto manualmente:
                <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted px-3 py-2 font-mono text-xs">
                  <span className="flex-1 break-all">{setup.secret}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      navigator.clipboard?.writeText(setup.secret);
                      setMsg({ tipo: "success", texto: "Secreto copiado" });
                    }}
                    aria-label="Copiar secreto"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </li>
              <li>
                Introduce el código de 6 dígitos que muestra la app para confirmar:
              </li>
            </ol>

            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qrDataUrl}
                alt="Código QR para activar segundo factor"
                className="h-48 w-48 rounded border bg-white p-2"
              />
              <div className="flex-1 space-y-3">
                <Label htmlFor="totpCode">Código de 6 dígitos</Label>
                <Input
                  id="totpCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="\d{6}"
                  placeholder="000000"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleVerificar}
                    disabled={isPending || code.length !== 6}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Confirmar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEstado("off");
                      setSetup(null);
                      setCode("");
                      setMsg(null);
                    }}
                    disabled={isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {estado === "on" && (
          <div className="space-y-3">
            <Alert>
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <AlertDescription className="ml-2">
                Activa. La próxima vez que inicies sesión necesitarás un código
                de tu app.
              </AlertDescription>
            </Alert>
            <details className="rounded-md border p-3 text-sm">
              <summary className="cursor-pointer font-medium">
                Desactivar verificación en dos pasos
              </summary>
              <div className="mt-3 space-y-3">
                <Label htmlFor="passwordDisable">
                  Confirma con tu contraseña
                </Label>
                <Input
                  id="passwordDisable"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDesactivar}
                  disabled={isPending || !password}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Desactivar
                </Button>
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
