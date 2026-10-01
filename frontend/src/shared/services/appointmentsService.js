// Servicio de citas: estadísticas, reportes y fechas disponibles.
import { api } from './api';

export const appointmentsService = {
  // Estadísticas globales de citas con filtros opcionales (caché 1 min)
  getAppointmentStats: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/appointments/stats${queryString ? `?${queryString}` : ''}`, true, 60000);
  },
  // Estadísticas de citas de un barbero (caché 5 min)
  getBarberAppointmentStats: (barberId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/appointments/barber/${barberId}/stats${queryString ? `?${queryString}` : ''}`;
    return api.get(url, true, 300000);
  },
  // Estadísticas de citas para varios barberos en una sola petición (batch, sin caché)
  getBarbersAppointmentStats: (barberIds = [], params = {}) => {
    const query = new URLSearchParams({ ids: barberIds.join(','), ...params }).toString();
    return api.get(`/appointments/barbers/stats?${query}`, false);
  },
  // Fechas con citas para un barbero (caché 5 min)
  getAvailableDates: (barberId) => api.get(`/appointments/barber/${barberId}/available-dates`, true, 300000),
  // Reporte diario de citas (opcionalmente filtrado por barbero), sin caché
  getDailyReport: (date, barberId = null) => {
    const params = new URLSearchParams({ date });
    if (barberId) params.append('barberId', barberId);
    return api.get(`/appointments/daily-report?${params.toString()}`, false);
  },
  // Nuevo endpoint para citas completadas detalladas
  // Detalle de citas completadas por barbero y rango (sin caché)
  getCompletedDetails: (barberId, startDate, endDate) => {
    const params = new URLSearchParams({ barberId });
    if (startDate !== undefined && startDate !== null) params.append('startDate', startDate);
    if (endDate !== undefined && endDate !== null) params.append('endDate', endDate);
    return api.get(`/appointments/completed-details?${params.toString()}`, false);
  }
};

export default appointmentsService;
