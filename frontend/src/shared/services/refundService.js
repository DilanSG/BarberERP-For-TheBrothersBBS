import { api } from './api';

// Servicio para manejar operaciones de reembolsos.
// Las notificaciones de error las maneja el wrapper `api` globalmente
// y el feedback de éxito lo muestran los componentes con useNotification.
export const refundService = {
  // Procesar reembolso de una venta (requiere código de autorización de admin)
  async processRefund(saleId, reason, adminCode) {
    return api.post(`/refunds/${saleId}`, {
      reason,
      adminCode
    });
  },

  // Procesar reembolso de una venta (alias para compatibilidad con { saleId, reason, adminCode })
  async refundSale(data) {
    return this.processRefund(data.saleId, data.reason, data.adminCode);
  },

  // Obtener todas las ventas reembolsadas (filtros: fechas, barbero, tipo, paginación)
  async getRefundedSales(filters = {}) {
    const params = new URLSearchParams();

    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.barberId) params.append('barberId', filters.barberId);
    if (filters.type) params.append('type', filters.type);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.page) params.append('page', filters.page.toString());

    return api.get(`/refunds?${params.toString()}`);
  },

  // Obtener resumen de reembolsos por barbero (solo admin)
  async getRefundsSummary(startDate = null, endDate = null) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return api.get(`/refunds/summary?${params.toString()}`);
  },

  // Obtener código de verificación actual (solo admin)
  async getVerificationCode() {
    return api.get('/refunds/verification-code');
  },

  // Obtener ventas del barbero autenticado para reembolsar (filtros de fecha/tipo/paginación)
  async getMySalesForRefund(filters = {}) {
    const params = new URLSearchParams();

    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.type) params.append('type', filters.type);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.page) params.append('page', filters.page.toString());

    return api.get(`/refunds/my-sales?${params.toString()}`);
  },

  // Obtener todas las ventas con filtros (admin)
  async getAllSalesForAdmin(filters = {}) {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    return api.get(`/sales?${params.toString()}`);
  },

  // Cancelar/eliminar venta (admin): PUT con body vacío, la venta queda cancelada
  async cancelSale(saleId) {
    return api.put(`/sales/${saleId}/cancel`, {});
  },

  // Eliminar reembolso (reversar a venta normal) - Solo Admin
  async deleteRefund(saleId) {
    return api.delete(`/refunds/${saleId}`);
  },

  // Eliminar reembolso permanentemente del sistema - Solo Admin
  async permanentDeleteRefund(saleId) {
    return api.delete(`/refunds/${saleId}/permanent`);
  }
};

export default refundService;
