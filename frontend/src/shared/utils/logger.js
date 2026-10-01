// Logger centralizado de la aplicación.
// Nivel configurable con VITE_LOG_LEVEL (error < warn < info < debug).
// error/warn siempre salen; info solo en desarrollo; debug/perf/cache/api
// requieren además VITE_DEBUG=true. Los logs salen con prefijo [NIVEL].
// Logging utilities para producción
// Solo logs esenciales y controlados por environment

const isDevelopment = import.meta.env.MODE === 'development';
const isDebugMode = import.meta.env.VITE_DEBUG === 'true';
const logLevel = import.meta.env.VITE_LOG_LEVEL || 'warn';

// Niveles de log: error (0), warn (1), info (2), debug (3)
const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[logLevel] || levels.warn;

export const logger = {
  // Solo errores críticos - siempre se muestran
  error: (...args) => {
    if (currentLevel >= levels.error) {
      console.error('[ERROR]', ...args);
    }
  },
  
  // Warnings importantes - siempre se muestran en warn o superior
  warn: (...args) => {
    if (currentLevel >= levels.warn) {
      console.warn('[WARN]', ...args);
    }
  },
  
  // Info solo en desarrollo o nivel info
  info: (...args) => {
    if (isDevelopment && currentLevel >= levels.info) {
      console.info('[INFO]', ...args);
    }
  },
  
  // Debug solo si está habilitado explícitamente
  debug: (...args) => {
    if (isDevelopment && isDebugMode && currentLevel >= levels.debug) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  // Performance logs solo en debug mode
  perf: (...args) => {
    if (isDevelopment && isDebugMode) {
      console.log('[PERF]', ...args);
    }
  },
  
  // Cache logs solo en debug mode
  cache: (...args) => {
    if (isDevelopment && isDebugMode) {
      console.log('[CACHE]', ...args);
    }
  },
  
  // API logs solo en debug mode
  api: (...args) => {
    if (isDevelopment && isDebugMode) {
      console.log('[API]', ...args);
    }
  }
};

export default logger;