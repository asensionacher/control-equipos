import "server-only";
import crypto from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

const ISSUER = process.env.NEXT_PUBLIC_APP_NAME ?? "Control de Equipos";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const CIPHERTEXT_VERSION = "v2";
const LEGACY_PLACEHOLDER = "cambia-esto-por-una-clave-segura-de-al-menos-32-caracteres";

function deriveKey(secret: string, variableName: string): Buffer {
  if (secret.length < 32 || secret === LEGACY_PLACEHOLDER) {
    throw new Error(
      `${variableName} es obligatorio, no puede ser un valor de ejemplo y debe tener al menos 32 caracteres.`
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function getEncryptionKey(): Buffer {
  return deriveKey(process.env.TOTP_ENCRYPTION_KEY ?? "", "TOTP_ENCRYPTION_KEY");
}

function getLegacyEncryptionKey(): Buffer {
  return deriveKey(process.env.AUTH_SECRET ?? "", "AUTH_SECRET");
}

export function cifrarSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CIPHERTEXT_VERSION}:${Buffer.concat([iv, tag, enc]).toString("base64")}`;
}

export function esSecretTotpLegacy(ciphertext: string): boolean {
  return !ciphertext.startsWith(`${CIPHERTEXT_VERSION}:`);
}

export function descifrarSecret(ciphertext: string): string {
  const isCurrentVersion = ciphertext.startsWith(`${CIPHERTEXT_VERSION}:`);
  const encoded = isCurrentVersion
    ? ciphertext.slice(CIPHERTEXT_VERSION.length + 1)
    : ciphertext;
  const data = Buffer.from(encoded, "base64");
  if (data.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("El secret TOTP cifrado no tiene un formato válido.");
  }
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const enc = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(
    ALGO,
    isCurrentVersion ? getEncryptionKey() : getLegacyEncryptionKey(),
    iv
  );
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function generarSecret(): string {
  return generateSecret({ length: 20 });
}

export function generarOtpAuthUri(secret: string, email: string, label?: string): string {
  const account = label?.trim() || email;
  return generateURI({
    strategy: "totp",
    issuer: ISSUER,
    label: account,
    secret,
  });
}

export async function generarQrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
}

export interface TotpVerification {
  valid: boolean;
  timeStep?: number;
}

export function verificarTotp(
  secret: string,
  code: string,
  afterTimeStep?: number | null
): TotpVerification {
  const limpio = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(limpio)) return { valid: false };
  try {
    const result = verifySync({
      strategy: "totp",
      token: limpio,
      secret,
      // Tolerancia: ±30s (un step), ayuda con relojes ligeramente desincronizados.
      epochTolerance: 30,
      ...(afterTimeStep == null ? {} : { afterTimeStep }),
    });
    return result.valid &&
      "timeStep" in result &&
      typeof result.timeStep === "number"
      ? { valid: true, timeStep: result.timeStep }
      : { valid: false };
  } catch {
    return { valid: false };
  }
}
