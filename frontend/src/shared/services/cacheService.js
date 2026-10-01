// Servicio de caché local en memoria con TTL para optimizar requests.
// Evita peticiones redundantes al servidor durante cambios de filtros.
import logger from '../utils/logger';

// Caché con expiración (TTL), tamaño máximo y limpieza automática.
// Usa una instancia singleton exportada por defecto.
class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutos TTL
    this.maxSize = 100; // Máximo 100 entradas
    this.autoCleanup = true;
    
    // Limpiar cache expirado cada 2 minutos
    if (this.autoCleanup) {
      setInterval(() => this.cleanup(), 2 * 60 * 1000);
    }
  }

  // Generar clave única para cache basada en parámetros de consulta
  // Formato: barber_<id>_<tipo>_<inicio>_<fin>
  generateKey(barberId, filterType, dateStart, dateEnd = null) {
    const endDate = dateEnd || dateStart;
    return `barber_${barberId}_${filterType}_${dateStart}_${endDate}`;
  }

  // Generar clave para cache de fechas disponibles
  generateDatesKey(startDate, endDate) {
    return `available_dates_${startDate}_${endDate}`;
  }

  // Guardar datos en cache con timestamp
  // Si el cache está lleno, limpia expirados y, si sigue lleno, descarta el más antiguo
  set(key, data) {
    // Si el cache está lleno, limpiar entradas expiradas
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
      
      // Si sigue lleno después de limpieza, eliminar la entrada más antigua
      if (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + this.ttl
    });

    logger.debug(`💾 Cache SET: ${key} (${this.cache.size}/${this.maxSize})`);
  }

  // Obtener datos del cache si no han expirado (null en MISS o expirado)
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      logger.debug(`❌ Cache MISS: ${key}`);
      return null;
    }

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      logger.debug(`⏰ Cache EXPIRED: ${key}`);
      return null;
    }

    logger.debug(`✅ Cache HIT: ${key}`);
    return item.data;
  }

  // Verificar si existe una clave en cache válido
  has(key) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expires) {
      return false;
    }
    return true;
  }

  // Limpiar entradas expiradas del cache (devuelve cuántas eliminó)
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`🧹 Cache cleanup: ${cleanedCount} entradas eliminadas`);
    }

    return cleanedCount;
  }

  // Limpiar todo el cache
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug(`🗑️ Cache cleared: ${size} entradas eliminadas`);
  }

  // Obtener estadísticas del cache (tamaño, límite, TTL y claves)
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      entries: Array.from(this.cache.keys())
    };
  }

  // Invalidar cache por barbero específico (devuelve el nº de entradas borradas)
  invalidateBarber(barberId) {
    let invalidatedCount = 0;
    
    for (const key of this.cache.keys()) {
      if (key.includes(`barber_${barberId}_`)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      logger.debug(`🗑️ Cache invalidated for barber ${barberId}: ${invalidatedCount} entradas`);
    }

    return invalidatedCount;
  }

  // Invalidar cache por tipo de filtro (devuelve el nº de entradas borradas)
  invalidateFilterType(filterType) {
    let invalidatedCount = 0;
    
    for (const key of this.cache.keys()) {
      if (key.includes(`_${filterType}_`)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      logger.debug(`🗑️ Cache invalidated for filter ${filterType}: ${invalidatedCount} entradas`);
    }

    return invalidatedCount;
  }

  // Precargar datos en cache a partir de una promesa.
  // Si ya hay una entrada válida, no repite la petición.
  preload(key, dataPromise) {
    // Si ya existe en cache válido, no precargar
    if (this.has(key)) {
      return Promise.resolve(this.get(key));
    }

    // Ejecutar la promesa y guardar resultado
    return dataPromise.then(data => {
      this.set(key, data);
      return data;
    }).catch(error => {
      console.error(`❌ Error en precarga de cache ${key}:`, error);
      throw error;
    });
  }
}

// Crear instancia singleton del cache
const cacheService = new CacheService();

// Exponer en window para debugging en desarrollo
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.cacheService = cacheService;
  logger.debug('🐛 cacheService expuesto en window.cacheService para debugging');
}

export default cacheService;

