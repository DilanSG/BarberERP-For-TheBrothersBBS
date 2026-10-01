import jwt from 'jsonwebtoken';
import User from '../../core/domain/entities/User.js';
import { logger } from '../../shared/utils/logger.js';
import config from '../../shared/config/index.js';

// Valores fijos de issuer/audience que deben coincidir con los usados al firmar los JWT.
const JWT_ISSUER = 'the-brothers-barbershop-api';
const JWT_AUDIENCE = 'the-brothers-barbershop-users';

// Middleware principal de autenticación
// Valida el header Bearer, verifica el JWT (firma, expiración, issuer, audience),
// carga el usuario y deja el documento en req.user. Responde 401 si algo falla.
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. Token no proporcionado.'
      });
    }
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acceso denegado. Token no válido.'
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido - usuario no existe'
      });
    }
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada. Contacta al administrador.'
      });
    }

    // Verificar tokenVersion - detecta tokens invalidados por logout/password change
    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: 'Token invalidado. Inicia sesión nuevamente.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Error en autenticación:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error en el servidor de autenticación'
    });
  }
};

// Verificar si es administrador (requiere protect() previo)
export const adminAuth = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren privilegios de administrador.'
    });
  }
  next();
};

// Verificar si es barbero o admin (requiere protect() previo)
export const barberAuth = (req, res, next) => {
  if (req.user.role !== 'barber' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requieren privilegios de barbero.'
    });
  }
  next();
};

// Verificar si es el mismo usuario o admin
// En rutas /profile compara el usuario autenticado con el dueño del barbero;
// en el resto compara contra el :id de la ruta.
export const sameUserOrAdmin = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return next();
    }

    if (req.path.includes('/profile')) {
      const Barber = (await import('../../core/domain/entities/Barber.js')).default;
      const barber = await Barber.findById(req.params.id);
      if (!barber) {
        return res.status(404).json({
          success: false,
          message: 'Barbero no encontrado'
        });
      }
      if (barber.user.toString() === req.user._id.toString()) {
        return next();
      }
    }
    else if (req.user._id.toString() === req.params.id) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Solo puedes acceder a tu propia información.'
    });
  } catch (error) {
    logger.error('Error en middleware sameUserOrAdmin:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al verificar permisos'
    });
  }
};
