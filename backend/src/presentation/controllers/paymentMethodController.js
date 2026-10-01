import { PaymentMethod, AppError, logger } from '../../barrel.js';
import { 
  GetPaymentMethods, 
  CreatePaymentMethod, 
  UpdatePaymentMethod, 
  DeletePaymentMethod,
  InitializePaymentMethods,
  NormalizeExistingPaymentMethods
} from '../../core/application/usecases/paymentMethodUseCases.js';
import { asyncHandler } from '../middleware/index.js';

/**
 * @desc    Obtener todos los métodos de pago activos
 * @route   GET /api/payment-methods
 * @access  Privado
 */
export const getPaymentMethods = asyncHandler(async (req, res) => {
  const methods = await GetPaymentMethods.execute();
  
  res.status(200).json({
    success: true,
    data: methods,
    total: methods.length
  });
});

/**
 * @desc    Crear un nuevo método de pago
 * @route   POST /api/payment-methods
 * @access  Admin
 */
export const createPaymentMethod = asyncHandler(async (req, res) => {
  const { backendId, name, description, color, category } = req.body;
  
  if (!backendId || !name) {
    throw new AppError('BackendId y nombre son requeridos', 400);
  }
  
  const method = await CreatePaymentMethod.execute({
    backendId,
    name,
    description,
    color,
    category
  });
  
  logger.info(`Método de pago creado por ${req.user.email}: ${method.backendId}`);
  
  res.status(201).json({
    success: true,
    message: 'Método de pago creado exitosamente',
    data: method
  });
});

/**
 * @desc    Actualizar un método de pago
 * @route   PUT /api/payment-methods/:backendId
 * @access  Admin
 */
export const updatePaymentMethod = asyncHandler(async (req, res) => {
  const { backendId } = req.params;
  const updateData = req.body;
  
  const method = await UpdatePaymentMethod.execute(backendId, updateData);
  
  logger.info(`Método de pago actualizado por ${req.user.email}: ${method.backendId}`);
  
  res.status(200).json({
    success: true,
    message: 'Método de pago actualizado exitosamente',
    data: method
  });
});

/**
 * @desc    Eliminar/desactivar un método de pago
 * @route   DELETE /api/payment-methods/:backendId
 * @access  Admin
 */
export const deletePaymentMethod = asyncHandler(async (req, res) => {
  const { backendId } = req.params;
  const { force } = req.query;
  
  const result = await DeletePaymentMethod.execute(backendId, force === 'true');
  
  const action = result.deleted ? 'eliminado' : 'desactivado';
  logger.info(`Método de pago ${action} por ${req.user.email}: ${backendId}`);
  
  res.status(200).json({
    success: true,
    message: `Método de pago ${action} exitosamente`,
    data: result
  });
});

/**
 * @desc    Inicializar métodos de pago del sistema
 * @route   POST /api/payment-methods/initialize
 * @access  Admin
 */
export const initializePaymentMethods = asyncHandler(async (req, res) => {
  const result = await InitializePaymentMethods.execute();
  
  logger.info(`Métodos de pago inicializados por ${req.user.email}`);
  
  res.status(200).json({
    success: true,
    message: 'Métodos de pago del sistema inicializados exitosamente',
    data: result
  });
});

/**
 * @desc    Normalizar métodos de pago existentes
 * @route   POST /api/payment-methods/normalize
 * @access  Admin
 */
export const normalizePaymentMethods = asyncHandler(async (req, res) => {
  const result = await NormalizeExistingPaymentMethods.execute();
  
  logger.info(`Métodos de pago normalizados por ${req.user.email}`);
  
  res.status(200).json({
    success: true,
    message: 'Métodos de pago normalizados exitosamente',
    data: result
  });
});

// MÉTODO LEGACY - Mantener por compatibilidad pero marcar como deprecated
export const getPaymentMethodsLegacy = async (req, res) => {
  try {
    logger.debug('USANDO MÉTODO LEGACY - Considera migrar al nuevo sistema');
    logger.debug('Obteniendo métodos de pago desde BD...');
    
    // Obtener métodos únicos de todas las colecciones
    const Sale = (await import('../../core/domain/entities/Sale.js')).default;
    const Expense = (await import('../../core/domain/entities/Expense.js')).default;
    const Appointment = (await import('../../core/domain/entities/Appointment.js')).default;
    
    const [salesMethods, expensesMethods, appointmentsMethods] = await Promise.all([
      Sale.distinct('paymentMethod'),
      Expense.distinct('paymentMethod'),
      Appointment.distinct('paymentMethod', { paymentMethod: { $exists: true, $ne: null } })
    ]);

    logger.debug('Métodos obtenidos por fuente:', {
      sales: salesMethods,
      expenses: expensesMethods,
      appointments: appointmentsMethods
    });

    // Combinar y normalizar métodos para evitar duplicados similares
    const allRawMethods = [...salesMethods, ...expensesMethods, ...appointmentsMethods];
    
    // Normalización para evitar duplicados como 'Transferencia Bancaria' y 'transferencia'
    const normalizedMethods = new Map();
    
    allRawMethods.forEach(method => {
      if (!method || !method.trim()) return;
      
      const normalized = method.toLowerCase().trim();
      
      // Mapeo de normalización para unificar métodos similares
      let unifiedKey = normalized;
      if (normalized.includes('efectivo') || normalized === 'cash') {
        unifiedKey = 'cash';
      } else if (normalized.includes('transferencia') || normalized.includes('bancaria')) {
        unifiedKey = 'transferencia';
      } else if (normalized.includes('qr') || normalized.includes('código')) {
        unifiedKey = 'qr';
      } else if (normalized.includes('tarjeta') || normalized === 'debit' || normalized === 'credit') {
        unifiedKey = 'tarjeta';
      } else if (normalized.includes('digital') || normalized.includes('pago digital')) {
        unifiedKey = 'digital';
      }
      
      // Mantener el primer método encontrado para cada clave unificada
      if (!normalizedMethods.has(unifiedKey)) {
        normalizedMethods.set(unifiedKey, method);
      }
    });

    logger.debug('Métodos normalizados:', Object.fromEntries(normalizedMethods));

    // Mapear a estructura esperada por el frontend
    const paymentMethodsData = Array.from(normalizedMethods.entries())
      .map(([key, originalMethod]) => {
        // Mapeo de colores por método conocido
        const methodColors = {
          'cash': '#10b981',
          'efectivo': '#10b981',
          'nequi': '#8b5cf6',
          'daviplata': '#ef4444',
          'nu': '#8b5cf6',
          'bancolombia': '#f59e0b',
          'digital': '#3b82f6',
          'debit': '#6b7280',
          'credit': '#3b82f6',
          'tarjeta': '#3b82f6',
          'transferencia': '#9333ea',
          'pse': '#1e40af',
          'qr': '#f97316',
          'test': '#ff6b6b',
          'prueba': '#4ecdc4'
        };

        // Mapeo de nombres amigables
        const friendlyNames = {
          'cash': 'Efectivo',
          'efectivo': 'Efectivo',
          'nequi': 'Nequi',
          'daviplata': 'Daviplata',
          'nu': 'Nu',
          'bancolombia': 'Bancolombia',
          'digital': 'Pago Digital',
          'debit': 'Tarjeta',
          'credit': 'Tarjeta',
          'tarjeta': 'Tarjeta',
          'transferencia': 'Transferencia Bancaria',
          'pse': 'PSE',
          'qr': 'Código QR',
          'test': 'test',
          'prueba': 'prueba'
        };

        return {
          _id: originalMethod,
          backendId: originalMethod,
          name: friendlyNames[key] || originalMethod.charAt(0).toUpperCase() + originalMethod.slice(1),
          color: methodColors[key] || '#6b7280'
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)); // Ordenar alfabéticamente

    logger.debug('Métodos de pago finales enviados:', paymentMethodsData);

    res.status(200).json({
      success: true,
      data: paymentMethodsData,
      total: paymentMethodsData.length
    });

  } catch (error) {
    logger.error('Error al obtener métodos de pago:', error);
    throw new AppError('Error al obtener métodos de pago', 500);
  }
};
