import { body } from 'express-validator';
import { Service } from '../../../barrel.js';
import { handleValidationErrors } from './core.js';

// Validaciones para servicios
export const validateService = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre del servicio debe tener entre 2 y 100 caracteres')
    .escape(),
  body('description')
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder los 500 caracteres')
    .escape(),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('El precio debe ser un número positivo'),
  body('duration')
    .isInt({ min: 15, max: 240 })
    .withMessage('La duración debe estar entre 15 y 240 minutos'),
  body('category')
    .isIn(['corte', 'barba', 'combo', 'tinte', 'tratamiento'])
    .withMessage('Categoría no válida'),
  handleValidationErrors
];
