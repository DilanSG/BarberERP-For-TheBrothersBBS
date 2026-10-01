// Servicio de ventas: estadísticas de barberos, reportes y creación/cancelación de ventas.
import { api } from './api';

export const salesService = {
  // Estadísticas de ventas de un barbero (filtros en `params`: date o startDate/endDate).
  // Caché de 5 minutos.
  getBarberSalesStats: (barberId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/sales/barber/${barberId}/stats${queryString ? `?${queryString}` : ''}`;
    console.log('🔍 [salesService] getBarberSalesStats:', { barberId, params, queryString, url });
    return api.get(url, true, 300000);
  },
  // Estadísticas de ventas para varios barberos en una sola petición (batch)
  // Solo trae datos "en vivo": no usa caché.
  getBarbersSalesStats: (barberIds = [], params = {}) => {
    const query = new URLSearchParams({ ids: barberIds.join(','), ...params }).toString();
    return api.get(`/sales/barbers/stats?${query}`, false);
  },
  // Si se pasa barberId, usa el endpoint por barbero; si no, usa el global.
  // Devuelve las fechas con datos para el selector/calendario (caché 5 min).
  getAvailableDates: (barberId = null) => {
    if (barberId) {
      return api.get(`/sales/barber/${barberId}/available-dates`, true, 300000);
    } else {
      return api.get(`/sales/available-dates`, true, 300000);
    }
  },
  // Reporte diario de ventas (opcionalmente filtrado por barbero). Sin caché.
  getDailyReport: (date, barberId = null) => {
    const params = new URLSearchParams({ date });
    if (barberId) params.append('barberId', barberId);
    return api.get(`/sales/daily-report?${params.toString()}`, false);
  },
  // Reporte de un rango (`type` define el preset: 7 días, 30 días, etc.)
  getBarberRangeReport: (type, date, barberId) => {
    const params = new URLSearchParams({ type, date });
    if (barberId) params.append('barberId', barberId);
    return api.get(`/sales/reports?${params.toString()}`, false);
  },
  
  // Crear venta de productos
  createSale: (saleData) => api.post('/sales', saleData),
  
  // Crear venta de servicio de corte  
  createWalkInSale: (walkInData) => api.post('/sales/walk-in', walkInData),
  
  // Crear venta desde carrito con métodos de pago múltiples
  createCartSale: (cartData) => api.post('/sales/cart', cartData),
  
  // Nuevos endpoints para reportes detallados
  // Ventas de productos detalladas por barbero y rango (sin caché)
  getDetailedSalesReport: (barberId, startDate, endDate) => {
    const params = new URLSearchParams({ barberId });
    if (startDate !== undefined && startDate !== null) params.append('startDate', startDate);
    if (endDate !== undefined && endDate !== null) params.append('endDate', endDate);
    return api.get(`/sales/detailed-report?${params.toString()}`, false);
  },
  // Detalle de cortes walk-in por barbero y rango
  getWalkInDetails: (barberId, startDate, endDate) => {
    const params = new URLSearchParams({ barberId });
    if (startDate !== undefined && startDate !== null) params.append('startDate', startDate);
    if (endDate !== undefined && endDate !== null) params.append('endDate', endDate);
    return api.get(`/sales/walk-in-details?${params.toString()}`, false);
  },
  // Reporte detallado de cortes por barbero y rango
  getDetailedCutsReport: (barberId, startDate, endDate) => {
    const params = new URLSearchParams({ barberId });
    if (startDate !== undefined && startDate !== null) params.append('startDate', startDate);
    if (endDate !== undefined && endDate !== null) params.append('endDate', endDate);
    return api.get(`/sales/detailed-cuts-report?${params.toString()}`, false);
  },
  
  // Obtener todas las ventas con filtros
  // Ignora filtros vacíos (undefined/null/'') antes de construir el query string
  getAllSales: (filters = {}) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });
    return api.get(`/sales?${params.toString()}`, false);
  },
  
  // Obtener facturas de carrito (ventas con clientData)
  // Aplica el mismo filtrado de parámetros vacíos que getAllSales
  getCartInvoices: (filters = {}) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });
    return api.get(`/sales/cart-invoices?${params.toString()}`, false);
  },
  
  // Cancelar/eliminar venta (PUT con body vacío; la venta pasa a estado cancelada)
  cancelSale: (saleId) => api.put(`/sales/${saleId}/cancel`, {})
};

export default salesService;
