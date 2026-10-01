// Constantes compartidas para gastos recurrentes
//
// Centraliza todas las constantes utilizadas en frontend y backend
// para asegurar consistencia en toda la aplicación.

// Patrones de frecuencia soportados
export const FREQUENCY_PATTERNS = {
  DAILY: 'daily',
  WEEKLY: 'weekly', 
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
};

// Mapeo de frecuencias legacy a patrones nuevos
export const LEGACY_FREQUENCY_MAP = {
  'daily': FREQUENCY_PATTERNS.DAILY,
  'weekly': FREQUENCY_PATTERNS.WEEKLY,
  'monthly': FREQUENCY_PATTERNS.MONTHLY,
  'yearly': FREQUENCY_PATTERNS.YEARLY,
  // Alias comunes
  'diario': FREQUENCY_PATTERNS.DAILY,
  'semanal': FREQUENCY_PATTERNS.WEEKLY,
  'mensual': FREQUENCY_PATTERNS.MONTHLY,
  'anual': FREQUENCY_PATTERNS.YEARLY
};

// Configuraciones por defecto
export const DEFAULT_CONFIG = {
  frequency: FREQUENCY_PATTERNS.MONTHLY,
  interval: 1,
  startDate: () => new Date().toISOString().split('T')[0],
  isActive: false,
  dailyAdjustments: {},
  adjustmentsMonth: null
};

// Constantes de cálculo
export const CALCULATION_CONSTANTS = {
  DAYS_IN_MONTH: 30.44,      // Promedio de días por mes (365/12)
  WEEKS_IN_MONTH: 4.33,      // Promedio de semanas por mes (52/12)
  MONTHS_IN_YEAR: 12,
  DAYS_IN_YEAR: 365.25       // Considerando años bisiestos
};

// Días de la semana (0 = Domingo, 6 = Sábado)
export const WEEKDAYS = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
};

// Etiquetas de días en español
export const WEEKDAY_LABELS = {
  [WEEKDAYS.SUNDAY]: 'Domingo',
  [WEEKDAYS.MONDAY]: 'Lunes',
  [WEEKDAYS.TUESDAY]: 'Martes',
  [WEEKDAYS.WEDNESDAY]: 'Miércoles',
  [WEEKDAYS.THURSDAY]: 'Jueves',
  [WEEKDAYS.FRIDAY]: 'Viernes',
  [WEEKDAYS.SATURDAY]: 'Sábado'
};

// Meses del año (0-based para compatibility con Date)
export const MONTHS = {
  JANUARY: 0,
  FEBRUARY: 1,
  MARCH: 2,
  APRIL: 3,
  MAY: 4,
  JUNE: 5,
  JULY: 6,
  AUGUST: 7,
  SEPTEMBER: 8,
  OCTOBER: 9,
  NOVEMBER: 10,
  DECEMBER: 11
};

// Etiquetas de meses en español
export const MONTH_LABELS = {
  [MONTHS.JANUARY]: 'Enero',
  [MONTHS.FEBRUARY]: 'Febrero',
  [MONTHS.MARCH]: 'Marzo',
  [MONTHS.APRIL]: 'Abril',
  [MONTHS.MAY]: 'Mayo',
  [MONTHS.JUNE]: 'Junio',
  [MONTHS.JULY]: 'Julio',
  [MONTHS.AUGUST]: 'Agosto',
  [MONTHS.SEPTEMBER]: 'Septiembre',
  [MONTHS.OCTOBER]: 'Octubre',
  [MONTHS.NOVEMBER]: 'Noviembre',
  [MONTHS.DECEMBER]: 'Diciembre'
};

// Estados de gastos recurrentes
export const EXPENSE_STATES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PAUSED: 'paused',
  ENDED: 'ended'
};

// Tipos de ajustes diarios
export const ADJUSTMENT_TYPES = {
  ABSOLUTE: 'absolute',    // Monto fijo
  PERCENTAGE: 'percentage', // Porcentaje del monto base
  ADD: 'add',              // Agregar al monto base
  SUBTRACT: 'subtract'     // Restar del monto base
};