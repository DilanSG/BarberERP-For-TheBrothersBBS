import mongoose from 'mongoose';
import { logger } from '../../../shared/utils/logger.js';
const { Schema, ObjectId } = mongoose;

// Esquema de gastos con soporte para gastos únicos y recurrentes
// Refactorizado con patrón más limpio y escalable
const expenseSchema = new Schema({
  // Campos básicos
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true,
    maxlength: [200, 'La descripción no puede exceder 200 caracteres']
  },
  
  amount: {
    type: Number,
    required: [true, 'El monto es requerido'],
    min: [0, 'El monto debe ser positivo']
  },
  
  category: {
    type: String,
    required: [true, 'La categoría es requerida'],
    enum: [
      'rent', 'utilities', 'supplies', 'equipment', 'salaries',
      'marketing', 'maintenance', 'insurance', 'taxes', 'transport',
      'food', 'training', 'software', 'other'
    ]
  },
  
  paymentMethodId: {
    // Referencia al método de pago configurable (fuente principal).
    type: Schema.Types.ObjectId,
    ref: 'PaymentMethod',
    required: [true, 'El método de pago es requerido']
  },

  // Mantener compatibilidad con código existente
  // paymentMethod (string) queda como respaldo si no hay paymentMethodId.
  paymentMethod: {
    type: String,
    required: false
  },
  
  date: {
    type: Date,
    required: [true, 'La fecha es requerida'],
    default: Date.now
  },
  
  // Tipo simplificado con mejor semántica
  type: {
    type: String,
    enum: ['one-time', 'recurring-template', 'recurring-instance'],
    default: 'one-time'
  },
  
  // Configuración para gastos recurrentes - Refactorizada
  // recurrence describe la plantilla: patrón, intervalo, vigencia y estado.
  recurrence: {
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'],
      // Obligatorio solo para plantillas recurrentes ('recurring-template').
      required: function() { 
        return this.type === 'recurring-template';
      }
    },
    
    interval: {
      // Cada cuántos períodos se repite (1 = cada día/semana/mes/año).
      type: Number,
      default: 1,
      min: [1, 'El intervalo debe ser al menos 1']
    },
    
    startDate: {
      // Por defecto arranca en la fecha del gasto (solo en plantillas).
      type: Date,
      default: function() {
        return this.type === 'recurring-template' ? this.date : null;
      }
    },
    
    endDate: {
      type: Date,
      default: null
    },
    
    isActive: {
      type: Boolean,
      default: true
    },
    
    lastProcessed: {
      // Última fecha para la que ya se generó una instancia recurrente.
      type: Date,
      default: null
    },
    
    // Configuración específica por patrón - Más ordenada
    config: {
      // Para weekly: [0,1,2,3,4,5,6] días de la semana
      weekDays: {
        type: [Number],
        validate: {
          validator: function(days) {
            return !days || days.every(day => day >= 0 && day <= 6);
          },
          message: 'Los días de la semana deben estar entre 0 (Domingo) y 6 (Sábado)'
        }
      },
      
      // Para monthly: [1,2,...,31] días del mes
      monthDays: {
        type: [Number],
        validate: {
          validator: function(days) {
            return !days || days.every(day => day >= 1 && day <= 31);
          },
          message: 'Los días del mes deben estar entre 1 y 31'
        }
      },
      
      // Para yearly: { month: 1-12, day: 1-31 }
      yearConfig: {
        month: {
          type: Number,
          min: 1,
          max: 12
        },
        day: {
          type: Number,
          min: 1,
          max: 31
        }
      }
    },
    
    // Campo de ajustes diarios - Mantener compatibilidad
    // Este campo se usará solo durante la transición
    dailyAdjustments: {
      type: Object,
      default: {}
    },
    
    adjustmentsMonth: {
      type: String,
      default: null
    }
  },
  
  // Para instancias generadas automáticamente
  // Cambiado de nombre pero manteniendo la misma funcionalidad
  parentTemplate: {
    type: Schema.Types.ObjectId,
    ref: 'Expense',
    default: null
  },
  
  // Compatibilidad con campo anterior
  parentRecurringExpense: {
    type: Schema.Types.ObjectId,
    ref: 'Expense',
    default: null
  },
  
  // Usuario que registra el gasto
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Notas adicionales
  notes: {
    type: String,
    maxlength: [500, 'Las notas no pueden exceder 500 caracteres']
  },
  
  // Metadatos para auditoria
  metadata: {
    source: {
      type: String,
      enum: ['manual', 'auto-generated', 'imported'],
      default: 'manual'
    },
    generatedAt: Date,
    lastCalculated: Date
  }

}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Formatear fechas para respuesta
      // Convierte date, fechas de recurrence y del formato legado a YYYY-MM-DD
      // (sin hora) para evitar desfases de zona horaria en el frontend.
      if (ret.date) {
        ret.date = ret.date.toISOString().split('T')[0];
      }
      
      // Manejar fechas en la nueva estructura de recurrence
      if (ret.recurrence?.endDate) {
        ret.recurrence.endDate = ret.recurrence.endDate.toISOString().split('T')[0];
      }
      if (ret.recurrence?.startDate) {
        ret.recurrence.startDate = ret.recurrence.startDate.toISOString().split('T')[0];
      }
      if (ret.recurrence?.lastProcessed) {
        ret.recurrence.lastProcessed = ret.recurrence.lastProcessed.toISOString().split('T')[0];
      }
      
      // Mantener compatibilidad con estructura anterior
      if (ret.recurringConfig?.endDate) {
        ret.recurringConfig.endDate = ret.recurringConfig.endDate.toISOString().split('T')[0];
      }
      if (ret.recurringConfig?.lastProcessed) {
        ret.recurringConfig.lastProcessed = ret.recurringConfig.lastProcessed.toISOString().split('T')[0];
      }
      
      return ret;
    }
  }
});

// Índices para optimizar consultas
// Soportan reportes por fecha, tipo, categoría, creador, plantilla y método de pago.
expenseSchema.index({ date: -1 });
expenseSchema.index({ type: 1 });
expenseSchema.index({ 'recurrence.pattern': 1, 'recurrence.isActive': 1 });
expenseSchema.index({ category: 1, date: -1 });
expenseSchema.index({ createdBy: 1, date: -1 });
expenseSchema.index({ parentTemplate: 1 });
expenseSchema.index({ paymentMethodId: 1 });

// Índices para mantener compatibilidad
expenseSchema.index({ 'recurringConfig.frequency': 1, 'recurringConfig.isActive': 1 });
expenseSchema.index({ parentRecurringExpense: 1 });

// Método estático para obtener resumen de gastos
// Versión mejorada con soporte para nuevos tipos y filtrado más eficiente
// Parámetros: startDate/endDate (strings YYYY-MM-DD) y filtros opcionales por
// categoría, método de pago o creador. Retorna totales y desgloses por tipo,
// categoría y método de pago (nombres resueltos vía $lookup a paymentmethods).
expenseSchema.statics.getExpenseSummary = async function(startDate, endDate, filters = {}) {
  // Validar fechas de entrada
  if (!startDate || !endDate) {
    throw new Error('startDate y endDate son requeridos para obtener resumen');
  }

  // Normalizar el rango al día completo en UTC: desde 00:00:00.000 hasta
  // 23:59:59.999, de modo que se incluyan todos los gastos de ambas fechas.
  const startDateTime = new Date(startDate + 'T00:00:00.000Z');
  const endDateTime = new Date(endDate + 'T23:59:59.999Z');

  // Preparar filtros básicos
  const matchFilters = {
    date: {
      $gte: startDateTime,
      $lte: endDateTime
    }
  };

  // Añadir filtros adicionales si se proporcionan
  if (filters.category) matchFilters.category = filters.category;
  if (filters.paymentMethodId) matchFilters.paymentMethodId = filters.paymentMethodId;
  if (filters.paymentMethod) matchFilters.paymentMethod = filters.paymentMethod;
  if (filters.createdBy) matchFilters.createdBy = filters.createdBy;

  // Pipeline de agregación optimizada
  const pipeline = [
    {
      $match: matchFilters
    },
    {
      // Une con paymentmethods para obtener el nombre del método de pago.
      $lookup: {
        from: 'paymentmethods',
        localField: 'paymentMethodId',
        foreignField: '_id',
        as: 'paymentMethodDetails'
      }
    },
    {
      // Resuelve el nombre: usa el documento relacionado o cae al campo legado.
      $addFields: {
        paymentMethodName: {
          $cond: {
            if: { $gt: [{ $size: "$paymentMethodDetails" }, 0] },
            then: { $arrayElemAt: ["$paymentMethodDetails.name", 0] },
            else: "$paymentMethod" // Fallback al campo antiguo
          }
        }
      }
    },
    {
      // Agrupa todo en un único documento: total, conteo y arreglos crudos
      // (categorías, métodos y tipos) que luego se desglosan en el $project.
      $group: {
        _id: null,
        totalExpenses: { $sum: '$amount' },
        totalCount: { $sum: 1 },
        categories: {
          $push: {
            category: '$category',
            amount: '$amount'
          }
        },
        paymentMethods: {
          $push: {
            method: { 
              $cond: { 
                if: { $gt: [{ $size: "$paymentMethodDetails" }, 0] }, 
                then: { $arrayElemAt: ["$paymentMethodDetails.backendId", 0] },
                else: "$paymentMethod" 
              }
            },
            name: "$paymentMethodName",
            amount: '$amount'
          }
        },
        byType: {
          $push: {
            type: '$type',
            amount: '$amount'
          }
        }
      }
    },
    {
      // Construye los desgloses: agrupa los arreglos crudos por clave única
      // ($setUnion) y suma los montos de cada grupo con $arrayToObject.
      $project: {
        _id: 0,
        totalExpenses: 1,
        totalCount: 1,
        typeBreakdown: {
          $arrayToObject: {
            $map: {
              input: {
                $setUnion: {
                  $map: {
                    input: '$byType',
                    as: 'item',
                    in: '$$item.type'
                  }
                }
              },
              as: 'type',
              in: {
                k: '$$type',
                v: {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: '$byType',
                          cond: { $eq: ['$$this.type', '$$type'] }
                        }
                      },
                      as: 'filtered',
                      in: '$$filtered.amount'
                    }
                  }
                }
              }
            }
          }
        },
        categoryBreakdown: {
          $arrayToObject: {
            $map: {
              input: {
                $setUnion: {
                  $map: {
                    input: '$categories',
                    as: 'cat',
                    in: '$$cat.category'
                  }
                }
              },
              as: 'category',
              in: {
                k: '$$category',
                v: {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: '$categories',
                          cond: { $eq: ['$$this.category', '$$category'] }
                        }
                      },
                      as: 'filtered',
                      in: '$$filtered.amount'
                    }
                  }
                }
              }
            }
          }
        },
        paymentMethodBreakdown: {
          $arrayToObject: {
            $map: {
              input: {
                $setUnion: {
                  $map: {
                    input: '$paymentMethods',
                    as: 'pm',
                    in: '$$pm.method'
                  }
                }
              },
              as: 'method',
              in: {
                k: '$$method',
                v: {
                  amount: {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: '$paymentMethods',
                            cond: { $eq: ['$$this.method', '$$method'] }
                          }
                        },
                        as: 'filtered',
                        in: '$$filtered.amount'
                      }
                    }
                  },
                  name: {
                    $arrayElemAt: [
                      {
                        $map: {
                          input: {
                            $filter: {
                              input: '$paymentMethods',
                              cond: { $eq: ['$$this.method', '$$method'] }
                            }
                          },
                          as: 'filtered',
                          in: '$$filtered.name'
                        }
                      },
                      0
                    ]
                  }
                }
              }
            }
          }
        }
      }
    }
  ];

  const result = await this.aggregate(pipeline);
  
  // Retornar resultado por defecto si no hay datos
  // (evita que los consumidores manejen undefined cuando no hay gastos).
  return result[0] || {
    totalExpenses: 0,
    totalCount: 0,
    typeBreakdown: {},
    categoryBreakdown: {},
    paymentMethodBreakdown: {}
  };
};

// Método estático para procesar gastos recurrentes
// IMPORTANTE: Este método quedará deprecado y se migrará a ExpenseService
// Se mantiene por compatibilidad con el código existente
// Recorre plantillas activas (formato nuevo y legado), calcula su próxima fecha
// y crea una instancia hija cuando la fecha ya venció, actualizando lastProcessed.
// Retorna { processed, errors? } y registra en errors los fallos por plantilla.
expenseSchema.statics.processRecurringExpenses = async function() {
  logger.warn('Método deprecated: Usar ExpenseService.processScheduledExpenses() en su lugar');
  
  const today = new Date();
  const recurringExpenses = await this.find({
    $or: [
      // Nueva estructura
      {
        type: 'recurring-template',
        'recurrence.isActive': true,
        $or: [
          { 'recurrence.endDate': null },
          { 'recurrence.endDate': { $gte: today } }
        ]
      },
      // Compatibilidad con estructura anterior
      {
        type: 'recurring',
        'recurringConfig.isActive': true,
        $or: [
          { 'recurringConfig.endDate': null },
          { 'recurringConfig.endDate': { $gte: today } }
        ]
      }
    ]
  });

  let processedCount = 0;
  const errors = [];

  for (const recurringExpense of recurringExpenses) {
    try {
      // Determinar qué estructura usar
      // isLegacy indica el formato antiguo (recurringConfig vs recurrence).
      const isLegacy = recurringExpense.type === 'recurring';
      const config = isLegacy ? recurringExpense.recurringConfig : recurringExpense.recurrence;
      const lastProcessed = config.lastProcessed || config.startDate || recurringExpense.date;
      
      // Calcular próxima fecha usando el método apropiado
      // El formato nuevo usa RecurrenceCalculator; el legado calculateNextDate.
      let nextDate;
      
      if (isLegacy) {
        // Usar el método antiguo para compatibilidad
        nextDate = calculateNextDate(lastProcessed, config);
      } else {
        // Importar dinámicamente el calculador nuevo
        const { default: RecurrenceCalculator } = await import('../../application/services/RecurrenceCalculatorAdapter.js');
        const calculator = new RecurrenceCalculator();
        nextDate = calculator.getNextOccurrenceDate(recurringExpense);
      }

      // Si la próxima fecha ya pasó, crear el gasto
      if (nextDate && nextDate <= today) {
        // Crear nueva instancia usando el tipo correcto
        await this.create({
          description: recurringExpense.description,
          amount: recurringExpense.amount,
          category: recurringExpense.category,
          paymentMethod: recurringExpense.paymentMethod,
          paymentMethodId: recurringExpense.paymentMethodId,
          date: nextDate,
          type: 'recurring-instance', // Nuevo tipo para instancias
          parentTemplate: recurringExpense._id, // Nuevo campo
          parentRecurringExpense: recurringExpense._id, // Campo antiguo para compatibilidad
          createdBy: recurringExpense.createdBy,
          notes: `Gasto automático generado de: ${recurringExpense.description}`,
          metadata: {
            source: 'auto-generated',
            generatedAt: new Date()
          }
        });

        // Actualizar fecha último procesamiento según estructura
        if (isLegacy) {
          recurringExpense.recurringConfig.lastProcessed = nextDate;
        } else {
          recurringExpense.recurrence.lastProcessed = nextDate;
        }
        
        await recurringExpense.save();
        processedCount++;
      }
    } catch (error) {
      // Acumula el error sin abortar el resto de plantillas.
      errors.push({
        expenseId: recurringExpense._id,
        description: recurringExpense.description,
        error: error.message
      });
    }
  }

  return {
    processed: processedCount,
    errors: errors.length > 0 ? errors : undefined
  };
};

// Función auxiliar para calcular la próxima fecha de un gasto recurrente
// DEPRECATED: Se mantiene por compatibilidad con el código existente.
// Esta función será eliminada en futuras versiones.
// Suma períodos según frequency/interval desde la última fecha procesada y
// avanza hasta superar hoy; retorna null si se pasa de config.endDate.
function calculateNextDate(lastDate, config) {
  logger.warn('Función calculateNextDate deprecated. Usar RecurrenceCalculator en su lugar.');
  
  const today = new Date();
  const startDate = new Date(lastDate);
  let nextDate = new Date(startDate);
  
  // Función para agregar un período según la frecuencia
  const addPeriod = (date) => {
    switch (config.frequency) {
      case 'daily':
        date.setDate(date.getDate() + config.interval);
        break;
        
      case 'weekly':
        date.setDate(date.getDate() + (config.interval * 7));
        break;
        
      case 'monthly':
        date.setMonth(date.getMonth() + config.interval);
        break;
        
      case 'yearly':
        date.setFullYear(date.getFullYear() + config.interval);
        break;
        
      default:
        throw new Error(`Frecuencia no válida: ${config.frequency}`);
    }
    return date;
  };

  // Si la fecha base ya es futura, calcular el próximo período
  if (startDate > today) {
    return addPeriod(nextDate);
  }

  // Calcular la primera fecha siguiente
  addPeriod(nextDate);

  // Mientras la fecha calculada sea anterior o igual a hoy, seguir agregando períodos
  while (nextDate <= today) {
    addPeriod(nextDate);
  }

  // Verificar que no exceda la fecha de fin (si existe)
  if (config.endDate && nextDate > new Date(config.endDate)) {
    return null; // El gasto recurrente ha terminado
  }

  return nextDate;
}

// Middleware para validar configuración de gastos recurrentes
// Asegura que los datos sean válidos antes de guardar en la BD
// Exige fecha de inicio y la configuración mínima según el patrón
// (weekDays para weekly, monthDays para monthly, mes/día para yearly) y
// mantiene las validaciones del formato legado 'recurring'.
expenseSchema.pre('save', function(next) {
  // Validación para gastos recurrentes (nuevo formato)
  if (this.type === 'recurring-template') {
    const recurrence = this.recurrence || {};
    
    // Validar que tenga una fecha de inicio para calcular recurrencias
    if (!recurrence.startDate && !this.date) {
      return next(new Error('Se requiere fecha de inicio para gastos recurrentes'));
    }
    
    // Validar configuración según el patrón
    if (recurrence.pattern === 'weekly' && 
        (!recurrence.config?.weekDays || recurrence.config.weekDays.length === 0)) {
      return next(new Error('Se requiere al menos un día de la semana para patrón semanal'));
    }
    
    if (recurrence.pattern === 'monthly' && 
        (!recurrence.config?.monthDays || recurrence.config.monthDays.length === 0)) {
      return next(new Error('Se requiere al menos un día del mes para patrón mensual'));
    }
    
    if (recurrence.pattern === 'yearly' && 
        (!recurrence.config?.yearConfig?.month || !recurrence.config?.yearConfig?.day)) {
      return next(new Error('Se requiere mes y día para patrón anual'));
    }
  }
  
  // Validación para compatibilidad con formato anterior
  if (this.type === 'recurring') {
    const config = this.recurringConfig;
    
    if (!config.startDate && !this.date) {
      return next(new Error('startDate o date es requerido para gastos recurrentes'));
    }
  }
  
  // Si se está migrando un gasto existente al nuevo formato, verificar consistencia
  if (this.isModified('type') && this.type === 'recurring-template' && !this.recurrence) {
    return next(new Error('Se requiere configuración de recurrencia para gastos de tipo recurring-template'));
  }
  
  next();
});

// Método para migrar un gasto del formato antiguo al nuevo
// Solo aplica a documentos type 'recurring' con recurringConfig; mapea los
// campos legados a recurrence, deriva la configuración por patrón (semanal,
// mensual o anual) y cambia el tipo a 'recurring-template'.
// Retorna true si migró y false si no había nada que migrar.
expenseSchema.methods.migrateToNewFormat = function() {
  // Solo migrar si tiene el formato antiguo
  if (this.type !== 'recurring' || !this.recurringConfig) {
    return false;
  }
  
  // Mapear los campos del formato antiguo al nuevo
  const oldConfig = this.recurringConfig;
  
  // Crear configuración de recurrencia con nuevo formato
  this.recurrence = {
    pattern: oldConfig.frequency,
    interval: oldConfig.interval || 1,
    startDate: oldConfig.startDate || this.date,
    endDate: oldConfig.endDate,
    isActive: oldConfig.isActive !== undefined ? oldConfig.isActive : true,
    lastProcessed: oldConfig.lastProcessed,
    config: {}
  };
  
  // Configuración específica según patrón
  switch (oldConfig.frequency) {
    case 'weekly':
      if (oldConfig.dayOfWeek !== undefined && oldConfig.dayOfWeek !== null) {
        this.recurrence.config.weekDays = [oldConfig.dayOfWeek];
      }
      break;
    
    case 'monthly':
      if (oldConfig.dayOfMonth !== undefined && oldConfig.dayOfMonth !== null) {
        this.recurrence.config.monthDays = [oldConfig.dayOfMonth];
      } else if (oldConfig.specificDates && oldConfig.specificDates.length > 0) {
        this.recurrence.config.monthDays = [...oldConfig.specificDates];
      }
      break;
    
    case 'yearly': {
      // Extraer mes y día de startDate para configuración anual
      const startDate = new Date(oldConfig.startDate || this.date);
      this.recurrence.config.yearConfig = {
        month: startDate.getMonth() + 1, // +1 porque getMonth() devuelve 0-11
        day: startDate.getDate()
      };
      break;
    }
  }
  
  // Actualizar el tipo de gasto
  this.type = 'recurring-template';
  
  // Mantener recurringConfig para compatibilidad pero marcarlo como migrado
  this.recurringConfig._migrated = true;
  
  return true;
};

// Método para obtener la próxima fecha de ejecución
// Usa RecurrenceCalculator para plantillas nuevas (import dinámico para evitar
// dependencias circulares, retorna null y loguea si falla) y calculateNextDate
// para el formato legado. Retorna null si el gasto no es recurrente.
expenseSchema.methods.getNextExecutionDate = async function() {
  // Usar el nuevo RecurrenceCalculator para cálculo de fechas
  if (this.type === 'recurring-template') {
    try {
      // Importar dinámicamente para evitar dependencias circulares
      const { default: RecurrenceCalculator } = await import('../../application/services/RecurrenceCalculatorAdapter.js');
      const calculator = new RecurrenceCalculator();
      return calculator.getNextOccurrenceDate(this);
    } catch (error) {
      logger.error('Error calculando próxima fecha con formato recurring-template', { 
        error: error.message 
      });
      return null;
    }
  }
  
  // Compatibilidad con formato anterior
  if (this.type === 'recurring') {
    const lastProcessed = this.recurringConfig.lastProcessed || 
                        this.recurringConfig.startDate || 
                        this.date;
    return calculateNextDate(lastProcessed, this.recurringConfig);
  }
  
  return null;
};

// Método para buscar gastos que deben procesarse
// Este método optimiza la consulta para el scheduler
// Devuelve solo plantillas activas y vigentes (sin endDate o con endDate futuro)
// en formato lean, con los campos que el scheduler necesita.
expenseSchema.statics.findPendingToProcess = async function() {
  const today = new Date();
  
  return this.find({
    $or: [
      // Nuevo formato
      {
        type: 'recurring-template',
        'recurrence.isActive': true,
        $or: [
          { 'recurrence.endDate': null },
          { 'recurrence.endDate': { $gte: today } }
        ]
      },
      // Compatibilidad con formato anterior
      {
        type: 'recurring',
        'recurringConfig.isActive': true,
        $or: [
          { 'recurringConfig.endDate': null },
          { 'recurringConfig.endDate': { $gte: today } }
        ]
      }
    ]
  })
  .select('_id description amount category paymentMethodId paymentMethod date type recurrence recurringConfig createdBy')
  .lean();
};

// Exportar el modelo con la configuración actualizada
export default mongoose.model('Expense', expenseSchema);