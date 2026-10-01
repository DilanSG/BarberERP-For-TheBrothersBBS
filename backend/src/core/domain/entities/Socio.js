import mongoose from 'mongoose';

// Modelo Mongoose de socios de la barbería.
// Representa a los dueños (fundador/socio) y su porcentaje de participación,
// vinculados a un usuario admin, con auditoría de quién crea y modifica.
const socioSchema = new mongoose.Schema({
  // Referencia al usuario admin que tendrá el subrol de socio
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'La referencia al usuario es requerida'],
    unique: true
  },
  nombre: {
    type: String,
    required: [true, 'El nombre es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  email: {
    type: String,
    required: [true, 'El email es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Por favor ingrese un email válido'
    ]
  },
  porcentaje: {
    type: Number,
    required: [true, 'El porcentaje de propiedad es requerido'],
    min: [0.01, 'El porcentaje debe ser mayor a 0'],
    max: [100, 'El porcentaje no puede exceder 100']
  },
  // Tipo de socio: 'socio' o 'fundador'
  tipoSocio: {
    type: String,
    enum: ['socio', 'fundador'],
    required: [true, 'El tipo de socio es requerido'],
    default: 'socio'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  fechaIngreso: {
    type: Date,
    default: Date.now
  },
  telefono: {
    type: String,
    trim: true,
    maxlength: [20, 'El teléfono no puede exceder 20 caracteres']
  },
  notas: {
    type: String,
    maxlength: [500, 'Las notas no pueden exceder 500 caracteres']
  },
  // Metadata de auditoría
  creadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  modificadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'socios'
});

// Índices
// Nota: email y userId ya tienen unique: true, no necesitan índices adicionales
socioSchema.index({ tipoSocio: 1 });
socioSchema.index({ isActive: 1 });
socioSchema.index({ createdAt: -1 });

// Middleware pre-save
// Reglas de negocio: solo usuarios admin pueden ser socios, solo puede existir
// un fundador activo y la suma de porcentajes activos no puede exceder 100%.
socioSchema.pre('save', async function(next) {
  // Validar que el usuario sea admin
  const User = mongoose.model('User');
  const user = await User.findById(this.userId);
  if (!user || user.role !== 'admin') {
    throw new Error('Solo los usuarios admin pueden ser socios');
  }

  // Solo permitir un socio fundador activo
  if (this.tipoSocio === 'fundador' && this.isNew) {
    const existingFounder = await this.constructor.findOne({ 
      tipoSocio: 'fundador', 
      isActive: true 
    });
    if (existingFounder) {
      throw new Error('Solo puede haber un socio fundador');
    }
  }

  // Validar que la suma de porcentajes no exceda 100
  // Agrega los demás socios activos (excluyendo este _id) y compara el total
  // disponible contra el porcentaje que se está guardando.
  if (this.isModified('porcentaje') || this.isNew) {
    const totalPorcentaje = await this.constructor.aggregate([
      {
        $match: {
          _id: { $ne: this._id },
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$porcentaje' }
        }
      }
    ]);

    const currentTotal = totalPorcentaje[0]?.total || 0;
    if (currentTotal + this.porcentaje > 100) {
      throw new Error(`La suma de porcentajes excede el 100%. Disponible: ${100 - currentTotal}%`);
    }
  }

  next();
});

// Métodos estáticos
// Devuelve los socios activos con datos básicos del usuario vinculado.
socioSchema.statics.getDistribucionActual = async function() {
  return await this.find({ isActive: true })
    .populate('userId', 'name email role')
    .select('nombre email porcentaje tipoSocio userId');
};

// Reparte una ganancia total proporcionalmente al porcentaje de cada socio y
// agrega la ganancia calculada (exacta y redondeada a pesos enteros).
socioSchema.statics.calcularDistribucion = async function(gananciaTotal) {
  const socios = await this.getDistribucionActual();
  
  return socios.map(socio => ({
    ...socio.toObject(),
    ganancia: (gananciaTotal * socio.porcentaje) / 100,
    gananciaNeta: Math.round((gananciaTotal * socio.porcentaje) / 100)
  }));
};

// Suma (agregación Mongo) los porcentajes de todos los socios activos.
socioSchema.statics.getTotalPorcentajeAsignado = async function() {
  const result = await this.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$porcentaje' }
      }
    }
  ]);

  return result[0]?.total || 0;
};

// Métodos de instancia
// Solo un fundador activo tiene permisos de gestión sobre otros socios.
socioSchema.methods.puedeCrearSocios = function() {
  return this.tipoSocio === 'fundador' && this.isActive;
};

// Misma regla que puedeCrearSocios: aplica para editar/eliminar socios.
socioSchema.methods.puedeEditarSocios = function() {
  return this.tipoSocio === 'fundador' && this.isActive;
};

// Construye los badges visuales del socio (Admin + Fundador/Socio) para la UI.
socioSchema.methods.getBadges = function() {
  const badges = [];
  
  // Badge de Admin (viene del usuario)
  badges.push({
    text: 'Admin',
    color: 'blue',
    bgColor: 'bg-blue-400/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-400/30'
  });

  // Badge de Socio
  if (this.tipoSocio === 'fundador') {
    badges.push({
      text: 'FS',
      color: 'gold',
      bgColor: 'bg-yellow-400/20',
      textColor: 'text-yellow-400',
      borderColor: 'border-yellow-400/30',
      description: 'Socio Fundador'
    });
  } else {
    badges.push({
      text: 'S',
      color: 'gold',
      bgColor: 'bg-yellow-400/20',
      textColor: 'text-yellow-400',
      borderColor: 'border-yellow-400/30',
      description: 'Socio'
    });
  }

  return badges;
};

// Serialización pública: elimina __v antes de enviar el socio al frontend.
socioSchema.methods.toJSON = function() {
  const socio = this.toObject();
  
  // No enviar información sensible al frontend
  delete socio.__v;
  
  return socio;
};

// Validación custom para porcentajes
// Exige un número finito dentro del rango (0, 100] además de las reglas del schema.
socioSchema.path('porcentaje').validate(function(value) {
  return value > 0 && value <= 100 && Number.isFinite(value);
}, 'El porcentaje debe ser un número válido entre 0.01 y 100');

export default mongoose.model('Socio', socioSchema);