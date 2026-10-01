// Sentry Configuration (Backend - Render)
// Error tracking y performance monitoring para producción
//
// IMPORTANTE: Configurar SENTRY_DSN_BACKEND en Render Dashboard

import * as Sentry from "@sentry/node";
// NOTE: ProfilingIntegration no disponible en @sentry/profiling-node v10.19.0
// import { ProfilingIntegration } from "@sentry/profiling-node";
import { logger } from './logger.js';

// Inicializar Sentry para error tracking
// Solo se activa en producción si SENTRY_DSN_BACKEND está configurado
//
// IMPORTANTE: Deshabilitado temporalmente por problemas de compatibilidad
// que impiden el startup del servidor en Render
export const initSentry = (app) => {
  const dsn = process.env.SENTRY_DSN_BACKEND;
  const environment = process.env.NODE_ENV || 'development';

  // TEMPORALMENTE DESHABILITADO - Sentry @sentry/node v10.19.0 tiene problemas
  // que bloquean el event loop e impiden que el servidor abra el puerto
  logger.warn('Sentry deshabilitado temporalmente (problemas de compatibilidad con v10.19.0)');
  return;

  /* CÓDIGO ORIGINAL - RE-HABILITAR CUANDO SE RESUELVA EL ISSUE
  // Solo inicializar en producción con DSN configurado
  if (!dsn) {
    if (environment === 'production') {
      logger.warn('Sentry no configurado: SENTRY_DSN_BACKEND no definido');
    } else {
      logger.info('Sentry deshabilitado en desarrollo');
    }
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      beforeSend(event, hint) {
        if (event.exception) {
          const error = hint.originalException;
          if (error?.name === 'ValidationError' || error?.statusCode === 400) {
            return null;
          }
        }
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }
        return event;
      },
      ignoreErrors: [
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
        'NetworkError',
        'Non-Error promise rejection',
      ],
    });
    logger.info(`Sentry inicializado en ambiente: ${environment}`);
  } catch (error) {
    logger.error('Error inicializando Sentry:', error.message);
    logger.error('Stack trace:', error.stack);
  }
  */
};

// Middleware para capturar requests en Sentry
// Aplicar ANTES de las rutas
export const sentryRequestHandler = () => {
  const dsn = process.env.SENTRY_DSN_BACKEND;
  if (!dsn) return (req, res, next) => next();
  
  return Sentry.Handlers.requestHandler();
};

// Middleware para capturar errores en Sentry
// Aplicar DESPUÉS de las rutas, ANTES del error handler
export const sentryErrorHandler = () => {
  const dsn = process.env.SENTRY_DSN_BACKEND;
  if (!dsn) return (req, res, next) => next();
  
  return Sentry.Handlers.errorHandler();
};

// Capturar excepción manualmente
// @param {Error} error - Error a reportar
// @param {Object} context - Contexto adicional
export const captureException = (error, context = {}) => {
  const dsn = process.env.SENTRY_DSN_BACKEND;
  if (!dsn) {
    logger.error('Error capturado (Sentry deshabilitado):', { error: error.message, ...context });
    return;
  }
  
  Sentry.captureException(error, {
    extra: context,
  });
};

// Capturar mensaje manual
// @param {string} message - Mensaje a reportar
// @param {string} level - Nivel (info, warning, error)
export const captureMessage = (message, level = 'info') => {
  const dsn = process.env.SENTRY_DSN_BACKEND;
  if (!dsn) {
    logger[level](`Mensaje capturado (Sentry deshabilitado): ${message}`);
    return;
  }
  
  Sentry.captureMessage(message, level);
};

// Agregar contexto de usuario
// @param {Object} user - Usuario autenticado
export const setUser = (user) => {
  const dsn = process.env.SENTRY_DSN_BACKEND;
  if (!dsn) return;
  
  Sentry.setUser({
    id: user.id || user._id,
    email: user.email,
    role: user.role,
  });
};

// Limpiar contexto de usuario (logout)
export const clearUser = () => {
  const dsn = process.env.SENTRY_DSN_BACKEND;
  if (!dsn) return;
  
  Sentry.setUser(null);
};

export default Sentry;
