// Servicio de reseñas de barberos (crear, consultar, actualizar y eliminar).
import { api } from './api';

export const reviewService = {
  // Crear una reseña
  create: (data) => api.post('/reviews', data),
  
  // Obtener reseñas de un barbero (paginadas vía params)
  getBarberReviews: (barberId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/reviews/barber/${barberId}${queryString ? '?' + queryString : ''}`);
  },
  
  // Obtener estadísticas de rating de un barbero
  getBarberStats: (barberId) => api.get(`/reviews/barber/${barberId}/stats`),
  
  // Verificar elegibilidad para dejar reseña (cita completada y sin reseña previa)
  checkEligibility: (appointmentId) => api.get(`/reviews/check/${appointmentId}`),
  
  // Obtener mis reseñas
  getMyReviews: () => api.get('/reviews/my-reviews'),
  
  // Actualizar una reseña
  update: (reviewId, data) => api.put(`/reviews/${reviewId}`, data),
  
  // Eliminar una reseña (admin)
  delete: (reviewId) => api.delete(`/reviews/${reviewId}`)
};

export default reviewService;
