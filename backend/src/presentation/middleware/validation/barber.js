import { body } from 'express-validator';
import { Barber, Service } from '../../../barrel.js';
import { handleValidationErrors } from './core.js';

// Validaciones para barberos
export const validateBarber = [
  body('specialty')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('La especialidad debe tener entre 2 y 100 caracteres')
    .escape(),
  body('experience')
    .optional()
    .isInt({ min: 0 })
    .withMessage('La experiencia debe ser un número positivo'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder los 500 caracteres')
    .escape(),
  body('services')
    .optional()
    .isArray()
    .withMessage('Los servicios deben ser un array'),
  body('services.*')
    .isMongoId()
    .withMessage('ID de servicio inválido')
    .custom(async (serviceId) => {
      const service = await Service.findById(serviceId);
      if (!service) {
        throw new Error('Servicio no encontrado');
      }
      return true;
    }),
  handleValidationErrors
];
