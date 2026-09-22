import crypto from "node:crypto";
import { generateSecret, generateSync } from "otplib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cifrarSecret,
  descifrarSecret,
  esSecretTotpLegacy,
  verificarTotp,
} from "@/lib/totp";

const AUTH_SECRET = "auth-secret-de-pruebas-con-mas-de-32-caracteres";
const TOTP_KEY = "totp-key-de-pruebas-distinta-con-mas-de-32-caracteres";

function cifrarLegacy(plain: string): string {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(AUTH_SECRET).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

describe("TOTP", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", AUTH_SECRET);
    vi.stubEnv("TOTP_ENCRYPTION_KEY", TOTP_KEY);
  });

  it("cifra los secretos nuevos con formato versionado", () => {
    const encrypted = cifrarSecret("SECRETO-DE-PRUEBA");

    expect(encrypted.startsWith("v2:")).toBe(true);
    expect(esSecretTotpLegacy(encrypted)).toBe(false);
    expect(descifrarSecret(encrypted)).toBe("SECRETO-DE-PRUEBA");
  });

  it("mantiene compatibilidad con secretos cifrados con AUTH_SECRET", () => {
    const encrypted = cifrarLegacy("SECRETO-LEGACY");

    expect(esSecretTotpLegacy(encrypted)).toBe(true);
    expect(descifrarSecret(encrypted)).toBe("SECRETO-LEGACY");
  });

  it("rechaza reutilizar el mismo timestep", () => {
    const secret = generateSecret({ length: 20 });
    const token = generateSync({ strategy: "totp", secret });

    const first = verificarTotp(secret, token);
    expect(first.valid).toBe(true);
    expect(first.timeStep).toBeTypeOf("number");

    const replay = verificarTotp(secret, token, first.timeStep);
    expect(replay).toEqual({ valid: false });
  });

  it.each(["", "12345", "1234567", "abcdef"])(
    "rechaza códigos con formato inválido: %s",
    (token) => {
      expect(verificarTotp("SECRETO", token)).toEqual({ valid: false });
    }
  );
});
