import cors from 'cors';
import { logger } from '../utils/logger.js';

// Lista de dominios permitidos
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://the-bro-barbers.vercel.app',
  'https://dilansg.github.io',
  process.env.FRONTEND_URL,
  process.env.ALLOWED_ORIGINS?.split(',')
].flat().filter(Boolean);

// Cache de resultados de IPs locales para evitar regex en cada request
const localIPCache = new Set();

// Verifica si un origin corresponde a una IP privada de desarrollo con puerto de Vite.
// Guarda en caché los que ya validó para evitar repetir las regex en cada request.
const isValidLocalIP = (origin) => {
  if (!origin) return false;

  if (localIPCache.has(origin)) return true;

  const patterns = [
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:(5173|5174)$/,
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:(5173|5174)$/,
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:(5173|5174)$/,
    /^http:\/\/127\.\d{1,3}\.\d{1,3}\.\d{1,3}:(5173|5174)$/
  ];

  if (patterns.some(p => p.test(origin))) {
    localIPCache.add(origin);
    return true;
  }

  return false;
};

// Opciones de CORS: permite el listado de origins y las IPs locales de desarrollo;
// las peticiones sin origin (mobile/postman) también se aceptan.
export const corsOptions = {
  origin: function (origin, callback) {
    // Sin origin = permitido (mobile, postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || isValidLocalIP(origin)) {
      return callback(null, true);
    }

    logger.warn(`CORS bloqueado: ${origin}`);
    callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: ['Authorization'],
};

export const corsMiddleware = cors(corsOptions);

export const configureCors = (app) => {
  app.use(corsMiddleware);
  app.options('*', corsMiddleware);
};
