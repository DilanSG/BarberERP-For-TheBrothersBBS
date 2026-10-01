// Servicio de procesamiento en lotes para optimizar requests concurrentes.
// Limita el número de peticiones simultáneas, reintenta con backoff y usa la caché de cacheService.
import cacheService from './cacheService';
import logger from '../utils/logger';

// Procesa colecciones de barberos en lotes pequeños con caché, timeouts y reintentos.
// Configuración por defecto: 3 simultáneos, 100ms entre lotes, 2 reintentos, timeout 10s.
class BatchProcessingService {
  constructor() {
    this.batchSize = 3; // Máximo 3 requests simultáneos
    this.batchDelay = 100; // 100ms entre lotes
    this.retryAttempts = 2;
    this.timeout = 10000; // 10 segundos timeout
    this.activeRequests = new Set();
  }

  // Procesar barberos en lotes con cache y control de concurrencia.
  // Primero sirve lo cacheado; el resto se reparte en lotes de `batchSize`.
  // Devuelve { results, errors, cacheHits }: un objeto por barber._id.
  // Si un barbero falla, se devuelven arrays vacíos para no romper la UI.
  async processBarbersWithCache(barbers, fetchFunction, filterType, startDate, endDate = null) {
    const results = {};
    const errors = {};
    const cacheHits = {};
    
    logger.perf(`Iniciando procesamiento en lotes: ${barbers.length} barberos, lotes de ${this.batchSize}`);

    // Verificar cache primero para todos los barberos
    const barbersNeedingData = [];
    
    for (const barber of barbers) {
      const cacheKey = cacheService.generateKey(barber._id, filterType, startDate, endDate);
      const cachedData = cacheService.get(cacheKey);
      
      if (cachedData) {
        results[barber._id] = cachedData;
        cacheHits[barber._id] = true;
      } else {
        barbersNeedingData.push(barber);
      }
    }

    if (barbersNeedingData.length === 0) {
      logger.cache(`Todos los datos en cache (${barbers.length}/${barbers.length})`);
      return { results, errors, cacheHits };
    }

    logger.cache(`Cache status: ${Object.keys(cacheHits).length}/${barbers.length} en cache, ${barbersNeedingData.length} necesitan fetch`);

    // Procesar barberos que necesitan datos en lotes
    for (let i = 0; i < barbersNeedingData.length; i += this.batchSize) {
      const batch = barbersNeedingData.slice(i, i + this.batchSize);
      
      logger.perf(`Procesando lote ${Math.floor(i/this.batchSize) + 1}/${Math.ceil(barbersNeedingData.length/this.batchSize)}: ${batch.length} barberos`);

      // Procesar lote actual en paralelo
      const batchPromises = batch.map(barber => 
        this.processBarberWithRetry(barber, fetchFunction, filterType, startDate, endDate)
      );

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Procesar resultados del lote
        batchResults.forEach((result, index) => {
          const barber = batch[index];
          
          if (result.status === 'fulfilled') {
            results[barber._id] = result.value;
            
            // Guardar en cache
            const cacheKey = cacheService.generateKey(barber._id, filterType, startDate, endDate);
            cacheService.set(cacheKey, result.value);
          } else {
            logger.error(`Error procesando barbero ${barber.user?.name || barber._id}:`, result.reason);
            errors[barber._id] = result.reason;
            
            // Datos por defecto en caso de error
            results[barber._id] = {
              sales: [],
              appointments: [],
              walkIns: [],
              totals: { sales: 0, appointments: 0, walkIns: 0 }
            };
          }
        });

      } catch (error) {
        logger.error(`Error procesando lote:`, error);
        
        // Asignar datos por defecto a todo el lote
        batch.forEach(barber => {
          errors[barber._id] = error;
          results[barber._id] = {
            sales: [],
            appointments: [],
            walkIns: [],
            totals: { sales: 0, appointments: 0, walkIns: 0 }
          };
        });
      }

      // Pausa entre lotes (excepto el último)
      if (i + this.batchSize < barbersNeedingData.length) {
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }

    logger.perf(`Procesamiento completo: ${Object.keys(results).length} resultados, ${Object.keys(errors).length} errores`);
    
    return { results, errors, cacheHits };
  }

  // Procesar un barbero individual con reintentos.
  // Envuelve fetchFunction en un timeout (this.timeout) y reintenta con
  // backoff exponencial hasta `retryAttempts`; registra el request como activo.
  async processBarberWithRetry(barber, fetchFunction, filterType, startDate, endDate, attempt = 1) {
    const requestId = `${barber._id}_${Date.now()}`;
    
    try {
      this.activeRequests.add(requestId);
      
      logger.api(`Fetching data para ${barber.user?.name || barber._id} (intento ${attempt})`);
      
      // Timeout wrapper
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout después de ${this.timeout}ms`)), this.timeout)
      );

      const dataPromise = fetchFunction(barber, filterType, startDate, endDate);
      
      const result = await Promise.race([dataPromise, timeoutPromise]);
      
      logger.api(`Data obtenida para ${barber.user?.name || barber._id}`);
      return result;

    } catch (error) {
      logger.error(`Error en intento ${attempt} para ${barber.user?.name || barber._id}:`, error);
      
      if (attempt < this.retryAttempts) {
        logger.debug(`Reintentando... (${attempt + 1}/${this.retryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Backoff exponencial
        return this.processBarberWithRetry(barber, fetchFunction, filterType, startDate, endDate, attempt + 1);
      }
      
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  // Precargar datos comunes en background.
  // Espera 2s (para no competir con la carga inicial) y precarga "Hoy" y "7 días"
  // para todos los barberos indicados.
  async preloadCommonFilters(barbers, fetchFunction) {
    logger.cache(`Precargando filtros comunes para ${barbers.length} barberos...`);
    
    const today = new Date().toISOString().split('T')[0];
    const commonFilters = [
      { type: 'Hoy', date: today },
      { type: '7 días', date: today }
    ];

    // Precargar sin bloquear la UI
    setTimeout(async () => {
      for (const filter of commonFilters) {
        try {
          await this.processBarbersWithCache(
            barbers, 
            fetchFunction, 
            filter.type, 
            filter.date
          );
          logger.cache(`Precarga completada: ${filter.type}`);
        } catch (error) {
          logger.error(`Error en precarga de ${filter.type}:`, error);
        }
      }
    }, 2000); // Esperar 2 segundos después de carga inicial
  }

  // Obtener estadísticas del servicio (configuración actual y requests activos)
  getStats() {
    return {
      batchSize: this.batchSize,
      batchDelay: this.batchDelay,
      activeRequests: this.activeRequests.size,
      retryAttempts: this.retryAttempts,
      timeout: this.timeout
    };
  }

  // Configurar parámetros del servicio (batchSize, batchDelay, retryAttempts, timeout)
  configure(options = {}) {
    if (options.batchSize) this.batchSize = options.batchSize;
    if (options.batchDelay) this.batchDelay = options.batchDelay;
    if (options.retryAttempts) this.retryAttempts = options.retryAttempts;
    if (options.timeout) this.timeout = options.timeout;
    
    logger.debug(`BatchProcessingService configurado:`, this.getStats());
  }
}

// Crear instancia singleton
const batchProcessingService = new BatchProcessingService();

// Exponer en window para debugging en desarrollo
if (typeof window !== 'undefined' && import.meta.env.MODE === 'development') {
  window.batchProcessingService = batchProcessingService;
  logger.debug('batchProcessingService expuesto en window.batchProcessingService para debugging');
}

export default batchProcessingService;
