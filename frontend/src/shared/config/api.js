// Configuración dinámica de API para todos los entornos
// Detecta automáticamente desarrollo, producción y red local

// Función para detectar la configuración de API apropiada
const getApiConfig = () => {
  // 1. Primero verificar si hay variable de entorno específica
  const envApiUrl = import.meta.env.VITE_API_URL;
  
  // 2. En producción (Vercel), usar siempre la variable de entorno
  if (import.meta.env.PROD && envApiUrl) {
    return envApiUrl;
  }
  
  // 3. En desarrollo local, detectar configuración automáticamente
  if (window.location.hostname === 'localhost') {
    return envApiUrl || 'http://localhost:5000/api/v1';
  }
  
  // 4. Si estamos accediendo por IP de red, usar la misma IP para el backend
  if (window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    const hostIp = window.location.hostname;
    return `http://${hostIp}:5000/api/v1`;
  }
  
  // 5. Fallback seguro
  return envApiUrl || 'http://localhost:5000/api/v1';
};

// Configuración de la aplicación
export const config = {
  apiUrl: getApiConfig(),
  // Otras configuraciones
  debugMode: import.meta.env.VITE_DEBUG === 'true',
  logLevel: import.meta.env.VITE_LOG_LEVEL || 'warn',
  
  // Información de la configuración actual (para diagnóstico/logs)
  getConnectionInfo: () => ({
    currentHost: window.location.hostname,
    currentPort: window.location.port,
    apiUrl: getApiConfig(),
    isLocalhost: window.location.hostname === 'localhost',
    isNetworkIp: window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) !== null
  })
};

export default config;