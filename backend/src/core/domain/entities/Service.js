import mongoose from 'mongoose';

// Modelo Mongoose del catálogo de servicios de la barbería.
// Representa cada servicio ofrecido (corte, afeitado, combo, etc.) con su
// precio, duración y banderas de visibilidad para el sitio y el panel.
const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre del servicio es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder los 100 caracteres'],
    unique: true
  },
  description: {
    type: String,
    required: [true, 'La descripción del servicio es requerida'],
    maxlength: [500, 'La descripción no puede exceder los 500 caracteres']
  },
  price: {
    type: Number,
    required: [true, 'El precio del servicio es requerido'],
    min: [0, 'El precio no puede ser negativo']
  },
  duration: {
    // Duración estimada del servicio expresada en minutos (entre 15 y 240).
    type: Number, // en minutos
    required: [true, 'La duración del servicio es requerida'],
    min: [15, 'La duración mínima es 15 minutos'],
    max: [240, 'La duración máxima es 4 horas']
  },
  category: {
    type: String,
    required: [true, 'La categoría del servicio es requerida'],
    enum: ['corte', 'afeitado', 'lavado', 'combo', 'otro']
  },
  isActive: {
    // Si es false el servicio queda oculto para nuevas ventas/citas.
    type: Boolean,
    default: true
  },
  showInHome: {
    // Controla si el servicio se promociona en la página principal.
    type: Boolean,
    default: false
  },
  image: {
    public_id: String,
    url: String
  }
}, {
  timestamps: true
});

// Índices para mejor performance
// Aceleran los listados por categoría y la búsqueda de servicios activos.
serviceSchema.index({ category: 1 });
serviceSchema.index({ isActive: 1 });

export default mongoose.model('Service', serviceSchema);