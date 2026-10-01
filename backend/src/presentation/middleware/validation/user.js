import { body, param, query } from 'express-validator';
import { User } from '../../../barrel.js';
import { handleValidationErrors, validateMongoId } from './core.js';

// Validación para actualización de usuario
export const validateUserUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),
    
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Debe proporcionar un email válido')
    .normalizeEmail(),
    
  body('phone')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') return true; // Optional field
      
      // Convertir a string y limpiar
      const phoneStr = String(value).trim();
      
      // Remover espacios, guiones, paréntesis para validar
      const cleanPhone = phoneStr.replace(/[\s\-()]/g, '');
      
      // Si empieza con +, es formato internacional
      if (cleanPhone.startsWith('+')) {
        // Debe tener entre 8 y 15 dígitos después del +
        if (!/^\+\d{8,15}$/.test(cleanPhone)) {
          throw new Error('Formato internacional inválido');
        }
        
        // Para Colombia (+57), debe tener exactamente 10 dígitos después del +57
        if (cleanPhone.startsWith('+57')) {
          const digitsAfter57 = cleanPhone.substring(3);
          if (!/^\d{10}$/.test(digitsAfter57)) {
            throw new Error('Número colombiano inválido');
          }
        }
      } else {
        // Números locales: solo dígitos, entre 7 y 15
        if (!/^\d{7,15}$/.test(cleanPhone)) {
          throw new Error('Número local inválido');
        }
      }
      
      return true;
    }),
    
  body('birthdate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Fecha de nacimiento inválida'),
    
  handleValidationErrors
];

// Validaciones comunes
export const commonValidations = {
  // Validación de ID
  id: param('id')
    .custom(validateMongoId)
    .withMessage('ID inválido'),

  // Validación de email
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Debe proporcionar un email válido'),

  // Validación de teléfono
  phone: body('phone')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') return true; // Optional field
      
      // Convertir a string y limpiar
      const phoneStr = String(value).trim();
      
      // Remover espacios, guiones, paréntesis para validar
      const cleanPhone = phoneStr.replace(/[\s\-()]/g, '');
      
      // Si empieza con +, es formato internacional
      if (cleanPhone.startsWith('+')) {
        // Debe tener entre 8 y 15 dígitos después del +
        if (!/^\+\d{8,15}$/.test(cleanPhone)) {
          throw new Error('Formato internacional inválido');
        }
        
        // Para Colombia (+57), debe tener exactamente 10 dígitos después del +57
        if (cleanPhone.startsWith('+57')) {
          const digitsAfter57 = cleanPhone.substring(3);
          if (!/^\d{10}$/.test(digitsAfter57)) {
            throw new Error('Número colombiano inválido');
          }
        }
      } else {
        // Números locales: solo dígitos, entre 7 y 15
        if (!/^\d{7,15}$/.test(cleanPhone)) {
          throw new Error('Número local inválido');
        }
      }
      
      return true;
    }),

  // Validación de contraseña
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),

  // Validación de fecha
  date: body('date')
    .isISO8601()
    .toDate()
    .withMessage('Fecha inválida'),

  // Validación de precio
  price: body('price')
    .isFloat({ min: 0 })
    .withMessage('El precio debe ser un número positivo'),

  // Validación de cantidad
  quantity: body('quantity')
    .isInt({ min: 0 })
    .withMessage('La cantidad debe ser un número entero positivo'),

  // Validación de página para paginación
  page: query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un número entero positivo'),

  // Validación de límite para paginación
  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('El límite debe ser un número entre 1 y 100')
};

// Validaciones para usuarios
export const userValidations = {
  create: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres')
      .matches(/^[a-zA-ZÀ-ÿ\s]{2,50}$/)
      .withMessage('El nombre solo puede contener letras y espacios')
      .escape(),
    commonValidations.email,
    commonValidations.password,
    commonValidations.phone.optional(),
    body('role')
      .optional()
      .isIn(['user', 'barber', 'admin'])
      .withMessage('Rol no válido'),
    handleValidationErrors
  ],

  update: [
    commonValidations.id,
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres')
      .matches(/^[a-zA-ZÀ-ÿ\s]{2,50}$/)
      .withMessage('El nombre solo puede contener letras y espacios')
      .escape(),
    commonValidations.email.optional(),
    commonValidations.phone.optional(),
    handleValidationErrors
  ],

  changePassword: [
    commonValidations.id,
    body('currentPassword')
      .notEmpty()
      .withMessage('La contraseña actual es requerida'),
    commonValidations.password,
    handleValidationErrors
  ]
};

// Variante legacy de validación de usuario, mantenida por compatibilidad con rutas existentes.
// A diferencia de userValidations, valida email/password contra la BD en el momento.
export const validateUser = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .escape(),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Debe proporcionar un email válido')
    .custom(async (email, { req }) => {
      const user = await User.findOne({ email, isActive: true });
      if (user && user._id.toString() !== req.params?.id) {
        throw new Error('El email ya está en uso');
      }
      return true;
    }),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
  body('phone')
    .optional()
    .custom((value) => {
      if (!value || value.trim() === '') return true; // Optional field
      
      // Convertir a string y limpiar
      const phoneStr = String(value).trim();
      
      // Remover espacios, guiones, paréntesis para validar
      const cleanPhone = phoneStr.replace(/[\s\-()]/g, '');
      
      // Si empieza con +, es formato internacional
      if (cleanPhone.startsWith('+')) {
        // Debe tener entre 8 y 15 dígitos después del +
        if (!/^\+\d{8,15}$/.test(cleanPhone)) {
          throw new Error('Formato internacional inválido. Debe ser +[código][número]');
        }
        
        // Para Colombia (+57), debe tener exactamente 10 dígitos después del +57
        if (cleanPhone.startsWith('+57')) {
          const digitsAfter57 = cleanPhone.substring(3); // Quita "+57"
          if (!/^\d{10}$/.test(digitsAfter57)) {
            throw new Error('Número colombiano debe tener formato +57XXXXXXXXXX (10 dígitos después de +57)');
          }
        }
      } else {
        // Números locales: solo dígitos, entre 7 y 15
        if (!/^\d{7,15}$/.test(cleanPhone)) {
          throw new Error('Número local debe contener solo dígitos (7-15 caracteres)');
        }
      }
      
      return true;
    }),
  body('role')
    .optional()
    .isIn(['user', 'barber', 'admin'])
    .withMessage('Rol no válido'),
  handleValidationErrors
];
