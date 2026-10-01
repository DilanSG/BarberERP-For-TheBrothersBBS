import { body } from 'express-validator';
import { handleValidationErrors } from './core.js';

// Validaciones para items de inventario
export const validateInventoryItem = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre del ítem debe tener entre 2 y 100 caracteres')
    .escape(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder los 500 caracteres')
    .escape(),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El stock debe ser un número entero positivo'),
  body('initialStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El stock inicial debe ser un número entero positivo'),
  body('entries')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Las entradas deben ser un número entero positivo'),
  body('exits')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Las salidas deben ser un número entero positivo'),
  body('minStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El stock mínimo debe ser un número entero positivo'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('El precio debe ser un número positivo'),
  body('supplier')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('El nombre del proveedor no puede exceder los 100 caracteres')
    .escape(),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('La categoría no puede exceder los 50 caracteres')
    .escape(),
  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA SOCIOS
// =============================================
