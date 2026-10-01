// Middleware para manejar rutas no encontradas
export const notFound = (req, res, next) => {
  const error = new Error(`No se encontró ${req.method} ${req.originalUrl}`);
  error.status = 404;
  error.statusCode = 404;
  error.isOperational = true;
  next(error);
};
