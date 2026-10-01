// Constantes para tipos de datos en el sistema de ventas

// Tipos de transacciones/ventas
export const SALE_TYPES = {
  PRODUCT: 'product',
  SERVICE: 'walkIn',        // Mantener compatibilidad con backend
  APPOINTMENT: 'appointment'
};

// Nombres de display para tipos
export const SALE_TYPE_LABELS = {
  [SALE_TYPES.PRODUCT]: 'Producto',
  [SALE_TYPES.SERVICE]: 'Servicio',
  [SALE_TYPES.APPOINTMENT]: 'Cita'
};

// Estados de transacciones
export const SALE_STATUS = {
  COMPLETED: 'completed',
  CANCELLED: 'cancelled', 
  REFUNDED: 'refunded'
};

// Estados de display
export const SALE_STATUS_LABELS = {
  [SALE_STATUS.COMPLETED]: 'Completada',
  [SALE_STATUS.CANCELLED]: 'Cancelada',
  [SALE_STATUS.REFUNDED]: 'Reembolsada'
};

// Métodos de pago normalizados
export const PAYMENT_METHODS = {
  CASH: 'efectivo',
  CARD: 'tarjeta', 
  TRANSFER: 'transferencia',
  NEQUI: 'nequi',
  NU: 'nu',
  DAVIPLATA: 'daviplata',
  BANCOLOMBIA: 'bancolombia',
  DEBIT: 'debit',
  DIGITAL: 'digital'
};

// Nombres de display para métodos de pago
export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHODS.CASH]: 'Efectivo',
  'cash': 'Efectivo', // Compatibilidad
  [PAYMENT_METHODS.CARD]: 'Tarjeta',
  'card': 'Tarjeta', // Compatibilidad  
  [PAYMENT_METHODS.TRANSFER]: 'Transferencia',
  'transfer': 'Transferencia', // Compatibilidad
  [PAYMENT_METHODS.NEQUI]: 'Nequi',
  [PAYMENT_METHODS.NU]: 'Nu',
  [PAYMENT_METHODS.DAVIPLATA]: 'Daviplata',
  [PAYMENT_METHODS.BANCOLOMBIA]: 'Bancolombia',
  [PAYMENT_METHODS.DEBIT]: 'Débito',
  [PAYMENT_METHODS.DIGITAL]: 'Digital'
};

// Colores para métodos de pago (derivados de la paleta de 15 en @utils/formatters)
import { PAYMENT_METHOD_PALETTE } from '@utils/formatters';

// Extrae solo las clases visuales de un color de la paleta compartida
const paletteOf = (name) => {
  const p = PAYMENT_METHOD_PALETTE[name] || PAYMENT_METHOD_PALETTE.gray;
  return { bg: p.bg, border: p.border, text: p.text, dot: p.dot };
};

export const PAYMENT_METHOD_COLORS = {
  [PAYMENT_METHODS.CASH]: paletteOf('emerald'),
  'cash': paletteOf('emerald'),
  'efectivo': paletteOf('emerald'),
  [PAYMENT_METHODS.NEQUI]: paletteOf('violet'),
  [PAYMENT_METHODS.NU]: paletteOf('purple'),
  [PAYMENT_METHODS.DAVIPLATA]: paletteOf('red'),
  [PAYMENT_METHODS.DEBIT]: paletteOf('blue'),
  [PAYMENT_METHODS.BANCOLOMBIA]: paletteOf('amber'),
  [PAYMENT_METHODS.DIGITAL]: paletteOf('cyan'),
  [PAYMENT_METHODS.CARD]: paletteOf('blue'),
  'card': paletteOf('blue'),
  'tarjeta': paletteOf('blue'),
  [PAYMENT_METHODS.TRANSFER]: paletteOf('blue'),
  'transfer': paletteOf('blue'),
  'transferencia': paletteOf('blue'),
};

// Color por defecto para métodos no reconocidos
export const DEFAULT_PAYMENT_COLOR = paletteOf('gray');

// Iconos para tipos de transacciones (nombres de iconos de lucide-react)
export const SALE_TYPE_ICONS = {
  [SALE_TYPES.PRODUCT]: 'Package',
  [SALE_TYPES.SERVICE]: 'Scissors', 
  [SALE_TYPES.APPOINTMENT]: 'Calendar'
};

// Colores para tipos de transacciones
export const SALE_TYPE_COLORS = {
  [SALE_TYPES.PRODUCT]: 'text-blue-400',
  [SALE_TYPES.SERVICE]: 'text-emerald-400',
  [SALE_TYPES.APPOINTMENT]: 'text-brand-300'
};