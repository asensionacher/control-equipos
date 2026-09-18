# AGENTS.md

Instrucciones para sesiones OpenCode en este repositorio. Solo lo que no se infiere fácilmente leyendo el código o el README.

## Lo que un agente NO descubre fácilmente

El README documenta stack, comandos y estructura. Antes de tocar nada, verifica contra el código actual con `git log`/`grep`, porque ese doc puede estar desactualizado. Engines: `package.json` exige Node `22.x` aunque el README mencione 20+. `postinstall` ejecuta `prisma generate` automáticamente, así que un `npm install` en frío no necesita paso extra de cliente.

### `next.config.mjs` tiene dos quirks que rompen si los tocas

- **`serverExternalPackages: ["pdfkit"]`** — pdfkit lee sus `.afm` desde `__dirname`; si el bundler de Next lo empaqueta falla con `ENOENT`. Déjalo externo y asegúrate de que el `Dockerfile` copia `node_modules/pdfkit` (ya lo hace).
- **`experimental.serverActions.bodySizeLimit: "15mb"`** — fija el límite de subida en Server Actions (justificantes, fotos). Si subes PDFs/fotos grandes, sube esto o divide el flujo en rutas API con su propio `request.formData()`.
- **`images.remotePatterns`** permite `https://**` — los `<Image>` no fallarán por dominio pero conviene restringir en producción.

### Auth vive en dos archivos por el Edge Runtime

- `lib/auth.config.ts` (30 líneas, Edge-safe, sin Prisma ni bcrypt) → lo importa `middleware.ts`.
- `lib/auth.ts` (Credentials + Prisma) → solo server actions / API routes.

Importar `lib/auth.ts` desde el middleware revienta el build en Edge. La verificación real contra BD del usuario (`session.user.id`) vive en `app/(panel)/layout.tsx:26`, no en el middleware.

### Recibos y almacenamiento S3 (CRÍTICO)

- **Numeración de recibos**: `Recibo.id` identifica internamente una emisión/lote. El número oficial autoincremental vive en `ReciboJugador.numero` y se formatea con `formatearNumeroRecibo(numero)` → `#001234`. Cada jugador asignado recibe un número distinto.
- **Asignación**: un Recibo puede relacionarse con varios equipos mediante `equipos` y simultáneamente con jugadores directos. Los jugadores de un equipo quedan también marcados como asignados directamente para conservar una única asignación deduplicada. Al añadir después un jugador al equipo, `sincronizarAsignacionesJugador` hereda los recibos y documentos asociados. `equipoId` solo conserva compatibilidad con registros antiguos. El estado de pago es individual.
- **PDFs** se generan con `lib/pdf-recibo.ts` (pdfkit) en formato español: emisor (de `ConfiguracionClub`), nº de recibo, fecha emisión/vencimiento, receptor (tutor o jugador), concepto, base imponible, IVA, total. Si está pagado, incluye fecha de pago, método y referencia.
- **S3** (MinIO en Docker): claves `recibos/<year>/<id>.pdf` y `justificantes/<year>/<reciboJugadorId>/<timestamp>-<filename>`. El bucket queda **privado** (sin política pública). Nunca se sirven URLs prefirmadas al usuario — siempre se sirve el fichero a través de las rutas API autenticadas (ver abajo), que verifican auth y permisos antes de llamar a `getObjectBuffer` (`lib/s3.ts`).
- **Datos fiscales del club** viven en `ConfiguracionClub` (singleton `id=1`). Editable desde `/admin/configuracion`.
- Al crear/anular/marcar pagos: invalidar el PDF cacheado (`invalidarPdfRecibo`) para que se regenere con los nuevos datos.
- **Permisos del jugador**: el jugador debe tener `usuarioId === session.user.id` O existir una `Tutoria` con `usuarioId === session.user.id` para acceder a un ReciboJugador concreto.

### Consentimientos y avisos agrupados (CRÍTICO)

- Los consentimientos son globales: al crearlos se asignan a todos los jugadores activos y `sincronizarAsignacionesJugador` los asigna también a cada jugador nuevo.
- La firma del jugador/tutor resuelve el consentimiento directamente. No existe validación administrativa; el admin solo puede revocarla, lo que elimina el PDF privado y devuelve la asignación a `PENDIENTE`.
- Los avisos operativos se guardan en `NotificacionPendiente` y se agrupan por email tras una ventana sin novedades. En producción los procesa `scripts/email-digest-worker.js`; activaciones y restablecimientos de contraseña deben seguir usando `enviarEmail` directamente.

### Sincronización Usuario ↔ Jugador (CRÍTICO)

Los datos personales (nombre, apellidos, email, teléfono) viven duplicados en `Usuario` y `Jugador`. Hay que sincronizarlos explícitamente desde `lib/jugador-sync.ts`:

- `getDatosPersonales(jugadorId)` — lee con prioridad: `Jugador.usuario` (cuenta propia) → tutor principal → Jugador.
- `sincronizarDatosPersonalesUsuario(usuarioId)` — propaga cambios al Jugador propio y a tutorados sin Usuario propio.

**Regla**: si añades un punto de edición de Usuario, invoca `sincronizarDatosPersonalesUsuario` o los datos del Jugador quedarán desincronizados.

`app/(panel)/perfil/actions.ts:42` ya lo invoca; cualquier otro punto de edición nuevo debe hacer lo mismo.

### Rutas API que sirven ficheros privados (no las reescribas)

Todas validan sesión y permisos antes de pasar el buffer S3 al cliente (`getObjectBuffer`):

- `/api/recibos/[id]/pdf` — PDF del recibo (admin o jugador/tutor afectado).
- `/api/recibos/jugador/[id]/justificante` — justificante de pago subido.
- `/api/recibos/zip` — descarga masiva (admin).
- `/api/documentos/[id]/archivo` — PDF del documento solicitado.
- `/api/consentimientos/[id]/pdf` — PDF del consentimiento firmado.
- `/api/jugadores/[id]/foto` — foto del jugador.
- `/api/club/logo` — logo del club (para la cabecera de los PDFs).

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

### S3 / MinIO es obligatorio en Docker

Los servicios `s3` y `s3-init` crean el bucket privado. La app espera poder hablar con `s3:9000` desde dentro de la red Docker. Si MinIO no está listo, las rutas `/api/recibos/*` fallarán con errores de conexión.

### Volumen S3 en la máquina host

Los datos de MinIO se montan en `${S3_DATA_DIR:-~/.control-equipos/s3-data}` (definido en `.env`). Si necesitas mover el volumen, cambia esa variable y recrea el contenedor (`docker compose down s3 && docker compose up -d s3`).

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
- No generes URLs prefirmadas de S3 para servir PDFs/justificantes al usuario. Pásalas siempre por las rutas API autenticadas (`/api/recibos/*`).
