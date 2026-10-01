// Validaciones para gastos recurrentes
//
// Proporciona validaciones consistentes para configuraciones de
// gastos recurrentes en frontend y backend.

import { 
  FREQUENCY_PATTERNS, 
  WEEKDAYS, 
  MONTHS,
  CALCULATION_CONSTANTS 
} from './constants.js';

// Valida una configuración de recurrencia completa
// @param {Object} config - Configuración de recurrencia
// @returns {Object} - { isValid: boolean, errors: string[] }
export const validateRecurrenceConfig = (config) => {
  const errors = [];
  
  if (!config) {
    errors.push('Configuración de recurrencia es requerida');
    return { isValid: false, errors };
  }
  
  // Validar patrón de frecuencia
  const patternValidation = validateFrequencyPattern(config.pattern || config.frequency);
  if (!patternValidation.isValid) {
    errors.push(...patternValidation.errors);
  }
  
  // Validar intervalo
  const intervalValidation = validateInterval(config.interval);
  if (!intervalValidation.isValid) {
    errors.push(...intervalValidation.errors);
  }
  
  // Validar fechas
  const dateValidation = validateDates(config.startDate, config.endDate);
  if (!dateValidation.isValid) {
    errors.push(...dateValidation.errors);
  }
  
  // Validar configuración específica del patrón
  const patternSpecificValidation = validatePatternSpecificConfig(
    config.pattern || config.frequency, 
    config.config || {}
  );
  if (!patternSpecificValidation.isValid) {
    errors.push(...patternSpecificValidation.errors);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Valida el patrón de frecuencia
// @param {string} pattern - Patrón de frecuencia
// @returns {Object} - Resultado de validación
export const validateFrequencyPattern = (pattern) => {
  const errors = [];
  
  if (!pattern) {
    errors.push('Patrón de frecuencia es requerido');
  } else if (!Object.values(FREQUENCY_PATTERNS).includes(pattern)) {
    errors.push(`Patrón de frecuencia no válido: ${pattern}. Debe ser uno de: ${Object.values(FREQUENCY_PATTERNS).join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Valida el intervalo de recurrencia
// @param {number} interval - Intervalo
// @returns {Object} - Resultado de validación
export const validateInterval = (interval) => {
  const errors = [];
  
  if (interval === undefined || interval === null) {
    errors.push('Intervalo es requerido');
  } else {
    const numInterval = parseInt(interval);
    if (isNaN(numInterval) || numInterval < 1) {
      errors.push('Intervalo debe ser un número entero mayor a 0');
    } else if (numInterval > 365) {
      errors.push('Intervalo no puede ser mayor a 365');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Valida fechas de inicio y fin
// @param {string|Date} startDate - Fecha de inicio
// @param {string|Date} endDate - Fecha de fin (opcional)
// @returns {Object} - Resultado de validación
export const validateDates = (startDate, endDate) => {
  const errors = [];
  
  // Validar fecha de inicio
  if (!startDate) {
    errors.push('Fecha de inicio es requerida');
  } else {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      errors.push('Fecha de inicio no válida');
    }
  }
  
  // Validar fecha de fin si se proporciona
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      errors.push('Fecha de fin no válida');
    } else if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime()) && end <= start) {
        errors.push('Fecha de fin debe ser posterior a la fecha de inicio');
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Valida configuración específica según el patrón
// @param {string} pattern - Patrón de frecuencia
// @param {Object} config - Configuración específica
// @returns {Object} - Resultado de validación
export const validatePatternSpecificConfig = (pattern, config) => {
  const errors = [];
  
  switch (pattern) {
    case FREQUENCY_PATTERNS.WEEKLY:
      if (config.weekDays) {
        if (!Array.isArray(config.weekDays)) {
          errors.push('weekDays debe ser un array');
        } else {
          const invalidDays = config.weekDays.filter(day => 
            !Object.values(WEEKDAYS).includes(parseInt(day))
          );
          if (invalidDays.length > 0) {
            errors.push(`Días de semana no válidos: ${invalidDays.join(', ')}. Deben estar entre 0-6`);
          }
        }
      }
      break;
      
    case FREQUENCY_PATTERNS.MONTHLY:
      if (config.monthDays) {
        if (!Array.isArray(config.monthDays)) {
          errors.push('monthDays debe ser un array');
        } else {
          const invalidDays = config.monthDays.filter(day => {
            const dayNum = parseInt(day);
            return dayNum < 1 || dayNum > 31;
          });
          if (invalidDays.length > 0) {
            errors.push(`Días de mes no válidos: ${invalidDays.join(', ')}. Deben estar entre 1-31`);
          }
        }
      }
      break;
      
    case FREQUENCY_PATTERNS.YEARLY:
      if (config.yearConfig) {
        const { month, day } = config.yearConfig;
        if (month !== undefined) {
          if (!Object.values(MONTHS).includes(parseInt(month) - 1)) {
            errors.push(`Mes no válido: ${month}. Debe estar entre 1-12`);
          }
        }
        if (day !== undefined) {
          const dayNum = parseInt(day);
          if (dayNum < 1 || dayNum > 31) {
            errors.push(`Día no válido: ${day}. Debe estar entre 1-31`);
          }
        }
      }
      break;
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Valida el monto de un gasto
// @param {number} amount - Monto del gasto
// @returns {Object} - Resultado de validación
export const validateAmount = (amount) => {
  const errors = [];
  
  if (amount === undefined || amount === null) {
    errors.push('Monto es requerido');
  } else {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      errors.push('Monto debe ser un número válido');
    } else if (numAmount <= 0) {
      errors.push('Monto debe ser mayor a 0');
    } else if (numAmount > 1000000) {
      errors.push('Monto no puede ser mayor a $1,000,000');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Valida ajustes diarios
// @param {Object} dailyAdjustments - Ajustes por día
// @returns {Object} - Resultado de validación
export const validateDailyAdjustments = (dailyAdjustments) => {
  const errors = [];
  
  if (!dailyAdjustments || typeof dailyAdjustments !== 'object') {
    return { isValid: true, errors: [] }; // Opcional
  }
  
  for (const [dateStr, adjustment] of Object.entries(dailyAdjustments)) {
    // Validar formato de fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      errors.push(`Formato de fecha no válido: ${dateStr}. Debe ser YYYY-MM-DD`);
      continue;
    }
    
    // Validar fecha válida
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      errors.push(`Fecha no válida: ${dateStr}`);
      continue;
    }
    
    // Validar ajuste
    if (typeof adjustment !== 'number' || isNaN(adjustment)) {
      errors.push(`Ajuste no válido para ${dateStr}: debe ser un número`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};