import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';

// Middleware de validación para el registro público.
// Valida nombre, email y contraseña; el campo role se ignora (ver nota inferior).
export const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios')
    .escape(),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Debe proporcionar un email válido')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/[a-z]/)
    .withMessage('La contraseña debe contener al menos una minúscula')
    .matches(/[A-Z]/)
    .withMessage('La contraseña debe contener al menos una mayúscula')
    .matches(/\d/)
    .withMessage('La contraseña debe contener al menos un número'),
  
  // El campo `role` se ignora deliberadamente: el registro público siempre crea usuarios 'user'

  handleValidationErrors
];

// Middleware de validación para cambio de contraseña:
// exige la contraseña actual y aplica las mismas reglas de complejidad a la nueva.
export const validatePasswordChange = [
  body('currentPassword')
    .exists()
    .withMessage('La contraseña actual es requerida'),
    
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/[a-z]/)
    .withMessage('La nueva contraseña debe contener al menos una minúscula')
    .matches(/[A-Z]/)
    .withMessage('La nueva contraseña debe contener al menos una mayúscula')
    .matches(/\d/)
    .withMessage('La nueva contraseña debe contener al menos un número'),
  
  handleValidationErrors
];
