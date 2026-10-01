// Servicio CRUD de citas (operaciones de agenda).
import { api } from './api';

export const appointmentService = {
  // Listado general de citas (caché 1 min)
  getAppointments: () => api.get('/appointments', true, 60000), // 1 minuto de caché
  // Listado de citas de un barbero (caché 1 min)
  getBarberAppointments: (barberId) => api.get(`/appointments/barber/${barberId}`, true, 60000),
  // Crear cita; el backend valida disponibilidad y solapamientos
  createAppointment: (data) => api.post('/appointments', data),
  // Actualizar datos de una cita existente
  updateAppointment: (id, data) => api.put(`/appointments/${id}`, data),
  // Cancelar cita indicando el motivo
  cancelAppointment: (id, reason) => api.put(`/appointments/${id}/cancel`, { reason }),
  // Aprobar cita pendiente
  approveAppointment: (id) => api.put(`/appointments/${id}/approve`, {}),
  // Marcar cita como completada registrando el método de pago
  completeAppointment: (id, paymentMethod) => api.put(`/appointments/${id}/complete`, { paymentMethod }),
  // Marcar inasistencia (no-show)
  markNoShow: (id) => api.put(`/appointments/${id}/no-show`, {}),
  // Eliminar cita
  deleteAppointment: (id) => api.delete(`/appointments/${id}`),
  // Horarios libres de un barbero para una fecha con duración fija de 30 min
  getAvailableTimes: (barberId, date) => api.get(`/appointments/availability/${barberId}?date=${date}&duration=30`),
};

export default appointmentService;
