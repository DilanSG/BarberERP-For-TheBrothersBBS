import { logger } from './logger.js';

// Error de aplicación con status HTTP y datos extra.
// @param {string} message - Mensaje para el cliente
// @param {number} statusCode - Código HTTP
// @param {*} details - Detalle adicional (ej. errores de validación)
export class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Errores comunes predefinidos
export const CommonErrors = {
  // Errores de autenticación (401)
  UNAUTHORIZED: new AppError('No autorizado. Por favor inicie sesión', 401),
  INVALID_CREDENTIALS: new AppError('Credenciales inválidas', 401),
  EXPIRED_TOKEN: new AppError('Token expirado. Por favor inicie sesión nuevamente', 401),
  INVALID_TOKEN: new AppError('Token inválido o malformado', 401),

  // Errores de autorización (403)
  FORBIDDEN: new AppError('No tiene permisos para realizar esta acción', 403),
  INSUFFICIENT_PERMISSIONS: new AppError('Permisos insuficientes', 403),

  // Errores de no encontrado (404)
  NOT_FOUND: (resource = 'Recurso') => new AppError(`${resource} no encontrado`, 404),
  USER_NOT_FOUND: new AppError('Usuario no encontrado', 404),
  APPOINTMENT_NOT_FOUND: new AppError('Cita no encontrada', 404),
  SERVICE_NOT_FOUND: new AppError('Servicio no encontrado', 404),
  BARBER_NOT_FOUND: new AppError('Barbero no encontrado', 404),

  // Errores de validación (400)
  VALIDATION_ERROR: (details) => new AppError('Error de validación', 400, details),
  INVALID_ID: new AppError('ID inválido', 400),
  MISSING_FIELDS: (fields) => new AppError(`Campos requeridos faltantes: ${fields.join(', ')}`, 400),
  INVALID_DATE: new AppError('Fecha inválida', 400),

  // Errores de conflicto (409)
  DUPLICATE_EMAIL: new AppError('El email ya está registrado', 409),
  DUPLICATE_APPOINTMENT: new AppError('Ya existe una cita en este horario', 409),
  DUPLICATE_SERVICE: new AppError('Ya existe un servicio con este nombre', 409),

  // Errores de límite excedido (429)
  TOO_MANY_REQUESTS: new AppError('Demasiadas peticiones. Por favor intente más tarde', 429),

  // Errores del servidor (500)
  INTERNAL_SERVER_ERROR: new AppError('Error interno del servidor', 500),
  DB_ERROR: new AppError('Error en la base de datos', 500),
  EMAIL_ERROR: new AppError('Error enviando email', 500),

  // Errores de negocio (422)
  INVALID_APPOINTMENT_STATUS: new AppError('Estado de cita inválido', 422),
  PAST_DATE: new AppError('No se pueden agendar citas en fechas pasadas', 422),
  INVALID_TIME_SLOT: new AppError('Horario no disponible', 422),
  INSUFFICIENT_STOCK: new AppError('Stock insuficiente', 422),
  INVALID_OPERATION: (message) => new AppError(message, 422)
};

// Función para manejar errores
// Envía una respuesta JSON uniforme; en desarrollo incluye stack y error completo.
// @param {Error} err - Error capturado
// @param {Object} res - Response de Express
export const handleError = (err, res) => {
  const { statusCode = 500, message, status = 'error', details, isOperational = false } = err;
  
  // Preparar la respuesta de error
  const response = {
    success: false,
    status,
    message,
    details
  };

  // En desarrollo, incluir información adicional
  if (process.env.NODE_ENV === 'development') {
    response.error = err;
    response.stack = err.stack;
    response.isOperational = isOperational;
  }

  // Log del error
  if (!isOperational) {
    logger.error('ERROR NO OPERACIONAL :', err);
  }

  res.status(statusCode).json(response);
};

// Wrapper para manejar errores en funciones asíncronas
// @param {Function} fn - Handler async de Express
// @returns {Function} Handler que reenvía los rechazos a next()
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
