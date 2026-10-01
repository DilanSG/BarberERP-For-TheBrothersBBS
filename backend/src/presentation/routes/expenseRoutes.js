import express from 'express';
import { body, query, param } from 'express-validator';
import { protect, adminAuth } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';
import { handleValidationErrors } from '../middleware/validation.js';
import expenseController from '../controllers/expenseController.js';
import PaymentMethod from '../../core/domain/entities/PaymentMethod.js';

const router = express.Router();

// Cache patterns para invalidación (gastos y resumen financiero)
const CACHE_PATTERNS = [
  '^/api/v1/expenses',
  '^/api/v1/sales'
];

// --- Validation Middlewares ---

// Validador que acepta paymentMethodId (ObjectId) o paymentMethod (backendId/alias) y normaliza ambos
const validateAndNormalizePaymentMethod = body().custom(async (_, { req }) => {
  const { paymentMethodId, paymentMethod } = req.body || {};

  let methodDoc = null;

  // 1) Intentar por ObjectId si viene paymentMethodId con forma de ObjectId
  try {
    if (paymentMethodId && typeof paymentMethodId === 'string' && paymentMethodId.match(/^[0-9a-fA-F]{24}$/)) {
      methodDoc = await PaymentMethod.findById(paymentMethodId);
    }
  } catch (e) {
    // Ignorar y continuar con otras estrategias
  }

  // 2) Intentar por backendId/alias si no se encontró
  if (!methodDoc && paymentMethod) {
    // Buscar por backendId exacto o alias activo
    methodDoc = await PaymentMethod.findByIdOrAlias(paymentMethod);
    if (!methodDoc) {
      // Intentar normalizar strings comunes (p.ej. "transfer" -> "bancolombia")
      try {
        const normalized = await PaymentMethod.normalizePaymentMethod(paymentMethod);
        methodDoc = await PaymentMethod.findByIdOrAlias(normalized) || await PaymentMethod.findOne({ backendId: normalized });
      } catch (e) {
        // Continuar
      }
    }
  }

  if (!methodDoc) {
    throw new Error('Método de pago no válido');
  }

  // Normalizar en el body para el servicio/modelo
  req.body.paymentMethodId = methodDoc._id.toString();
  req.body.paymentMethod = methodDoc.backendId;
  return true;
});

const expenseCategories = [
  'rent', 'utilities', 'supplies', 'equipment', 'salaries', 'marketing',
  'maintenance', 'insurance', 'taxes', 'transport', 'food', 'training',
  'software', 'other'
];

// Base validation for a single expense
const expenseValidation = [
  body('description').trim().isLength({ min: 1, max: 200 }).withMessage('La descripción debe tener entre 1 y 200 caracteres'),
  body('amount').isFloat({ min: 0.01 }).withMessage('El monto debe ser un número positivo'),
  body('category').isIn(expenseCategories).withMessage('Categoría inválida'),
  validateAndNormalizePaymentMethod,
  body('date').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Formato de fecha inválido'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Las notas no pueden exceder los 500 caracteres'),
  handleValidationErrors
];

// Validation for recurring expense templates (explícito, sin filtrar objetos con builder desconocido)
const recurringExpenseValidation = [
  body('description').trim().isLength({ min: 1, max: 200 }).withMessage('La descripción debe tener entre 1 y 200 caracteres'),
  body('amount').isFloat({ min: 0.01 }).withMessage('El monto debe ser un número positivo'),
  body('category').isIn(expenseCategories).withMessage('Categoría inválida'),
  validateAndNormalizePaymentMethod,
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Las notas no pueden exceder los 500 caracteres'),
  body('recurrence').isObject().withMessage('El objeto de recurrencia es requerido'),
  body('recurrence.pattern').isIn(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']).withMessage('Patrón de recurrencia inválido'),
  body('recurrence.interval').optional().isInt({ min: 1 }).withMessage('El intervalo debe ser un entero positivo'),
  body('recurrence.startDate').isISO8601().toDate().withMessage('La fecha de inicio es requerida y debe ser válida'),
  body('recurrence.endDate').optional({ checkFalsy: true }).isISO8601().toDate().withMessage('Formato de fecha de fin inválido'),
  body('recurrence.config.weekDays').optional().isArray().withMessage('weekDays debe ser un arreglo'),
  body('recurrence.config.weekDays.*').isInt({ min: 0, max: 6 }).withMessage('Día de la semana inválido (0-6)'),
  body('recurrence.config.monthDays').optional().isArray().withMessage('monthDays debe ser un arreglo'),
  body('recurrence.config.monthDays.*').isInt({ min: 1, max: 31 }).withMessage('Día del mes inválido (1-31)'),
  handleValidationErrors
];

// Validation for query parameters
const queryValidation = [
  query('startDate').optional().isISO8601().withMessage('Formato de fecha de inicio inválido'),
  query('endDate').optional().isISO8601().withMessage('Formato de fecha de fin inválido'),
  query('page').optional().isInt({ min: 1 }).withMessage('La página debe ser un entero positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('El límite debe estar entre 1 y 100'),
  handleValidationErrors
];

const mongoIdParam = [param('id').isMongoId().withMessage('ID inválido'), handleValidationErrors];

// --- Expense Routes ---

router.use(protect); // All expense routes are protected

// GET
router.get('/', cacheMiddleware(120), queryValidation, expenseController.getExpenses);
router.get('/summary', cacheMiddleware(120), expenseController.getExpenseSummary);
router.get('/categories', expenseController.getExpenseCategories);
router.get('/recurring', cacheMiddleware(120), expenseController.getRecurringExpenses);
router.get('/recurring/:id', mongoIdParam, expenseController.getRecurringExpenseById);
router.get('/:id/daily-adjustments',
  mongoIdParam,
  query('yearMonth').optional().matches(/^\d{4}-\d{2}$/).withMessage('yearMonth debe tener formato YYYY-MM'),
  expenseController.getDailyAdjustments
);

// POST
router.post('/', expenseValidation, invalidateCacheMiddleware(CACHE_PATTERNS), expenseController.createExpense);
router.post('/recurring', recurringExpenseValidation, invalidateCacheMiddleware(CACHE_PATTERNS), expenseController.createRecurringExpense);
router.post('/process-automatic', adminAuth, invalidateCacheMiddleware(CACHE_PATTERNS), expenseController.processAutomaticExpenses); // Solo Admin

// PUT / PATCH
router.put('/:id', mongoIdParam, invalidateCacheMiddleware(CACHE_PATTERNS), expenseController.updateExpense); // Handles both one-time and recurring templates
router.put('/:id/daily-adjustments',
  mongoIdParam,
  body('yearMonth').matches(/^\d{4}-\d{2}$/).withMessage('yearMonth debe tener formato YYYY-MM'),
  body('adjustments').isObject().withMessage('adjustments debe ser un objeto'),
  handleValidationErrors,
  invalidateCacheMiddleware(CACHE_PATTERNS),
  expenseController.updateDailyAdjustments
);
router.patch('/recurring/:id/toggle',
  mongoIdParam,
  body('isActive').isBoolean().withMessage('isActive debe ser un valor booleano'),
  handleValidationErrors,
  invalidateCacheMiddleware(CACHE_PATTERNS),
  expenseController.toggleRecurringExpense
);

// DELETE
router.delete('/:id', mongoIdParam, invalidateCacheMiddleware(CACHE_PATTERNS), expenseController.deleteExpense);

export default router;