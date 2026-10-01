// Utilidades de formato compartidas: moneda COP, fechas y métodos de pago.
// Centraliza lo que antes se duplicaba en más de 12 modales.
// Shared formatters for currency, dates, and payment methods.
// Eliminates duplication across 12+ modal components.

// Formatea un número como pesos colombianos sin decimales; null/NaN → '$0'
export const formatCurrency = (amount) => {
  const value = Number(amount);
  if (amount === null || amount === undefined || isNaN(value)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Fecha y hora en formato es-CO (dd/mm/aaaa hh:mm)
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Fecha sin hora (dd/mm/aaaa)
export const formatDateShort = (dateString) => {
  return new Date(dateString).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Convierte una fecha al formato YYYY-MM-DD que esperan los <input type="date">
export const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

const PAYMENT_NAMES = {
  cash: 'Efectivo',
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  debit: 'Tarjeta Debito',
  credit: 'Tarjeta Credito',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  bancolombia: 'Bancolombia',
  nu: 'Nu Bank',
  transferencia: 'Transferencia',
  transfer: 'Transferencia',
  digital: 'Pago Digital',
  pagodigital: 'Pago Digital',
};

// Nombre legible del método de pago; si no está en el diccionario, devuelve el id
export const getPaymentMethodDisplayName = (methodId) => {
  if (!methodId) return 'Desconocido';
  const id = methodId.toLowerCase().trim();
  return PAYMENT_NAMES[id] || methodId;
};

// ── Paleta de métodos de pago (15 colores) ────────────────────────────────
// Cada color expone su hex (para la DB) y sus clases Tailwind (para la UI).
// Crea una entrada de paleta con clases Tailwind estáticas (el escáner de
// Tailwind necesita las clases completas, por eso se generan aquí).
const P = (label, hex, c, extra = {}) => ({
  label,
  hex,
  bg: `bg-${c}-500/10`,
  border: `border-${c}-500/30`,
  text: `text-${c}-300`,
  dot: `bg-${c}-400`,
  swatch: `bg-${c}-500`,
  ...extra,
});

export const PAYMENT_METHOD_PALETTE = {
  emerald: P('Esmeralda', '#10b981', 'emerald'),
  green: P('Verde', '#22c55e', 'green'),
  teal: P('Turquesa', '#14b8a6', 'teal'),
  cyan: P('Cian', '#06b6d4', 'cyan'),
  blue: P('Azul', '#3b82f6', 'blue'),
  indigo: P('Índigo', '#6366f1', 'indigo'),
  violet: P('Violeta', '#8b5cf6', 'violet'),
  purple: P('Púrpura', '#a855f7', 'purple'),
  pink: P('Rosa', '#ec4899', 'pink'),
  rose: P('Rojo rosado', '#f43f5e', 'rose'),
  red: P('Rojo', '#ef4444', 'red'),
  orange: P('Naranja', '#f97316', 'orange'),
  amber: P('Ámbar', '#f59e0b', 'amber'),
  brand: P('Dorado', '#C6A664', 'brand', {
    bg: 'bg-brand-500/10',
    border: 'border-brand-500/30',
    text: 'text-brand-300',
    dot: 'bg-brand-400',
    swatch: 'bg-brand-500',
  }),
  gray: P('Gris', '#6b7280', 'gray'),
};

// Opciones listas para selects/swatches: [{ id, name, hex, swatch }]
export const PAYMENT_COLOR_OPTIONS = Object.entries(PAYMENT_METHOD_PALETTE).map(
  ([id, color]) => ({ id, name: color.label, hex: color.hex, swatch: color.swatch })
);

// Ids de métodos históricos → color de la paleta
const LEGACY_METHOD_COLORS = {
  cash: 'emerald',
  efectivo: 'emerald',
  tarjeta: 'blue',
  card: 'blue',
  debit: 'blue',
  credit: 'blue',
  transferencia: 'blue',
  transfer: 'blue',
  nequi: 'violet',
  nu: 'purple',
  daviplata: 'red',
  bancolombia: 'amber',
  digital: 'cyan',
  pagodigital: 'cyan',
};

// Traduce nombres de color legacy (p. ej. 'fuchsia', 'grey') a la paleta actual
const LEGACY_COLOR_NAMES = {
  green: 'green',
  purple: 'purple',
  violet: 'violet',
  pink: 'pink',
  fuchsia: 'pink',
  red: 'red',
  rose: 'rose',
  yellow: 'amber',
  amber: 'amber',
  orange: 'orange',
  cyan: 'cyan',
  teal: 'teal',
  indigo: 'indigo',
  blue: 'blue',
  emerald: 'emerald',
  brand: 'brand',
  gray: 'gray',
  grey: 'gray',
};

// Resuelve la paleta por nombre de color, hex o id de método
export const getPaymentMethodPalette = (colorOrMethod) => {
  if (!colorOrMethod) return PAYMENT_METHOD_PALETTE.gray;
  const task = String(typeof colorOrMethod === 'object'
    ? (colorOrMethod.color || colorOrMethod.backendId || '')
    : colorOrMethod).toLowerCase().trim();

  if (PAYMENT_METHOD_PALETTE[task]) return PAYMENT_METHOD_PALETTE[task];
  if (task.startsWith('#')) {
    const found = Object.values(PAYMENT_METHOD_PALETTE).find((p) => p.hex.toLowerCase() === task);
    return found || PAYMENT_METHOD_PALETTE.gray;
  }
  const byColorName = LEGACY_COLOR_NAMES[task];
  if (byColorName && PAYMENT_METHOD_PALETTE[byColorName]) return PAYMENT_METHOD_PALETTE[byColorName];
  const byId = LEGACY_METHOD_COLORS[task];
  return byId ? PAYMENT_METHOD_PALETTE[byId] : PAYMENT_METHOD_PALETTE.gray;
};

// Color por id de método (registros históricos) o por objeto método
export const getPaymentMethodColor = (method) => getPaymentMethodPalette(method);

// Texto legible para un rango de fechas de modales según su preset
// (all/today/yesterday/thisWeek/lastWeek/thisMonth/lastMonth o start-end).
export const formatModalDateRange = (dateRange) => {
  if (!dateRange) return 'Periodo seleccionado';

  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  if (dateRange.preset === 'all') return 'Todos los registros';
  if (dateRange.preset === 'today') return 'Hoy';
  if (dateRange.preset === 'yesterday') return 'Ayer';
  if (dateRange.preset === 'thisWeek') return 'Esta semana';
  if (dateRange.preset === 'lastWeek') return 'Semana pasada';
  if (dateRange.preset === 'thisMonth') return 'Este mes';
  if (dateRange.preset === 'lastMonth') return 'Mes pasado';

  if (dateRange.start && dateRange.end) {
    return `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`;
  }
  return 'Periodo personalizado';
};
