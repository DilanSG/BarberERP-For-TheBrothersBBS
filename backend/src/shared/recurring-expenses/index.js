// Módulo unificado de gastos recurrentes
//
// Exporta todas las utilidades para gastos recurrentes en un solo lugar,
// reemplazando las implementaciones duplicadas en frontend y backend.
// Mantiene aliases (RecurrenceCalculator) y un helper legacy para compatibilidad.

// Exportar constantes
export * from './constants.js';

// Exportar validaciones
export * from './validator.js';

// Exportar calculadora
export * from './calculator.js';

// Exportar formateadores
export * from './formatter.js';

// Exportar instancias por defecto para compatibilidad
import calculator from './calculator.js';
export { calculator as RecurringExpenseCalculator };

// Alias para compatibilidad con código existente
export { calculator as RecurrenceCalculator };

// Clase helper para compatibilidad con código legacy
export class RecurringExpenseHelper {
  static convertLegacyFormat(recurringConfig) {
    return calculator.normalizeConfig({ recurringConfig });
  }
  
  static isRecurring(expense) {
    const config = calculator.normalizeConfig(expense);
    return config.isActive && config.pattern;
  }
  
  static getRecurrenceDescription(expense) {
    const { formatExpenseSummary } = require('./formatter.js');
    return formatExpenseSummary(expense).frequency;
  }
  
  static formatCurrency(amount) {
    const { formatAmount } = require('./formatter.js');
    return formatAmount(amount);
  }
  
  static formatDate(date, format) {
    const { formatDate } = require('./formatter.js');
    return formatDate(date, format);
  }
}

// Función helper principal para uso directo
// Valida la configuración y devuelve un objeto con métodos de cálculo ya ligados a ella.
export const createRecurringExpense = (config) => {
  const validation = validateRecurrenceConfig(config);
  
  if (!validation.isValid) {
    throw new Error(`Configuración inválida: ${validation.errors.join(', ')}`);
  }
  
  return {
    ...config,
    normalizedConfig: calculator.normalizeConfig(config),
    calculateDailyAmount: (date) => calculator.getDailyAdjustedAmount(config, date),
    calculateRangeAmount: (startDate, endDate) => calculator.calculateRangeAmount(config, startDate, endDate),
    getNextOccurrence: (fromDate) => calculator.calculateNextOccurrence(config, fromDate),
    shouldOccurOnDate: (date) => calculator.shouldOccurOnDate(config, date),
    format: () => formatExpenseSummary(config)
  };
};

// Importar validaciones y formateadores
import { validateRecurrenceConfig } from './validator.js';
import { formatExpenseSummary } from './formatter.js';