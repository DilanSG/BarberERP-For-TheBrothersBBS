import { body } from 'express-validator';
import { Appointment } from '../../../barrel.js';
import { handleValidationErrors } from './core.js';

// Validaciones para reseñas
export const validateReview = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('El rating debe estar entre 1 y 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('El comentario no puede exceder los 1000 caracteres')
    .escape(),
  body('appointmentId')
    .isMongoId()
    .withMessage('ID de cita inválido')
    .custom(async (appointmentId, { req }) => {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        throw new Error('Cita no encontrada');
      }
      if (appointment.user.toString() !== req.user._id.toString()) {
        throw new Error('No puedes reseñar esta cita');
      }
      if (appointment.status !== 'completed') {
        throw new Error('Solo puedes reseñar citas completadas');
      }
      return true;
    }),
  handleValidationErrors
];
