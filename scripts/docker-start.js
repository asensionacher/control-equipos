const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");

async function waitForDb() {
  const prisma = new PrismaClient();
  const maxAttempts = 30;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("[db] Conexión establecida");
      await prisma.$disconnect();
      return;
    } catch (err) {
      console.log(`[db] Esperando conexión (intento ${attempt}/${maxAttempts})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.error("[db] No se pudo conectar a la base de datos");
  process.exit(1);
}

function runPrismaPush() {
  const { execFileSync } = require("child_process");
  // Buscar el binario de prisma dentro del standalone bundle
  const candidates = [
    path.join(__dirname, "..", "node_modules", "prisma", "build", "index.js"),
    path.join(__dirname, "..", "node_modules", "@prisma", "cli", "build", "index.js"),
  ];

  let prismaBin = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      prismaBin = candidate;
      break;
    }
  }

  if (!prismaBin) {
    console.log("[db] No se encontró el binario de prisma local. Saltando db push (asumimos DB ya inicializada).");
    return;
  }

  console.log("[db] Sincronizando schema...");
  execFileSync("node", [prismaBin, "db", "push", "--skip-generate", "--accept-data-loss"], {
    stdio: "inherit",
    env: process.env,
  });
}

async function main() {
  await waitForDb();
  runPrismaPush();

  console.log("[app] Iniciando servidor Next.js...");
  const { spawn } = require("child_process");
  const child = spawn("node", ["server.js"], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
