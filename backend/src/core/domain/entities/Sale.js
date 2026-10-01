import mongoose from "mongoose";
import { SALE_TYPES } from "../../../shared/constants/salesConstants.js";

// Modelo Mongoose de ventas.
// Cada venta es de tipo PRODUCT o SERVICE (campos obligatorios según el tipo),
// registra cantidad, precio unitario, total, barbero y método de pago, y
// soporta estados completed/cancelled/refunded con trazabilidad del reembolso.
const saleSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Inventory",
    required: function() { return this.type === SALE_TYPES.PRODUCT; }
  },
  productName: {
    type: String,
    required: function() { return this.type === SALE_TYPES.PRODUCT; }
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service", 
    required: function() { return this.type === SALE_TYPES.SERVICE; }
  },
  serviceName: {
    type: String,
    required: function() { return this.type === SALE_TYPES.SERVICE; }
  },
  type: {
    type: String,
    enum: [SALE_TYPES.PRODUCT, SALE_TYPES.SERVICE],
    required: true
  },
  quantity: {
    type: Number,
    required: [true, "La cantidad es requerida"],
    min: [1, "La cantidad debe ser mayor a 0"]
  },
  unitPrice: {
    type: Number,
    required: [true, "El precio unitario es requerido"],
    min: [0, "El precio no puede ser negativo"]
  },
  totalAmount: {
    type: Number,
    required: [true, "El total es requerido"],
    min: [0, "El total no puede ser negativo"]
  },
  barberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Barber",
    required: [true, "El barbero es requerido"]
  },
  barberName: {
    type: String,
    required: [true, "El nombre del barbero es requerido"]
  },
  paymentMethod: {
    type: String,
    required: [true, "El método de pago es requerido"],
    default: 'cash',
    // Permitir cualquier método de pago para flexibilidad con métodos dinámicos
    // (los métodos configurables se aceptan como string no vacío).
    validate: {
      validator: function(value) {
        // Lista de métodos válidos conocidos
        const validMethods = ['cash', 'debit', 'credit', 'nequi', 'daviplata', 'nu', 'bancolombia', 'digital'];
        // Permitir métodos conocidos o cualquier string no vacío para métodos dinámicos
        return validMethods.includes(value) || (typeof value === 'string' && value.length > 0);
      },
      message: 'El método de pago debe ser válido'
    }
  },
  customerName: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true,
    validate: {
      validator: function(value) {
        // Para productos, la categoría puede venir del producto o ser establecida manualmente
        if (this.type === SALE_TYPES.PRODUCT) {
          return true; // Permitir vacío, se puede obtener del producto
        }
        // Para servicios walkIn, es recomendable tener categoría
        if (this.type === SALE_TYPES.SERVICE) {
          return true; // Permitir vacío por compatibilidad, pero recomendable
        }
        return true;
      },
      message: 'La categoría debe ser válida para el tipo de venta'
    }
  },
  notes: {
    type: String,
    trim: true
  },
  // Datos del cliente (opcional, para facturas de carrito)
  clientData: {
    firstName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  saleDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ["completed", "cancelled", "refunded"],
    default: "completed"
  },
  // Campos de reembolso
  // Registran cuándo, por qué y quién marcó la venta como 'refunded'.
  refundedAt: {
    type: Date
  },
  refundReason: {
    type: String,
    trim: true
  },
  refundedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Invoice",
    index: true
  }
}, {
  timestamps: true
});

// Índices para mejorar performance de queries
// Cubren los reportes por barbero, producto, servicio, fecha y tipo de venta.
saleSchema.index({ barberId: 1, saleDate: -1 });
saleSchema.index({ productId: 1, saleDate: -1 });
saleSchema.index({ serviceId: 1, saleDate: -1 });
saleSchema.index({ saleDate: -1 });
saleSchema.index({ type: 1, barberId: 1 });

// NUEVO: Índice compuesto crítico para getBarberSalesStats (barberId + status + saleDate)
// Este índice optimiza la query más frecuente: filtrar ventas completadas de un barbero por fecha
saleSchema.index({ barberId: 1, status: 1, saleDate: -1 });

// NUEVO: Índice para queries de tipo + status (ej: obtener solo productos completados)
saleSchema.index({ type: 1, status: 1, saleDate: -1 });

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
