import { body } from 'express-validator';
import { SALE_TYPES, getValidSaleTypes, VALIDATION_MESSAGES } from '../../../shared/constants/salesConstants.js';
import { handleValidationErrors, validateMongoId } from './core.js';

// Validaciones para ventas
// Los campos productId/productName son obligatorios solo para tipo 'product',
// y serviceId/serviceName solo para 'walkIn' (validaciones condicionales con .if()).
export const validateSale = [
  body('type')
    .notEmpty()
    .withMessage('El tipo de venta es requerido')
    .custom((value) => {
      const validTypes = getValidSaleTypes();
      if (!validTypes.includes(value)) {
        throw new Error(VALIDATION_MESSAGES.SALE_TYPE_INVALID);
      }
      return true;
    }),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un número entero mayor a 0'),
  body('unitPrice')
    .isFloat({ min: 0 })
    .withMessage('El precio unitario debe ser un número positivo'),
  body('totalAmount')
    .isFloat({ min: 0 })
    .withMessage('El total debe ser un número positivo'),
  body('paymentMethod')
    .notEmpty()
    .withMessage('El método de pago es requerido')
    .isString()
    .trim(),
  body('barberId')
    .notEmpty()
    .withMessage('El ID del barbero es requerido')
    .custom(validateMongoId)
    .withMessage('ID de barbero no válido'),
  // Validaciones condicionales según tipo
  body('productId')
    .if(body('type').equals(SALE_TYPES.PRODUCT))
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.PRODUCT_ID_REQUIRED)
    .custom(validateMongoId)
    .withMessage('ID de producto no válido'),
  body('productName')
    .if(body('type').equals(SALE_TYPES.PRODUCT))
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.PRODUCT_NAME_REQUIRED)
    .isString()
    .trim(),
  body('serviceId')
    .if(body('type').equals(SALE_TYPES.WALKIN))
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.SERVICE_ID_REQUIRED)
    .custom(validateMongoId)
    .withMessage('ID de servicio no válido'),
  body('serviceName')
    .if(body('type').equals(SALE_TYPES.WALKIN))
    .notEmpty()
    .withMessage(VALIDATION_MESSAGES.SERVICE_NAME_REQUIRED)
    .isString()
    .trim(),
  body('category')
    .optional()
    .isString()
    .trim()
    .withMessage('La categoría debe ser un texto válido'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder 500 caracteres'),
  handleValidationErrors
];

// Validaciones para venta desde carrito
export const validateCartSale = [
  body('cart')
    .isArray({ min: 1 })
    .withMessage('El carrito debe contener al menos un item'),
  body('cart.*.type')
    .isIn(getValidSaleTypes())
    .withMessage(VALIDATION_MESSAGES.SALE_TYPE_INVALID),
  body('cart.*.quantity')
    .isInt({ min: 1 })
    .withMessage('La cantidad de cada item debe ser mayor a 0'),
  body('cart.*.price')
    .isFloat({ min: 0 })
    .withMessage('El precio de cada item debe ser positivo'),
  body('cart.*.paymentMethod')
    .notEmpty()
    .withMessage('Cada item debe tener un método de pago'),
  body('barberId')
    .notEmpty()
    .withMessage('El ID del barbero es requerido')
    .custom(validateMongoId)
    .withMessage('ID de barbero no válido'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder 500 caracteres'),
  handleValidationErrors
];
