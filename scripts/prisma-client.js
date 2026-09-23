const { PrismaClient } = require("@prisma/client");

const POSTGRES_SCOPE = "https://ossrdbms-aad.database.windows.net/.default";

function getDatabaseAuthMode() {
  const mode = (process.env.DATABASE_AUTH_MODE || "password").trim().toLowerCase();
  if (mode === "password" || mode === "azure-managed-identity") return mode;
  throw new Error(
    `DATABASE_AUTH_MODE no válido: "${mode}". Usa "password" o "azure-managed-identity".`
  );
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatorio con Azure Managed Identity.`);
  return value;
}

function getAzureCredential() {
  const { DefaultAzureCredential } = require("@azure/identity");
  const managedIdentityClientId = process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID?.trim();
  return new DefaultAzureCredential(
    managedIdentityClientId ? { managedIdentityClientId } : undefined
  );
}

function getAzurePostgresConfig() {
  return {
    host: requiredEnv("AZURE_POSTGRES_HOST"),
    port: Number(process.env.AZURE_POSTGRES_PORT || 5432),
    database: requiredEnv("AZURE_POSTGRES_DATABASE"),
    user: requiredEnv("AZURE_POSTGRES_USER"),
    ssl: {
      rejectUnauthorized:
        (process.env.AZURE_POSTGRES_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false",
    },
  };
}

function createPrismaClient() {
  const { PrismaPg } = require("@prisma/adapter-pg");

  if (getDatabaseAuthMode() === "password") {
    const connectionString = (process.env.DATABASE_URL || "").trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL es obligatorio con autenticación por password.");
    }
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  const { entraTokenProvider } = require("@azure/postgresql-auth");
  const { Pool } = require("pg");
  const pool = new Pool({
    ...getAzurePostgresConfig(),
    password: entraTokenProvider(getAzureCredential()),
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    application_name: process.env.NEXT_PUBLIC_APP_NAME || "control-equipos",
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

async function getPrismaCliDatabaseUrl() {
  if (getDatabaseAuthMode() === "password") return process.env.DATABASE_URL;

  const config = getAzurePostgresConfig();
  const accessToken = await getAzureCredential().getToken(POSTGRES_SCOPE);
  if (!accessToken?.token) {
    throw new Error("Azure Managed Identity no devolvió un token para PostgreSQL.");
  }

  const url = new URL("postgresql://localhost");
  url.hostname = config.host;
  url.port = String(config.port);
  url.username = config.user;
  url.password = accessToken.token;
  url.pathname = `/${config.database}`;
  url.searchParams.set("schema", process.env.AZURE_POSTGRES_SCHEMA || "public");
  url.searchParams.set("sslmode", "require");
  return url.toString();
}

module.exports = {
  createPrismaClient,
  getDatabaseAuthMode,
  getPrismaCliDatabaseUrl,
};
