// Calculadora unificada para gastos recurrentes
//
// Centraliza toda la lógica de cálculos para gastos recurrentes,
// reemplazando las implementaciones duplicadas en frontend y backend.

import { 
  FREQUENCY_PATTERNS, 
  LEGACY_FREQUENCY_MAP, 
  DEFAULT_CONFIG, 
  CALCULATION_CONSTANTS 
} from './constants.js';
import { validateRecurrenceConfig, validateAmount } from './validator.js';
import { logger } from '../utils/logger.js';

// Clase principal para cálculos de gastos recurrentes
export class RecurringExpenseCalculator {
  constructor() {
    this.constants = CALCULATION_CONSTANTS;
  }

  // Normaliza la configuración de un gasto recurrente
  // Maneja tanto formato legacy como nuevo formato
  // @param {Object} expense - Gasto recurrente
  // @returns {Object} - Configuración normalizada
  normalizeConfig(expense) {
    if (!expense) {
      return {
        ...DEFAULT_CONFIG,
        startDate: DEFAULT_CONFIG.startDate()
      };
    }

    let config = {};
    let frequency, interval;

    // Priorizar nuevo formato 'recurrence' sobre legacy 'recurringConfig'
    if (expense.recurrence) {
      config = expense.recurrence;
      frequency = config.pattern || config.frequency;
      interval = config.interval;
    } else if (expense.recurringConfig) {
      config = expense.recurringConfig;
      frequency = config.frequency;
      interval = config.interval;
    } else {
      // Fallback a propiedades directas
      frequency = expense.frequency;
      interval = expense.interval;
      config = expense;
    }

    // Normalizar frecuencia usando mapeo
    const normalizedFrequency = this._normalizeFrequency(frequency);
    const normalizedInterval = parseInt(interval) || DEFAULT_CONFIG.interval;

    return {
      pattern: normalizedFrequency,
      interval: normalizedInterval,
      startDate: config.startDate || expense.startDate || DEFAULT_CONFIG.startDate(),
      endDate: config.endDate || expense.endDate || null,
      isActive: config.isActive !== undefined ? config.isActive : expense.isActive !== undefined ? expense.isActive : DEFAULT_CONFIG.isActive,
      lastProcessed: config.lastProcessed || expense.lastProcessed || null,
      dailyAdjustments: config.dailyAdjustments || expense.dailyAdjustments || DEFAULT_CONFIG.dailyAdjustments,
      adjustmentsMonth: config.adjustmentsMonth || expense.adjustmentsMonth || DEFAULT_CONFIG.adjustmentsMonth,
      config: this._extractPatternConfig(config, expense, normalizedFrequency)
    };
  }

  // Calcula el monto diario base de un gasto recurrente
  // Convierte el monto según el patrón a un promedio por día (base para reportes).
  // @param {Object} expense - Gasto recurrente
  // @returns {number} - Monto diario base
  calculateBaseDailyAmount(expense) {
    if (!expense || !expense.amount) {
      return 0;
    }

    const amount = parseFloat(expense.amount);
    const config = this.normalizeConfig(expense);

    switch (config.pattern) {
      case FREQUENCY_PATTERNS.DAILY:
        return amount / config.interval;

      case FREQUENCY_PATTERNS.WEEKLY:
        return (amount * 7) / (config.interval * this.constants.DAYS_IN_MONTH);

      case FREQUENCY_PATTERNS.MONTHLY:
        return amount / (config.interval * this.constants.DAYS_IN_MONTH);

      case FREQUENCY_PATTERNS.YEARLY:
        return amount / (config.interval * this.constants.DAYS_IN_YEAR);

      default:
        logger.warn(`Patrón de frecuencia no reconocido: ${config.pattern}`);
        return amount / this.constants.DAYS_IN_MONTH; // Fallback mensual
    }
  }

  // Obtiene el monto ajustado para una fecha específica
  // @param {Object} expense - Gasto recurrente
  // @param {string} dateStr - Fecha en formato YYYY-MM-DD
  // @returns {number} - Monto ajustado para la fecha
  getDailyAdjustedAmount(expense, dateStr) {
    const baseDailyAmount = this.calculateBaseDailyAmount(expense);
    const config = this.normalizeConfig(expense);

    // Verificar si hay ajuste específico para esta fecha
    if (config.dailyAdjustments && config.dailyAdjustments[dateStr] !== undefined) {
      return parseFloat(config.dailyAdjustments[dateStr]) || 0;
    }

    return baseDailyAmount;
  }

  // Calcula el monto mensual de un gasto recurrente
  // Normaliza el monto al equivalente mensual según el patrón e intervalo.
  // @param {Object} expense - Gasto recurrente
  // @returns {number} - Monto mensual
  calculateMonthlyAmount(expense) {
    if (!expense || !expense.amount) {
      return 0;
    }

    const amount = parseFloat(expense.amount);
    const config = this.normalizeConfig(expense);

    switch (config.pattern) {
      case FREQUENCY_PATTERNS.DAILY:
        return (amount * this.constants.DAYS_IN_MONTH) / config.interval;

      case FREQUENCY_PATTERNS.WEEKLY:
        return (amount * this.constants.WEEKS_IN_MONTH) / config.interval;

      case FREQUENCY_PATTERNS.MONTHLY:
        return amount / config.interval;

      case FREQUENCY_PATTERNS.YEARLY:
        return amount / (config.interval * this.constants.MONTHS_IN_YEAR);

      default:
        logger.warn(`Patrón de frecuencia no reconocido: ${config.pattern}`);
        return amount; // Fallback mensual
    }
  }

  // Calcula el monto total para un rango de fechas
  // @param {Object} expense - Gasto recurrente
  // @param {string} startDate - Fecha de inicio (YYYY-MM-DD)
  // @param {string} endDate - Fecha de fin (YYYY-MM-DD)
  // @returns {number} - Monto total para el rango
  calculateRangeAmount(expense, startDate, endDate) {
    if (!expense || !startDate || !endDate) {
      return 0;
    }

    const config = this.normalizeConfig(expense);
    
    // Verificar si el gasto está activo en el rango
    if (!this._isActiveInRange(config, startDate, endDate)) {
      return 0;
    }

    let totalAmount = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Iterar día por día en el rango
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = this._formatDate(currentDate);
      
      if (this._shouldOccurOnDate(config, currentDate)) {
        totalAmount += this.getDailyAdjustedAmount(expense, dateStr);
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalAmount;
  }

  // Calcula la próxima fecha de ocurrencia
  // @param {Object} expense - Gasto recurrente
  // @param {string|Date} fromDate - Fecha desde la cual calcular (opcional)
  // @returns {Date|null} - Próxima fecha de ocurrencia
  calculateNextOccurrence(expense, fromDate = new Date()) {
    const config = this.normalizeConfig(expense);
    
    if (!config.isActive) {
      return null;
    }

    const baseDate = new Date(fromDate);
    const startDate = new Date(config.startDate);
    
    // Si la fecha base es anterior al inicio, retornar fecha de inicio
    if (baseDate < startDate) {
      return startDate;
    }

    // Verificar fecha de fin
    if (config.endDate && baseDate >= new Date(config.endDate)) {
      return null;
    }

    return this._calculateNextDateForPattern(config, baseDate);
  }

  // Verifica si un gasto debe ocurrir en una fecha específica
  // @param {Object} expense - Gasto recurrente
  // @param {string|Date} date - Fecha a verificar
  // @returns {boolean} - True si debe ocurrir en esa fecha
  shouldOccurOnDate(expense, date) {
    const config = this.normalizeConfig(expense);
    const checkDate = new Date(date);
    
    return this._shouldOccurOnDate(config, checkDate);
  }

  // ============ MÉTODOS PRIVADOS ============

  // Normaliza la frecuencia usando el mapeo de legacy
  // @private
  _normalizeFrequency(frequency) {
    if (!frequency) {
      return DEFAULT_CONFIG.frequency;
    }
    
    return LEGACY_FREQUENCY_MAP[frequency.toLowerCase()] || frequency;
  }

  // Extrae la configuración específica del patrón
  // @private
  _extractPatternConfig(config, expense, pattern) {
    const patternConfig = config.config || {};

    switch (pattern) {
      case FREQUENCY_PATTERNS.WEEKLY:
        return {
          weekDays: patternConfig.weekDays || 
                   (config.dayOfWeek !== undefined ? [parseInt(config.dayOfWeek)] : [])
        };

      case FREQUENCY_PATTERNS.MONTHLY:
        return {
          monthDays: patternConfig.monthDays || 
                    (config.specificDates?.length > 0 ? config.specificDates.map(d => parseInt(d)) :
                     config.dayOfMonth !== undefined ? [parseInt(config.dayOfMonth)] : [])
        };

      case FREQUENCY_PATTERNS.YEARLY: {
        if (patternConfig.yearConfig) {
          return { yearConfig: patternConfig.yearConfig };
        }
        // Extraer del startDate si no hay configuración específica
        const startDate = new Date(config.startDate || expense.startDate);
        return {
          yearConfig: {
            month: startDate.getMonth() + 1,
            day: startDate.getDate()
          }
        };
      }

      default:
        return {};
    }
  }

  // Verifica si el gasto está activo en un rango de fechas
  // @private
  _isActiveInRange(config, startDate, endDate) {
    if (!config.isActive) {
      return false;
    }

    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);
    const expenseStart = new Date(config.startDate);
    
    // El gasto debe haber comenzado antes del final del rango
    if (expenseStart > rangeEnd) {
      return false;
    }

    // Si hay fecha de fin, debe ser después del inicio del rango
    if (config.endDate) {
      const expenseEnd = new Date(config.endDate);
      if (expenseEnd < rangeStart) {
        return false;
      }
    }

    return true;
  }

  // Verifica si un gasto debe ocurrir en una fecha específica según su configuración
  // @private
  _shouldOccurOnDate(config, date) {
    const startDate = new Date(config.startDate);
    
    // No puede ocurrir antes de la fecha de inicio
    if (date < startDate) {
      return false;
    }

    // No puede ocurrir después de la fecha de fin
    if (config.endDate && date > new Date(config.endDate)) {
      return false;
    }

    switch (config.pattern) {
      case FREQUENCY_PATTERNS.DAILY:
        return this._shouldOccurDaily(config, date, startDate);

      case FREQUENCY_PATTERNS.WEEKLY:
        return this._shouldOccurWeekly(config, date, startDate);

      case FREQUENCY_PATTERNS.MONTHLY:
        return this._shouldOccurMonthly(config, date, startDate);

      case FREQUENCY_PATTERNS.YEARLY:
        return this._shouldOccurYearly(config, date, startDate);

      default:
        return false;
    }
  }

  // Lógica para recurrencia diaria
  // @private
  _shouldOccurDaily(config, date, startDate) {
    const daysDiff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
    return daysDiff >= 0 && daysDiff % config.interval === 0;
  }

  // Lógica para recurrencia semanal
  // @private
  _shouldOccurWeekly(config, date, startDate) {
    // Si hay días específicos configurados, verificar solo esos días
    if (config.config.weekDays && config.config.weekDays.length > 0) {
      const dayOfWeek = date.getDay();
      if (!config.config.weekDays.includes(dayOfWeek)) {
        return false;
      }
    }

    const weeksDiff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24 * 7));
    return weeksDiff >= 0 && weeksDiff % config.interval === 0;
  }

  // Lógica para recurrencia mensual
  // @private
  _shouldOccurMonthly(config, date, startDate) {
    // Si hay días específicos del mes configurados
    if (config.config.monthDays && config.config.monthDays.length > 0) {
      const dayOfMonth = date.getDate();
      if (!config.config.monthDays.includes(dayOfMonth)) {
        return false;
      }
    }

    // Verificar intervalo de meses
    const monthsDiff = (date.getFullYear() - startDate.getFullYear()) * 12 + 
                       (date.getMonth() - startDate.getMonth());
    return monthsDiff >= 0 && monthsDiff % config.interval === 0;
  }

  // Lógica para recurrencia anual
  // @private
  _shouldOccurYearly(config, date, startDate) {
    const yearConfig = config.config.yearConfig;
    
    if (yearConfig) {
      const targetMonth = yearConfig.month - 1; // Convertir a 0-based
      const targetDay = yearConfig.day;
      
      if (date.getMonth() !== targetMonth || date.getDate() !== targetDay) {
        return false;
      }
    } else {
      // Usar la fecha de inicio como referencia
      if (date.getMonth() !== startDate.getMonth() || 
          date.getDate() !== startDate.getDate()) {
        return false;
      }
    }

    const yearsDiff = date.getFullYear() - startDate.getFullYear();
    return yearsDiff >= 0 && yearsDiff % config.interval === 0;
  }

  // Calcula la próxima fecha para un patrón específico
  // @private
  _calculateNextDateForPattern(config, fromDate) {
    const nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + 1); // Empezar desde el día siguiente

    // Buscar hasta 2 años en el futuro como máximo
    const maxDate = new Date(fromDate);
    maxDate.setFullYear(maxDate.getFullYear() + 2);

    while (nextDate <= maxDate) {
      if (this._shouldOccurOnDate(config, nextDate)) {
        return new Date(nextDate);
      }
      nextDate.setDate(nextDate.getDate() + 1);
    }

    return null; // No se encontró próxima ocurrencia
  }

  // Formatea una fecha como YYYY-MM-DD
  // @private
  _formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  // Calcula el monto mensual base sin ajustes diarios
  // (Alias de calculateMonthlyAmount para compatibilidad)
  // @param {Object} expense - Gasto recurrente
  // @returns {number} - Monto mensual base
  calculateBaseMonthlyAmount(expense) {
    return this.calculateMonthlyAmount(expense);
  }

  // Obtiene la descripción de frecuencia del gasto
  // @param {Object} expense - Gasto recurrente
  // @returns {string} - Descripción de la frecuencia
  getFrequencyDescription(expense) {
    const config = this.normalizeConfig(expense);
    const { pattern, interval } = config;
    
    if (!pattern) return 'Sin configurar';
    
    switch (pattern) {
      case 'daily':
        return interval === 1 ? 'Diario' : `Cada ${interval} días`;
      case 'weekly':
        return interval === 1 ? 'Semanal' : `Cada ${interval} semanas`;
      case 'monthly':
        return interval === 1 ? 'Mensual' : `Cada ${interval} meses`;
      case 'yearly':
        return interval === 1 ? 'Anual' : `Cada ${interval} años`;
      default: {
        const intervalText = interval > 1 ? ` cada ${interval}` : '';
        return `${pattern}${intervalText}`;
      }
    }
  }
}

// Instancia singleton para uso directo
export const calculator = new RecurringExpenseCalculator();

// Exportar métodos estáticos para compatibilidad con implementaciones existentes
export const normalizeRecurringConfig = (expense) => calculator.normalizeConfig(expense);
export const calculateBaseDailyAmount = (expense) => calculator.calculateBaseDailyAmount(expense);
export const calculateMonthlyAmount = (expense) => calculator.calculateMonthlyAmount(expense);
export const getDailyAdjustedAmount = (expense, dateStr) => calculator.getDailyAdjustedAmount(expense, dateStr);
export const calculateRangeAmount = (expense, startDate, endDate) => calculator.calculateRangeAmount(expense, startDate, endDate);
export const calculateNextOccurrence = (expense, fromDate) => calculator.calculateNextOccurrence(expense, fromDate);
export const shouldOccurOnDate = (expense, date) => calculator.shouldOccurOnDate(expense, date);

// Calcula el monto mensual base sin ajustes diarios
// (Alias de calculateMonthlyAmount para compatibilidad)
// @param {Object} expense - Gasto recurrente
// @returns {number} - Monto mensual base
export const calculateBaseMonthlyAmount = (expense) => calculator.calculateMonthlyAmount(expense);

// Obtiene la descripción de frecuencia del gasto
// @param {Object} expense - Gasto recurrente
// @returns {string} - Descripción de la frecuencia
export const getFrequencyDescription = (expense) => {
  const { formatExpenseSummary } = require('./formatter.js');
  return formatExpenseSummary(expense).frequency;
};

export default calculator;