// Servicio de snapshots (fotos) del inventario: creación, consulta, descarga y borrado.
import { api, API_URL, fetchWithRetry, getValidToken } from './api';

export const inventorySnapshotService = {
  // Guarda un snapshot con el estado actual del inventario
  createSnapshot: (data) => api.post('/inventory-snapshots', data),
  // Lista snapshots con filtros opcionales (caché 5 min)
  getSnapshots: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/inventory-snapshots${queryString ? `?${queryString}` : ''}`, true, 300000);
  },
  // Snapshot por id (caché 5 min)
  getSnapshotById: (id) => api.get(`/inventory-snapshots/${id}`, true, 300000),
  // Elimina un snapshot
  deleteSnapshot: (id) => api.delete(`/inventory-snapshots/${id}`),
  // Estadísticas de snapshots (caché 5 min)
  getStats: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return api.get(`/inventory-snapshots/stats${queryString ? `?${queryString}` : ''}`, true, 300000);
  },
  // Descarga el archivo (Excel/CSV) de un snapshot como Blob.
  // Usa fetchWithRetry (30s de timeout por ser descarga de snapshot) y devuelve response.blob().
  downloadSnapshot: async (id) => {
    try {
      const token = getValidToken();
      const response = await fetchWithRetry(`${API_URL}/inventory-snapshots/${id}/download`, {
        method: 'GET',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`Error al descargar: ${response.status}`);
      }

      return response.blob();
    } catch (error) {
      console.error('Error al descargar inventario guardado:', error);
      throw error;
    }
  }
};

export default inventorySnapshotService;
