// Formateadores para gastos recurrentes
//
// Proporciona utilidades de formato y presentación para
// gastos recurrentes en frontend y backend.

import { 
  FREQUENCY_PATTERNS, 
  WEEKDAY_LABELS, 
  MONTH_LABELS 
} from './constants.js';

// Formatea una frecuencia para mostrar al usuario
// @param {string} pattern - Patrón de frecuencia
// @param {number} interval - Intervalo
// @param {Object} config - Configuración específica del patrón
// @returns {string} - Descripción legible de la frecuencia
export const formatFrequency = (pattern, interval = 1, config = {}) => {
  if (!pattern) return 'Sin configurar';

  const intervalText = interval > 1 ? ` cada ${interval}` : '';

  switch (pattern) {
    case FREQUENCY_PATTERNS.DAILY:
      if (interval === 1) return 'Diario';
      return `Cada ${interval} días`;

    case FREQUENCY_PATTERNS.WEEKLY: {
      const weekDaysText = formatWeekDays(config.weekDays);
      if (interval === 1) {
        return weekDaysText ? `Semanal (${weekDaysText})` : 'Semanal';
      }
      return `Cada ${interval} semanas${weekDaysText ? ` (${weekDaysText})` : ''}`;
    }

    case FREQUENCY_PATTERNS.MONTHLY: {
      const monthDaysText = formatMonthDays(config.monthDays);
      if (interval === 1) {
        return monthDaysText ? `Mensual (día ${monthDaysText})` : 'Mensual';
      }
      return `Cada ${interval} meses${monthDaysText ? ` (día ${monthDaysText})` : ''}`;
    }

    case FREQUENCY_PATTERNS.YEARLY: {
      const yearText = formatYearConfig(config.yearConfig);
      if (interval === 1) {
        return yearText ? `Anual (${yearText})` : 'Anual';
      }
      return `Cada ${interval} años${yearText ? ` (${yearText})` : ''}`;
    }

    default:
      return `${pattern}${intervalText}`;
  }
};

// Formatea días de la semana
// @param {number[]} weekDays - Array de días (0=Domingo, 6=Sábado)
// @returns {string} - Días formateados
export const formatWeekDays = (weekDays) => {
  if (!weekDays || weekDays.length === 0) return '';
  
  if (weekDays.length === 7) return 'todos los días';
  
  const dayNames = weekDays
    .sort()
    .map(day => WEEKDAY_LABELS[day])
    .filter(Boolean);
    
  if (dayNames.length === 0) return '';
  if (dayNames.length === 1) return dayNames[0];
  if (dayNames.length === 2) return dayNames.join(' y ');
  
  return `${dayNames.slice(0, -1).join(', ')} y ${dayNames[dayNames.length - 1]}`;
};

// Formatea días del mes
// @param {number[]} monthDays - Array de días del mes (1-31)
// @returns {string} - Días formateados
export const formatMonthDays = (monthDays) => {
  if (!monthDays || monthDays.length === 0) return '';
  
  const sortedDays = [...monthDays].sort((a, b) => a - b);
  
  if (sortedDays.length === 1) return sortedDays[0].toString();
  if (sortedDays.length === 2) return sortedDays.join(' y ');
  
  return `${sortedDays.slice(0, -1).join(', ')} y ${sortedDays[sortedDays.length - 1]}`;
};

// Formatea configuración anual
// @param {Object} yearConfig - { month: number, day: number }
// @returns {string} - Configuración formateada
export const formatYearConfig = (yearConfig) => {
  if (!yearConfig || !yearConfig.month || !yearConfig.day) return '';
  
  const monthName = MONTH_LABELS[yearConfig.month - 1]; // Convertir de 1-based a 0-based
  return `${yearConfig.day} de ${monthName}`;
};

// Formatea un monto monetario
// @param {number} amount - Monto a formatear
// @param {string} currency - Símbolo de moneda (por defecto '$')
// @param {number} decimals - Número de decimales (por defecto 2)
// @returns {string} - Monto formateado
export const formatAmount = (amount, currency = '$', decimals = 2) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0.00`;
  }
  
  const numAmount = parseFloat(amount);
  return `${currency}${numAmount.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
};

// Formatea una fecha para mostrar al usuario
// @param {string|Date} date - Fecha a formatear
// @param {string} format - Formato ('short', 'long', 'iso')
// @returns {string} - Fecha formateada
export const formatDate = (date, format = 'short') => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return 'Fecha inválida';
  
  switch (format) {
    case 'iso':
      return dateObj.toISOString().split('T')[0];
      
    case 'long':
      return dateObj.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
    case 'MMM d, yyyy':
      return dateObj.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
    case 'short':
    default:
      return dateObj.toLocaleDateString('es-ES');
  }
};

// Formatea un rango de fechas
// @param {string|Date} startDate - Fecha de inicio
// @param {string|Date} endDate - Fecha de fin
// @param {string} format - Formato de fecha
// @returns {string} - Rango formateado
export const formatDateRange = (startDate, endDate, format = 'short') => {
  const formattedStart = formatDate(startDate, format);
  
  if (!endDate) {
    return `Desde ${formattedStart}`;
  }
  
  const formattedEnd = formatDate(endDate, format);
  return `${formattedStart} - ${formattedEnd}`;
};

// Formatea el estado de un gasto recurrente
// @param {boolean} isActive - Si está activo
// @param {string|Date} endDate - Fecha de fin
// @returns {string} - Estado formateado
export const formatStatus = (isActive, endDate) => {
  if (!isActive) return 'Inactivo';
  
  if (endDate) {
    const end = new Date(endDate);
    const now = new Date();
    
    if (end < now) return 'Finalizado';
    return 'Activo (con fecha de fin)';
  }
  
  return 'Activo';
};

// Genera un resumen completo de un gasto recurrente
// @param {Object} expense - Gasto recurrente
// @returns {Object} - Resumen formateado
export const formatExpenseSummary = (expense) => {
  if (!expense) {
    return {
      name: 'Sin nombre',
      amount: formatAmount(0),
      frequency: 'Sin configurar',
      status: 'Inactivo',
      dateRange: 'Sin fechas',
      description: 'Gasto sin configurar'
    };
  }

  // Determinar configuración
  const config = expense.recurrence || expense.recurringConfig || expense;
  const pattern = config.pattern || config.frequency;
  const interval = config.interval || 1;
  const patternConfig = config.config || {};

  return {
    name: expense.description || expense.name || 'Sin nombre',
    amount: formatAmount(expense.amount),
    frequency: formatFrequency(pattern, interval, patternConfig),
    status: formatStatus(config.isActive, config.endDate),
    dateRange: formatDateRange(config.startDate, config.endDate),
    description: `${formatAmount(expense.amount)} - ${formatFrequency(pattern, interval, patternConfig)}`
  };
};