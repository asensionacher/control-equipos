import "server-only";
import crypto from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

const ISSUER = process.env.NEXT_PUBLIC_APP_NAME ?? "Control de Equipos";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET es obligatorio y debe tener al menos 32 caracteres para cifrar el secret TOTP."
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function cifrarSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getEncryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function descifrarSecret(ciphertext: string): string {
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const enc = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, getEncryptionKey(), iv);
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

export function verificarTotp(secret: string, code: string): boolean {
  const limpio = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(limpio)) return false;
  try {
    const result = verifySync({
      strategy: "totp",
      token: limpio,
      secret,
      // Tolerancia: ±30s (un step), ayuda con relojes ligeramente desincronizados.
      epochTolerance: 30,
    });
    return result.valid === true;
  } catch {
    return false;
  }
}
