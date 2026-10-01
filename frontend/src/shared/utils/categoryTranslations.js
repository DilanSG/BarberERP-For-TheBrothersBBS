// Utilidad de traducción de categorías de gastos
// Mapea categorías legacy en inglés a español

// Diccionario de traducciones para categorías de gastos
// Mapea categorías en inglés (legacy) a español
export const CATEGORY_TRANSLATIONS = {
  // Categorías legacy en inglés
  'rent': 'Arriendo',
  'utilities': 'Servicios',
  'supplies': 'Insumos',
  'equipment': 'Equipos',
  'salaries': 'Nómina',
  'nomina': 'Nómina', // Alias
  'marketing': 'Marketing',
  'maintenance': 'Mantenimiento',
  'insurance': 'Seguros',
  'taxes': 'Impuestos',
  'other': 'Otros',
  
  // Categorías en español (ya correctas)
  'arriendo': 'Arriendo',
  'insumos': 'Insumos',
  'servicios': 'Servicios',
  'equipos': 'Equipos'
};

// Diccionario de traducciones para métodos de pago
// Mapea valores de backend a nombres legibles
export const PAYMENT_METHOD_TRANSLATIONS = {
  // Métodos de pago en español/minúsculas
  'efectivo': 'Efectivo',
  'cash': 'Efectivo',
  'tarjeta': 'Tarjeta',
  'card': 'Tarjeta',
  'transferencia': 'Transferencia',
  'transfer': 'Transferencia',
  'nequi': 'Nequi',
  'nu': 'Nu',
  'daviplata': 'Daviplata',
  'bancolombia': 'Bancolombia',
  'debit': 'Débito',
  'debito': 'Débito',
  'digital': 'Digital'
};

// Obtiene la etiqueta traducida de una categoría
// @param {string} category - Categoría en inglés o español
// @returns {string} Etiqueta en español
export const getCategoryLabel = (category) => {
  if (!category) return 'Sin categoría';
  
  // Primero buscar en el diccionario de traducciones (case-insensitive)
  const translated = CATEGORY_TRANSLATIONS[category.toLowerCase()];
  if (translated) return translated;
  
  // Si no está en el diccionario, capitalizar la primera letra
  return category.charAt(0).toUpperCase() + category.slice(1);
};

// Obtiene la etiqueta traducida de un método de pago
// @param {string} paymentMethod - Método de pago (efectivo, cash, tarjeta, etc.)
// @returns {string} Etiqueta capitalizada
export const getPaymentMethodLabel = (paymentMethod) => {
  if (!paymentMethod) return 'Sin especificar';
  
  // Primero buscar en el diccionario de traducciones (case-insensitive)
  const translated = PAYMENT_METHOD_TRANSLATIONS[paymentMethod.toLowerCase()];
  if (translated) return translated;
  
  // Si no está en el diccionario, capitalizar la primera letra
  return paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1);
};

// Traduce un array de categorías
// @param {Array} categories - Array de categorías {value, label}
// @returns {Array} Array con labels traducidos
export const translateCategories = (categories) => {
  if (!Array.isArray(categories)) return [];
  
  return categories.map(cat => ({
    ...cat,
    label: getCategoryLabel(cat.value || cat.label || cat.category)
  }));
};

// Normaliza y traduce una categoría desde cualquier estructura
// @param {string|Object} category - Categoría como string o objeto
// @returns {Object} {value, label}
export const normalizeCategory = (category) => {
  if (!category) {
    return { value: 'other', label: 'Otros' };
  }
  
  if (typeof category === 'string') {
    return {
      value: category,
      label: getCategoryLabel(category)
    };
  }
  
  // Si es objeto, normalizar su estructura
  const value = category.value || category.category || category.key || category._id || 'other';
  return {
    value,
    label: getCategoryLabel(value)
  };
};
