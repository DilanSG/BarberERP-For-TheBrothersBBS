// Constantes para el backend del sistema de ventas
// Mantiene compatibilidad con la base de datos
// Nota: WALKIN y SERVICE apuntan al mismo valor para no romper datos históricos.

export const SALE_TYPES = {
  PRODUCT: 'product',
  WALKIN: 'walkIn',        // Mantener compatibilidad con DB
  SERVICE: 'walkIn',       // Alias para consistencia
  APPOINTMENT: 'appointment'
};

export const SALE_STATUS = {
  COMPLETED: 'completed',
  CANCELLED: 'cancelled', 
  REFUNDED: 'refunded'
};

export const VALIDATION_MESSAGES = {
  SALE_TYPE_INVALID: `El tipo de venta debe ser "${SALE_TYPES.PRODUCT}" o "${SALE_TYPES.WALKIN}"`,
  PRODUCT_ID_REQUIRED: 'El ID del producto es requerido para ventas de productos',
  SERVICE_ID_REQUIRED: 'El ID del servicio es requerido para servicios walk-in',
  PRODUCT_NAME_REQUIRED: 'El nombre del producto es requerido para ventas de productos',
  SERVICE_NAME_REQUIRED: 'El nombre del servicio es requerido para servicios walk-in'
};

// Obtener tipos válidos para validaciones
export function getValidSaleTypes() {
  return [SALE_TYPES.PRODUCT, SALE_TYPES.WALKIN];
}

// Verificar si un tipo es válido
export function isValidSaleType(type) {
  return getValidSaleTypes().includes(type);
}

// Obtener nombre de display para un tipo
export function getSaleTypeDisplayName(type) {
  const names = {
    [SALE_TYPES.PRODUCT]: 'Producto',
    [SALE_TYPES.WALKIN]: 'Servicio',
    [SALE_TYPES.APPOINTMENT]: 'Cita'
  };
  return names[type] || type;
}