// Servicio de barberos: CRUD, perfiles y estadísticas.
import { api } from './api';

export const barberService = {
  // Listado de barberos (caché 5 min)
  getAllBarbers: () => api.get('/barbers', true, 300000), // 5 minutos de caché
  // Barbero por id de documento (caché 5 min)
  getBarberById: (id) => api.get(`/barbers/${id}`, true, 300000),
  // Barbero asociado a un usuario (caché 5 min)
  getBarberByUserId: (userId) => api.get(`/barbers/by-user/${userId}`, true, 300000),
  // Crear perfil de barbero vinculado a un usuario
  createBarber: (data) => api.post('/barbers', data),
  // Actualizar datos del barbero
  updateBarber: (id, data) => api.put(`/barbers/${id}`, data),
  // Baja lógica del barbero (no borra el registro)
  removeBarber: (id) => api.put(`/barbers/${id}/remove`),
  // Marcar/desmarcar como barbero principal
  updateMainBarberStatus: (id, isMainBarber) => api.patch(`/barbers/${id}/main-status`, { isMainBarber }),
  // Perfil del barbero autenticado a partir del usuario guardado en localStorage
  getBarberProfile: async () => {
    // Para obtener el perfil del barbero autenticado, necesitamos su userId
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user._id) {
      throw new Error('Usuario no autenticado');
    }
    return api.get(`/barbers/by-user/${user._id}`, true, 300000);
  },
  // Actualiza el perfil del barbero autenticado (resuelve su _id interno primero)
  updateBarberProfile: (id, data) => api.put(`/barbers/${id}`, data),
  updateMyProfile: async (data) => {
    // Para actualizar el perfil del barbero autenticado
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user._id) {
      throw new Error('Usuario no autenticado');
    }
    
    // Primero obtener el perfil para conseguir el ID del barbero
    const barberResponse = await api.get(`/barbers/by-user/${user._id}`, false);
    const barberData = barberResponse.data || barberResponse;
    
    if (!barberData || !barberData._id) {
      throw new Error('No se pudo obtener el ID del barbero');
    }
    
    // Siempre usar el endpoint /profile para evitar validateImageRequired
    // El endpoint /profile maneja tanto FormData como JSON
    return api.put(`/barbers/${barberData._id}/profile`, data);
  },
  // Estadísticas agregadas del barbero (caché 15 min)
  getBarberStats: (id) => api.get(`/barbers/${id}/stats`, true, 900000), // 15 minutos de caché
};

export default barberService;
