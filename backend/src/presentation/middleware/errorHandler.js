import mongoose from 'mongoose';
import { AppError, CommonErrors, logger } from '../../barrel.js';

// Convierte un CastError de Mongoose (formato de valor inválido) en AppError 400.
const handleCastErrorDB = err => {
  const message = `Valor inválido ${err.value} para el campo ${err.path}`;
  return new AppError(message, 400);
};

// Convierte el error de clave duplicada (código 11000) en AppError 400 extrayendo el valor del mensaje.
const handleDuplicateFieldsDB = err => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Valor duplicado: ${value}. Por favor use otro valor`;
  return new AppError(message, 400);
};

// Agrupa los mensajes de validación de Mongoose en un único AppError 400.
const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Datos inválidos. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Mapea un token JWT malformado al error común predefinido INVALID_TOKEN.
const handleJWTError = () => CommonErrors.INVALID_TOKEN;

// Mapea un token JWT expirado al error común predefinido EXPIRED_TOKEN.
const handleJWTExpiredError = () => CommonErrors.EXPIRED_TOKEN;

// Traduce los códigos de error de Multer (tamaño o campo inesperado) a AppError 400.
const handleMulterError = err => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('El archivo es demasiado grande. Máximo 5MB permitido.', 400);
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Tipo de archivo no permitido', 400);
  }
  return new AppError('Error procesando el archivo', 400);
};

const sendErrorDev = (err, req, res) => {
  // API
  if (req.originalUrl && req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode || 500).json({
      success: false,
      status: err.status || 'error',
      message: err.message || 'Error interno del servidor',
      stack: err.stack,
      ...(err.details && { details: err.details })
    });
  }

  // Renderizado Web
  res.status(err.statusCode || 500).json({
    title: 'Something went wrong!',
    message: err.message || 'Error interno del servidor'
  });
};

const sendErrorProd = (err, req, res) => {
  // A) API
  if (req.originalUrl && req.originalUrl.startsWith('/api')) {
    // Error operacional, de confianza: enviar mensaje al cliente
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        success: false,
        status: err.status,
        message: err.message,
        ...(err.details && { details: err.details })
      });
    }

    // B) Error de programación u otro: no filtrar detalles
    return res.status(500).json({
      success: false,
      status: 'error',
      message: 'Algo salió mal!'
    });
  }

  // B) Renderizado Web
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      title: 'Something went wrong!',
      message: err.message
    });
  }

  res.status(err.statusCode).json({
    title: 'Something went wrong!',
    message: 'Please try again later.'
  });
};

// Middleware principal de manejo de errores
export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = err;

  // Fuera de desarrollo se normalizan los errores de Mongoose, JWT y Multer
  // para no exponer detalles internos al cliente.
  if (process.env.NODE_ENV !== 'development') {
    error = { ...err };
    error.message = err.message;

    // Errores específicos de Mongoose
    if (error instanceof mongoose.Error.CastError) error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error instanceof mongoose.Error.ValidationError) error = handleValidationErrorDB(error);

    // Errores de JWT
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // Errores de Multer
    if (error.name === 'MulterError') error = handleMulterError(error);
  }

  // Log centralizado: 4xx → warn (mensaje), 5xx → error (con stack)
  const statusCode = error.statusCode || err.statusCode || 500;
  logger.logError(statusCode >= 500 ? err : error, req, statusCode);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    sendErrorProd(error, req, res);
  }
};

// Wrapper async para evitar try-catch
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};