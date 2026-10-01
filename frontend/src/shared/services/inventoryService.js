// Servicio de inventario: productos, stock, movimientos, logs y reportes.
import { api } from './api';

export const inventoryService = {
  // Listado de productos con filtros opcionales (caché 5 min)
  getInventory: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/inventory${queryString ? `?${queryString}` : ''}`, true, 300000);
  },
  // Producto por id (caché 5 min)
  getInventoryItem: (id) => api.get(`/inventory/${id}`, true, 300000),
  // Crear producto
  createInventoryItem: (data) => api.post('/inventory', data),
  // Actualizar producto
  updateInventoryItem: (id, data) => api.put(`/inventory/${id}`, data),
  // Eliminar producto
  deleteInventoryItem: (id) => api.delete(`/inventory/${id}`),
  // Ajustar stock (entradas/salidas/mermas) con motivo
  adjustStock: (id, data) => api.post(`/inventory/${id}/stock`, data),
  // Productos por debajo del umbral de stock (caché 5 min)
  getLowStockItems: (threshold) => api.get(`/inventory/low-stock${threshold ? `?threshold=${threshold}` : ''}`, true, 300000),
  // Productos de una categoría (caché 5 min)
  getItemsByCategory: (category) => api.get(`/inventory/category/${category}`, true, 300000),
  // Historial de movimientos de un producto en un rango de fechas (caché 5 min)
  getMovementHistory: (id, startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return api.get(`/inventory/${id}/history${params.toString() ? `?${params.toString()}` : ''}`, true, 300000);
  },
  // Resumen general de inventario: totales, valor y alertas (caché 5 min)
  getStats: () => api.get('/inventory/stats/overview', true, 300000),
  // Logs de auditoría de inventario (caché 1 min)
  getLogs: (queryString) => api.get(`/inventory/logs${queryString ? `?${queryString}` : ''}`, true, 60000),
  // Estadísticas de los logs en un rango de fechas (caché 5 min)
  getLogStats: (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return api.get(`/inventory/logs/stats${params.toString() ? `?${params.toString()}` : ''}`, true, 300000);
  },
  // Reporte diario de inventario (movimientos del día), sin caché
  getDailyReport: (date) => {
    const params = new URLSearchParams({ date });
    return api.get(`/inventory/daily-report?${params.toString()}`, false);
  },
  // Repara inconsistencias de stock contra los movimientos registrados (admin)
  fixConsistency: () => api.post('/inventory/fix-consistency', {})
};

export default inventoryService;
