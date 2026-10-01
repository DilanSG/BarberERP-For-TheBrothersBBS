import mongoose from 'mongoose';

// Modelo Mongoose del perfil de barbero.
// Vincula a un usuario con su especialidad, horario semanal, servicios que
// atiende, métricas de reseñas y estadísticas acumuladas de ventas.
const barberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El usuario del barbero es requerido'],
    unique: true
  },
  specialty: {
    type: String,
    required: [true, 'La especialidad del barbero es requerida'],
    trim: true,
    maxlength: [100, 'La especialidad no puede exceder los 100 caracteres']
  },
  experience: {
    // Años de experiencia del barbero; alimenta el virtual experienceFormatted.
    type: Number, // en años
    min: [0, 'La experiencia no puede ser negativa'],
    default: 0
  },
  description: {
    type: String,
    maxlength: [500, 'La descripción no puede exceder los 500 caracteres']
  },
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  schedule: {
    // Horario semanal: por día se guarda hora de inicio/fin y si atiende.
    monday: { start: String, end: String, available: Boolean },
    tuesday: { start: String, end: String, available: Boolean },
    wednesday: { start: String, end: String, available: Boolean },
    thursday: { start: String, end: String, available: Boolean },
    friday: { start: String, end: String, available: Boolean },
    saturday: { start: String, end: String, available: Boolean },
    sunday: { start: String, end: String, available: Boolean }
  },
  rating: {
    // Rating en formato anidado (legado). El promedio vigente se mantiene
    // sincronizado en averageRating/totalReviews desde el modelo Review.
    average: {
      type: Number,
      default: 0,
      min: [0, 'El rating no puede ser menor a 0'],
      max: [5, 'El rating no puede ser mayor a 5']
    },
    count: {
      type: Number,
      default: 0
    }
  },
  // Campos adicionales para sistema de reseñas
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isMainBarber: {
    type: Boolean,
    default: false
  },
  photo: {
    public_id: String,
    url: String
  },
  // Estadísticas de ventas
  totalSales: {
    type: Number,
    default: 0,
    min: [0, 'El total de ventas no puede ser negativo']
  },
  totalRevenue: {
    type: Number,
    default: 0,
    min: [0, 'Los ingresos totales no pueden ser negativos']
  },
  lastSaleDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Índices para optimización de consultas
// Soportan listados de barberos activos, principales y filtros por especialidad.
barberSchema.index({ isActive: 1 });
barberSchema.index({ isMainBarber: 1 });
barberSchema.index({ specialty: 1 });
barberSchema.index({ 'rating.average': -1 });
// Índice compuesto para la consulta principal de barberos activos ordenados por principales
barberSchema.index({ isActive: 1, isMainBarber: -1, createdAt: 1 });

// Virtual para años de experiencia formateados
barberSchema.virtual('experienceFormatted').get(function() {
  if (this.experience === 0) return 'Sin experiencia';
  if (this.experience === 1) return '1 año de experiencia';
  return `${this.experience} años de experiencia`;
});

export default mongoose.model('Barber', barberSchema);