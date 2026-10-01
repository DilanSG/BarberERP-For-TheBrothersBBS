// Servicio de socios (admins con subrol y porcentaje de participación).
import { api } from './api';

export const sociosService = {
  // Obtener todos los socios
  getAll: async () => {
    const response = await api.get('/socios');
    return response; // api.get ya devuelve los datos procesados
  },

  // Obtener distribución de ganancias para un monto dado
  getDistribucion: async (gananciaTotal) => {
    const response = await api.get(`/socios/distribucion?gananciaTotal=${gananciaTotal}`);
    return response;
  },

  // Obtener estadísticas de socios
  getEstadisticas: async () => {
    const response = await api.get('/socios/estadisticas');
    return response;
  },

  // Obtener admins disponibles para ser socios
  getAdminsDisponibles: async () => {
    const response = await api.get('/socios/admins-disponibles');
    return response;
  },

  // Asignar subrol de socio a un admin
  asignarSocio: async (socioData) => {
    const response = await api.post('/socios', socioData);
    return response;
  },

  // Actualizar porcentaje de socio
  updatePorcentaje: async (id, porcentaje) => {
    const response = await api.put(`/socios/${id}/porcentaje`, { porcentaje });
    return response;
  },

  // Actualizar datos de socio
  update: async (id, socioData) => {
    const response = await api.put(`/socios/${id}`, socioData);
    return response;
  },

  // Eliminar socio
  delete: async (id) => {
    const response = await api.delete(`/socios/${id}`);
    return response;
  },

  // Obtener información del usuario actual (incluyendo si es socio/fundador)
  getCurrentUser: async () => {
    const response = await api.get('/socios/current-user');
    return response;
  }
};

export default sociosService;