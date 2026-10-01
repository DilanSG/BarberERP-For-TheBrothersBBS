import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

// Obtener __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de logging (no depende de config para evitar dependencia circular)
const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  dirname: process.env.LOG_DIR || path.join(__dirname, '../../../logs'),
  maxFiles: process.env.LOG_MAX_FILES || '30d',
  maxSize: process.env.LOG_MAX_SIZE || '20m',
};

const appConfig = {
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Niveles de log personalizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Colores para cada nivel
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan'
};

// Añadir colores a Winston
winston.addColors(colors);

// Función para serialización segura de objetos circulares
// @param {Object} obj - Objeto a serializar
// @param {number} space - Indentación de JSON.stringify
// @returns {string} JSON sin referencias circulares
const safeStringify = (obj, space) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, val) => {
    if (val != null && typeof val === 'object') {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  }, space);
};

// Formato para los logs
const HIDDEN_META_KEYS = new Set(['timestamp', 'level', 'message', 'label', 'service', 'environment', 'splat', 'stack']);

const formats = {
  // Formato para consola con colores y emojis
  console: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(info => {
      // Mostrar símbolos solo si LOG_EMOJIS !== 'false' y en desarrollo
      const useSymbols = (process.env.LOG_EMOJIS ?? 'true') !== 'false' && appConfig.nodeEnv === 'development';
      const symbolSet = (process.env.LOG_SYMBOL_SET || 'ascii').toLowerCase();

      const symbolMaps = {
        ascii:   { error: '[ERR]', warn: '[WARN]', info: '[INFO]', http: '[HTTP]', debug: '[DBG]' },
        unicode: { error: '✖',     warn: '⚠',      info: 'ℹ',      http: '⇄',       debug: '🔎'    },
        initials:{ error: 'E',     warn: 'W',      info: 'I',      http: 'H',       debug: 'D'      },
        arrows:  { error: '>>',    warn: '!!',     info: '->',     http: '<>',      debug: '??'     },
        none:    { error: '',      warn: '',       info: '',       http: '',        debug: ''       }
      };

      const symbol = useSymbols ? (symbolMaps[symbolSet] || symbolMaps.ascii) : symbolMaps.none;
      const label = info.label || 'app';

      // info.level viene con códigos ANSI por colorize(): limpiarlos para el lookup
      // eslint-disable-next-line no-control-regex -- se eliminan códigos ANSI de color
      const rawLevel = String(info.level).replace(/\u001b\[[0-9;]*m/g, '');
      const levelSymbol = useSymbols && symbol[rawLevel]
        ? symbol[rawLevel]
        : `[${rawLevel.toUpperCase()}]`;

      // Metadata adicional (status, url, duration, etc.) visible en consola
      const meta = {};
      Object.keys(info).forEach((key) => {
        if (!HIDDEN_META_KEYS.has(key) && info[key] !== undefined) {
          meta[key] = info[key];
        }
      });
      const metaText = Object.keys(meta).length ? ` ${safeStringify(meta)}` : '';

      // Stack trace en consola (errores)
      const stackText = info.stack ? `\n${info.stack}` : '';

      return `${info.timestamp} [${label}] ${levelSymbol} ${info.message}${metaText}${stackText}`;
    })
  ),

  // Formato para archivos (JSON estructurado)
  file: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),

  // Formato para logs de HTTP
  http: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => {
      const { timestamp, level, message } = info;
      return `${timestamp} ${level}: ${message}`;
    })
  )
};

// Transports configurables
// Crea los archivos rotativos (combined/error/http) y la consola según el ambiente.
const createTransports = () => {
  const transports = [];

  // Transport para todos los logs
  transports.push(
    new DailyRotateFile({
      filename: `${loggingConfig.dirname}/%DATE%-combined.log`,
      datePattern: 'YYYY-MM-DD',
      maxFiles: loggingConfig.maxFiles,
      maxSize: loggingConfig.maxSize,
      format: formats.file
    })
  );

  // Transport específico para errores
  transports.push(
    new DailyRotateFile({
      filename: `${loggingConfig.dirname}/%DATE%-error.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: loggingConfig.maxFiles,
      maxSize: loggingConfig.maxSize,
      format: formats.file
    })
  );

  // Transport específico para logs HTTP
  transports.push(
    new DailyRotateFile({
      filename: `${loggingConfig.dirname}/%DATE%-http.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      maxFiles: loggingConfig.maxFiles,
      maxSize: loggingConfig.maxSize,
      format: formats.http
    })
  );

  // En desarrollo, consola con el nivel configurado en LOG_LEVEL (default: info)
  if (appConfig.nodeEnv === 'development') {
    transports.push(
      new winston.transports.Console({
        level: loggingConfig.level,
        format: formats.console
      })
    );
  } else {
    // En producción, solo errores y warnings a consola
    transports.push(
      new winston.transports.Console({
        level: 'warn',
        format: formats.console
      })
    );
  }

  return transports;
};

// Crear el logger
const logger = winston.createLogger({
  level: loggingConfig.level,
  levels,
  defaultMeta: { 
    service: 'the-brothers-barbershop-api',
    environment: appConfig.nodeEnv
  },
  transports: createTransports(),
  // Manejo de excepciones y rechazos no capturados
  exceptionHandlers: [
    new DailyRotateFile({
      filename: `${loggingConfig.dirname}/%DATE%-exceptions.log`,
      datePattern: 'YYYY-MM-DD',
      maxFiles: loggingConfig.maxFiles,
      format: formats.file
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: `${loggingConfig.dirname}/%DATE%-rejections.log`,
      datePattern: 'YYYY-MM-DD',
      maxFiles: loggingConfig.maxFiles,
      format: formats.file
    })
  ],
  exitOnError: false
});

// Métodos de utilidad
// Registra una request HTTP; usa error/warn/http según el status code.
// @param {Object} req - Request de Express
// @param {Object} res - Response de Express
// @param {number} responseTime - Duración en ms
logger.logRequest = (req, res, responseTime) => {
  const meta = {
    requestId: req.requestId || req.id,
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    user: req.user ? req.user._id : 'anonymous'
  };

  const message = `${req.method} ${req.originalUrl} → ${res.statusCode} (${responseTime}ms)`;

  if (res.statusCode >= 500) {
    logger.error(message, meta);
  } else if (res.statusCode >= 400) {
    logger.warn(message, meta);
  } else {
    logger.http(message, meta);
  }
};

// Registra un error: 5xx con stack y nivel error; 4xx con nivel warn.
// @param {Error} error - Error a loguear
// @param {Object} req - Request opcional para añadir contexto
// @param {number} statusCode - Status HTTP opcional
logger.logError = (error, req = null, statusCode = null) => {
  const code = statusCode || error.statusCode || 500;

  const meta = {
    statusCode: code,
    name: error.name,
    ...(code >= 500 && error.stack && { stack: error.stack }),
    ...(error.details && { details: error.details }),
    ...(req && {
      requestId: req.requestId || req.id,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      user: req.user ? req.user._id : 'anonymous'
    })
  };

  const message = `${code} ${error.name || 'Error'}: ${error.message}`;

  if (code >= 500) {
    logger.error(message, meta);
  } else {
    logger.warn(message, meta);
  }
};

// Banner de arranque con el resumen de lo inicializado
// Imprime una caja con el estado de los servicios principales (omite valores vacíos).
// @param {Object} info - Datos de arranque (entorno, puertos, servicios)
logger.logStartup = ({
  nodeEnv,
  port,
  host,
  apiBase,
  docsUrl,
  database,
  email,
  websocket,
  cronJobs,
  monitoring
} = {}) => {
  const rows = [
    ['Entorno', nodeEnv],
    ['Puerto', port],
    ['Host', host],
    ['API', apiBase],
    ['Docs', docsUrl],
    ['Base de datos', database],
    ['Email', email],
    ['WebSocket', websocket],
    ['Cron jobs', cronJobs],
    ['Monitoreo', monitoring],
    ['Node', `${process.version} · pid ${process.pid}`]
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  const keyWidth = Math.max(14, ...rows.map(([key]) => `${key}`.length));
  const width = Math.max(...rows.map(([, value]) => 2 + keyWidth + 1 + `${value}`.length));
  const line = '─'.repeat(width);

  const content = rows
    .map(([key, value]) => `  ${`${key}`.padEnd(keyWidth)} ${value}`)
    .join('\n');

  logger.info(`\n┌${line}┐\n  The Brothers Barber Shop API — iniciada\n${content}\n└${line}┘`);
};

// Stream para Morgan
logger.stream = {
  write: (message) => logger.http(message.trim())
};

// Funciones auxiliares para logging
// Middleware que asigna un requestId y loguea al finalizar la respuesta.
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Agregar requestId al request para tracking
  req.requestId = req.requestId || Math.random().toString(36).substring(7);

  res.on('finish', () => {
    logger.logRequest(req, res, Date.now() - start);
  });

  next();
};

// Middleware de logging de errores
// Loguea el error con su contexto y lo reenvía al siguiente middleware.
export const errorLogger = (error, req, res, next) => {
  logger.logError(error, req);
  next(error);
};

export { logger };