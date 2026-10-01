# The Brothers Barber Shop

BarberERP es un sistema de gestión integral para barberías: agenda de citas, punto de venta, inventario, facturación, gastos recurrentes, socios y reportes financieros. El backend está construido con Node.js, Express y MongoDB siguiendo los principios de Clean Architecture; el frontend es una aplicación React con Vite organizada por funcionalidades.

[![CI/CD](https://github.com/DilanSG/BarberERP-For-TheBrothersBBS/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/DilanSG/BarberERP-For-TheBrothersBBS/actions/workflows/ci-cd.yml)
[![License](https://img.shields.io/badge/license-BarberERP%201.0%20Non--Commercial-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8-green.svg)](https://www.mongodb.com/)

## Tabla de contenido

- [Descripción general](#descripción-general)
- [Características](#características)
- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Requisitos previos](#requisitos-previos)
- [Instalación y configuración](#instalación-y-configuración)
- [Scripts disponibles](#scripts-disponibles)
- [API y documentación](#api-y-documentación)
- [Pruebas](#pruebas)
- [CI/CD y despliegue](#cicd-y-despliegue)
- [Seguridad](#seguridad)
- [Licencia](#licencia)
- [Autores](#autores)

## Descripción general

The Brothers Barber Shop resuelve la operación completa de una barbería en una sola plataforma. El sistema cubre el ciclo comercial desde la reserva de una cita hasta el cierre financiero del período, con control de inventario, facturación térmica y un panel de socios.

El backend expone una API REST versionada (`/api/v1`) con autenticación JWT, validación de datos, caché en memoria, limitación de peticiones y documentación Swagger. El frontend consume esa API y ofrece interfaces diferenciadas por rol.

Roles del sistema:

| Rol | Alcance principal |
|-----|-------------------|
| `admin` | Operación completa, reportes, inventario, usuarios y socios |
| `barber` | Agenda propia, registro de ventas y estadísticas personales |
| `user` | Reserva de citas, perfil e historial |
| `socio` | Participaciones, liquidaciones y análisis financiero |

## Características

### Gestión de citas

- Reserva en línea con selección de barbero, servicio y disponibilidad horaria.
- Confirmación y notificación por correo electrónico.
- Estados de cita, reprogramación, cancelación y conversión a venta.
- Vistas diferenciadas para cliente, barbero y administrador.

### Ventas y facturación

- Punto de venta con servicios, productos y carritos de venta.
- Métodos de pago configurables desde la base de datos.
- Facturación online y generación de facturas en PDF/Excel.
- Impresión térmica para impresoras de 58 mm y 80 mm.
- Reembolsos y reversión de operaciones con trazabilidad.
- Facturas de carrito consolidadas por barbero y período.

### Inventario

- Control de stock teórico (`stock`), conteo físico (`realStock`) y registros de venta.
- Movimientos de inventario con historial embebido por producto.
- Alertas de stock bajo y reposición.
- Snapshots de inventario y reinicio de existencias.

### Finanzas y reportes

- Reportes por período, barbero, servicio, categoría y método de pago.
- Resumen financiero con ingresos, gastos y rentabilidad.
- Gastos recurrentes (diarios, semanales, mensuales) con ajustes por día.
- Exportación de reportes a Excel.
- Caché de reportes con TTL dinámico según la antigüedad de los datos.

### Socios

- Registro de socios y porcentajes de participación.
- Cálculo de liquidaciones por período.
- Panel de análisis financiero para la sociedad.

### Infraestructura técnica

- Autenticación JWT con expiración diferenciada por rol y `tokenVersion` para invalidar sesiones.
- Bloqueo temporal de cuentas tras intentos de acceso fallidos.
- Notificaciones en tiempo real con Socket.IO.
- Aplicación web progresiva (service worker, instalable y con soporte offline básico).
- Monitoreo de recursos, métricas internas y registro estructurado con Winston.
- Seguimiento de errores con Sentry y analítica con Vercel Analytics y Speed Insights.
- Documentación de API con Swagger UI.

## Arquitectura

### Backend: Clean Architecture

El backend separa las reglas de negocio de los detalles de infraestructura. Las dependencias apuntan hacia el dominio y los casos de uso se orquestan desde la capa de aplicación.

```text
backend/src/
├── core/
│   ├── domain/
│   │   ├── entities/              # Modelos de dominio (User, Sale, Inventory, ...)
│   │   └── repositories/          # Interfaces de repositorio
│   └── application/
│       ├── usecases/              # Casos de uso (Auth, Sale, Inventory, Invoice, ...)
│       └── services/              # Servicios de aplicación (gastos recurrentes)
├── infrastructure/
│   └── database/repositories/     # Implementaciones de repositorio (Mongoose)
├── presentation/
│   ├── controllers/               # Controladores HTTP
│   ├── middleware/                # Autenticación, validación, caché, errores, rate limiting
│   └── routes/                    # Definición de rutas de la API
├── services/                      # Integraciones: email, impresión, websockets, cron, reembolsos
└── shared/
    ├── config/                    # Configuración (base de datos, CORS, Swagger, Cloudinary)
    ├── constants/                 # Constantes de negocio
    ├── container/                 # Contenedor de inyección de dependencias
    ├── recurring-expenses/        # Cálculo y validación de gastos recurrentes
    └── utils/                     # Logger, errores, fechas, geolocalización
```

### Frontend: arquitectura por funcionalidades

```text
frontend/src/
├── features/
│   ├── admin/                     # Panel administrativo (reportes, inventario, usuarios, servicios)
│   ├── appointments/              # Citas por rol y gestión de disponibilidad
│   ├── auth/                      # Login, registro y rutas protegidas
│   ├── barbers/                   # Perfil y ventas de barberos
│   ├── expenses/                  # Gastos recurrentes
│   └── reviews/                   # Reseñas de clientes
├── pages/                         # Páginas principales de la aplicación
├── shared/
│   ├── components/                # Componentes de interfaz reutilizables
│   ├── config/                    # Configuración de negocio y de API
│   ├── contexts/                  # Providers (Auth, Inventario, Notificaciones, Socket, Tema)
│   ├── hooks/                     # Hooks personalizados
│   ├── services/                  # Clientes HTTP de la API
│   ├── recurring-expenses/        # Lógica compartida de gastos recurrentes
│   └── utils/                     # Formateadores, fechas y utilidades
└── styles/                        # Estilos y tokens de diseño
```

### Flujo de una operación

```text
Autenticación       Cliente/Admin -> Login -> JWT -> Verificación de rol -> Acceso
Citas               Cliente -> Barbero y servicio -> Fecha disponible -> Confirmación -> Email
Venta               Barbero -> Servicios/productos -> Método de pago -> Factura -> Inventario
Reportes            Admin -> Período -> Cálculo de métricas -> Panel -> Exportación
Inventario          Sistema -> Control de stock -> Alerta -> Reposición -> Snapshot
```

## Tecnologías

### Backend

| Categoría | Tecnología | Uso |
|-----------|------------|-----|
| Runtime | Node.js 20+ | Plataforma de ejecución |
| Framework | Express 4 | API REST |
| Base de datos | MongoDB + Mongoose 8 | Persistencia NoSQL |
| Autenticación | JSON Web Token 9, bcryptjs 3 | Sesiones y hash de contraseñas |
| Validación | express-validator 7 | Validación de entradas |
| Seguridad | Helmet 7, express-rate-limit 7, hpp, xss-clean, express-mongo-sanitize | Cabeceras y protección de la API |
| Logging | Winston 3 con rotación diaria, morgan | Registro estructurado |
| Caché | node-cache 5 | Caché en memoria con TTL |
| Archivos | Cloudinary 2, multer | Carga de imágenes |
| Correo | Nodemailer 7, SendGrid 8 | Notificaciones por email |
| Reportes | ExcelJS 4 | Exportación a Excel |
| Impresión | node-thermal-printer 4.5 | Facturación térmica 58/80 mm |
| Tiempo real | Socket.IO 4.8 | Notificaciones |
| Tareas programadas | node-cron 4 | Trabajos recurrentes |
| Documentación | Swagger (swagger-jsdoc, swagger-ui-express) | API docs |
| Observabilidad | Sentry 10 | Seguimiento de errores |
| Pruebas | Jest 29, Supertest 6 | Pruebas unitarias e integración |

### Frontend

| Categoría | Tecnología | Uso |
|-----------|------------|-----|
| Framework | React 18 | Interfaz de usuario |
| Build | Vite 4.5 | Desarrollo y empaquetado |
| Ruteo | React Router 6 | Navegación SPA |
| Estilos | Tailwind CSS 3 | Diseño utility-first |
| Iconos | Lucide React | Iconografía SVG |
| Fechas | date-fns 3, react-day-picker 8, react-calendar 6 | Manejo de fechas |
| Notificaciones | React Toastify 11 | Avisos al usuario |
| Animaciones | GSAP 3.12 | Transiciones |
| Reportes | ExcelJS 4 | Exportación a Excel |
| Tiempo real | Socket.IO Client 4.8 | Comunicación en vivo |
| Observabilidad | Sentry 10, Vercel Analytics, Vercel Speed Insights | Errores y métricas |

### DevOps y despliegue

| Servicio | Propósito |
|----------|-----------|
| Vercel | Hosting del frontend y despliegues de vista previa |
| Render | Hosting del backend (web service) |
| MongoDB Atlas | Base de datos en la nube |
| Cloudinary | Almacenamiento y CDN de imágenes |
| GitHub Actions | Integración y despliegue continuos |
| Dependabot | Actualización de dependencias |

## Requisitos previos

- Node.js 20 o superior.
- npm 9 o superior.
- MongoDB 6 o superior (local o MongoDB Atlas).
- Cuenta de Cloudinary para la carga de imágenes.
- Servidor SMTP (opcional) para el envío de correos.
- Impresora térmica compatible con ESC/POS (opcional) para la facturación física.

## Instalación y configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/DilanSG/BarberERP-For-TheBrothersBBS.git
cd BarberERP-For-TheBrothersBBS
```

### 2. Instalar dependencias

```bash
npm run install:all
```

### 3. Configurar variables de entorno

```bash
npm run setup:dev
```

Este comando crea `backend/.env` y `frontend/.env.local` a partir de los archivos de ejemplo. Ajusta los valores antes de iniciar los servicios.

Variables principales del backend (`backend/.env`):

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | Entorno (`development`, `production`, `test`). |
| `PORT` | Puerto del servidor (por defecto `5000`). |
| `MONGODB_URI` | Cadena de conexión a MongoDB. |
| `JWT_SECRET` | Secreto de firma de tokens (mínimo 32 caracteres). |
| `JWT_REFRESH_EXPIRES_IN` | Vigencia del refresh token (por defecto `30d`). |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Credenciales de Cloudinary. |
| `FRONTEND_URL` | URL pública del frontend para CORS y WebSocket. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` | Servidor SMTP (opcional). |
| `CACHE_TTL`, `CACHE_CHECK_PERIOD` | Configuración de caché en memoria. |
| `LOG_LEVEL`, `LOG_MAX_FILES`, `LOG_MAX_SIZE` | Configuración de logs. |
| `SENTRY_DSN_BACKEND` | DSN de Sentry (opcional). |
| `BUSINESS_*`, `INVOICE_*` | Datos de la empresa para facturación. |

Variables principales del frontend (`frontend/.env.development` o `frontend/.env.local`):

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL base de la API (por defecto `http://localhost:5000/api/v1`). |
| `VITE_WS_URL` | URL del servidor WebSocket (opcional). |
| `VITE_SENTRY_DSN_FRONTEND` | DSN de Sentry para el frontend (opcional). |
| `VITE_DEBUG`, `VITE_LOG_LEVEL` | Nivel de depuración del cliente. |

### 4. Iniciar el entorno de desarrollo

```bash
npm run dev
```

El comando inicia el backend y el frontend en paralelo:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:5000>
- Documentación de la API: <http://localhost:5000/api/docs>

### 5. Datos iniciales (opcional)

```bash
cd backend
npm run seed:init        # Crea servicios, barberos y usuarios base
npm run seed:master      # Población completa de datos de demostración
```

## Scripts disponibles

### Raíz del proyecto

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia backend y frontend en paralelo. |
| `npm run dev:backend` | Inicia solo el backend en modo desarrollo. |
| `npm run dev:frontend` | Inicia solo el frontend con Vite. |
| `npm run build` | Compila el frontend para producción. |
| `npm run install:all` | Instala dependencias de backend y frontend. |
| `npm run setup:dev` | Crea los archivos de entorno de desarrollo. |
| `npm run setup:prod` | Crea el archivo de entorno de producción del backend. |
| `npm run lint:backend` | Ejecuta ESLint sobre el backend. |
| `npm run test:backend` | Ejecuta las pruebas unitarias del backend. |
| `npm run validate` | Ejecuta lint, pruebas y build del frontend. |

### Backend

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor con nodemon. |
| `npm start` | Servidor en modo producción. |
| `npm run lint` | ESLint sobre `src`. |
| `npm test` | Suite completa de Jest. |
| `npm run test:unit` | Pruebas unitarias. |
| `npm run test:integration` | Pruebas de integración. |
| `npm run test:coverage` | Cobertura de pruebas. |
| `npm run seed:init` | Datos base del sistema. |
| `npm run seed:master` | Datos de demostración. |

### Frontend

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo con Vite. |
| `npm run build` | Compilación para producción. |
| `npm run preview` | Vista previa local del build. |

## API y documentación

La API está versionada bajo el prefijo `/api/v1`.

| Recurso | Ruta base |
|---------|-----------|
| Autenticación | `/api/v1/auth` |
| Usuarios | `/api/v1/users` |
| Servicios | `/api/v1/services` |
| Barberos | `/api/v1/barbers` |
| Citas | `/api/v1/appointments` |
| Ventas | `/api/v1/sales` |
| Inventario | `/api/v1/inventory` |
| Snapshots de inventario | `/api/v1/inventory-snapshots` |
| Gastos | `/api/v1/expenses` |
| Métodos de pago | `/api/v1/payment-methods` |
| Socios | `/api/v1/socios` |
| Reembolsos | `/api/v1/refunds` |
| Facturas | `/api/v1/invoices` |
| Reseñas | `/api/v1/reviews` |
| Monitoreo | `/api/v1/monitoring` |

Recursos de operación:

| Recurso | URL |
|---------|-----|
| Documentación Swagger (producción) | <https://thebrothersbarbershop.onrender.com/api/docs> |
| Estado del servicio | <https://thebrothersbarbershop.onrender.com/health> |
| Aplicación web | <https://the-bro-barbers.vercel.app> |

## Pruebas

```bash
# Pruebas unitarias del backend
npm run test:backend

# Suite completa (unitarias e integración, dentro de backend/)
cd backend && npm test

# Cobertura
cd backend && npm run test:coverage
```

Las pruebas usan Jest y Supertest. La configuración se encuentra en `backend/jest.config.js` y el entorno de pruebas en `backend/tests/setupTests.js`.

## CI/CD y despliegue

El proyecto usa GitHub Actions para validar cada cambio y desplegar en `main`.

### Pipeline de integración y despliegue (`ci-cd.yml`)

| Job | Descripción |
|-----|-------------|
| `lint-backend` | ESLint sobre el código del backend. |
| `test-backend` | Pruebas unitarias y cobertura. |
| `build-frontend` | Compilación del frontend con Vite. |
| `security` | Auditoría de dependencias con `npm audit`. |
| `deploy-frontend` | Despliegue del frontend a Vercel (solo `main`). |
| `deploy-backend` | Disparo del despliegue en Render (solo `main`). |
| `deploy-preview` | Despliegue de vista previa por pull request. |

### Workflow de Lighthouse (`lighthouse.yml`)

Ejecuta auditorías de rendimiento, accesibilidad y buenas prácticas sobre el build del frontend, con presupuestos definidos en `lighthouse-budget.json`.

### Secrets requeridos

Configura estos secretos en `Settings -> Secrets and variables -> Actions`:

| Secreto | Uso |
|---------|-----|
| `VERCEL_TOKEN` | Autenticación con Vercel. |
| `VERCEL_ORG_ID` | Identificador de la organización en Vercel. |
| `VERCEL_PROJECT_ID` | Identificador del proyecto en Vercel. |
| `RENDER_DEPLOY_HOOK_URL` | Webhook de despliegue del backend en Render. |
| `CODECOV_TOKEN` | Carga de cobertura a Codecov (opcional). |
| `VITE_SENTRY_DSN_FRONTEND` | DSN de Sentry para el build del frontend (opcional). |

La guía detallada del pipeline está en [`.github/CI_CD_GUIDE.md`](.github/CI_CD_GUIDE.md).

## Seguridad

- Hash de contraseñas con bcrypt y política de fuerza mínima.
- Bloqueo temporal de cuentas tras intentos fallidos consecutivos.
- Tokens JWT con `tokenVersion` para invalidar sesiones al cambiar credenciales.
- Expiración diferenciada por rol: `user` 6 h, `barber` 8 h, `admin` 4 h.
- Sanitización de entradas contra inyección NoSQL y XSS.
- Cabeceras de seguridad con Helmet, incluida HSTS en producción.
- Limitación de peticiones global y por endpoint.
- Validación de esquema en los endpoints críticos con express-validator.
- Auditoría de dependencias en el pipeline de integración continua.

## Licencia

BarberERP 1.0 - No Comercial (Source-Available). Desarrollado por IntoCode, con autoría original de Dilan Acuña. Consulta el archivo [`LICENSE`](LICENSE) para el texto completo.

Resumen no vinculante:

- Permitido: usar, estudiar, copiar y modificar el código en entornos propios.
- Prohibido: cualquier uso comercial sin una licencia comercial escrita.
- Los derivados deben conservar la autoría y distribuirse bajo esta misma licencia.

## Autores

| Nombre | Rol |
|--------|-----|
| Dilan Acuña | Arquitectura full-stack y desarrollo principal ([@DilanSG](https://github.com/DilanSG)) |
| IntoCode | Desarrollo del proyecto BarberERP |
| Karl Bustos | Product Owner |

## Contacto

- Issues: <https://github.com/DilanSG/BarberERP-For-TheBrothersBBS/issues>
- Correo: <garaydilan2002@gmail.com>
