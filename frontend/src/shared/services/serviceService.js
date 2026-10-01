// Servicio del catálogo de servicios de barbería (cortes, afeitados, etc.).
import { api } from './api';

export const serviceService = {
  // Catálogo completo de servicios (caché 5 min)
  getAllServices: () => api.get('/services', true, 300000),
  // Servicio por id (caché 5 min)
  getServiceById: (id) => api.get(`/services/${id}`, true, 300000),
  // Crear servicio (nombre, precio, duración, imagen, etc.)
  createService: (data) => api.post('/services', data),
  // Actualizar servicio existente
  updateService: (id, data) => api.put(`/services/${id}`, data),
  // Eliminar servicio
  deleteService: (id) => api.delete(`/services/${id}`),
};

export default serviceService;
