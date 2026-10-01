import express from 'express';
import { body, param } from 'express-validator';
import { 
  getPaymentMethods, 
  createPaymentMethod, 
  updatePaymentMethod, 
  deletePaymentMethod,
  initializePaymentMethods,
  normalizePaymentMethods
} from '../controllers/paymentMethodController.js';
import { protect, adminAuth } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// Cache patterns para invalidación
const CACHE_PATTERNS = [
  '^/api/v1/payment-methods'
];

// Validaciones
const paymentMethodValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ max: 50 }).withMessage('El nombre no puede exceder 50 caracteres'),
  body('backendId')
    .trim()
    .notEmpty().withMessage('El backendId es requerido')
    .isLength({ max: 50 }).withMessage('El backendId no puede exceder 50 caracteres'),
  body('description').optional().trim().isLength({ max: 200 }).withMessage('La descripción no puede exceder 200 caracteres'),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/).withMessage('El color debe ser un hex válido (#RRGGBB)'),
  body('category').optional().isIn(['cash', 'digital', 'card', 'transfer', 'other']).withMessage('Categoría inválida'),
  handleValidationErrors
];

const backendIdParam = [
  param('backendId')
    .trim()
    .notEmpty().withMessage('backendId es requerido')
    .isLength({ max: 50 }).withMessage('backendId inválido'),
  handleValidationErrors
];

// Rutas públicas para usuarios autenticados
router.get('/', protect, cacheMiddleware(600), getPaymentMethods);

// Rutas administrativas
router.use(protect, adminAuth); // Todas las rutas siguientes requieren admin

router.post('/', paymentMethodValidation, invalidateCacheMiddleware(CACHE_PATTERNS), createPaymentMethod);
router.put('/:backendId', backendIdParam, invalidateCacheMiddleware(CACHE_PATTERNS), updatePaymentMethod);
router.delete('/:backendId', backendIdParam, invalidateCacheMiddleware(CACHE_PATTERNS), deletePaymentMethod);

// Rutas especiales para gestión del sistema
router.post('/initialize', invalidateCacheMiddleware(CACHE_PATTERNS), initializePaymentMethods);
router.post('/normalize', invalidateCacheMiddleware(CACHE_PATTERNS), normalizePaymentMethods);

export default router;