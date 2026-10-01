import { body, param, query } from 'express-validator';
import { handleValidationErrors, validateMongoId } from './core.js';

// Validación para asignar subrol de socio
export const validateCreateSocio = [
  body('userId')
    .notEmpty()
    .withMessage('El ID del usuario es requerido')
    .custom(validateMongoId)
    .withMessage('ID de usuario inválido'),
  body('porcentaje')
    .isNumeric()
    .withMessage('El porcentaje debe ser un número')
    .isFloat({ min: 0.01, max: 100 })
    .withMessage('El porcentaje debe estar entre 0.01 y 100'),
  body('telefono')
    .optional()
    .trim()
    .isMobilePhone('es-CO')
    .withMessage('Debe proporcionar un número de teléfono válido de Colombia')
    .isLength({ max: 20 })
    .withMessage('El teléfono no puede exceder los 20 caracteres'),
  body('notas')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Las notas no pueden exceder los 500 caracteres')
    .escape(),
  handleValidationErrors
];

// Validación para actualizar porcentaje
export const validateUpdatePorcentaje = [
  param('id')
    .custom(validateMongoId)
    .withMessage('ID de socio inválido'),
  body('porcentaje')
    .isNumeric()
    .withMessage('El porcentaje debe ser un número')
    .isFloat({ min: 0.01, max: 100 })
    .withMessage('El porcentaje debe estar entre 0.01 y 100'),
  handleValidationErrors
];

// Validación para obtener distribución
export const validateDistribucion = [
  query('gananciaTotal')
    .isNumeric()
    .withMessage('La ganancia total debe ser un número')
    .isFloat()
    .withMessage('La ganancia total debe ser un número válido'),
  handleValidationErrors
];
