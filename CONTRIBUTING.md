# Contribuir a Control de Equipos

Gracias por contribuir. Antes de abrir un pull request, comprueba que el cambio
es pequeño, está documentado y mantiene la privacidad de los datos gestionados
por la aplicación.

Al contribuir aceptas que tu aportación se publique bajo la licencia MIT del
repositorio.

## Preparación local

Requisitos:

- Node.js 24.x
- npm
- PostgreSQL, directamente o mediante Docker Compose

```bash
npm ci
cp .env.example .env
npx prisma db push
npm run dev
```

Genera valores locales distintos para `AUTH_SECRET` y `TOTP_ENCRYPTION_KEY`:

```bash
openssl rand -base64 32
```

No incluyas claves, datos personales, PDFs, justificantes ni volcados de bases
de datos en commits, issues o pull requests.

## Validación

Antes de enviar un pull request:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Para generar el informe de cobertura:

```bash
npm run test:coverage
```

Los pull requests ejecutan automáticamente estos mismos checks. Los workflows
de PR no tienen acceso a secretos de Azure.

## Tests

- Añade tests para cada corrección de error o cambio funcional.
- Prioriza autenticación, permisos, MFA, RGPD, recibos y acceso a archivos
  privados.
- Los tests unitarios se guardan en `tests/` y usan Vitest.
- No conectes los tests unitarios a servicios de producción.

## Base de datos

`prisma/schema.prisma` es la fuente de verdad. Si lo modificas:

```bash
npx prisma format
npx prisma validate
npx prisma generate
```

El proyecto usa actualmente `prisma db push` durante el arranque del contenedor.
No incluyas `prisma/migrations/` salvo que el proyecto adopte explícitamente
migraciones versionadas.

## Pull requests

- Explica el motivo del cambio, no solo su implementación.
- Evita refactors no relacionados.
- Actualiza la documentación afectada.
- No desactives checks, permisos o validaciones para hacer pasar la CI.
- Los cambios de seguridad pueden requerir una revisión adicional del
  propietario del repositorio.

## Despliegues

Fusionar un pull request no despliega a Azure. El despliegue se ejecuta:

- manualmente desde `Deploy image to Azure`; o
- al publicar una GitHub Release.

El job usa el environment `production`, que debe tener revisores obligatorios.
