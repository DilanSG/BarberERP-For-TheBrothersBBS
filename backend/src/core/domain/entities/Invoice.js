import mongoose from 'mongoose';

// Schema de Factura/Invoice
// Generado automáticamente desde ventas
// Compatible con impresoras térmicas (formato 80mm)
const invoiceSchema = new mongoose.Schema({
  // Numeración de factura (secuencial)
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
    // Formato: "FAC-2025-00001"
  },

  // Referencia a la venta original
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true,
    index: true
  },

  // Datos del barbero/vendedor
  barber: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Barber',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    phone: String
  },

  // Datos del cliente (opcional para ventas sin cita)
  client: {
    name: {
      type: String,
      default: 'Cliente General'
    },
    phone: String,
    email: String,
    document: String // CC, NIT, etc.
  },

  // Items de la factura
  items: [{
    description: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory'
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service'
    }
  }],

  // Totales
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  
  tax: {
    type: Number,
    default: 0,
    min: 0
  },

  discount: {
    type: Number,
    default: 0,
    min: 0
  },

  total: {
    type: Number,
    required: true,
    min: 0
  },

  // Método de pago
  paymentMethod: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'transferencia', 'nequi', 'daviplata', 'bancolombia', 'nu', 'digital', 'mixto'],
    default: 'efectivo'
  },

  // Fecha de emisión (puede diferir de createdAt si se genera desde venta/cita antigua)
  issueDate: {
    type: Date,
    default: () => new Date()
  },

  // Estado de la factura
  status: {
    type: String,
    enum: ['pending', 'printed', 'cancelled', 'refunded'],
    default: 'pending'
  },

  // Información de impresión
  printInfo: {
    printed: {
      type: Boolean,
      default: false
    },
    printedAt: Date,
    printedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    printCount: {
      type: Number,
      default: 0
    },
    lastPrintedAt: Date
  },

  // Notas adicionales
  notes: {
    type: String,
    maxlength: 500
  },

  // Información fiscal (para futuras integraciones DIAN)
  fiscalInfo: {
    resolution: String,        // Resolución DIAN
    prefix: String,             // Prefijo autorizado
    authorizationNumber: String,
    validFrom: Date,
    validUntil: Date,
    technicalKey: String        // Clave técnica (facturación electrónica)
  },

  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['pos', 'admin', 'mobile', 'api'],
      default: 'pos'
    },
    device: String,
    ipAddress: String,
    location: String
  }

}, {
  timestamps: true,
  collection: 'invoices'
});

// Índices compuestos
// Optimizan facturas por barbero, por estado y el listado cronológico general.
invoiceSchema.index({ 'barber.id': 1, createdAt: -1 });
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ createdAt: -1 });

// Virtual para formato de factura
// Usa el consecutivo real o un respaldo derivado de los últimos 6 dígitos del _id.
invoiceSchema.virtual('formattedNumber').get(function() {
  return this.invoiceNumber || `FAC-${this._id.toString().slice(-6).toUpperCase()}`;
});

// Método para generar número de factura
// Busca la última factura del año actual por prefijo FAC-<año>- y devuelve el
// siguiente consecutivo rellenado a 5 dígitos. Si no hay ninguna, empieza en 1.
invoiceSchema.statics.generateInvoiceNumber = async function() {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}`;
  
  // Buscar la última factura del año
  const lastInvoice = await this.findOne({
    invoiceNumber: new RegExp(`^${prefix}-`)
  }).sort({ invoiceNumber: -1 });

  let nextNumber = 1;
  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  return `${prefix}-${String(nextNumber).padStart(5, '0')}`;
};

// Método para marcar como impresa
// Efecto secundario: actualiza printInfo (fechas, contador y usuario), pasa el
// estado 'pending' a 'printed' y persiste el documento (retorna la promesa de save).
invoiceSchema.methods.markAsPrinted = function(userId) {
  this.printInfo.printed = true;
  this.printInfo.printedAt = this.printInfo.printedAt || new Date();
  this.printInfo.lastPrintedAt = new Date();
  this.printInfo.printCount = (this.printInfo.printCount || 0) + 1;
  
  if (userId) {
    this.printInfo.printedBy = userId;
  }

  if (this.status === 'pending') {
    this.status = 'printed';
  }

  return this.save();
};

// Método para formatear para impresión
// Proyecta solo los campos necesarios para el ticket térmico (sin datos internos).
invoiceSchema.methods.formatForPrint = function() {
  return {
    invoiceNumber: this.formattedNumber,
    date: this.createdAt,
    barber: this.barber.name,
    client: this.client.name || 'Cliente General',
    items: this.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal
    })),
    subtotal: this.subtotal,
    tax: this.tax,
    discount: this.discount,
    total: this.total,
    paymentMethod: this.paymentMethod
  };
};

// Método para cancelar factura
// Efecto secundario: cambia status a 'cancelled', anexa el motivo a notes y persiste.
invoiceSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.notes = (this.notes ? this.notes + '\n' : '') + `Cancelada: ${reason}`;
  return this.save();
};

// Pre-save hook para calcular totales
// Solo recalcula cuando items cambió: subtotal por ítem = cantidad * precio
// unitario; subtotal general = suma; total = subtotal + impuestos - descuento.
invoiceSchema.pre('save', function(next) {
  if (this.isModified('items')) {
    // Calcular subtotal desde items
    this.subtotal = this.items.reduce((sum, item) => {
      item.subtotal = item.quantity * item.unitPrice;
      return sum + item.subtotal;
    }, 0);

    // Calcular total
    this.total = this.subtotal + (this.tax || 0) - (this.discount || 0);
  }
  next();
});

// Método toJSON personalizado
// Expone virtuals, renombra _id a id y oculta _id/__v en las respuestas JSON.
invoiceSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
