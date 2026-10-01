import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { logger } from '../../../shared/utils/logger.js';
import config from '../../../shared/config/index.js';

// Modelo Mongoose de usuarios.
// Cuenta con roles user/barber/admin, autenticación por contraseña hasheada,
// bloqueo por intentos fallidos y campos de recuperación de contraseña.
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder los 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    trim: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Email no válido']
  },
  password: {
    // Hash bcrypt; select:false evita devolverlo en consultas por defecto.
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'barber', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  birthdate: {
    type: Date,
    required: false
  },
  phone: {
    type: String,
    required: false,
    trim: true
  },
  profilePicture: {
    type: String,
    required: false
  },
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    marketingEmails: {
      type: Boolean,
      default: false
    }
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  tokenVersion: {
    type: Number,
    default: 0
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Middleware para validar unicidad del email en save
// Verifica que no exista otro usuario activo con el mismo email y hashea la
// contraseña cuando fue modificada (omite el hash si ya empieza con '$2').
userSchema.pre('save', async function(next) {
  try {
    // Validar email si es nuevo o si el email ha sido modificado
    if (this.isNew || this.isModified('email')) {
      const existingUser = await this.constructor.findOne({
        email: this.email,
        isActive: true,
        _id: { $ne: this._id }
      });
      
      if (existingUser) {
        const error = new Error('El email ya está registrado');
        error.name = 'ValidationError';
        return next(error);
      }
    }

    // Hashear contraseña si ha sido modificada
    if (this.isModified('password')) {
      // Si la contraseña ya está hasheada (empezó con $2), no la hashees de nuevo
      if (this.password && this.password.startsWith('$2')) {
        return next();
      }
      
      const salt = await bcrypt.genSalt(config.security.bcryptRounds);
      this.password = await bcrypt.hash(this.password, salt);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Middleware para validar unicidad del email en update operations
// Aplica a findOneAndUpdate/updateOne y solo comprueba cuando se setea email,
// excluyendo el propio documento por _id.
userSchema.pre(['findOneAndUpdate', 'updateOne'], async function(next) {
  try {
    const update = this.getUpdate();
    
    // Solo validar si se está actualizando el email
    if (update.$set && update.$set.email) {
      const email = update.$set.email;
      const docId = this.getQuery()._id;
      
      const existingUser = await this.model.findOne({
        email: email,
        isActive: true,
        _id: { $ne: docId }
      });
      
      if (existingUser) {
        const error = new Error('El email ya está registrado');
        error.name = 'ValidationError';
        return next(error);
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Índices
userSchema.index({ isActive: 1 });
userSchema.index({ resetPasswordToken: 1 }, { sparse: true });

// Índice único compuesto para email + isActive (solo para usuarios activos)
// Gracias al partialFilterExpression un email puede reutilizarse tras desactivar
// la cuenta anterior, pero no puede duplicarse entre activos.
userSchema.index(
  { email: 1, isActive: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'email_1_isActive_1_unique'
  }
);

userSchema.index({ createdAt: -1 });

// Indica si la cuenta está bloqueada temporalmente por intentos fallidos.
userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Método para comparar contraseñas
// Compara el texto plano con el hash bcrypt del documento; lanza error si el
// campo password no fue cargado (select:false) o si bcrypt falla.
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    if (!this.password) {
      throw new Error('Password not found in user document');
    }
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
  } catch (error) {
    logger.error('Error comparing passwords', { 
      error: error.message,
      userId: this._id
    });
    throw new Error('Error al comparar contraseñas');
  }
};

const User = mongoose.model('User', userSchema);
export default User;