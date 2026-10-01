import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, AppError, logger, config } from '../../../barrel.js';
import emailService from '../../../services/emailService.js';
import { getLocationFromIP, getRealIP } from '../../../shared/utils/geoLocation.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MINUTES = 30;
const JWT_ISSUER = 'the-brothers-barbershop-api';
const JWT_AUDIENCE = 'the-brothers-barbershop-users';
const MAX_REFRESH_AGE_DAYS = 7;

// Casos de uso de autenticación.
// Gestiona login con bloqueo por intentos fallidos, registro público,
// restablecimiento/cambio de contraseña y emisión/validación de JWT con
// tokenVersion para invalidar sesiones al cambiar credenciales.
class AuthUseCases {
  // Login por email/contraseña.
  // Verifica existencia, cuenta activa, bloqueo temporal y hash bcrypt; en fallo
  // incrementa failedLoginAttempts y bloquea 30 min al llegar a 5, reseteando el
  // contador. En éxito limpia el bloqueo, emite JWT y (si el email está
  // configurado) notifica el inicio de sesión sin bloquear la respuesta.
  static async login(email, password, req = null) {
    try {
      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        logger.warn(`Intento de inicio de sesión fallido: usuario no encontrado (${email})`);
        throw new AppError('Credenciales inválidas', 401);
      }

      if (!user.isActive) {
        logger.warn(`Intento de inicio de sesión: cuenta desactivada (${email})`);
        throw new AppError('Cuenta desactivada. Contacta al administrador.', 401);
      }

      // Verificar si la cuenta está bloqueada
      if (user.isLocked()) {
        const remainingMin = Math.ceil((user.lockUntil - Date.now()) / 60000);
        logger.warn(`Intento de login en cuenta bloqueada (${email}), ${remainingMin}min restantes`);
        throw new AppError(`Cuenta bloqueada temporalmente. Intenta en ${remainingMin} minutos.`, 423);
      }

      // Verificar contraseña
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        // Incrementar intentos fallidos
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

        if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
          user.lockUntil = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
          user.failedLoginAttempts = 0;
          logger.warn(`Cuenta bloqueada por ${MAX_FAILED_ATTEMPTS} intentos fallidos: ${email}`);
        }

        await user.save();
        throw new AppError('Credenciales inválidas', 401);
      }

      // Login exitoso - resetear intentos fallidos
      if (user.failedLoginAttempts > 0 || user.lockUntil) {
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
        await user.save();
      }

      // Generar token
      const token = this.generateToken(user);
      const userResponse = this.sanitizeUser(user);

      // Enviar notificación de login (sin bloquear el response)
      if (emailService.isConfigured) {
        const location = req ? getLocationFromIP(getRealIP(req)) : 'Unknown';
        emailService.sendLoginNotification(user, {
          timestamp: new Date(),
          device: 'Web Browser',
          location
        }).catch(err => logger.error('Error enviando notificación de login:', err));
      }

      logger.info(`Inicio de sesión exitoso: ${email}`);
      return { token, user: userResponse };
    } catch (error) {
      logger.error('Error en login:', error);
      throw error;
    }
  }

  // Registro público de usuarios.
  // Rechaza emails ya activos, hashea la contraseña y aplica una whitelist de
  // campos: el rol siempre es 'user' (no se pueden crear admins/barberos aquí).
  static async register(userData) {
    try {
      const existingUser = await User.findOne({
        email: userData.email,
        isActive: true
      });

      if (existingUser) {
        throw new AppError('El email ya está registrado', 400);
      }

      const hashedPassword = await bcrypt.hash(userData.password, config.security.bcryptRounds);

      // Whitelist de campos: el registro público NUNCA puede asignar roles privilegiados
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        phone: userData.phone,
        role: 'user'
      });

      const token = this.generateToken(user);
      const userResponse = this.sanitizeUser(user);

      if (emailService.isConfigured) {
        emailService.sendWelcomeEmail(user)
          .catch(err => logger.error('Error enviando email de bienvenida:', err));
      }

      logger.info(`Nuevo usuario registrado: ${userData.email}`);
      return { token, user: userResponse };
    } catch (error) {
      logger.error('Error en registro:', error);
      throw error;
    }
  }

  // Solicita el restablecimiento de contraseña.
  // Responde siempre el mismo mensaje para no filtrar si el email existe.
  // Guarda solo el hash SHA-256 del token (expira en 1 h) e incrementa
  // tokenVersion para invalidar las sesiones vigentes.
  static async resetPassword(email) {
    try {
      const user = await User.findOne({ email, isActive: true });
      if (!user) {
        return { message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.' };
      }

      const resetToken = this.generateResetToken();
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = Date.now() + 3600000;
      // Invalidar todos los tokens existentes
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      if (emailService.isConfigured) {
        await emailService.sendPasswordResetEmail(user, resetToken);
        logger.info(`Email de reset de contraseña enviado a: ${email}`);
      } else {
        logger.warn(`Servicio de email no configurado. Token de reset [REDACTED]`);
      }

      return { message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña.' };
    } catch (error) {
      logger.error('Error en resetPassword:', error);
      throw error;
    }
  }

  // Cambio de contraseña autenticado.
  // Exige la contraseña actual, hashea la nueva e incrementa tokenVersion para
  // cerrar todas las sesiones; luego envía confirmación por email si aplica.
  static async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new AppError('Usuario no encontrado', 404);
      }

      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        throw new AppError('Contraseña actual incorrecta', 401);
      }

      user.password = await this.hashPassword(newPassword);
      // Invalidar todos los tokens existentes
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      if (emailService.isConfigured) {
        emailService.sendPasswordChangedConfirmation(user)
          .catch(err => logger.error('Error enviando confirmación de cambio de contraseña:', err));
      }

      logger.info(`Contraseña cambiada para usuario: ${user.email}`);
      return { message: 'Contraseña actualizada correctamente' };
    } catch (error) {
      logger.error('Error en changePassword:', error);
      throw error;
    }
  }

  // Restablece la contraseña usando el token enviado por email.
  // Busca por hash SHA-256 y expiración vigente; si es válido actualiza la
  // contraseña, consume el token e invalida las sesiones (tokenVersion).
  static async verifyResetTokenAndUpdatePassword(token, newPassword) {
    try {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new AppError('Token inválido o expirado', 400);
      }

      user.password = await this.hashPassword(newPassword);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      // Invalidar todos los tokens existentes
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      if (emailService.isConfigured) {
        emailService.sendPasswordChangedConfirmation(user)
          .catch(err => logger.error('Error enviando confirmación de cambio de contraseña:', err));
      }

      logger.info(`Contraseña restablecada exitosamente para: ${user.email}`);
      return { message: 'Contraseña restablecida exitosamente' };
    } catch (error) {
      logger.error('Error en verifyResetTokenAndUpdatePassword:', error);
      throw error;
    }
  }

  // Invalidar todos los tokens de un usuario (logout)
  // Incrementa tokenVersion; los JWT con la versión anterior dejan de ser válidos.
  static async invalidateAllTokens(userId) {
    try {
      await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
      logger.info(`Tokens invalidados para usuario: ${userId}`);
    } catch (error) {
      logger.error('Error invalidando tokens:', error);
    }
  }

  // Métodos auxiliares
  // Firma un JWT con id, rol, tokenVersion y jti único. La expiración varía por
  // rol: user 6 h, barber 8 h, admin 4 h (o el valor de config como respaldo).
  static generateToken(user) {
    const expirationTimes = {
      'user': '6h',
      'barber': '8h',
      'admin': '4h'
    };

    const expiresIn = expirationTimes[user.role] || config.jwt.accessExpiresIn;

    return jwt.sign(
      {
        id: user._id,
        role: user.role,
        tokenVersion: user.tokenVersion || 0,
        jti: crypto.randomUUID()
      },
      config.jwt.secret,
      {
        expiresIn,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      }
    );
  }

  // Genera un token aleatorio de 20 bytes en hex para el reset de contraseña.
  static generateResetToken() {
    return crypto.randomBytes(20).toString('hex');
  }

  // Hashea una contraseña con bcrypt usando las rondas configuradas.
  static async hashPassword(password) {
    return bcrypt.hash(password, config.security.bcryptRounds);
  }

  // Elimina del usuario los campos sensibles antes de enviarlo al cliente
  // (password, tokens de reset y contadores de bloqueo).
  static sanitizeUser(user) {
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpires;
    delete userObj.tokenVersion;
    delete userObj.failedLoginAttempts;
    delete userObj.lockUntil;
    return userObj;
  }

  // Refrescar token JWT
  // Verifica tokenVersion y maximum session age
  // Acepta incluso tokens expirados si no superan los 7 días desde su emisión;
  // valida usuario activo y tokenVersion (para revocar sesiones), emite uno nuevo.
  static async refreshToken(token) {
    try {
      let decoded;
      try {
        decoded = jwt.verify(token, config.jwt.secret, {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE
        });
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          decoded = jwt.verify(token, config.jwt.secret, {
            ignoreExpiration: true,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
          });
        } else {
          throw new AppError('Token inválido', 401);
        }
      }

      // Verificar maximum session age (7 días desde emisión)
      const tokenAge = (Date.now() / 1000) - decoded.iat;
      if (tokenAge > MAX_REFRESH_AGE_DAYS * 24 * 60 * 60) {
        throw new AppError('Sesión expirada. Inicia sesión nuevamente.', 401);
      }

      const user = await User.findById(decoded.id);

      if (!user) {
        throw new AppError('Usuario no encontrado', 404);
      }

      if (!user.isActive) {
        throw new AppError('Usuario inactivo. Contacta al administrador.', 401);
      }

      // Verificar tokenVersion - si no coincide, el token fue invalidado
      if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
        throw new AppError('Token invalidado. Inicia sesión nuevamente.', 401);
      }

      const newToken = this.generateToken(user);
      const userResponse = this.sanitizeUser(user);

      logger.info(`Token refrescado para usuario: ${user.email}`);

      return {
        token: newToken,
        user: userResponse
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error en refreshToken:', error);
      throw new AppError('Error al refrescar token', 500);
    }
  }

  // Valida un JWT y devuelve el usuario activo asociado.
  // Verifica firma/issuer/audience, existencia y estado del usuario, y
  // tokenVersion; traduce errores de JWT a AppError 401.
  static async validateToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });
      const user = await User.findById(decoded.id);

      if (!user || !user.isActive) {
        throw new AppError('Token inválido o usuario inactivo', 401);
      }

      // Verificar tokenVersion
      if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
        throw new AppError('Token invalidado', 401);
      }

      return user;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Token inválido', 401);
      }
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Token expirado', 401);
      }
      throw error;
    }
  }
}

export default AuthUseCases;
