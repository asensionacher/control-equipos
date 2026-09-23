FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN export DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="docker-build-only-auth-secret-not-used-at-runtime" \
    && npx prisma generate \
    && npm run build
RUN node scripts/copy-runtime-deps.js /runtime-node_modules \
    prisma @prisma/adapter-pg pg @azure/identity @azure/postgresql-auth dotenv

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
# Dependencias usadas directamente por los scripts de arranque para PostgreSQL
# con Microsoft Entra ID. Next standalone no rastrea esos scripts externos.
COPY --from=builder --chown=nextjs:nodejs /runtime-node_modules ./node_modules
# pdfkit (Standard PDF fonts como Helvetica, Helvetica-Bold) - necesarios en runtime
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfkit ./node_modules/pdfkit
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "scripts/docker-start.js"]
