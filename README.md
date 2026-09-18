# Control de Equipos

Sistema web responsive para la gestión de equipos, jugadores y temporadas.

## Stack

- **Next.js 15** (App Router, Server Actions)
- **PostgreSQL** como base de datos
- **Prisma** como ORM
- **Auth.js v5** para autenticación con email + contraseña (bcrypt)
- **TailwindCSS + shadcn/ui** para UI responsive
- **Resend + React Email** para envío de invitaciones
- **Zod** para validación
- **MinIO/S3 o Azure Blob Storage** para almacenamiento privado de archivos
- **PDFKit** para generar los PDFs de los recibos

## Características

- Registro de administradores y jugadores/padres/tutores
- Login con email y contraseña
- Creación de temporadas (ej. 2026/2027)
- Equipos creados por temporada
- Asignación de jugadores a equipos (individual y masiva)
- Sistema de invitaciones por link para vincular jugadores a tutores
- Búsqueda de jugadores por nombre, apellidos o año de nacimiento
- **Emisión de recibos** asignados a uno o varios equipos o a jugadores individuales, con asignaciones editables después de emitirlos. Cada asignación `ReciboJugador` recibe su propio número oficial autoincremental (`#001234`). Los nuevos jugadores de un equipo heredan automáticamente sus recibos y el administrador puede registrar pagos individuales o masivos.
- **Solicitud de documentos** para uno o varios equipos o para jugadores concretos. Los nuevos jugadores de un equipo heredan sus solicitudes; el jugador/tutor sube el PDF y el administrador puede validarlo individualmente o en bloque. Al rechazarlo se elimina del almacenamiento privado y se solicita una nueva subida.
- **Consentimientos globales** asignados automáticamente a todos los jugadores actuales y futuros. Su descripción admite texto enriquecido seguro (negrita, cursiva, subrayado, listas, tamaños y colores), que se conserva en el PDF privado generado al firmar. La firma queda resuelta sin validación adicional y el administrador puede revocarla.
- **Avisos por email agrupados** para recibos, documentos, consentimientos y otras novedades operativas. Los eventos próximos en el tiempo y los distintos hijos de un mismo destinatario se concentran en un único resumen; activaciones de cuenta y cambios de contraseña siempre se envían de forma individual e inmediata.
- **Almacenamiento privado configurable** (S3/MinIO o Azure Blob Storage) para recibos, justificantes, documentos y consentimientos firmados, servido siempre a través de rutas autenticadas.
- Panel de administración con estadísticas
- Ficha del jugador visible para el propio jugador o su tutor
- Diseño 100% responsive

## Requisitos

- Node.js 20+ y npm (para desarrollo local)
- Docker y Docker Compose (para despliegue con contenedores)

## Opción A: Docker (recomendado)

1. **Configurar variables de entorno:**
   ```bash
   cp .env.example .env
   ```
   Edita `.env` y rellena al menos `AUTH_SECRET` (genera uno con `openssl rand -base64 32`).

   El proveedor de archivos se elige con `STORAGE_PROVIDER=s3` (predeterminado)
   o `STORAGE_PROVIDER=azure`. En Azure usa la identidad administrada de App Service:
   ```bash
   STORAGE_PROVIDER=azure
   AZURE_STORAGE_AUTH_MODE=managed-identity
   AZURE_STORAGE_ACCOUNT_URL=https://cuenta.blob.core.windows.net
   AZURE_STORAGE_CONTAINER=control-equipos-documents
   ```
   El contenedor de Azure se crea como privado automáticamente si no existe.
   Cambiar de proveedor no migra los archivos existentes; las claves guardadas en
   PostgreSQL deben existir también en el nuevo bucket o contenedor.

   Para Azure Database for PostgreSQL con la misma identidad administrada:
   ```bash
   DATABASE_AUTH_MODE=azure-managed-identity
   AZURE_POSTGRES_HOST=servidor.postgres.database.azure.com
   AZURE_POSTGRES_PORT=5432
   AZURE_POSTGRES_DATABASE=control_equipos
   AZURE_POSTGRES_USER=nombre-identidad-administrada
   AZURE_POSTGRES_SCHEMA=public
   ```
   Si usas una identidad asignada por el usuario, añade
   `AZURE_MANAGED_IDENTITY_CLIENT_ID`; con una identidad asignada por el sistema
   debe quedar vacío. Fuera de Azure usa `DATABASE_AUTH_MODE=password`. Para
   probar Blob Storage con Azurite o una connection string usa
   `AZURE_STORAGE_AUTH_MODE=connection-string`.

   En Azure debes asignar a la identidad de App Service el rol
   **Storage Blob Data Contributor** sobre la cuenta o el contenedor. En
   PostgreSQL Flexible Server, activa Microsoft Entra authentication, configura
   un administrador Entra y crea el principal:
   ```sql
   SELECT * FROM pgaadauth_create_principal('nombre-identidad-administrada', false, false);
   ```
   Después concédele permisos sobre la base de datos y el esquema. El arranque
   actual ejecuta `prisma db push`, por lo que esa identidad necesita permisos
   DDL además de lectura y escritura.

2. **Arrancar los contenedores:**
   ```bash
   docker compose up -d --build
   ```
   Esto levantará PostgreSQL, MinIO y la aplicación. La primera vez descargará imágenes y compilará la app (puede tardar varios minutos). Si usas Azure y no quieres levantar MinIO, ejecuta `docker compose up -d --build db app`.

   MinIO expone su API en `${S3_PORT:-9000}` y la consola web en `http://localhost:${S3_CONSOLE_PORT:-9001}` (credenciales por defecto: `control-equipos` / `control-equipos-secret`). Los datos se persisten en `${S3_DATA_DIR:-~/.control-equipos/s3-data}`. El bucket por defecto es `control-equipos-documents` y queda configurado como privado.

3. **Cargar datos de prueba (opcional):**
   ```bash
   docker compose exec app npx tsx prisma/seed.ts
   ```

4. Abre [http://localhost:3000](http://localhost:3000).

5. **Comandos útiles:**
   ```bash
   docker compose logs -f app        # Ver logs de la app
   docker compose logs -f db         # Ver logs de PostgreSQL
   docker compose logs -f s3         # Ver logs de MinIO
   docker compose down               # Parar contenedores
   docker compose down -v            # Parar y borrar volúmenes (datos)
   docker compose restart app        # Reiniciar solo la app
   ```

## Opción B: Desarrollo local sin Docker

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   
   Edita `.env` con tus datos:
   ```
   DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/control_equipos?schema=public"
   AUTH_SECRET="una-clave-segura-de-al-menos-32-caracteres"
   AUTH_URL="http://localhost:3000"
   RESEND_API_KEY="re_xxxxxxx"  # Opcional pero recomendado para enviar invitaciones
   EMAIL_FROM="Control Equipos <noreply@tudominio.com>"
   FCF_TRAINER_DEFAULT_PASSWORD="una-contraseña-inicial-segura"
   ```

3. **Inicializar la base de datos:**
   ```bash
   npx prisma db push
   npm run db:seed   # Datos de prueba (opcional)
   ```

4. **Arrancar en desarrollo:**
   ```bash
   npm run dev
   ```

5. Abre [http://localhost:3000](http://localhost:3000).

## Primer uso

- Si la base de datos está vacía, aparecerá un botón para registrar el primer administrador.
- Tras crear el admin, inicia sesión y desde el panel podrás crear temporadas, equipos y jugadores.
- Al crear un jugador con email de tutor, se genera automáticamente una invitación por email.
- Si configuras el Código FCF del club, la importación de equipos crea una cuenta ficticia de
  entrenador para cada equipo sin enviar emails de activación. Las cuentas usan direcciones
  reservadas `@example.invalid` y la contraseña definida en `FCF_TRAINER_DEFAULT_PASSWORD`.

## Datos de prueba (seed)

Tras ejecutar `npm run db:seed` (o `docker compose exec app npx tsx prisma/seed.ts`) tendrás:

- **Admin:** `admin@controldeequipos.es` / `admin123`
- **Padre:** `padre@example.com` / `padre123`
- **Padre/Jugadora** (María, que es jugadora de cadete y madre de Diego): `maria@example.com` / `padrejugador123`
- 2 temporadas, 4 equipos, 5 jugadores (1 sin tutor, 4 con tutor, María es jugador y padre a la vez)

Para ampliar una instalación existente con una demo completa de club:

```bash
npm run db:demo
```

Este comando es idempotente y añade 10 familias, 14 jugadores, 6 equipos con horarios,
recibos pagados y pendientes, una solicitud documental y un consentimiento. Usa únicamente
correos reservados `@demo.example` y escribe directamente con Prisma, por lo que no envía
emails ni crea notificaciones pendientes. Las cuentas demo comparten la contraseña
`DemoFutbol2026!`.

## Scripts disponibles

```bash
npm run dev          # Desarrollo
npm run build        # Build producción
npm run start        # Iniciar producción
npm run lint         # Linter
npm run typecheck    # TypeScript check
npm run db:push      # Sincronizar schema a la DB
npm run db:migrate   # Crear migración
npm run db:studio    # Abrir Prisma Studio
npm run db:seed      # Cargar datos de prueba
npm run db:demo      # Añadir una demo completa sin enviar emails
```

## Estructura del proyecto

```
app/
├── (panel)/                 # Rutas protegidas (requieren login)
│   ├── admin/               # Panel de administrador
│   │   ├── jugadores/       # CRUD jugadores + asignación a equipos
│   │   ├── equipos/         # CRUD equipos + asignación masiva
│   │   ├── temporadas/      # CRUD temporadas
│   │   ├── recibos/         # Emisión y gestión de recibos + PDF
│   │   ├── documentos/      # Solicitud y validación de documentos
│   │   ├── configuracion/   # Datos fiscales del club (emisor de recibos)
│   │   └── usuarios/        # Listado de usuarios
│   └── dashboard/
│       ├── recibos/         # Recibos pendientes/pagados + subida de justificante
│       └── documentos/      # Subida de documentos PDF solicitados
├── api/
│   ├── auth/[...nextauth]/  # NextAuth endpoints
│   ├── recibos/             # Rutas API autenticadas para servir PDFs/justificantes
│   └── documentos/          # Descarga autenticada de documentos privados
├── login/                   # Inicio de sesión
├── registro-admin/          # Registro del primer admin
├── invitacion/[token]/      # Aceptar invitación
├── page.tsx                 # Landing pública
└── layout.tsx
components/ui/               # Componentes shadcn/ui
emails/                      # Plantillas React Email
lib/
├── auth.ts, auth.config.ts  # NextAuth
├── prisma.ts                # Cliente Prisma
├── storage.ts               # Almacenamiento S3/MinIO o Azure Blob
├── s3.ts                    # Reexportación compatible del almacenamiento
├── pdf-recibo.ts            # Generador de PDFs de recibos (formato español)
├── recibo-utils.ts          # Cálculos + métodos de pago
├── jugador-sync.ts          # Sincronización Jugador ↔ Usuario
├── utils.ts                 # Utilidades de formato
└── validaciones.ts          # Schemas Zod
prisma/
├── schema.prisma            # Modelo de datos
├── seed.ts                  # Datos de prueba básicos
└── demo.ts                  # Demo completa e idempotente
```

## Flujo de invitaciones

1. El admin crea un jugador y rellena el email del tutor.
2. El sistema comprueba si ya existe un usuario con ese email:
   - **No existe** → envía email con link de REGISTRO. El tutor crea su cuenta y el jugador queda vinculado.
   - **Sí existe** → genera invitación de VINCULACIÓN. El tutor inicia sesión y el jugador se vincula automáticamente a su cuenta.
3. La invitación caduca en 7 días.

## Notas sobre el email

Si no configuras `RESEND_API_KEY`, el sistema seguirá funcionando pero los emails no se enviarán.
Los links de invitación se generarán igualmente y se mostrarán en pantalla como fallback en algunos casos.
Los avisos operativos se agrupan durante `EMAIL_DIGEST_WINDOW_SECONDS` (120 segundos por defecto) y el trabajador comprueba la cola cada `EMAIL_DIGEST_POLL_SECONDS` (30 segundos por defecto).
Los emails de activación y restablecimiento de contraseña no pasan por esta cola.
Para producción, configura Resend o cualquier otro proveedor SMTP compatible.

## Licencia

MIT
