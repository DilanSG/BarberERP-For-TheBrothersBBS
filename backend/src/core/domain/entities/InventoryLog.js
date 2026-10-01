import mongoose from 'mongoose';

// Modelo Mongoose de auditoría del inventario.
// Registra cada acción relevante (creación, actualización, ajustes de stock,
// entradas/salidas y ventas) con el usuario que la realizó y su estado previo/nuevo.
const inventoryLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['create', 'update', 'delete', 'stock_adjustment', 'movement_entry', 'movement_exit', 'sale']
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: function() {
      // Solo es requerido si no es una venta de carrito
      // (las ventas pueden agrupar varios ítems y no apuntan a un único itemId).
      return this.action !== 'sale';
    }
  },
  itemName: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userRole: {
    type: String,
    required: true,
    enum: ['admin', 'barber']
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  message: {
    type: String
  },
  reason: {
    type: String
  },
  notes: {
    type: String
  },
  quantity: {
    type: Number
  },
  oldStock: {
    type: Number
  },
  newStock: {
    type: Number
  },
  totalAmount: {
    type: Number
  },
  previousState: {
    type: mongoose.Schema.Types.Mixed
  },
  newState: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para consultas eficientes
// Optimizan los listados cronológicos y el filtrado por usuario, ítem o acción.
inventoryLogSchema.index({ timestamp: -1 });
inventoryLogSchema.index({ performedBy: 1, timestamp: -1 });
inventoryLogSchema.index({ itemId: 1, timestamp: -1 });
inventoryLogSchema.index({ action: 1, timestamp: -1 });

export default mongoose.model('InventoryLog', inventoryLogSchema);
