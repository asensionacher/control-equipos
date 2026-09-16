# AGENTS.md

Instrucciones para sesiones OpenCode en este repositorio. Solo lo que no se infiere fácilmente leyendo el código o el README.

## Lo que un agente descubre solo

- **Stack**: Next.js 15 (App Router + Server Actions) + PostgreSQL 16 + Prisma 5 + Auth.js v5 beta + Tailwind + shadcn/ui + Resend + Zod.
- **Comandos básicos**: `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run db:push`, `npm run db:seed`.
- **Setup Docker**: `cp .env.example .env` → rellenar `AUTH_SECRET` (`openssl rand -base64 32`) → `docker compose up -d --build`.
- **Estructura de directorios**: ver `README.md` (ya documentada allí).

## Lo que un agente NO descubre fácilmente

### Sincronización Usuario ↔ Jugador (CRÍTICO)

Los datos personales (nombre, apellidos, email, teléfono) viven duplicados en `Usuario` y `Jugador`. Hay que sincronizarlos explícitamente desde `lib/jugador-sync.ts`:

- `getDatosPersonales(jugadorId)` — lee con prioridad: `Jugador.usuario` (cuenta propia) → tutor principal → Jugador.
- `sincronizarDatosPersonalesUsuario(usuarioId)` — propaga cambios al Jugador propio y a tutorados sin Usuario propio.

**Regla**: si añades un punto de edición de Usuario, invoca `sincronizarDatosPersonalesUsuario` o los datos del Jugador quedarán desincronizados.

Páginas que ya usan el helper: ficha jugador admin, ficha jugador tutor, dashboard del usuario, ficha del padre.

### Auth tiene dos archivos con propósitos distintos

- `lib/auth.config.ts` — Edge-safe (sin Prisma ni bcrypt). Lo importa el middleware.
- `lib/auth.ts` — incluye Credentials provider y Prisma. Lo usan server actions.

**Por qué importa**: si importas `lib/auth.ts` desde el middleware, bcryptjs rompe Edge Runtime. La verificación contra BD del usuario vive en `app/(panel)/layout.tsx`, no en el middleware.

### Sesión obsoleta tras resetear la BD

Si reseteas la BD (ej. `DROP SCHEMA public CASCADE`), los JWT existentes apuntan a usuarios que ya no existen. Síntomas:

- FK violation `PendingRegistration_creadoPorId_fkey` al crear entidades.
- Redirect loop al intentar acceder.

**Fix**: las server actions verifican que `session.user.id` existe en BD antes de usarlo como FK (`creadoPorId`), y si no existe devuelven error o usan `null`. El `layout.tsx` también redirige a `/login?expired=1`.

### Email en desarrollo sin API key

Si `RESEND_API_KEY` está vacía, las actions devuelven `{ ok: false }` y:

- El link de invitación/activación se imprime en logs del servidor.
- El form lo muestra en pantalla con un alert amarillo (`devLink`).

No hace falta manejar esto manualmente — los callers ya reciben `devLink` en la respuesta.

### `output: "standalone"` rompe `npm start`

`next.config.mjs` tiene `output: "standalone"`. Si haces `npm run build` y luego `npm start`, sale un warning y no funciona correctamente. Usa `node .next/standalone/server.js` o el entrypoint del Dockerfile (`node scripts/docker-start.js`).

### El entrypoint del contenedor espera a la DB y hace `db push`

`scripts/docker-start.js` se ejecuta al arrancar el contenedor. Espera a que la DB responda (hasta 30 intentos × 2s) y luego ejecuta `prisma db push --skip-generate --accept-data-loss` antes de arrancar Next. **No es opcional**: si lo arrancas sin esto, fallará porque la BD estará vacía.

### Schema compartido entre código y Dockerfile

`prisma/schema.prisma` es la fuente de verdad. El `Dockerfile` copia:

- `prisma/` (para `db push`)
- `node_modules/.prisma` y `node_modules/@prisma` (cliente generado)
- `node_modules/prisma` (CLI para `db push`)

Si cambias el schema, **debes rebuildear la imagen** (`docker compose build app`).

## Convenciones del código

- **Server Components hacen `prisma.X.findUnique` directamente** — no fetch a API routes propias.
- **Páginas con formularios** tienen server action + form cliente con `useTransition`. Ver `app/(panel)/admin/jugadores/form.tsx` como referencia.
- **Páginas dinámicas con datos de BD** casi siempre llevan `export const dynamic = "force-dynamic";` para evitar errores de prerender.
- **Validación con Zod centralizada** en `lib/validaciones.ts`. Un schema por dominio (jugador, temporada, equipo, perfil).
- **Tras `update`/`create`** siempre llamar a `revalidatePath(...)` para los paths afectados.
- **Formato de fechas**: usar `formatearFecha()` de `lib/utils.ts` (siempre dd/mm/yyyy) y `formatearFechaInput()` (yyyy-mm-dd). Nunca `Date.toLocaleDateString()` directo.
- **UI components** están en `components/ui/`. No crear nuevos si ya existe uno similar.
- **Email no editable desde el perfil** (solo admin). El campo está disabled en `/perfil`.
- **Tutor solo lo cambia el admin** desde la ficha del jugador.

## Lo que NO debes hacer

- No commitees `tsconfig.tsbuildinfo`, `.env`, `.next/` o `node_modules/` (ya están en `.gitignore`).
- No uses `next start` con `output: "standalone"`.
- No agregues `passwordHash` editable en formularios del usuario (excepto admin). Va por flujo de activación + recuperación.
- No asumas sesión válida en server actions: verifica `session.user.id` contra BD antes de usar como FK.
- No llames `prisma` directamente desde el middleware (Edge Runtime no lo soporta).
- No crees una sección de "datos del tutor" en fichas de jugador — el modelo nuevo usa la tabla `Tutoria` que apunta a `Usuario`.
