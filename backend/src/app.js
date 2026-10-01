import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import mongoose from 'mongoose';

// Configuraciones
import { config, validateEnv } from './shared/config/index.js';
import { corsOptions } from './shared/config/cors.js';
import { cloudinaryConfig } from './shared/config/cloudinary.js';
import { setupSwagger } from './shared/config/swagger.js';

// Utilidades y middleware
import { logger } from './shared/utils/logger.js';
import { initSentry, sentryRequestHandler, sentryErrorHandler } from './shared/utils/sentry.js';
import { morganMiddleware } from './presentation/middleware/morgan.js';
import { errorHandler } from './presentation/middleware/errorHandler.js';
import { notFound } from './presentation/middleware/notFound.js';
import { globalLimiter } from './presentation/middleware/rateLimiting.js';

// Rutas
import routes from './presentation/routes/index.js';

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validar variables de entorno
try {
  validateEnv();
} catch (error) {
  logger.error('ERROR AL VALIDAR VARIABLES DE ENTORNO:', { error: error.message });
  process.exit(1);
}

// Inicializar Express
const app = express();

// Inicializar Sentry (error tracking en Render)
// DESHABILITADO: Sentry v10.19.0 tiene problemas que bloquean el servidor
initSentry(app);

// Sentry request handler (DEBE ir antes de todas las rutas)
// DESHABILITADO: Los middlewares de Sentry bloquean el event loop en Render
// app.use(sentryRequestHandler());

// Configuración de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // HSTS - Forzar HTTPS en producción (1 año)
  strictTransportSecurity: {
    maxAge: 31536000, // 1 año en segundos
    includeSubDomains: true,
    preload: true
  },
  // Headers adicionales de seguridad
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true,
  noSniff: true,
  frameguard: { action: 'deny' }
}));

// Configuración de CORS
app.use(cors(corsOptions));

// Compresión de respuestas
app.use(compression());

// Rate limiting global (safety net)
app.use(globalLimiter);

// Logging
app.use(morganMiddleware);

// Configurar Swagger
setupSwagger(app);

// Body parsers y sanitización
app.use(express.json({ limit: config.app?.maxFileSize || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: config.app?.maxFileSize || '10mb' }));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Configuración de Cloudinary
cloudinaryConfig();

// Directorio estático para uploads (respaldo para archivos legacy)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Documentación API
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/swagger.yaml'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Rutas de la API
app.use(`/api/${config.app.apiVersion}`, routes);

// Ruta raíz - Bienvenida de la API  
app.get('/', (req, res) => {
  try {
    logger.debug('Root route accessed');
    res.status(200).json({
      success: true,
      service: 'The Brothers Barber Shop API',
      version: 'v1',
      message: 'API funcionando correctamente',
      timestamp: new Date().toISOString(),
      status: 'online'
    });
  } catch (error) {
    logger.error('Error en la ruta raíz', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// Ruta de estado de salud
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    service: 'The Brothers Barber Shop API',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    }
  });
});

// Manejo de rutas no encontradas
app.use(notFound);

// Sentry error handler (DEBE ir DESPUÉS de rutas, ANTES de error handler)
// DESHABILITADO: Los middlewares de Sentry bloquean el event loop en Render
// app.use(sentryErrorHandler());

// Manejo de errores
app.use(errorHandler);

// Manejo de errores no capturados
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION!', { 
    error: err.message, 
    stack: err.stack 
  });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION!', { 
    error: err.message, 
    stack: err.stack 
  });
  process.exit(1);
});

// Exportar la app
export default app;
