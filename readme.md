# 💈 The Brothers Barber Shop

> **Sistema de gestión integral para barbería con arquitectura empresarial moderna**

Un sistema completo de gestión diseñado específicamente para barberías que combina un backend robusto con Clean Architecture y un frontend React moderno. Incluye gestión de citas, inventario, ventas, reportes financieros, sistema de socios y facturación térmica.

[![License](https://img.shields.io/badge/License-BarberERP%201.0%20Non--Commercial-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-green.svg)](https://mongodb.com/)
[![Security](https://img.shields.io/badge/Security-0%20vulnerabilities-brightgreen.svg)](#seguridad)

## 🧩 Características Principales

### 🏢 **Gestión Empresarial**
- **Sistema de Usuarios Multi-Rol**: Admin, Barbero, Cliente, Socio con permisos granulares
- **Panel de Socios**: Gestión de participaciones, porcentajes y análisis financiero
- **Autenticación JWT**: Tokens diferenciados por rol con refresh automático
- **Monitoreo en Tiempo Real**: Métricas de recursos y performance del sistema

### 💼 **Operaciones de Barbería**
- **Sistema de Citas**: Reservas online con confirmación automática por email
- **Gestión de Barberos**: Perfiles, estadísticas de ventas y performance
- **Catálogo de Servicios**: Precios dinámicos y configuración de duraciones
- **Sistema de Reseñas**: Calificaciones y comentarios de clientes

### 📊 **Gestión Financiera Avanzada**
- **Reportes Ejecutivos**: Dashboard con métricas de ingresos, gastos y rentabilidad
- **Gastos Recurrentes**: Cálculo automático de gastos fijos mensuales
- **Control de Inventario**: Gestión de stock con alertas y snapshots automáticos
- **Facturación Térmica**: Integración con impresoras térmicas 80mm
- **Análisis de Ventas**: Reportes por barbero, período y método de pago

### 🛠️ **Características Técnicas**
- **PWA Ready**: Service Workers y offline capabilities
- **Responsive Design**: Mobile-first con Tailwind CSS
- **Cache Inteligente**: Sistema de cache con TTL dinámico
- **Exports Excel**: Generación automática de reportes en Excel
- **Backup Automático**: Respaldos diarios de MongoDB
- **Logging Avanzado**: Winston con rotación de archivos (30 días)

## ⚙️ Arquitectura General

### 🏗️ **Backend - Clean Architecture**

```
backend/src/
├── core/                          # NÚCLEO DEL SISTEMA
│   ├── domain/                    # Capa de Dominio
│   │   ├── entities/              # 14 Modelos Mongoose
│   │   │   ├── User.js            # Usuarios del sistema
│   │   │   ├── Barber.js          # Perfiles de barberos
│   │   │   ├── Appointment.js     # Sistema de citas
│   │   │   ├── Sale.js            # Ventas y transacciones
│   │   │   ├── Inventory.js       # Control de inventario
│   │   │   ├── Expense.js         # Gastos operacionales
│   │   │   ├── Socio.js           # Sistema de socios
│   │   │   └── ...                # Servicios, Reviews, Facturas
│   │   └── repositories/          # Interfaces Repository Pattern
│   └── application/               # Capa de Aplicación
│       ├── usecases/              # 15 Casos de Uso
│       │   ├── AuthUseCases.js    # Autenticación y autorización
│       │   ├── SaleUseCases.js    # Lógica de ventas
│       │   ├── InventoryUseCases.js # Control de inventario
│       │   └── ...                # Otros casos de uso
│       └── services/              # Servicios de dominio
│
├── infrastructure/                # INFRAESTRUCTURA
│   ├── database/                  # Configuración MongoDB
│   ├── external/                  # APIs externas (Cloudinary)
│   └── cache/                     # Adaptadores de cache
│
├── presentation/                  # PRESENTACIÓN
│   ├── controllers/               # 15 Controladores HTTP
│   ├── middleware/                # 9 Middlewares personalizados
│   └── routes/                    # Definición de rutas API
│
├── services/                      # SERVICIOS DE INFRAESTRUCTURA
│   ├── emailService.js            # Templates y envío SMTP
│   ├── cronJobService.js          # Tareas programadas
│   └── refundService.js           # Lógica de reembolsos
│
└── shared/                        # COMPARTIDO
    ├── config/                    # Configuraciones centralizadas
    ├── utils/                     # Logger, errores, validaciones
    ├── constants/                 # Constantes del sistema
    └── recurring-expenses/        # Módulo unificado de gastos
```

### 🎨 **Frontend - Feature-based Architecture**

```
frontend/src/
├── features/                      # CARACTERÍSTICAS POR DOMINIO
│   ├── admin/                     # Panel administrativo
│   │   ├── AdminBarbers.jsx       # Estadísticas de barberos
│   │   ├── Reports.jsx            # Reportes ejecutivos
│   │   ├── Inventory.jsx          # Gestión de inventario
│   │   └── UserRoleManager.jsx    # Gestión de usuarios
│   ├── appointments/              # Sistema de citas
│   ├── auth/                      # Autenticación y autorización
│   ├── barbers/                   # Panel de barberos
│   └── expenses/                  # Gestión de gastos
│
├── pages/                         # PÁGINAS PRINCIPALES
├── layouts/                       # LAYOUTS COMPARTIDOS
│
└── shared/                        # COMPARTIDO
    ├── components/                # Componentes UI reutilizables
    ├── contexts/                  # Context providers (Auth, Inventory)
    ├── hooks/                     # Custom hooks (useAuth, useLocalStorage)
    ├── services/                  # APIs y servicios HTTP
    └── utils/                     # Utilidades y helpers
```

## 🛠️ Tecnologías Utilizadas

### **Backend - Stack Empresarial**

| Categoría | Tecnología | Versión | Propósito |
|-----------|------------|---------|-----------|
| **Runtime** | Node.js | 20+ | Plataforma JavaScript del servidor |
| **Framework** | Express.js | 4.x | Framework web robusto y minimalista |
| **Base de Datos** | MongoDB | 6+ | Base de datos NoSQL escalable |
| **ODM** | Mongoose | 8.x | Modelado de objetos MongoDB |
| **Autenticación** | JWT | 9.x | Tokens seguros con refresh |
| **Validación** | Express-validator | 7.x | Validación robusta de datos |
| **Logging** | Winston | 3.x | Sistema de logs empresarial |
| **Cache** | node-cache | 5.x | Cache en memoria inteligente |
| **Seguridad** | Helmet + CORS | Latest | Headers seguros y CORS |
| **Rate Limiting** | express-rate-limit | 7.x | Protección DDoS |
| **Sanitización** | express-mongo-sanitize | 2.x | Prevención NoSQL injection |
| **File Upload** | Cloudinary | 2.x | Gestión de archivos en la nube |
| **Email** | Nodemailer | 7.x | Envío de emails SMTP |
| **Documentación** | Swagger | Latest | Documentación API automática |
| **Testing** | Jest + Supertest | 29.x | Testing unitario e integración |

### **Frontend - Stack Moderno**

| Categoría | Tecnología | Versión | Propósito |
|-----------|------------|---------|-----------|
| **Framework** | React | 18+ | Librería UI declarativa |
| **Build Tool** | Vite | 4.x | Build tool ultra-rápido |
| **Routing** | React Router | 6+ | Enrutamiento SPA |
| **Styling** | Tailwind CSS | 3.x | Framework CSS utility-first |
| **Iconos** | Lucide React | Latest | Iconografía consistente SVG |
| **Fechas** | date-fns | 3.x | Manipulación de fechas |
| **Notificaciones** | React Toastify | 11.x | Sistema de notificaciones |
| **Calendar** | React Day Picker | 8.x | Selector de fechas |
| **Excel Export** | ExcelJS | 4.x | Generación de archivos Excel |
| **Estado Global** | React Context | - | Gestión de estado nativa |
| **Monitoreo** | Sentry | 10.x | Error tracking y performance |
| **Analytics** | Vercel Analytics | Latest | Métricas de usuario |

### **DevOps & Deployment**

| Servicio | Propósito | Configuración |
|----------|-----------|---------------|
| **Vercel** | Frontend hosting | Deploy automático desde GitHub |
| **Render** | Backend hosting | Web Service con health checks |
| **MongoDB Atlas** | Base de datos | Cluster cloud con backups |
| **Cloudinary** | File storage | CDN para imágenes y archivos |
| **GitHub Actions** | CI/CD | Lint → Test → Build → Deploy |
| **Dependabot** | Dependencias | Updates automáticos de seguridad |

## 🔄 Flujo General del Sistema

### 1. **Autenticación y Autorización**
```
Cliente/Admin → Login → JWT Token → Verificación de Rol → Acceso a Features
```

### 2. **Gestión de Citas**
```
Cliente → Selecciona Barbero → Elige Fecha/Hora → Confirma Cita → Email Automático
```

### 3. **Operaciones de Venta**
```
Barbero → Registra Servicio/Producto → Selecciona Método de Pago → Genera Factura → Actualiza Inventario
```

### 4. **Reportes Financieros**
```
Admin → Selecciona Período → Sistema Calcula Métricas → Genera Dashboard → Export Excel
```

### 5. **Gestión de Inventario**
```
Sistema → Monitor Stock → Alerta Bajo Stock → Admin Restock → Snapshot Automático
```
### **Configuración de Seguridad**

- **Rate Limiting**: 100 requests/15min general, 5 attempts/15min para auth
- **CORS**: Configurado para dominios permitidos
- **Headers de Seguridad**: Helmet configurado para producción
- **Sanitización**: Protección contra NoSQL injection y XSS
- **Validación**: Express-validator en todos los endpoints críticos

## 📦 Dependencias Principales

### **Backend Core**

| Dependencia | Propósito |
|-------------|-----------|
| `express` | Framework web principal |
| `mongoose` | ODM para MongoDB con validaciones |
| `jsonwebtoken` | Autenticación JWT |
| `bcryptjs` | Hash de contraseñas |
| `helmet` | Headers de seguridad HTTP |
| `cors` | Cross-Origin Resource Sharing |
| `express-validator` | Validación robusta de inputs |
| `winston` | Sistema de logging profesional |
| `node-cache` | Cache en memoria |
| `cloudinary` | Gestión de archivos en la nube |
| `nodemailer` | Envío de emails SMTP |
| `express-rate-limit` | Rate limiting y protección DDoS |

### **Frontend Core**

| Dependencia | Propósito |
|-------------|-----------|
| `react` | Librería UI principal |
| `react-dom` | Renderizado DOM |
| `react-router-dom` | Enrutamiento SPA |
| `tailwindcss` | Framework CSS utility-first |
| `lucide-react` | Iconos SVG optimizados |
| `date-fns` | Manipulación de fechas |
| `react-toastify` | Sistema de notificaciones |
| `exceljs` | Generación de archivos Excel |
| `react-day-picker` | Selector de fechas |
| `@sentry/react` | Error tracking |

## 💡 Decisiones Técnicas y Buenas Prácticas

### **Arquitectura Backend**

- **Clean Architecture**: Separación clara de responsabilidades en capas
- **Domain-Driven Design**: Modelado basado en el dominio de negocio
- **Repository Pattern**: Abstracción de la persistencia de datos
- **Dependency Injection**: Inversión de dependencias para testing
- **Error Handling Centralizado**: Middleware global de manejo de errores
- **Barrel Exports**: Imports centralizados para mejor organización

### **Arquitectura Frontend**

- **Feature-based**: Organización por características de negocio
- **Context API**: Gestión de estado global reactiva
- **Custom Hooks**: Reutilización de lógica entre componentes
- **Path Aliases**: Imports limpios con rutas absolutas
- **Component Composition**: Componentes pequeños y reutilizables
- **Mobile-first**: Diseño responsivo desde mobile

### **Performance y Optimización**

- **Code Splitting**: Chunks inteligentes en el build de Vite
- **Cache Strategy**: TTL dinámico basado en antigüedad de datos
- **Image Optimization**: Cloudinary para transformaciones automáticas
- **Bundle Analysis**: Optimización del tamaño del bundle
- **Lazy Loading**: Carga diferida de componentes pesados

### **Seguridad**

- **JWT Refresh Tokens**: Renovación automática de tokens
- **Rate Limiting**: Protección contra ataques de fuerza bruta
- **Input Sanitization**: Limpieza de datos de entrada
- **SQL Injection Prevention**: Mongoose sanitization
- **XSS Protection**: Headers y limpieza de contenido
- **HTTPS Only**: Cookies seguros en producción


### **Estándares de Código**

- **ESLint**: Configurado para Node.js y React
- **Prettier**: Formateo automático de código
- **Conventional Commits**: Standard para mensajes de commit
- **Clean Code**: Principios SOLID y DRY
- **Documentation**: JSDoc para funciones complejas

## 📄 Licencia

**BarberERP 1.0 — No Comercial (Source-Available)** · Desarrollado por **IntoCod**, programado por **Dilan Acuña**. Ver [`LICENSE`](LICENSE).

- ✅ **Permitido**: usar, estudiar, copiar y **modificar** el código; uso en **entornos propios** (personales/internos).
- ❌ **Prohibido**: cualquier **uso comercial** (vender, cobrar, ofrecerlo como servicio, integrarlo en productos/servicios de pago o usarlo para generar ganancias).
- 🔁 **Derivados**: deben conservar la autoría y distribuirse bajo esta misma licencia.
- 📧 **Contacto**: para licencias comerciales, contactar al equipo de desarrollo (IntoCod / Dilan Acuña).

## 👤 Autor y Equipo

### **Desarrolladora**
- **IntoCode** — *Desarrollo del proyecto (BarberERP)*

### **Desarrollador Principal**
- **Dilan Acuña** - *Arquitectura Full-Stack y Lead Developer*
  - GitHub: [@DilanSG](https://github.com/DilanSG)
  - Especialidad: Clean Architecture, React, Node.js

### **Equipo de Desarrollo**
- **Karl Bustos** - *Product Owner*

### **Reconocimientos**

Agradecimiento especial a:
- Comunidad de **Clean Architecture** por los patrones de diseño
- Equipo de **Vercel** por la plataforma de deployment
- Comunidad **React** y **Express.js** por las herramientas
- Contribuidores de **Open Source** por las dependencias utilizadas

---

## Soporte y Contacto

### **Soporte Técnico**
- **Email**: garaydilan2002@gmail.com
- **Issues**: [GitHub Issues](https://github.com/DilanSG/TheBrothersBarberShop/issues)
- **Documentación**: [Wiki del Proyecto](https://github.com/DilanSG/TheBrothersBarberShop/wiki)

### **Enlaces Importantes**
- **Aplicación**: [The Brothers Barber Shop](https://thebrothers-barbershop.vercel.app)
- **API Docs**: [Swagger Documentation](https://thebrothersbarbershop.onrender.com/api/docs)
- **Status**: [System Status](https://thebrothersbarbershop.onrender.com/api/health)

---

<div align="center">

**Desarrollado por DilanSG**

*Transformando la gestión de barberías con tecnología moderna*

[🏠 Inicio](https://thebrothers-barbershop.vercel.app) • [Documentación](https://github.com/DilanSG/TheBrothersBarberShop/wiki) • [Reportar Bug](https://github.com/DilanSG/TheBrothersBarberShop/issues)

</div>