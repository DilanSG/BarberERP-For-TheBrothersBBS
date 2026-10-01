// Cliente HTTP central de la aplicación.
// Expone `api` (get/post/put/delete/patch/upload) con:
// - token JWT validado localmente antes de cada petición
// - reintentos con backoff exponencial y timeout según el tipo de petición
// - caché en memoria + Cache API con stale-while-revalidate
// - deduplicación de peticiones GET simultáneas a la misma URL
// - manejo centralizado de errores 400/401/403/404/429/5xx con notificaciones
import config from '../config/api.js';
import logger from '../utils/logger';

// URL base de la API (ej. http://localhost:5000/api/v1)
export const API_URL = config.apiUrl;
// Versión enviada en la cabecera X-Client-Version
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

// Log de configuración de conexión para debugging
console.log('🔧 Configuración de API:', config.getConnectionInfo());

// Espera no bloqueante usada por los reintentos (backoff)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Contexto de notificaciones de React (se inyecta con setNotificationContext)
let notificationContext = null;

// Conecta el NotificationContext de React con este módulo; si no se conecta,
// los errores se avisan con `alert` como fallback.
export const setNotificationContext = (context) => {
  notificationContext = context;
};

// Envoltorio defensivo sobre la Cache API del navegador.
// La Cache API solo existe en contextos seguros (HTTPS/localhost); si no está
// disponible o falla, se devuelve un valor vacío para no romper la app.
// La caché en memoria sigue funcionando como capa principal.
const safeCache = {
  // Abre (o crea) la caché por nombre; null si no está disponible
  async open(name) {
    if (typeof caches === 'undefined') return null;
    try {
      return await caches.open(name);
    } catch (error) {
      console.warn('Error al abrir caché:', error);
      return null;
    }
  },

  // Borra una entrada concreta de la Cache API (false si no se pudo)
  async delete(request) {
    if (typeof caches === 'undefined') return false;
    try {
      return await caches.delete(request);
    } catch (error) {
      console.warn('Error al eliminar caché:', error);
      return false;
    }
  },

  // Lista los nombres de caché existentes; [] si la Cache API no está disponible
  async keys() {
    if (typeof caches === 'undefined') return [];
    try {
      return await caches.keys();
    } catch (error) {
      console.warn('Error al obtener keys de caché:', error);
      return [];
    }
  }
};

// Construye un Error nuevo conservando `response`, `data` y `status` del error
// original, para no perder el detalle HTTP en errores de validación (400).
const createPreservedError = (message, error) => {
  const preservedError = new Error(message);
  if (error?.response) preservedError.response = error.response;
  if (error?.data) preservedError.data = error.data;
  if (error?.response?.status) preservedError.status = error.response.status;
  return preservedError;
};

// Cache helper
// Peticiones GET en vuelo (dedupe: una sola llamada por URL simultánea)
const inflightRequests = new Map();

// Caché en memoria: funciona SIEMPRE (la Cache API solo existe en HTTPS/localhost)
// Clave: url → { value, expiry }. Es la capa primaria por velocidad.
const memoryCache = new Map();
const MEMORY_CACHE_LIMIT = 300; // Nº máximo de entradas antes de podar la más antigua

// Caché de respuestas GET en dos capas: memoria (rápida) y Cache API (persistente
// entre recargas). Soporta stale-while-revalidate usando entradas expiradas.
export const cacheHelper = {
  // Devuelve { value, expiry } aunque esté expirado (para stale-while-revalidate).
  // Busca primero en memoria y luego en la Cache API (repuebla la memoria).
  async getEntry(key) {
    // 1) Memoria (inmediata)
    const inMemory = memoryCache.get(key);
    if (inMemory) return inMemory;

    // 2) Cache API (persistencia entre recargas; solo en contextos seguros)
    const cache = await safeCache.open('api-cache');
    if (!cache) return null;
    try {
      const response = await cache.match(key);
      if (!response) return null;
      const data = await response.json();
      if (data && data.value !== undefined) {
        const entry = { value: data.value, expiry: data.expiry || 0 };
        memoryCache.set(key, entry);
        return entry;
      }
    } catch (error) {
      console.warn('Error al obtener entrada de caché:', error);
    }
    return null;
  },

  // Devuelve el valor solo si NO ha expirado (revisa únicamente la Cache API);
  // si expiró, elimina la entrada.
  async get(key) {
    const cache = await safeCache.open('api-cache');
    if (!cache) return null;
    
    try {
      const response = await cache.match(key);
      if (response) {
        const data = await response.json();
        // Verificar si el caché ha expirado
        if (data.expiry && data.expiry > Date.now()) {
          return data.value;
        }
        // Si expiró, eliminar del caché
        await cache.delete(key);
      }
    } catch (error) {
      console.warn('Error al obtener del caché:', error);
    }
    return null;
  },

  // Guarda la entrada en memoria (podando la más antigua si se supera el
  // límite) y además la persiste en la Cache API si está disponible.
  async set(key, value, ttl = 300000) { // 5 minutos por defecto
    const entry = {
      value,
      expiry: Date.now() + ttl,
      timestamp: Date.now()
    };

    // Memoria (podar si crece demasiado)
    if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
      const oldest = memoryCache.keys().next().value;
      memoryCache.delete(oldest);
    }
    memoryCache.set(key, entry);

    // Persistencia (Cache API) — opcional según el contexto
    const cache = await safeCache.open('api-cache');
    if (!cache) return;
    try {
      const response = new Response(JSON.stringify(entry));
      await cache.put(key, response);
    } catch (error) {
      console.warn('Error al guardar en caché:', error);
    }
  },

  // Vacía la caché en memoria y elimina todas las cachés del navegador
  async clear() {
    memoryCache.clear();
    try {
      const keys = await safeCache.keys();
      await Promise.all(keys.map(key => safeCache.delete(key)));
    } catch (error) {
      console.warn('Error al limpiar caché:', error);
    }
  },

  // Invalida entradas cuyo URL coincida con el patrón (p. ej. /sales).
  // Recorre memoria y Cache API; útil tras POST/PUT/PATCH/DELETE.
  async invalidateByPattern(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    for (const key of [...memoryCache.keys()]) {
      if (regex.test(key)) memoryCache.delete(key);
    }
    try {
      const cache = await safeCache.open('api-cache');
      if (!cache) return;
      const keys = await cache.keys();
      await Promise.all(keys.map((req) => (regex.test(req.url) ? cache.delete(req) : null)));
    } catch (error) {
      console.warn('Error invalidando caché:', error);
    }
  }
};

// Ejecuta fetch con timeout y reintentos automáticos.
// - Timeout: 30s para subidas (multipart) y snapshots; 10s para el resto.
// - Añade cabeceras X-Client-Version y X-Request-ID para monitoreo.
// - Reintenta con backoff exponencial en 429 y en fallos de red.
// Parámetros: url, options de fetch, reintentos restantes (3) y backoff inicial (1000ms).
// Devuelve la Response; lanza Error con response/data adjuntos si el HTTP no es ok.
export const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
  // Añadir timeout de 30 segundos para subidas de archivos y snapshots
  const isUpload = options.headers && options.headers['Content-Type'] === 'multipart/form-data';
  const isSnapshot = url.includes('/inventory-snapshots');
  const timeoutMs = isUpload || isSnapshot ? 30000 : 10000; // 30s para uploads/snapshots, 10s para otros
  
  const controller = new AbortController();
  let timeoutId;
  
  try {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    // Añadir headers de monitoreo
    options.headers = {
      ...options.headers,
      'X-Client-Version': APP_VERSION,
      'X-Request-ID': Math.random().toString(36).substring(7)
    };
    
    options.signal = controller.signal;

    const startTime = performance.now();
    const response = await fetch(url, options);
    const endTime = performance.now();
    
    clearTimeout(timeoutId);

    // Comentado: Las métricas de rendimiento están causando errores
    // try {
    //   await fetch(`${API_URL}/monitoring/metrics`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       endpoint: url,
    //       responseTime: endTime - startTime,
    //       status: response.status,
    //       success: response.ok
    //     })
    //   });
    // } catch (e) {
    //   console.warn('Error enviando métricas:', e);
    // }
    
    // 429 (rate limit): espera y reintenta duplicando el backoff
    if (response.status === 429 && retries > 0) {
      await wait(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }

    if (!response.ok) {
      // Primero intentar obtener el cuerpo de la respuesta para el manejo de errores
      let errorBody;
      try {
        errorBody = await response.text();
        // Intentar parsear como JSON si es posible
        try {
          errorBody = JSON.parse(errorBody);
        } catch (e) {
          // Si no es JSON válido, mantener como texto
        }
      } catch (e) {
        errorBody = 'Error desconocido';
      }

      // Crear error con detalles
      const error = new Error(
        `HTTP error! status: ${response.status}\nEndpoint: ${url}\nDetails: ${typeof errorBody === 'object' ? JSON.stringify(errorBody) : errorBody}`
      );
      error.response = response;
      error.data = errorBody;
      throw error;
    }

    return response;
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Si es timeout, mostrar mensaje específico
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`La operación tardó demasiado (más de ${timeoutMs/1000}s). Esto puede deberse a problemas de conectividad.`);
      throw timeoutError;
    }
    
    // Fallo de red (servidor caído, CORS, sin conexión): reintenta con backoff
    if (retries > 0 && (error.name === 'TypeError' || error.message.includes('failed to fetch'))) {
      await wait(backoff);
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
};

// Cierre de sesión forzado por token expirado:
// muestra la notificación (o `alert` si no hay contexto), limpia token, usuario
// y caché, y redirige a /login pasados 2 segundos.
export const handleSessionExpired = () => {
  logger.debug('🕐 Sesión expirada - iniciando proceso de limpieza');
  
  // Mostrar notificación de sesión expirada
  if (notificationContext) {
    logger.debug('📢 Mostrando notificación de sesión expirada');
    notificationContext.showSessionExpired();
  } else {
    console.warn('⚠️ NotificationContext no disponible para mostrar sesión expirada');
    // Fallback: usar alert si no hay contexto
    alert('Tu sesión ha expirado. Serás redirigido al login.');
  }
  
  // Limpiar datos locales
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  cacheHelper.clear();
  
  // Redirigir después de un breve delay
  setTimeout(() => {
    logger.debug('🔄 Redirigiendo a login...');
    window.location.href = '/login';
  }, 2000);
};

// Manejo centralizado de errores 401 (token expirado, ausente o inválido):
// - No notifica en /auth/login ni /auth/register (los maneja el formulario).
// - Evita bucles de redirección si ya estamos en /login o /register.
// - Si el mensaje indica expiración/JWT llama a handleSessionExpired.
// - En cualquier otro caso avisa, limpia credenciales y redirige a /login.
// Siempre lanza Error para que el llamador detenga el flujo.
const handleAuthError = (response, data, endpoint = '') => {
  if (response.status === 401) {
    const message = data.message || '';
    
    // No mostrar notificaciones durante el proceso de login o registro
    if (endpoint.includes('/auth/login') || endpoint.includes('/auth/register')) {
      // Dejar que el AuthService y los componentes manejen estos errores
      throw new Error(message || 'Error de autenticación');
    }
    
    // Evitar bucles de redirección si ya estamos en login
    if (window.location.pathname === '/login' || window.location.pathname === '/register') {
      throw new Error(message || 'Error de autenticación');
    }
    
    if (message.toLowerCase().includes('expirado') || 
        message.toLowerCase().includes('expired') ||
        message.toLowerCase().includes('jwt')) {
      // Token expirado
      logger.debug('🕐 Token expirado detectado, llamando handleSessionExpired');
      handleSessionExpired();
      throw new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    } else if (message.toLowerCase().includes('no proporcionado') || 
               message.toLowerCase().includes('token requerido') ||
               message.toLowerCase().includes('acceso denegado') ||
               message.toLowerCase().includes('unauthorized')) {
      // Token faltante o acceso denegado
      logger.debug('🚫 Acceso no autorizado, mostrando notificación');
      if (notificationContext) {
        notificationContext.showError(
          'Tu sesión ha expirado o no tienes los permisos necesarios. Redirigiendo al login...',
          'Sesión Expirada'
        );
      }
      // Limpiar datos locales
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirigir a login
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      throw new Error('Se requiere autenticación. Redirigiendo al inicio de sesión...');
    } else {
      // Otros errores de autenticación
      logger.debug('❌ Otro error de autenticación');
      if (notificationContext) {
        notificationContext.showError(
          'Error de autenticación. Por favor, inicia sesión nuevamente.',
          'Acceso Denegado'
        );
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      throw new Error('Error de autenticación. Redirigiendo al inicio de sesión...');
    }
  }
};

// Traduce errores HTTP a notificaciones de usuario según el status:
// 429 servidor ocupado, 403 sin permisos, 404 no encontrado, 500 error interno,
// fallo de red (failed to fetch). Los 400 y 401 se omiten aquí porque ya se
// manejan antes con mensajes específicos.
const handleConnectionError = (error) => {
  if (notificationContext) {
    if (error.message.includes('failed to fetch') || error.name === 'TypeError') {
      notificationContext.showConnectionError();
    } else if (error.message.includes('429')) {
      notificationContext.showWarning(
        'El servidor está ocupado. Por favor, espera un momento y vuelve a intentarlo.',
        'Servidor Ocupado'
      );
    } else if (error.message.includes('HTTP error! status: 400')) {
      // Los errores 400 (validación) ya son manejados específicamente en cada método
      return;
    } else if (error.message.includes('HTTP error! status: 401')) {
      // Ya manejado por handleAuthError, no mostrar duplicado
      return;
    } else if (error.message.includes('HTTP error! status: 403')) {
      notificationContext.showError(
        'No tienes permisos para realizar esta acción.',
        'Acceso Prohibido'
      );
    } else if (error.message.includes('HTTP error! status: 404')) {
      notificationContext.showError(
        'El recurso solicitado no fue encontrado.',
        'No Encontrado'
      );
    } else if (error.message.includes('HTTP error! status: 500')) {
      // No mostrar notificación genérica para errores de duplicado, 
      // ya que el componente manejará el error específico
      if (!(error.message.includes('duplicate key error') || error.message.includes('E11000'))) {
        notificationContext.showError(
          'Error interno del servidor. Por favor, inténtalo más tarde.',
          'Error del Servidor'
        );
      }
    } else {
      // Solo mostrar para errores genéricos que no tienen un status HTTP específico
      if (!error.message.includes('HTTP error! status:')) {
        notificationContext.showError(error.message, 'Error de Servidor');
      }
    }
  }
};

// Devuelve el token guardado solo si sigue vigente.
// Decodifica el payload del JWT SIN verificar la firma (únicamente para leer `exp`).
// Si está expirado o malformado, limpia token/usuario y devuelve null.
// Función auxiliar para obtener token válido
export const getValidToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  try {
    // Decodificar sin verificar la firma para revisar expiración
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < now) {
      logger.debug('🚨 Token expirado, removiendo del localStorage');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return null;
    }
    
    return token;
  } catch (error) {
    console.error('❌ Error al validar token:', error);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return null;
  }
};

export const api = {
  // Firma flexible:
  // api.get(endpoint)
  // api.get(endpoint, false) -> sin caché
  // api.get(endpoint, true, 60000) -> con TTL custom
  // api.get(endpoint, { params: {...}, useCache: true, cacheTTL: 60000 })
  // GET con caché y deduplicación de peticiones simultáneas.
  // Flujo: si la caché está fresca devuelve su valor; si está expirada devuelve
  // la copia vieja y revalida en segundo plano (stale-while-revalidate); si no
  // hay caché hace la petición y la comparte con otras idénticas en vuelo.
  get: async (endpoint, optionsOrUseCache = true, cacheTTL = 300000) => {
    try {
      let params = null;
      let useCache = true;
      let finalTTL = cacheTTL;

      if (typeof optionsOrUseCache === 'object' && optionsOrUseCache !== null && !Array.isArray(optionsOrUseCache)) {
        params = optionsOrUseCache.params || null;
        if (typeof optionsOrUseCache.useCache === 'boolean') useCache = optionsOrUseCache.useCache;
        if (typeof optionsOrUseCache.cacheTTL === 'number') finalTTL = optionsOrUseCache.cacheTTL;
      } else {
        // Backward compatibility (boolean second arg)
        useCache = Boolean(optionsOrUseCache);
      }

      const token = getValidToken();

      // Construir query string si hay params
      let queryString = '';
      if (params && typeof params === 'object') {
        const usp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') {
            usp.append(k, v);
          }
        });
        const built = usp.toString();
        if (built) queryString = `?${built}`;
      }

      const url = `${API_URL}${endpoint}${queryString}`;
      if (params) {
        console.log('🔍 [api.get] URL construida con params:', { endpoint, url, params, useCache, finalTTL });
      }

      const authHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };

      // Petición real: parsea JSON, valida 401 y guarda en caché si aplica
      const fetchAndCache = async () => {
        const response = await fetchWithRetry(url, { method: 'GET', headers: authHeaders });
        const data = await response.json();
        handleAuthError(response, data, endpoint);
        if (useCache && response.ok) {
          await cacheHelper.set(url, data, finalTTL);
        }
        return data;
      };

      // Caché: fresca → instantánea; expirada → instantánea + revalidación en 2º plano
      if (useCache) {
        const entry = await cacheHelper.getEntry(url);
        if (entry) {
          if (entry.expiry > Date.now()) return entry.value;
          // stale-while-revalidate (deduplicado)
          if (!inflightRequests.has(url)) {
            const bg = fetchAndCache()
              .catch(() => {})
              .finally(() => inflightRequests.delete(url));
            inflightRequests.set(url, bg);
          }
          return entry.value;
        }
      }

      // Dedupe: si ya hay una petición igual en curso, compartirla
      if (inflightRequests.has(url)) {
        return inflightRequests.get(url);
      }

      const request = fetchAndCache();
      inflightRequests.set(url, request);
      try {
        return await request;
      } finally {
        inflightRequests.delete(url);
      }
    } catch (error) {
      logger.debug('🚨 Error en api.get:', error);
      if (error.response && error.data) {
        try {
          handleAuthError(error.response, error.data, endpoint);
        } catch (authError) {
          throw authError;
        }
      }
      handleConnectionError(error);
      throw error;
    }
  },

  // POST en JSON con token. Al responder OK invalida la caché del recurso
  // (patrón = primer segmento del endpoint, p. ej. /sales).
  // Los errores 400 de validación se notifican con el detalle por campo.
  // Devuelve el JSON ya parseado.
  post: async (endpoint, data) => {
    try {
      const token = getValidToken();
      const response = await fetchWithRetry(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      // Manejar errores de autenticación
      handleAuthError(response, responseData, endpoint);

      // Invalidar caché relacionado (memoria + Cache API)
      if (response.ok) {
        try {
          await cacheHelper.invalidateByPattern(new RegExp(endpoint.split('/')[1]));
        } catch (cacheError) {
          console.warn('Error al invalidar caché:', cacheError);
        }
      }

      return responseData;
    } catch (error) {
      logger.debug('🚨 Error en api.post:', error);
      
      // 🔍 DEBUG TEMPORAL: Información completa del error para recurring expenses
      if (endpoint.includes('expenses/recurring')) {
        console.log('🔍 [DEBUG api.post] Error completo para expenses/recurring:', {
          error: error,
          message: error.message,
          response: error.response,
          data: error.data,
          status: error.response?.status,
          hasResponse: !!error.response,
          hasData: !!error.data,
          responseKeys: error.response ? Object.keys(error.response) : [],
          dataType: typeof error.data
        });
        
        // Intentar expandir más detalles si están disponibles
        if (error.data && typeof error.data === 'object') {
          console.log('🔍 [DEBUG api.post] Error data expandido:', JSON.stringify(error.data, null, 2));
        }
        
        if (error.response && error.response.status) {
          console.log('🔍 [DEBUG api.post] Response status y headers:', {
            status: error.response.status,
            statusText: error.response.statusText,
            headers: error.response.headers
          });
        }
      }
      
      // Si el error tiene información de respuesta HTTP, manejar específicamente
      if (error.response && error.data) {
        try {
          handleAuthError(error.response, error.data, endpoint);
        } catch (authError) {
          throw authError;
        }
        
        // Si llegamos aquí, no es un error de autenticación
        // Para errores 400 (validación), mostrar mensaje específico sin duplicar
        if (error.response.status === 400 && notificationContext) {
          const errorData = error.data;
          let message = 'Error de validación';
          
          // Si hay detalles de validación específicos, mostrarlos
          if (errorData?.details && Array.isArray(errorData.details)) {
            const fieldErrors = errorData.details.map(detail => 
              `${detail.field}: ${detail.message}`
            ).join(', ');
            message = `Error de validación: ${fieldErrors}`;
          } else if (errorData?.message) {
            message = errorData.message;
          }
          
          notificationContext.showError(message, 'Error de Validación');
          
          // 🔧 IMPORTANTE: Preservar información original de respuesta
          throw createPreservedError(message, error);
        }
      }
      
      // Para otros tipos de errores, usar el manejador general
      handleConnectionError(error);
      throw error;
    }
  },

  // PUT con token. Detecta FormData (no fuerza Content-Type para no romper el
  // boundary) y en JSON envía el body serializado. Invalida la caché del recurso.
  // customOptions.headers permite añadir cabeceras extra.
  put: async (endpoint, data, customOptions = {}) => {
    try {
      const token = getValidToken();
      
      // Detectar si data es FormData
      const isFormData = data instanceof FormData;
      logger.debug(`PUT ${endpoint} - isFormData: ${isFormData}`);
      
      const fetchOptions = {
        method: 'PUT',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...customOptions.headers,
        },
      };
      
      // Solo agregar Content-Type si no es FormData (el navegador lo hace automáticamente para FormData)
      if (!isFormData) {
        fetchOptions.headers['Content-Type'] = 'application/json';
        fetchOptions.body = data ? JSON.stringify(data) : undefined;
      } else {
        fetchOptions.body = data;
      }

      logger.debug('Enviando request con headers:', fetchOptions.headers);
      const response = await fetchWithRetry(`${API_URL}${endpoint}`, fetchOptions);
      logger.debug('Response status:', response.status, 'ok:', response.ok);

      const responseData = await response.json();
      logger.debug('Response data:', responseData);

      // Manejar errores de autenticación
      handleAuthError(response, responseData, endpoint);

      // Invalidar caché relacionado (memoria + Cache API)
      if (response.ok) {
        try {
          await cacheHelper.invalidateByPattern(new RegExp(endpoint.split('/')[1]));
        } catch (cacheError) {
          console.warn('Error al invalidar caché:', cacheError);
        }
      }

      return responseData;
    } catch (error) {
      logger.debug('🚨 Error en api.put:', error);
      
      // Si el error tiene información de respuesta HTTP, manejar específicamente
      if (error.response && error.data) {
        try {
          handleAuthError(error.response, error.data, endpoint);
        } catch (authError) {
          throw authError;
        }
        
        // Si llegamos aquí, no es un error de autenticación
        // Para errores 400 (validación), mostrar mensaje específico sin duplicar
        if (error.response.status === 400 && notificationContext) {
          const errorData = error.data;
          let message = 'Error de validación';
          
          // Si hay detalles de validación específicos, mostrarlos
          if (errorData?.details && Array.isArray(errorData.details)) {
            const fieldErrors = errorData.details.map(detail => 
              `${detail.field}: ${detail.message}`
            ).join(', ');
            message = `Error de validación: ${fieldErrors}`;
          } else if (errorData?.message) {
            message = errorData.message;
          }
          
          notificationContext.showError(message, 'Error de Validación');
          throw createPreservedError(message, error);
        }
      }
      
      // Para otros tipos de errores, usar el manejador general
      handleConnectionError(error);
      throw error;
    }
  },

  // DELETE con token. Invalida la caché del recurso tras una respuesta OK.
  delete: async (endpoint) => {
    try {
      const token = getValidToken();
      const response = await fetchWithRetry(`${API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      const responseData = await response.json();

      // Manejar errores de autenticación
      handleAuthError(response, responseData, endpoint);

      // Invalidar caché relacionado (memoria + Cache API)
      if (response.ok) {
        try {
          await cacheHelper.invalidateByPattern(new RegExp(endpoint.split('/')[1]));
        } catch (cacheError) {
          console.warn('Error al invalidar caché:', cacheError);
        }
      }

      return responseData;
    } catch (error) {
      logger.debug('🚨 Error en api.delete:', error);
      
      // Si el error tiene información de respuesta HTTP, manejar específicamente
      if (error.response && error.data) {
        try {
          handleAuthError(error.response, error.data, endpoint);
        } catch (authError) {
          throw authError;
        }
        
        // Si llegamos aquí, no es un error de autenticación
        // Para errores 400 (validación), mostrar mensaje específico sin duplicar
        if (error.response.status === 400 && notificationContext) {
          const errorData = error.data;
          let message = 'Error de validación';
          
          // Si hay detalles de validación específicos, mostrarlos
          if (errorData?.details && Array.isArray(errorData.details)) {
            const fieldErrors = errorData.details.map(detail => 
              `${detail.field}: ${detail.message}`
            ).join(', ');
            message = `Error de validación: ${fieldErrors}`;
          } else if (errorData?.message) {
            message = errorData.message;
          }
          
          notificationContext.showError(message, 'Error de Validación');
          throw createPreservedError(message, error);
        }
      }
      
      // Para otros tipos de errores, usar el manejador general
      handleConnectionError(error);
      throw error;
    }
  },

  // PATCH en JSON con token. Invalida la caché del recurso tras una respuesta OK.
  patch: async (endpoint, data) => {
    try {
      const token = getValidToken();
      const response = await fetchWithRetry(`${API_URL}${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      // Manejar errores de autenticación
      handleAuthError(response, responseData, endpoint);

      // Invalidar caché relacionado (memoria + Cache API)
      if (response.ok) {
        try {
          await cacheHelper.invalidateByPattern(new RegExp(endpoint.split('/')[1]));
        } catch (cacheError) {
          console.warn('Error al invalidar caché:', cacheError);
        }
      }

      return responseData;
    } catch (error) {
      logger.debug('🚨 Error en api.patch:', error);
      
      // Si el error tiene información de respuesta HTTP, manejar específicamente
      if (error.response && error.data) {
        try {
          handleAuthError(error.response, error.data, endpoint);
        } catch (authError) {
          throw authError;
        }
        
        // Si llegamos aquí, no es un error de autenticación
        // Para errores 400 (validación), mostrar mensaje específico sin duplicar
        if (error.response.status === 400 && notificationContext) {
          const errorData = error.data;
          let message = 'Error de validación';
          
          // Si hay detalles de validación específicos, mostrarlos
          if (errorData?.details && Array.isArray(errorData.details)) {
            const fieldErrors = errorData.details.map(detail => 
              `${detail.field}: ${detail.message}`
            ).join(', ');
            message = `Error de validación: ${fieldErrors}`;
          } else if (errorData?.message) {
            message = errorData.message;
          }
          
          notificationContext.showError(message, 'Error de Validación');
          throw createPreservedError(message, error);
        }
      }
      
      // Para otros tipos de errores, usar el manejador general
      handleConnectionError(error);
      throw error;
    }
  },

  // Método específico para subir archivos
  // POST de FormData: NO fija Content-Type (el navegador añade el boundary).
  // Invalida la caché del recurso y devuelve el JSON de la respuesta.
  upload: async (endpoint, formData) => {
    try {
      const token = getValidToken();
      const response = await fetchWithRetry(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          // No establecer Content-Type - el navegador lo hará automáticamente con boundary
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: formData, // Enviar FormData directamente
      });

      const responseData = await response.json();

      // Manejar errores de autenticación
      handleAuthError(response, responseData, endpoint);

      // Invalidar caché relacionado (memoria + Cache API)
      if (response.ok) {
        try {
          await cacheHelper.invalidateByPattern(new RegExp(endpoint.split('/')[1]));
        } catch (cacheError) {
          console.warn('Error al invalidar caché:', cacheError);
        }
      }

      return responseData;
    } catch (error) {
      logger.debug('🚨 Error en api.upload:', error);
      
      // Si el error tiene información de respuesta HTTP, manejar específicamente
      if (error.response && error.data) {
        try {
          handleAuthError(error.response, error.data, endpoint);
        } catch (authError) {
          throw authError;
        }
        
        // Si llegamos aquí, no es un error de autenticación
        // Para errores 400 (validación), mostrar mensaje específico sin duplicar
        if (error.response.status === 400 && notificationContext) {
          const errorData = error.data;
          let message = 'Error de validación';
          
          // Si hay detalles de validación específicos, mostrarlos
          if (errorData?.details && Array.isArray(errorData.details)) {
            const fieldErrors = errorData.details.map(detail => 
              `${detail.field}: ${detail.message}`
            ).join(', ');
            message = `Error de validación: ${fieldErrors}`;
          } else if (errorData?.message) {
            message = errorData.message;
          }
          
          notificationContext.showError(message, 'Error de Validación');
          throw createPreservedError(message, error);
        }
      }
      
      // Para otros tipos de errores, usar el manejador general
      handleConnectionError(error);
      throw error;
    }
  },
};

// Servicios específicos

// Servicios de ventas

// Servicios de citas  

// Servicios de snapshots de inventario

// API de métodos de pago (nuevo sistema centralizado)

// ============================================================================
// REVIEWS SERVICE
// ============================================================================
