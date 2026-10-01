import { logger } from "../../../shared/utils/logger.js";
import NodeCache from "node-cache";

// Servicio de caché en memoria para los reportes de ventas.
// Evita recalcular agregaciones costosas usando TTL adaptativo según el rango
// de fechas y permitiendo invalidar por barbero, tipo de reporte o todo.
class ReportsCacheService {
  // Configura el caché: TTL por defecto 15 min, revisión cada 2 min y sin
  // clonado de objetos (useClones:false) para ahorrar memoria/CPU.
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 900,
      checkperiod: 120,
      useClones: false
    });
    this.keyPrefix = "reports:";
    logger.info("Smart cache de reportes inicializado (node-cache)");
  }

  // Construye la clave `reports:<tipo>:<barbero>:<inicio>:<fin>` con las
  // fechas normalizadas a YYYY-MM-DD (ignora la hora para agrupar consultas).
  generateCacheKey(type, barberId, startDate, endDate) {
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];
    return `${this.keyPrefix}${type}:${barberId}:${start}:${end}`;
  }

  // TTL adaptativo en segundos: 5 min si el rango incluye hoy (datos volátiles),
  // 30 min para 1 día, 1 h hasta 7 días y 4 h para rangos mayores (histórico estable).
  calculateTTL(startDate, endDate) {
    const now = new Date();
    const isToday = endDate.toDateString() === now.toDateString();
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (isToday) return 300;
    else if (daysDiff === 1) return 1800;
    else if (daysDiff <= 7) return 3600;
    else return 14400;
  }

  // Lee del caché; retorna null en miss o si el almacenamiento lanza error.
  async get(type, barberId, startDate, endDate) {
    try {
      const key = this.generateCacheKey(type, barberId, startDate, endDate);
      const cachedData = this.cache.get(key);
      if (cachedData) {
        logger.info(`Cache HIT: ${type}:${barberId}`);
        return cachedData;
      }
      return null;
    } catch (error) {
      logger.error("Error en cache:", error);
      return null;
    }
  }

  // Guarda `data` con la clave y TTL calculados; retorna false si falla.
  async set(type, barberId, startDate, endDate, data) {
    try {
      const key = this.generateCacheKey(type, barberId, startDate, endDate);
      const ttl = this.calculateTTL(startDate, endDate);
      return this.cache.set(key, data, ttl);
    } catch (error) {
      logger.error("Error guardando cache:", error);
      return false;
    }
  }

  // Invalida todas las entradas de un barbero buscando `:barberId:` en la clave.
  async invalidateBarber(barberId) {
    try {
      const keys = this.cache.keys().filter(k => k.includes(`:${barberId}:`));
      if (keys.length > 0) this.cache.del(keys);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Invalida todas las entradas cuyo tipo de reporte coincida con `type`.
  async invalidateReportType(type) {
    try {
      const keys = this.cache.keys().filter(k => k.startsWith(`${this.keyPrefix}${type}:`));
      if (keys.length > 0) this.cache.del(keys);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Vacía únicamente las claves del servicio (prefijo `reports:`).
  async clearAll() {
    try {
      const keys = this.cache.keys().filter(k => k.startsWith(this.keyPrefix));
      if (keys.length > 0) this.cache.del(keys);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Patrón cache-aside: si hay dato cacheado lo devuelve; si no, ejecuta
  // `dataGenerator`, guarda el resultado con su TTL y lo retorna.
  async withCache(type, barberId, startDate, endDate, dataGenerator) {
    const cachedData = await this.get(type, barberId, startDate, endDate);
    if (cachedData) return cachedData;
    const freshData = await dataGenerator();
    await this.set(type, barberId, startDate, endDate, freshData);
    return freshData;
  }

  // Métricas del caché: claves activas, hits, misses y tasa de aciertos;
  // si no hubo hits, la tasa se reporta como 0 (evita división por cero).
  getStats() {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits > 0 ? stats.hits / (stats.hits + stats.misses) : 0
    };
  }
}

// Instancia singleton para reutilizar el mismo caché en toda la app.
export const reportsCacheService = new ReportsCacheService();
export default ReportsCacheService;