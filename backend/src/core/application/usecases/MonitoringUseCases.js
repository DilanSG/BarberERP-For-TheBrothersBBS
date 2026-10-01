import os from 'os';
import { logger } from '../../../shared/utils/logger.js';

// Casos de uso de monitoreo en memoria.
// Acumula métricas de requests, tiempos de respuesta, uso de memoria/CPU,
// errores y efectividad del caché, y expone un snapshot vía getMetrics().
class MonitoringUseCases {
  // Inicializa las estructuras de métricas. El monitoreo periódico NO arranca
  // aquí: debe llamarse startResourceMonitoring() cuando el servidor esté listo.
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byEndpoint: new Map()
      },
      responseTime: {
        avg: 0,
        max: 0,
        min: Infinity
      },
      memory: {
        usage: [],
        maxUsage: 0
      },
      cpu: {
        usage: [],
        maxUsage: 0
      },
      errors: {
        count: 0,
        byType: new Map()
      },
      cache: {
        hits: 0,
        misses: 0,
        ratio: 0
      }
    };

    // NO iniciar monitoreo automáticamente en el constructor
    // Se debe llamar explícitamente después de que el servidor esté listo
    this.monitoringInterval = null;
  }

  // Monitoreo de recursos del sistema
  // Idempotente: si ya está activo no hace nada. Cada 5 minutos muestrea heap
  // (MB) y CPU, conserva los últimos 100 registros y solo loguea advertencia
  // cuando el consumo es realmente alto (CPU > 90% o heap > 100 MB).
  startResourceMonitoring() {
    if (this.monitoringInterval) {
      return; // Ya está iniciado
    }
    
    this.monitoringInterval = setInterval(async () => {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = await this.getCPUUsage();

      // Memoria
      this.metrics.memory.usage.push({
        timestamp: Date.now(),
        value: memoryUsage.heapUsed / 1024 / 1024 // MB
      });

      this.metrics.memory.maxUsage = Math.max(
        this.metrics.memory.maxUsage,
        memoryUsage.heapUsed / 1024 / 1024
      );

      // CPU
      this.metrics.cpu.usage.push({
        timestamp: Date.now(),
        value: cpuUsage
      });

      this.metrics.cpu.maxUsage = Math.max(
        this.metrics.cpu.maxUsage,
        cpuUsage
      );

      // Mantener solo últimos 100 registros
      if (this.metrics.memory.usage.length > 100) {
        this.metrics.memory.usage.shift();
      }
      if (this.metrics.cpu.usage.length > 100) {
        this.metrics.cpu.usage.shift();
      }

      // Log SOLO si hay uso REALMENTE alto de recursos
      if (cpuUsage > 90 || (memoryUsage.heapUsed / 1024 / 1024) > 100) {
        logger.warn('Alto uso de recursos detectado', {
          cpu: cpuUsage,
          memory: memoryUsage.heapUsed / 1024 / 1024,
          module: 'monitoring'
        });
      }
    }, 300000); // Cada 5 minutos en lugar de cada minuto
  }

  // Calcula uso de CPU
  // Toma dos muestras de los tiempos por núcleo separadas 100 ms y estima el
  // porcentaje de uso como (1 - idle/total) promedio entre todos los núcleos.
  async getCPUUsage() {
    const startMeasure = os.cpus().map(cpu => ({
      idle: cpu.times.idle,
      total: Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0)
    }));

    await new Promise(resolve => setTimeout(resolve, 100));

    const endMeasure = os.cpus().map(cpu => ({
      idle: cpu.times.idle,
      total: Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0)
    }));

    const cpuUsage = startMeasure.map((start, i) => {
      const end = endMeasure[i];
      const idle = end.idle - start.idle;
      const total = end.total - start.total;
      return ((1 - idle / total) * 100).toFixed(1);
    });

    return parseFloat(cpuUsage.reduce((acc, usage) => acc + parseFloat(usage), 0) / cpuUsage.length);
  }

  // Registra una request
  // Usa como clave `MÉTODO ruta` (req.route.path si existe) para agrupar por
  // endpoint, inicializa sus contadores y retorna el objeto de seguimiento.
  trackRequest(req, startTime) {
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    
    if (!this.metrics.requests.byEndpoint.has(endpoint)) {
      this.metrics.requests.byEndpoint.set(endpoint, {
        count: 0,
        errors: 0,
        totalTime: 0
      });
    }

    const endpointMetrics = this.metrics.requests.byEndpoint.get(endpoint);
    endpointMetrics.count++;
    
    this.metrics.requests.total++;
    
    return {
      endpointMetrics,
      endpoint,
      startTime
    };
  }

  // Registra una respuesta exitosa
  // Actualiza el promedio móvil de tiempos (ponderado por total de requests),
  // los extremos max/min y advierte si supera SLOW_REQUEST_MS (2000 ms por defecto).
  trackSuccess(tracking, responseTime) {
    this.metrics.requests.success++;
    tracking.endpointMetrics.totalTime += responseTime;

    // Actualizar tiempos de respuesta
    this.metrics.responseTime.avg = (
      (this.metrics.responseTime.avg * (this.metrics.requests.total - 1) + responseTime) /
      this.metrics.requests.total
    );
    this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, responseTime);
    this.metrics.responseTime.min = Math.min(this.metrics.responseTime.min, responseTime);

    // Log si el tiempo de respuesta es alto (umbral configurable)
    const slowRequestMs = Number(process.env.SLOW_REQUEST_MS || 2000);
    if (responseTime > slowRequestMs) {
      logger.warn('Tiempo de respuesta alto detectado', {
        endpoint: tracking.endpoint,
        responseTime: Math.round(responseTime),
        module: 'monitoring'
      });
    }
  }

  // Registra un error
  // Acumula totales global/por endpoint y por tipo (error.name); si el tipo ya
  // se repitió más de 10 veces emite un log de error frecuente.
  trackError(tracking, error) {
    this.metrics.requests.errors++;
    tracking.endpointMetrics.errors++;
    this.metrics.errors.count++;

    const errorType = error.name || 'UnknownError';
    const errorCount = this.metrics.errors.byType.get(errorType) || 0;
    this.metrics.errors.byType.set(errorType, errorCount + 1);

    // Log de errores frecuentes
    if (errorCount > 10) {
      logger.error('Error frecuente detectado', {
        type: errorType,
        count: errorCount,
        module: 'monitoring'
      });
    }
  }

  // Registra eventos de caché
  // Incrementa hits o misses y recalcula el ratio de aciertos en porcentaje.
  trackCache(hit) {
    if (hit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }
    
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.ratio = (this.metrics.cache.hits / total) * 100;
  }

  // Obtiene todas las métricas
  // Arma un snapshot con uptime, totales, historiales y Map convertidos a objeto.
  getMetrics() {
    const now = new Date();
    const uptime = process.uptime();
    
    return {
      timestamp: now.toISOString(),
      uptime: uptime,
      requests: {
        total: this.metrics.requests.total,
        success: this.metrics.requests.success,
        errors: this.metrics.requests.errors,
        byEndpoint: Object.fromEntries(this.metrics.requests.byEndpoint)
      },
      responseTime: this.metrics.responseTime,
      memory: {
        current: process.memoryUsage().heapUsed / 1024 / 1024,
        max: this.metrics.memory.maxUsage,
        history: this.metrics.memory.usage
      },
      cpu: {
        current: this.metrics.cpu.usage[this.metrics.cpu.usage.length - 1]?.value || 0,
        max: this.metrics.cpu.maxUsage,
        history: this.metrics.cpu.usage
      },
      errors: {
        total: this.metrics.errors.count,
        byType: Object.fromEntries(this.metrics.errors.byType)
      },
      cache: this.metrics.cache
    };
  }

  // Detener monitoreo de recursos
  // Cancela el interval activo (si lo hay) y limpia la referencia.
  stopResourceMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Monitoreo de recursos detenido');
    }
  }
}

// Singleton
export default new MonitoringUseCases();
