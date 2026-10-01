import monitoringService from '../../core/application/usecases/MonitoringUseCases.js';
import { performance } from 'perf_hooks';
import { logger } from '../../barrel.js';

// Middleware para monitoreo de métricas de la aplicación
// Mide la duración real de cada request y al finalizar registra éxito o error
// en monitoringService, además de loguear los errores con detalle.
const monitoringMiddleware = (req, res, next) => {
  // Marca de tiempo al inicio de la request
  const startTime = process.hrtime();
  
  // Iniciar tracking de la request
  const tracking = monitoringService.trackRequest(req, startTime);

  // Interceptar la finalización de la request
  res.on('finish', () => {
    // Calcular tiempo de respuesta
    const hrtime = process.hrtime(startTime);
    const responseTime = hrtime[0] * 1000 + hrtime[1] / 1000000;

    // Trackear según el status code
    if (res.statusCode >= 400) {
      monitoringService.trackError(tracking, {
        name: `HTTP${res.statusCode}`,
        message: res.statusMessage
      });

      // Log detallado para errores
      logger.error('Request error', {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: Math.round(responseTime * 100) / 100, // Redondear a 2 decimales
        userAgent: req.get('user-agent'),
        ip: req.ip || req.connection?.remoteAddress || 'unknown',
        module: 'monitoring'
      });
    } else {
      monitoringService.trackSuccess(tracking, responseTime);
    }
  });

  next();
};

// Middleware para endpoints de monitoreo
// Devuelve el snapshot completo de métricas recolectadas.
const metricsEndpoint = (req, res) => {
  const metrics = monitoringService.getMetrics();
  res.json(metrics);
};

// Middleware para health check
// Resume uptime, memoria, CPU, errores y tasas de éxito; marca el estado como
// 'degraded' o 'unhealthy' cuando se superan los umbrales críticos.
const healthCheck = (req, res) => {
  const metrics = monitoringService.getMetrics();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(metrics.memory.current),
      max: Math.round(metrics.memory.max)
    },
    cpu: {
      current: Math.round(metrics.cpu.current),
      max: Math.round(metrics.cpu.max)
    },
    errors: metrics.errors.total,
    requestsTotal: metrics.requests.total,
    successRate: ((metrics.requests.success / metrics.requests.total) * 100).toFixed(2) + '%',
    cacheHitRate: metrics.cache.ratio.toFixed(2) + '%'
  };

  // Verificar umbrales críticos
  if (metrics.cpu.current > 80 || metrics.memory.current > 1024) {
    health.status = 'degraded';
  }
  if (metrics.errors.total > 100 || metrics.requests.errors > metrics.requests.success) {
    health.status = 'unhealthy';
  }

  res.json(health);
};

export {
  monitoringMiddleware,
  metricsEndpoint,
  healthCheck
};
