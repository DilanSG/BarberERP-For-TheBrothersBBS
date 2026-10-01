# Guía de CI/CD

Documentación del pipeline de integración y despliegue continuo de The Brothers
Barber Shop (BarberERP).

## Resumen

| Elemento | Configuración |
|----------|---------------|
| Plataforma CI | GitHub Actions |
| Workflow principal | `.github/workflows/ci-cd.yml` |
| Workflow de rendimiento | `.github/workflows/lighthouse.yml` |
| Frontend | Vercel (`https://the-bro-barbers.vercel.app`) |
| Backend | Render (`https://thebrothersbarbershop.onrender.com`) |
| Base de datos | MongoDB Atlas |
| Actualización de dependencias | Dependabot (`.github/dependabot.yml`) |

## Pipeline principal (`ci-cd.yml`)

Se ejecuta en cada `push` y `pull_request` hacia `main` y `develop`, y también
puede lanzarse manualmente con `workflow_dispatch`.

| Job | Depende de | Descripción |
|-----|------------|-------------|
| `lint-backend` | - | Instala dependencias del backend y ejecuta ESLint. |
| `test-backend` | `lint-backend` | Ejecuta las pruebas unitarias y genera cobertura. |
| `build-frontend` | - | Compila el frontend con Vite. |
| `security` | - | Ejecuta `npm audit` en backend y frontend (informativo). |
| `deploy-frontend` | `test-backend`, `build-frontend` | Despliega a producción en Vercel (solo `main`). |
| `deploy-backend` | `test-backend` | Dispara el despliegue del backend en Render (solo `main`). |
| `deploy-preview` | `test-backend`, `build-frontend` | Crea un despliegue de vista previa en Vercel y comenta la URL en el pull request. |

Notas:

- El pipeline usa Node.js 22.
- Si un job de validación falla, los despliegues no se ejecutan.
- La cancelación de ejecuciones obsoletas está habilitada mediante `concurrency`.
- Los despliegues de vista previa solo se ejecutan para pull requests del mismo
  repositorio (no para forks).
- Si `VERCEL_TOKEN` o `RENDER_DEPLOY_HOOK_URL` no están configurados, el job
  correspondiente finaliza sin desplegar y sin marcar error.

## Workflow de Lighthouse (`lighthouse.yml`)

Se ejecuta en pull requests que modifican `frontend/**` y en pushes a `main`.
Compila el frontend, sirve el directorio `frontend/dist` y ejecuta Lighthouse CI
con los presupuestos definidos en `lighthouse-budget.json`. Los resultados se
publican como comentario en el pull request y como artefacto de la ejecución.

## Secrets requeridos

Configúralos en `Settings -> Secrets and variables -> Actions`.

| Secreto | Obligatorio | Uso |
|---------|-------------|-----|
| `VERCEL_TOKEN` | Sí, para desplegar frontend | Token personal de Vercel. |
| `VERCEL_ORG_ID` | Sí, para desplegar frontend | Identificador de la organización en Vercel. |
| `VERCEL_PROJECT_ID` | Sí, para desplegar frontend | Identificador del proyecto del frontend. |
| `RENDER_DEPLOY_HOOK_URL` | Sí, para desplegar backend | URL del deploy hook del servicio en Render. |
| `CODECOV_TOKEN` | No | Carga de cobertura a Codecov. |
| `VITE_SENTRY_DSN_FRONTEND` | No | DSN de Sentry usado durante el build. |

### Cómo obtener los valores de Vercel

```bash
# 1. Token personal
#    Vercel Dashboard -> Settings -> Tokens -> Create Token

# 2. Identificadores del proyecto
cd frontend
npx vercel link
cat .vercel/project.json
# orgId     -> VERCEL_ORG_ID
# projectId -> VERCEL_PROJECT_ID
```

### Cómo obtener el deploy hook de Render

```text
Render Dashboard -> servicio del backend -> Settings -> Deploy Hook -> Create
```

Copia la URL generada y guárdala como `RENDER_DEPLOY_HOOK_URL`.

## Configuración de despliegue

### Frontend (Vercel)

- El proyecto debe tener configurado el directorio raíz en `frontend`.
- La configuración del proyecto vive en `frontend/vercel.json`:
  - reescritura de `/api/v1/*` hacia el backend como respaldo,
  - fallback de SPA hacia `/index.html` para las rutas del router,
  - cabeceras de seguridad y caché de assets.
- La URL de la API se define con `VITE_API_URL` en `frontend/.env.production`.

### Backend (Render)

- La infraestructura está declarada en `render.yaml`.
- El directorio raíz del servicio es `backend` (`rootDir`).
- `autoDeploy` está deshabilitado para que el despliegue lo controle el
  pipeline de GitHub Actions.
- Build Command: `npm ci`.
- Start Command: `npm start` (ejecuta `node src/index.js` dentro de `backend`).
- Health Check Path: `/health`.
- Las variables de entorno se configuran en el panel de Render (las marcadas
  con `sync: false` en `render.yaml`).
- Si el servicio no está gestionado por Blueprint, aplica estos mismos valores
  en `Settings -> Build & Deploy` del dashboard. Un Start Command como
  `node backend/src/index.js` falla cuando el Root Directory ya es `backend`.

## Validación local

Antes de subir cambios, ejecuta desde la raíz del repositorio:

```bash
# Lint del backend
npm run lint:backend

# Pruebas unitarias del backend
npm run test:backend

# Build del frontend
npm run build

# Todo junto
npm run validate
```

También puedes ejecutar cada proyecto por separado:

```bash
cd backend
npm run lint
npm run test:unit
npm run test:coverage

cd ../frontend
npm run build
npm run preview
```

## Protección de rama

Si el repositorio usa reglas de protección de rama, configura como checks
requeridos:

- `Lint backend`
- `Test backend`
- `Build frontend`

Los jobs de despliegue solo se ejecutan después de que estos checks pasan.

## Solución de problemas

### El job de pruebas falla

1. Ejecuta `cd backend && npm run test:unit` de forma local.
2. Verifica que `NODE_ENV=test` y `JWT_SECRET` estén definidos en el entorno.
3. Revisa que no haya dependencias sin instalar ejecutando `npm ci`.

### El despliegue a Vercel no se ejecuta

1. Confirma que los secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID` y
   `VERCEL_PROJECT_ID` existen.
2. Verifica que el job `deploy-frontend` solo corre en `push` a `main`.
3. Revisa que el directorio raíz del proyecto en Vercel sea `frontend`.

### El despliegue a Render no se ejecuta

1. Confirma que `RENDER_DEPLOY_HOOK_URL` está configurado.
2. Verifica que el hook siga activo en el panel de Render.
3. Consulta los logs del servicio en Render para errores de build o arranque.

### El backend no inicia en Render (MODULE_NOT_FOUND)

Si el log muestra un error como
`Cannot find module '/opt/render/project/src/backend/backend/src/index.js'`,
el Start Command del servicio está duplicando el directorio raíz. Verifica en
el dashboard, en `Settings -> Build & Deploy`:

- Root Directory: `backend`
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/health`

El comando `node backend/src/index.js` es incorrecto cuando el Root Directory
ya es `backend`, porque la ruta se resuelve dos veces.

### El workflow de Lighthouse falla por presupuesto

1. Revisa el informe publicado en el pull request.
2. Ajusta los límites en `lighthouse-budget.json` si el cambio es intencional.
3. Optimiza los recursos si el presupuesto refleja una regresión real.

## Dependabot

`.github/dependabot.yml` revisa dependencias de backend, frontend y GitHub
Actions. Las actualizaciones se agrupan por ecosistema, se etiquetan y se
asignan al responsable del mantenimiento con prefijos de commit semánticos.
