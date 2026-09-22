"use client";

import { use, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { prepararLogin } from "./actions";
import { obtenerRutaLocalSegura } from "@/lib/safe-redirect";

function mensajeInicial(params: {
  registered?: string;
  reset?: string;
  activated?: string;
  expired?: string;
  mfa?: string;
}): string | null {
  if (params.reset) {
    return "Contraseña actualizada. Inicia sesión con tu nueva contraseña.";
  }
  if (params.registered) return "Cuenta creada correctamente. Inicia sesión.";
  if (params.activated) {
    return "Cuenta activada correctamente. Inicia sesión con la contraseña que acabas de elegir.";
  }
  if (params.mfa === "enabled") {
    return "Verificación en dos pasos activada. Inicia sesión de nuevo.";
  }
  if (params.mfa === "disabled") {
    return "Verificación en dos pasos desactivada. Inicia sesión de nuevo.";
  }
  if (params.expired) return "Tu sesión ha caducado. Inicia sesión de nuevo.";
  return null;
}

export function LoginForm({
  searchParams,
  nombreClub,
  tieneLogo,
  colorPrimario,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; registered?: string; reset?: string; activated?: string; expired?: string; mfa?: string }>;
  nombreClub: string;
  tieneLogo: boolean;
  colorPrimario: string;
}) {
  const params = use(searchParams);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(
    params.error ? "Credenciales inválidas" : null
  );
  const [success, setSuccess] = useState<string | null>(mensajeInicial(params));
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [defaultDestination, setDefaultDestination] = useState("/");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      let destination = defaultDestination;
      if (!requiresTwoFactor) {
        const preparation = await prepararLogin(email, password);
        if (!preparation.valid) {
          setError("Email, contraseña o código incorrectos");
          return;
        }
        setDefaultDestination(preparation.redirectTo);
        destination = preparation.redirectTo;
        if (preparation.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          setError(
            "Esta cuenta requiere verificación en dos pasos. Introduce el código de tu app autenticadora."
          );
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        totp: requiresTwoFactor ? code : undefined,
        redirect: false,
      });
      if (result?.code === "requires_2fa") {
        setRequiresTwoFactor(true);
        setError(
          "Esta cuenta requiere verificación en dos pasos. Introduce el código de tu app autenticadora."
        );
        return;
      }
      if (result?.error) {
        setError("Email, contraseña o código incorrectos");
        return;
      }
      router.push(
        params.callbackUrl
          ? obtenerRutaLocalSegura(params.callbackUrl)
          : destination
      );
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="items-center space-y-3 text-center">
        {tieneLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/api/club/logo"
            alt={`Escudo de ${nombreClub}`}
            className="h-24 w-24 object-contain"
          />
        )}
        <div className="space-y-1">
          <CardTitle className="text-2xl">{nombreClub}</CardTitle>
          <CardDescription>Acceso privado</CardDescription>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {success && (
            <Alert variant="success">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Usuario</Label>
            <Input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={requiresTwoFactor}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              {!requiresTwoFactor && (
                <Link href="/recuperar-password" className="text-xs text-blue-600 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              )}
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={requiresTwoFactor}
            />
          </div>
          {requiresTwoFactor && (
            <div className="space-y-2">
              <Label htmlFor="code">Código de verificación (2FA)</Label>
              <Input
                id="code"
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
                required
              />
              <p className="text-xs text-muted-foreground">
                Abre tu app autenticadora (Google Authenticator, Authy, 1Password, etc.)
                e introduce los 6 dígitos que muestra para esta cuenta.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRequiresTwoFactor(false);
                  setCode("");
                  setError(null);
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                ← Volver
              </button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            style={{ backgroundColor: colorPrimario }}
            disabled={isPending || (requiresTwoFactor && code.length !== 6)}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {requiresTwoFactor ? "Verificando…" : "Entrando…"}
              </>
            ) : requiresTwoFactor ? (
              "Verificar y continuar"
            ) : (
              "Entrar"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
