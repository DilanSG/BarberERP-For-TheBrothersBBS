// Servicio de autenticación: registro, login/logout, verificación de email,
// recuperación de contraseña y refresco de token.
import { api, cacheHelper } from './api.js';

const API_URL = import.meta.env.VITE_API_URL;
// Versión enviada en la cabecera X-Client-Version
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Sistema de reintentos específico para auth (menos intentos, más rápido)
// Añade cabeceras de monitoreo, parsea la respuesta (JSON o texto) y
// reintenta en 429 y en errores de red con backoff exponencial.
// Devuelve { response, data }; lanza Error con status/details/errors del backend.
const authFetchWithRetry = async (url, options, retries = 2, backoff = 500) => {
  try {
    // Añadir headers de monitoreo
    options.headers = {
      ...options.headers,
      'X-Client-Version': APP_VERSION,
      'X-Request-ID': Math.random().toString(36).substring(7)
    };

    const startTime = performance.now();
    const response = await fetch(url, options);
    const endTime = performance.now();

    // Métricas ya se capturan automáticamente en el backend
    // No necesitamos enviarlas manualmente desde el frontend

    if (response.status === 429 && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return authFetchWithRetry(url, options, retries - 1, backoff * 2);
    }

    // Verificar si la respuesta es JSON antes de parsearlo
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('Respuesta no JSON recibida:', text);
      data = { message: 'Error del servidor', error: text };
    }

    if (!response.ok) {
      // Crear error con details del backend para que el frontend pueda mostrarlos
      const error = new Error(data.message || 'Error en la autenticación');
      error.status = response.status;
      error.details = data.details || null;
      error.errors = data.errors || null;
      throw error;
    }

    return { response, data };
  } catch (error) {
    if (retries > 0 && error.name === 'TypeError') {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return authFetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
};

export const authService = {
  // Registro de usuario. Devuelve los datos del backend y conserva
  // `details`/`errors` en el Error para que Register.jsx los muestre.
  register: async (userData) => {
    try {
      const { data } = await authFetchWithRetry(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      return data;
    } catch (error) {
      console.error('Error en el registro:', error);
      // Re-lanzar con details preservados para que Register.jsx pueda mostrarlos
      throw error;
    }
  },

  // Login: guarda token y usuario en localStorage y limpia la caché para no
  // mezclar datos de sesiones anteriores. Traduce 401/429/red a mensajes claros.
  login: async (credentials) => {
    try {
      const { data, response } = await authFetchWithRetry(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      // Almacenar token y datos de usuario
      if (data.token) {
        localStorage.setItem('token', data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        // Limpiar caché al iniciar sesión para evitar datos de sesiones anteriores
        await cacheHelper.clear();
      }

      return data;
    } catch (error) {
      console.error('Error en el login:', error);
      
      // Mensajes de error específicos según el código de estado
      let errorMessage = error.message;
      
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessage = 'Credenciales inválidas. Verifica tu email y contraseña.';
      } else if (error.message?.includes('429')) {
        errorMessage = 'Demasiados intentos de inicio de sesión. Por favor, espera un momento.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch failed')) {
        errorMessage = 'Error de conexión. Verifica que el servidor esté activo.';
      }
      
      throw new Error(errorMessage);
    }
  },

  // Cierra sesión en el servidor (si hay token) y siempre limpia el estado local
  // y la caché, incluso si la petición falla.
  logout: async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Intenta hacer logout en el servidor
        try {
          await authFetchWithRetry(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
        } catch (e) {
          console.warn('Error en logout del servidor:', e);
        }
      }
    } finally {
      // Siempre limpiar datos locales
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      await cacheHelper.clear();
    }
  },

  // Verifica el email con el token recibido por correo
  verifyEmail: async (token) => {
    try {
      const { data } = await authFetchWithRetry(`${API_URL}/auth/verify-email/${token}`, {
        method: 'GET'
      });
      return data;
    } catch (error) {
      console.error('Error en verificación de email:', error);
      throw new Error(error.message || 'Error al verificar el email');
    }
  },

  // Solicita el correo de recuperación de contraseña (mensaje especial en 429)
  requestPasswordReset: async (email) => {
    try {
      const { data } = await authFetchWithRetry(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      return data;
    } catch (error) {
      console.error('Error en solicitud de reset de password:', error);
      throw new Error(
        error.message.includes('429')
          ? 'Demasiadas solicitudes. Por favor, espera unos minutos.'
          : error.message
      );
    }
  },

  // Restablece la contraseña con el token del correo
  resetPassword: async (token, newPassword) => {
    try {
      const { data } = await authFetchWithRetry(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      return data;
    } catch (error) {
      console.error('Error en reset de password:', error);
      throw new Error(error.message || 'Error al restablecer la contraseña');
    }
  },

  // Refresca el token con el actual; guarda el nuevo token/usuario.
  // Si falla, cierra sesión y lanza error de sesión expirada.
  refreshToken: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No hay token para refrescar');

      const { data } = await authFetchWithRetry(`${API_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token })
      });

      if (data.token) {
        localStorage.setItem('token', data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      }

      return { token: data.token, user: data.user };
    } catch (error) {
      console.error('Error refreshing token:', error);
      await authService.logout();
      throw new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    }
  },

  // Usuario guardado en localStorage (o null); no consulta al backend
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
};
