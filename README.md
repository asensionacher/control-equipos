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

## Características

- Registro de administradores y jugadores/padres/tutores
- Login con email y contraseña
- Creación de temporadas (ej. 2026/2027)
- Equipos creados por temporada
- Asignación de jugadores a equipos (individual y masiva)
- Sistema de invitaciones por link para vincular jugadores a tutores
- Búsqueda de jugadores por nombre, apellidos o año de nacimiento
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

2. **Arrancar los contenedores:**
   ```bash
   docker compose up -d --build
   ```
   Esto levantará PostgreSQL y la aplicación. La primera vez descargará imágenes y compilará la app (puede tardar varios minutos).

3. **Cargar datos de prueba (opcional):**
   ```bash
   docker compose exec app npx tsx prisma/seed.ts
   ```

4. Abre [http://localhost:3000](http://localhost:3000).

5. **Comandos útiles:**
   ```bash
   docker compose logs -f app        # Ver logs de la app
   docker compose logs -f db         # Ver logs de PostgreSQL
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

## Datos de prueba (seed)

Tras ejecutar `npm run db:seed` (o `docker compose exec app npx tsx prisma/seed.ts`) tendrás:

- **Admin:** `admin@controldeequipos.es` / `admin123`
- **Padre:** `padre@example.com` / `padre123`
- **Padre/Jugadora** (María, que es jugadora de cadete y madre de Diego): `maria@example.com` / `padrejugador123`
- 2 temporadas, 4 equipos, 5 jugadores (1 sin tutor, 4 con tutor, María es jugador y padre a la vez)

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
```

## Estructura del proyecto

```
app/
├── (panel)/                 # Rutas protegidas (requieren login)
│   ├── admin/               # Panel de administrador
│   │   ├── jugadores/       # CRUD jugadores + asignación a equipos
│   │   ├── equipos/         # CRUD equipos + asignación masiva
│   │   ├── temporadas/      # CRUD temporadas
│   │   └── usuarios/        # Listado de usuarios
│   └── dashboard/           # Panel de jugador/padre
├── login/                   # Inicio de sesión
├── registro-admin/          # Registro del primer admin
├── invitacion/[token]/      # Aceptar invitación
├── api/auth/[...nextauth]/  # NextAuth endpoints
├── page.tsx                 # Landing pública
└── layout.tsx
components/ui/               # Componentes shadcn/ui
emails/                      # Plantillas React Email
lib/                         # Utilidades, auth, prisma, validaciones
prisma/
├── schema.prisma            # Modelo de datos
└── seed.ts                  # Datos de prueba
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
Para producción, configura Resend o cualquier otro proveedor SMTP compatible.

## Licencia

MIT
