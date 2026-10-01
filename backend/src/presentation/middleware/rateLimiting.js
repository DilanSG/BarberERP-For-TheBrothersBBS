// Rate Limiting Configuration
// Configuración de límites de tasa personalizados por tipo de endpoint
//
// IMPORTANTE: Previene abuso de API y ataques DoS

import rateLimit from 'express-rate-limit';
import { logger } from '../../shared/utils/logger.js';

// Handler personalizado para cuando se excede el límite
const rateLimitHandler = (req, res) => {
  logger.warn('Rate limit excedido', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('user-agent')
  });

  res.status(429).json({
    success: false,
    message: 'Demasiadas solicitudes. Por favor intenta más tarde.',
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: res.getHeader('Retry-After')
  });
};

// Skip rate limit para rutas internas o de salud
const skipSuccessfulRequests = (req, res) => {
  // No contar requests exitosos de health check
  return req.path === '/api/health' && res.statusCode < 400;
};

// AUTH ENDPOINTS (Login, Register, Password Reset)
// Límite: 5 intentos por 15 minutos
// Razón: Prevenir ataques de fuerza bruta
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 requests por ventana
  message: 'Demasiados intentos de autenticación. Intenta en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Solo contar intentos fallidos
  keyGenerator: (req) => {
    // Rate limit por IP + email para mayor precisión
    const email = req.body?.email || '';
    return `${req.ip}-${email}`;
  }
});

// DATA ENDPOINTS (CRUD operations)
// Límite: 100 requests por minuto
// Razón: Balance entre UX y protección
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 requests por ventana
  message: 'Límite de API excedido. Intenta en 1 minuto.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipSuccessfulRequests
});

// PUBLIC ENDPOINTS (Health, Status, Public Data)
// Límite: 200 requests por minuto
// Razón: Endpoints públicos, menos restricción
export const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 200, // 200 requests por ventana
  message: 'Límite de solicitudes públicas excedido.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

// PAYMENT ENDPOINTS (Ventas, Transacciones)
// Límite: 20 requests por minuto
// Razón: Operaciones críticas, mayor seguridad
export const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // 20 requests por ventana
  message: 'Límite de transacciones excedido. Intenta en 1 minuto.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // Rate limit por IP + usuario autenticado
    const userId = req.user?.id || '';
    return `${req.ip}-${userId}`;
  }
});

// UPLOAD ENDPOINTS (Imágenes, Archivos)
// Límite: 10 uploads por hora
// Razón: Prevenir abuso de almacenamiento
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 uploads por ventana
  message: 'Límite de uploads excedido. Intenta en 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

// EMAIL ENDPOINTS (Notificaciones, Recuperación)
// Límite: 3 emails por hora
// Razón: Prevenir spam
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 emails por ventana
  message: 'Límite de emails excedido. Intenta en 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // Rate limit por email destino
    const email = req.body?.email || req.user?.email || '';
    return `${req.ip}-${email}`;
  }
});

// REPORT ENDPOINTS (Reportes pesados)
// Límite: 30 requests por hora
// Razón: Queries costosas, proteger DB
export const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30, // 30 requests por ventana
  message: 'Límite de reportes excedido. Intenta en 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

// SEARCH ENDPOINTS (Búsquedas)
// Límite: 50 requests por minuto
// Razón: Balance entre UX y carga DB
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 50, // 50 requests por ventana
  message: 'Límite de búsquedas excedido. Intenta en 1 minuto.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

// Rate limiter dinámico basado en rol de usuario
// Usuarios premium/admin tienen límites más altos
export const dynamicLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 1 * 60 * 1000,
    max: async (req) => {
      // Límites por rol
      const role = req.user?.role;
      
      switch (role) {
        case 'admin':
        case 'socio':
          return options.adminMax || 500; // Sin límites prácticos
        case 'barber':
          return options.barberMax || 200;
        case 'client':
          return options.clientMax || 50;
        default:
          return options.defaultMax || 100;
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler
  });
};

// Configuración de rate limiting por defecto para toda la app
// Aplicar en app.js
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requests por ventana (muy permisivo, safety net)
  message: 'Límite global de API excedido.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req) => {
    // No limitar rutas internas
    return req.path.startsWith('/api/health') || req.path.startsWith('/api/metrics');
  }
});

// Exportar todas las configuraciones
export const RATE_LIMIT_CONFIG = {
  auth: { windowMs: 15 * 60 * 1000, max: 5 },
  api: { windowMs: 1 * 60 * 1000, max: 100 },
  public: { windowMs: 1 * 60 * 1000, max: 200 },
  payment: { windowMs: 1 * 60 * 1000, max: 20 },
  upload: { windowMs: 60 * 60 * 1000, max: 10 },
  email: { windowMs: 60 * 60 * 1000, max: 3 },
  report: { windowMs: 60 * 60 * 1000, max: 30 },
  search: { windowMs: 1 * 60 * 1000, max: 50 },
  global: { windowMs: 15 * 60 * 1000, max: 1000 }
};

export default {
  auth: authLimiter,
  api: apiLimiter,
  public: publicLimiter,
  payment: paymentLimiter,
  upload: uploadLimiter,
  email: emailLimiter,
  report: reportLimiter,
  search: searchLimiter,
  dynamic: dynamicLimiter,
  global: globalLimiter
};
