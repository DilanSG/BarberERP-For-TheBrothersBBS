import mongoose from 'mongoose';

// Subdocumento embebido que registra cada movimiento de stock de un producto:
// tipo (add/remove/set), cantidad, stock antes/después, motivo, fecha y usuario.
const movementSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['add', 'remove', 'set'],
  },
  quantity: {
    type: Number,
    required: true
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Modelo Mongoose de inventario (productos).
// Además del stock actual guarda contadores acumulados (initialStock, entries,
// exits, sales, realStock) para comparar el stock teórico contra el conteo
// físico, y el historial embebido de movimientos.
const inventorySchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'El código del producto es requerido'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'El nombre del producto es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder los 100 caracteres'],
    unique: true
  },
  description: {
    type: String,
    maxlength: [500, 'La descripción no puede exceder los 500 caracteres']
  },
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: ['cannabicos', 'gorras', 'insumos', 'productos_pelo', 'lociones', 'ceras', 'geles', 'maquinas', 'accesorios', 'otros'],
    default: 'insumos'
  },
  stock: {
    type: Number,
    required: [true, 'El stock es requerido'],
    min: [0, 'El stock no puede ser negativo'],
    validate: {
      validator: Number.isInteger,
      message: 'El stock debe ser un número entero'
    }
  },
  initialStock: {
    type: Number,
    required: [true, 'El stock inicial es requerido'],
    min: [0, 'El stock inicial no puede ser negativo'],
    default: 0
  },
  entries: {
    type: Number,
    default: 0,
    min: [0, 'Las entradas no pueden ser negativas']
  },
  exits: {
    type: Number,
    default: 0,
    min: [0, 'Las salidas no pueden ser negativas']
  },
  sales: {
    type: Number,
    default: 0,
    min: [0, 'Las ventas no pueden ser negativas']
  },
  realStock: {
    type: Number,
    default: 0,
    min: [0, 'El stock real no puede ser negativo'],
    validate: {
      validator: Number.isInteger,
      message: 'El stock real debe ser un número entero'
    }
  },
  minStock: {
    type: Number,
    required: [true, 'El stock mínimo es requerido'],
    min: [0, 'El stock mínimo no puede ser negativo'],
    validate: {
      validator: Number.isInteger,
      message: 'El stock mínimo debe ser un número entero'
    }
  },
  unit: {
    type: String,
    required: [true, 'La unidad es requerida'],
    enum: ['unidad', 'ml', 'g', 'kg', 'l', 'otros'],
    default: 'unidad'
  },
  price: {
    type: Number,
    required: [true, 'El precio es requerido'],
    min: [0, 'El precio no puede ser negativo']
  },
  supplier: {
    name: String,
    contact: String,
    phone: String,
    email: String
  },
  location: {
    type: String,
    required: [true, 'La ubicación es requerida'],
    enum: ['vitrina_grande_1', 'vitrina_grande_2', 'vitrina_pequeña_1', 'vitrina_pequeña_2', 'bodega'],
    default: 'bodega'
  },
  priority: {
    type: String,
    enum: ['baja', 'normal', 'alta', 'urgente'],
    default: 'normal'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  movements: [movementSchema]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtuals para cálculos automáticos
// finalStock: stock teórico del sistema (inicial + entradas - salidas).
inventorySchema.virtual('finalStock').get(function() {
  return this.initialStock + this.entries - this.exits;
});

// stockComparison: diferencia entre el stock real contado y el teórico,
// clasificada como 'sobrante', 'faltante' o 'exacto' con su monto absoluto.
inventorySchema.virtual('stockComparison').get(function() {
  const theoretical = this.finalStock;
  const actual = this.stock;
  const difference = actual - theoretical;
  
  if (difference > 0) {
    return { type: 'sobrante', amount: difference };
  } else if (difference < 0) {
    return { type: 'faltante', amount: Math.abs(difference) };
  } else {
    return { type: 'exacto', amount: 0 };
  }
});

inventorySchema.virtual('stockStatus').get(function() {
  // Clasifica el stock: 'bajo' si está en o por debajo del mínimo,
  // 'medio' hasta 1.5x el mínimo y 'alto' por encima de ese umbral.
  if (this.stock <= this.minStock) {
    return 'bajo';
  } else if (this.stock <= this.minStock * 1.5) {
    return 'medio';
  } else {
    return 'alto';
  }
});

// Índices
// Agilizan filtros por categoría/estado/ubicación, orden por stock y últimos movimientos.
inventorySchema.index({ category: 1 });
inventorySchema.index({ isActive: 1 });
inventorySchema.index({ stock: 1 });
inventorySchema.index({ location: 1 });
inventorySchema.index({ 'movements.date': -1 });

// Validación pre-save para stock mínimo
// Efecto secundario: si el stock cae por debajo del mínimo, sube la prioridad a 'alta'.
inventorySchema.pre('save', function(next) {
  if (this.stock < this.minStock) {
    this.priority = 'alta';
  }
  next();
});

export default mongoose.model('Inventory', inventorySchema);
