import NodeCache from 'node-cache';
import config from '../../../shared/config/index.js';
import { logger } from '../../../shared/utils/logger.js';

// Casos de uso de caché genérica en memoria.
// Envuelve node-cache con TTL configurable, listeners de expiración/borrado y
// contadores propios de hits/misses para exponer estadísticas.
class CacheUseCases {
  // Crea la instancia con la config de la app y engancha los listeners de
  // 'expired' y 'del' solo para trazabilidad (logger.debug).
  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.cache.ttl, // Tiempo de vida por defecto
      checkperiod: config.cache.checkPeriod, // Período de limpieza
      useClones: false, // Para mejor rendimiento
      deleteOnExpire: true // Eliminar keys expirados automáticamente
    });

    // Escuchar eventos de caché
    this.cache.on('expired', (key, value) => {
      logger.debug(`Cache key expirada: ${key}`, {
        key,
        value: typeof value === 'object' ? 'object' : value,
        module: 'cache'
      });
    });

    this.cache.on('del', (key) => {
      logger.debug(`Cache key eliminada: ${key}`, {
        key,
        module: 'cache'
      });
    });

    // Estadísticas iniciales
    this.stats = {
      hits: 0,
      misses: 0,
      keys: 0
    };
  }

  // Obtener un valor de la caché
  // Retorna null y suma un miss si la key no existe; si existe suma un hit.
  get(key) {
    const value = this.cache.get(key);
    
    if (value === undefined) {
      this.stats.misses++;
      logger.debug(`Cache miss: ${key}`, { key, module: 'cache' });
      return null;
    }

    this.stats.hits++;
    logger.debug(`Cache hit: ${key}`, { key, module: 'cache' });
    return value;
  }

  // Guardar un valor en la caché
  // Usa el TTL indicado (por defecto el de config), actualiza el conteo de keys
  // y retorna true/false según el resultado.
  set(key, value, ttl = config.cache.ttl) {
    const success = this.cache.set(key, value, ttl);
    
    if (success) {
      this.stats.keys = this.cache.keys().length;
      logger.debug(`Cache set: ${key}`, {
        key,
        ttl,
        valueType: typeof value,
        module: 'cache'
      });
    } else {
      logger.warn(`Error setting cache: ${key}`, {
        key,
        ttl,
        valueType: typeof value,
        module: 'cache'
      });
    }

    return success;
  }

  // Eliminar un valor de la caché
  // Retorna true si la key existía y fue borrada.
  del(key) {
    const deleted = this.cache.del(key);
    
    if (deleted > 0) {
      this.stats.keys = this.cache.keys().length;
      logger.debug(`Cache deleted: ${key}`, { key, module: 'cache' });
    }

    return deleted > 0;
  }

  // Obtener múltiples valores de la caché
  // Retorna un objeto { key: valor } solo con las keys encontradas y ajusta
  // los contadores usando keys.length como total de misses.
  mget(keys) {
    const values = this.cache.mget(keys);
    const hits = Object.keys(values).length;
    const misses = keys.length - hits;

    this.stats.hits += hits;
    this.stats.misses += misses;

    logger.debug(`Cache multiple get: ${keys.join(', ')}`, {
      keys,
      hits,
      misses,
      module: 'cache'
    });

    return values;
  }

  // Guardar múltiples valores en la caché
  // Recibe pares [{key, val}] y aplica el mismo TTL a todos.
  mset(keyValuePairs, ttl = config.cache.ttl) {
    const success = this.cache.mset(keyValuePairs.map(({key, val}) => ({
      key,
      val,
      ttl
    })));

    if (success) {
      this.stats.keys = this.cache.keys().length;
      logger.debug(`Cache multiple set`, {
        keys: keyValuePairs.map(({key}) => key),
        ttl,
        count: keyValuePairs.length,
        module: 'cache'
      });
    }

    return success;
  }

  // Limpiar toda la caché
  // Vacía todas las keys y reinicia el contador local a 0.
  flush() {
    this.cache.flushAll();
    this.stats.keys = 0;
    logger.info('Cache limpiada completamente', { module: 'cache' });
  }

  // Obtener estadísticas de la caché
  // Combina los contadores locales con las métricas del store y calcula el
  // hitRate en porcentaje (0 si aún no hubo consultas). Retorna strings.
  getStats() {
    const cacheStats = this.cache.getStats();
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      keys: this.cache.keys().length,
      memory: cacheStats,
      config: {
        ttl: config.cache.ttl,
        checkPeriod: config.cache.checkPeriod
      }
    };
  }

  // Verificar si una key existe en la caché
  has(key) {
    return this.cache.has(key);
  }

  // Obtener todas las keys en la caché
  keys() {
    return this.cache.keys();
  }

  // Obtener el TTL restante de una key (en milisegundos; undefined si no existe)
  getTtl(key) {
    return this.cache.getTtl(key);
  }

  // Extender el TTL de una key
  // Si la key existe, le aplica el nuevo TTL y retorna true.
  extendTtl(key, ttl = config.cache.ttl) {
    const success = this.cache.ttl(key, ttl);
    
    if (success) {
      logger.debug(`Cache TTL extendido: ${key}`, {
        key,
        ttl,
        module: 'cache'
      });
    }

    return success;
  }
}

// Exportar una única instancia
export default new CacheUseCases();
