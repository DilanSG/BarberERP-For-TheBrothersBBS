import express from 'express';
import { body, param } from 'express-validator';
import { protect, adminAuth } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';
import { handleValidationErrors } from '../middleware/validation.js';
import * as refundController from '../controllers/refundController.js';

const router = express.Router();

// Cache patterns para invalidación (reembolsos afectan ventas y reportes)
const CACHE_PATTERNS = [
  '^/api/v1/refunds',
  '^/api/v1/sales'
];

// Validaciones
const saleIdParam = [
  param('saleId').isMongoId().withMessage('ID de venta inválido'),
  handleValidationErrors
];

const processRefundValidation = [
  body('reason')
    .trim()
    .notEmpty().withMessage('La razón del reembolso es requerida')
    .isLength({ max: 500 }).withMessage('La razón no puede exceder 500 caracteres'),
  // Solo obligatorio para no-admins (el controller valida según el rol)
  body('adminCode')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 6, max: 6 }).withMessage('El código debe tener 6 dígitos')
    .isNumeric().withMessage('El código debe ser numérico'),
  handleValidationErrors
];

// Aplicar autenticación a todas las rutas
router.use(protect);

// @route   POST /api/refunds/:saleId
// @desc    Procesar reembolso de una venta específica
// @access  Privado (Barberos con código admin)
router.post('/:saleId', saleIdParam, processRefundValidation, invalidateCacheMiddleware(CACHE_PATTERNS), refundController.processRefund);

// @route   GET /api/refunds
// @desc    Obtener todas las ventas reembolsadas (filtradas por rol)
// @access  Privado
router.get('/', cacheMiddleware(60), refundController.getRefundedSales);

// @route   GET /api/refunds/my-sales
// @desc    Obtener ventas del barbero para poder reembolsar
// @access  Privado (Barberos)
router.get('/my-sales', refundController.getMySalesForRefund);

// @route   GET /api/refunds/summary
// @desc    Obtener resumen de reembolsos por barbero
// @access  Solo Admin
router.get('/summary', adminAuth, refundController.getRefundsSummary);

// @route   GET /api/refunds/verification-code
// @desc    Obtener código de verificación actual para reembolsos
// @access  Solo Admin
router.get('/verification-code', adminAuth, refundController.getVerificationCode);

// @route   DELETE /api/refunds/:saleId
// @desc    Eliminar reembolso (reversar a venta normal)
// @access  Solo Admin
router.delete('/:saleId', adminAuth, saleIdParam, invalidateCacheMiddleware(CACHE_PATTERNS), refundController.deleteRefund);

// @route   DELETE /api/refunds/:saleId/permanent
// @desc    Eliminar reembolso permanentemente del sistema
// @access  Solo Admin
router.delete('/:saleId/permanent', adminAuth, saleIdParam, invalidateCacheMiddleware(CACHE_PATTERNS), refundController.permanentDeleteRefund);

export default router;