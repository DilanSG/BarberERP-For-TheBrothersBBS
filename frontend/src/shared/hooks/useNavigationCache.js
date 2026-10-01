import React, { useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import logger from '../utils/logger';
// Sistema de caché inteligente para navegación.
// Evita recargas innecesarias y mejora la performance.
// Caché en memoria con TTL (5 min por defecto) y tamaño máximo de 10 entradas;
// al llenarse descarta la entrada más antigua (orden de inserción).
class NavigationCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 10; // Máximo de páginas en caché
    this.defaultTTL = 5 * 60 * 1000; // 5 minutos por defecto
  }

  // Guarda datos para una clave con TTL; si está lleno, descarta la más antigua
  set(key, data, ttl = this.defaultTTL) {
    // Si el caché está lleno, eliminar el más antiguo
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const item = {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, item);
    logger.debug(`🗄️ Cached navigation data for: ${key}`);
  }

  // Devuelve los datos si la entrada sigue vigente; null si no existe o expiró.
  // Actualiza contadores de acceso (accessCount, lastAccessed) para getStats.
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;

    // Verificar si ha expirado
    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      logger.debug(`🗑️ Cache expired for: ${key}`);
      return null;
    }

    // Actualizar estadísticas de acceso
    item.accessCount++;
    item.lastAccessed = now;
    
    // logger.debug(`📦 Retrieved cached data for: ${key} (accessed ${item.accessCount} times)`);
    return item.data;
  }

  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;

    // Verificar expiración
    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  invalidate(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug(`🗑️ Invalidated cache for: ${key}`);
    }
    return deleted;
  }

  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    let deletedCount = 0;
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      logger.debug(`🗑️ Invalidated ${deletedCount} cache entries matching pattern: ${pattern}`);
    }
    return deletedCount;
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug(`🗑️ Cleared entire navigation cache (${size} items)`);
  }

  getStats() {
    const items = Array.from(this.cache.values());
    return {
      totalItems: this.cache.size,
      totalAccesses: items.reduce((sum, item) => sum + item.accessCount, 0),
      averageAge: items.reduce((sum, item) => sum + (Date.now() - item.timestamp), 0) / items.length || 0,
      mostAccessed: items.sort((a, b) => b.accessCount - a.accessCount)[0] || null
    };
  }
}

// Instancia singleton del caché
const navigationCache = new NavigationCache();

// Hook de caché de navegación: claves por ruta + query params, invalidación por
// patrón y sincronización entre pestañas vía evento `storage`.
export const useNavigationCache = () => {
  const location = useLocation();
  const currentRouteRef = useRef(location.pathname);

  // Generar clave de caché basada en ruta y parámetros
  const generateCacheKey = useCallback((path, params = {}) => {
    const paramString = Object.keys(params).length > 0 
      ? `?${new URLSearchParams(params).toString()}` 
      : '';
    return `${path}${paramString}`;
  }, []);

  // Cachear datos de una ruta
  const cacheRouteData = useCallback((path, data, ttl) => {
    const key = generateCacheKey(path);
    navigationCache.set(key, data, ttl);
  }, [generateCacheKey]);

  // Obtener datos cacheados de una ruta
  const getCachedRouteData = useCallback((path, params) => {
    const key = generateCacheKey(path, params);
    return navigationCache.get(key);
  }, [generateCacheKey]);

  // Verificar si una ruta tiene datos cacheados válidos
  const hasCachedData = useCallback((path, params) => {
    const key = generateCacheKey(path, params);
    return navigationCache.has(key);
  }, [generateCacheKey]);

  // Invalidar caché de una ruta específica
  const invalidateRoute = useCallback((path, params) => {
    const key = generateCacheKey(path, params);
    return navigationCache.invalidate(key);
  }, [generateCacheKey]);

  // Invalidar caché por patrón (ej: todas las rutas de admin)
  const invalidatePattern = useCallback((pattern) => {
    return navigationCache.invalidatePattern(pattern);
  }, []);

  // Limpiar todo el caché
  const clearCache = useCallback(() => {
    navigationCache.clear();
  }, []);

  // Obtener estadísticas del caché
  const getCacheStats = useCallback(() => {
    return navigationCache.getStats();
  }, []);

  // Efecto para invalidar caché cuando cambien ciertos datos
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Invalidar caché relacionado cuando cambien datos importantes
      if (e.key === 'userRole') {
        invalidatePattern('/admin/*');
        logger.debug('🗑️ Admin cache invalidated due to role change');
      }
      if (e.key === 'appointmentUpdate') {
        invalidatePattern('/appointment/*');
        logger.debug('🗑️ Appointment cache invalidated due to data update');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [invalidatePattern]);

  // Actualizar referencia de ruta actual
  useEffect(() => {
    currentRouteRef.current = location.pathname;
  }, [location.pathname]);

  return {
    cacheRouteData,
    getCachedRouteData,
    hasCachedData,
    invalidateRoute,
    invalidatePattern,
    clearCache,
    getCacheStats,
    currentRoute: currentRouteRef.current
  };
};

// HOC para componentes que necesitan caché automático.
// Inyecta cacheRouteData(data), getCachedData() y hasCachedData() usando la ruta
// actual (o cacheConfig.cacheKey) y un TTL configurable.
export const withNavigationCache = (WrappedComponent, cacheConfig = {}) => {
  return function CachedComponent(props) {
    const { 
      cacheRouteData, 
      getCachedRouteData, 
      hasCachedData 
    } = useNavigationCache();
    
    const location = useLocation();
    const { ttl = 5 * 60 * 1000, cacheKey } = cacheConfig;
    
    const key = cacheKey || location.pathname;
    
    // Props adicionales para el componente envuelto
    const cacheProps = {
      cacheRouteData: (data) => cacheRouteData(key, data, ttl),
      getCachedData: () => getCachedRouteData(key),
      hasCachedData: () => hasCachedData(key),
      ...props
    };

    return React.createElement(WrappedComponent, cacheProps);
  };
};

// Hook especializado para datos de formularios (TTL 30 min, clave form_<id>)
export const useFormCache = (formId) => {
  const { cacheRouteData, getCachedRouteData, invalidateRoute } = useNavigationCache();
  
  const saveFormData = useCallback((formData) => {
    const key = `form_${formId}`;
    cacheRouteData(key, formData, 30 * 60 * 1000); // 30 minutos para formularios
  }, [formId, cacheRouteData]);
  
  const getFormData = useCallback(() => {
    const key = `form_${formId}`;
    return getCachedRouteData(key);
  }, [formId, getCachedRouteData]);
  
  const clearFormData = useCallback(() => {
    const key = `form_${formId}`;
    return invalidateRoute(key);
  }, [formId, invalidateRoute]);
  
  return {
    saveFormData,
    getFormData,
    clearFormData
  };
};

// Utilidades de caché para casos específicos
export const cacheUtils = {
  // Precargar datos para una ruta
  preloadRouteData: async (path, dataLoader, ttl) => {
    try {
      const data = await dataLoader();
      navigationCache.set(path, data, ttl);
      // logger.debug(`🚀 Preloaded data for route: ${path}`);
    } catch (error) {
      console.warn(`⚠️ Failed to preload data for ${path}:`, error);
    }
  },

  // Invalidar caché relacionado con usuario
  invalidateUserData: () => {
    navigationCache.invalidatePattern('/profile');
    navigationCache.invalidatePattern('/appointment');
    logger.debug('🗑️ User-related cache cleared');
  },

  // Invalidar caché de administración
  invalidateAdminData: () => {
    navigationCache.invalidatePattern('/admin/*');
    logger.debug('🗑️ Admin cache cleared');
  },

  // Obtener información de debug del caché
  getDebugInfo: () => {
    const stats = navigationCache.getStats();
    return {
      ...stats,
      cacheEntries: Array.from(navigationCache.cache.keys())
    };
  }
};

export default navigationCache;

