import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { entraTokenProvider } from "@azure/postgresql-auth";
import { Pool } from "pg";
import { getAzureCredential } from "./azure-credential";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

type DatabaseAuthMode = "password" | "azure-managed-identity";

function getDatabaseAuthMode(): DatabaseAuthMode {
  const mode = (process.env.DATABASE_AUTH_MODE ?? "password").trim().toLowerCase();
  if (mode === "password" || mode === "azure-managed-identity") return mode;
  throw new Error(
    `DATABASE_AUTH_MODE no válido: "${mode}". Usa "password" o "azure-managed-identity".`
  );
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatorio con Azure Managed Identity.`);
  return value;
}

function createPrismaClient(): PrismaClient {
  const log = process.env.NODE_ENV === "development" ? ["error", "warn"] as const : ["error"] as const;

  if (getDatabaseAuthMode() === "password") {
    return new PrismaClient({ log: [...log] });
  }

  const pool = new Pool({
    host: requiredEnv("AZURE_POSTGRES_HOST"),
    port: Number(process.env.AZURE_POSTGRES_PORT ?? 5432),
    database: requiredEnv("AZURE_POSTGRES_DATABASE"),
    user: requiredEnv("AZURE_POSTGRES_USER"),
    password: entraTokenProvider(getAzureCredential()),
    ssl: {
      rejectUnauthorized:
        (process.env.AZURE_POSTGRES_SSL_REJECT_UNAUTHORIZED ?? "true").toLowerCase() !== "false",
    },
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    application_name: process.env.NEXT_PUBLIC_APP_NAME ?? "control-equipos",
  });

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: [...log],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
