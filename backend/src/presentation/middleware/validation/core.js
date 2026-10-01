import { body, param, query, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { AppError } from '../../../barrel.js';

// Middleware para manejar errores de validación
// Si express-validator encontró errores, lanza AppError 400 con el detalle por campo
// para que lo procese el errorHandler central.
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value
    }));

    throw new AppError('Error de validación', 400, errorMessages);
  }
  next();
};

// Validar ID de MongoDB
// @param {string} value - Valor a validar
// @returns {boolean} true si es un ObjectId válido
export const validateMongoId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('ID inválido');
  }
  return true;
};

// Validación de ID en parámetros
export const validateId = [
  param('id')
    .custom(validateMongoId)
    .withMessage('ID inválido'),
  handleValidationErrors
];

// Validación de barberId en parámetros
export const validateBarberId = [
  param('barberId')
    .custom(validateMongoId)
    .withMessage('ID de barbero inválido'),
  handleValidationErrors
];

// Validación de saleId en parámetros
export const validateSaleId = [
  param('saleId')
    .custom(validateMongoId)
    .withMessage('ID de venta inválido'),
  handleValidationErrors
];

// Validación de invoiceId en parámetros
export const validateInvoiceId = [
  param('invoiceId')
    .custom(validateMongoId)
    .withMessage('ID de factura inválido'),
  handleValidationErrors
];

// Validaciones para parámetros de ID
export const validateIdParam = [
  param('id')
    .isMongoId()
    .withMessage('ID inválido'),
  handleValidationErrors
];

// Validación para parámetro de categoría (string no vacío)
export const validateCategoryParam = [
  param('category')
    .trim()
    .notEmpty()
    .withMessage('La categoría es requerida')
    .isLength({ max: 100 })
    .withMessage('La categoría no puede exceder 100 caracteres'),
  handleValidationErrors
];

// Validaciones para queries de paginación
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número mayor a 0'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser entre 1 y 100'),
  handleValidationErrors
];
