// API de métodos de pago dinámicos (reforma). Efectivo ('cash') es el único
// método de sistema; el resto los gestiona el administrador (CRUD).
// Las mutaciones invalidan la caché del recurso vía api.js.
import { api } from './api';

export const paymentMethodsApi = {
  // Obtener todos los métodos de pago activos (caché 5 min)
  getAll: () => api.get('/payment-methods'),
  
  // Crear un nuevo método de pago (solo admin)
  create: (data) => api.post('/payment-methods', data),
  
  // Actualizar un método de pago (solo admin); no cambia el backendId
  update: (backendId, data) => api.put(`/payment-methods/${backendId}`, data),
  
  // Eliminar/desactivar un método de pago (solo admin).
  // `force` permite borrar aunque tenga ventas asociadas.
  delete: (backendId, force = false) => api.delete(`/payment-methods/${backendId}?force=${force}`),
  
  // Inicializar métodos del sistema (solo admin)
  initialize: () => api.post('/payment-methods/initialize'),
  
  // Normalizar métodos existentes (solo admin)
  normalize: () => api.post('/payment-methods/normalize')
};

export default paymentMethodsApi;
