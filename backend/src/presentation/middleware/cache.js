import cacheService from '../../core/application/usecases/CacheUseCases.js';
import { logger } from '../../barrel.js';

// Genera una key de caché basada en la request
// Combina URL + método + usuario y normaliza la query para que distintas
// variaciones de orden de parámetros compartan la misma entrada.
const generateCacheKey = (req) => {
  const parts = [
    req.originalUrl,
    req.method,
    req.user ? req.user._id : 'anonymous'
  ];

  // Añadir query params ordenados si existen (ignorando cache-busters)
  const IGNORED_PARAMS = new Set(['_t', '_', 'timestamp']);
  const queryKeys = Object.keys(req.query).filter((key) => !IGNORED_PARAMS.has(key));
  if (queryKeys.length > 0) {
    const sortedQuery = queryKeys
      .sort()
      .reduce((acc, key) => {
        acc[key] = req.query[key];
        return acc;
      }, {});
    parts.push(JSON.stringify(sortedQuery));
  }

  // Añadir body en requests POST/PUT si existe
  if (['POST', 'PUT'].includes(req.method) && Object.keys(req.body).length > 0) {
    parts.push(JSON.stringify(req.body));
  }

  return parts.join('|');
};

// Middleware de caché para rutas
// @param {number|null} duration - TTL en segundos (null usa el TTL por defecto del servicio)
export const cacheMiddleware = (duration = null) => {
  return (req, res, next) => {
    // Skip cache en desarrollo si se especifica
    if (process.env.DISABLE_CACHE === 'true') {
      return next();
    }

    // No cachear si hay errores
    if (res.statusCode >= 400) {
      return next();
    }

    const key = generateCacheKey(req);
    const cachedResponse = cacheService.get(key);

    if (cachedResponse) {
      logger.debug('Respuesta servida desde caché', {
        key,
        method: req.method,
        url: req.originalUrl,
        module: 'cache'
      });

      return res.json(cachedResponse);
    }

    // Interceptar res.json para cachear la respuesta
    const originalJson = res.json;
    res.json = function(body) {
      if (res.statusCode < 400) {
        cacheService.set(key, body, duration);
      }
      
      return originalJson.call(this, body);
    };

    next();
  };
};

// Middleware para invalidar caché
// @param {string[]} patterns - Patrones (strings de expresiones regulares) de keys a invalidar
export const invalidateCacheMiddleware = (patterns) => {
  return (req, res, next) => {
    const originalSend = res.json;
    
    res.json = function(data) {
      // Invalidar caché ANTES de enviar la respuesta
      const keys = cacheService.keys();
      let invalidated = 0;

      patterns.forEach(pattern => {
        const regex = new RegExp(pattern);
        keys.forEach(key => {
          if (regex.test(key)) {
            cacheService.del(key);
            invalidated++;
          }
        });
      });
      
      if (invalidated > 0) {
        logger.debug(`Cache invalidada: ${invalidated} keys`, {
          patterns,
          count: invalidated,
          module: 'cache'
        });
      }
      
      // Enviar la respuesta original
      return originalSend.call(this, data);
    };

    next();
  };
};

// Middleware para caché condicional basado en headers
// Responde 304 Not Modified si el ETag o Last-Modified del cliente coinciden con la entrada cacheada.
export const conditionalCache = () => {
  return (req, res, next) => {
    const key = generateCacheKey(req);
    const cachedResponse = cacheService.get(key);

    if (cachedResponse) {
      // Verificar ETag
      const etag = req.headers['if-none-match'];
      if (etag && etag === cachedResponse.etag) {
        return res.status(304).end();
      }

      // Verificar Last-Modified
      const lastModified = req.headers['if-modified-since'];
      if (lastModified && new Date(lastModified) >= new Date(cachedResponse.lastModified)) {
        return res.status(304).end();
      }

      // Enviar respuesta cacheada con headers
      res.set({
        'ETag': cachedResponse.etag,
        'Last-Modified': cachedResponse.lastModified,
        'Cache-Control': 'private, must-revalidate'
      });

      return res.json(cachedResponse.data);
    }

    // Interceptar res.json para añadir headers de cache
    const originalJson = res.json;
    res.json = function(body) {
      const responseData = {
        data: body,
        etag: require('crypto').createHash('md5').update(JSON.stringify(body)).digest('hex'),
        lastModified: new Date().toUTCString()
      };

      cacheService.set(key, responseData);

      res.set({
        'ETag': responseData.etag,
        'Last-Modified': responseData.lastModified,
        'Cache-Control': 'private, must-revalidate'
      });

      return originalJson.call(this, body);
    };

    next();
  };
};

// Middleware para caché parcial (campos específicos)
// Solo guarda y reinyecta los campos indicados, dejando el resto de la respuesta intacto.
// @param {string[]} fields - Campos de la respuesta a cachear
// @param {number|null} duration - TTL en segundos
export const partialCache = (fields, duration = null) => {
  return (req, res, next) => {
    const key = generateCacheKey(req) + '|' + fields.join(',');
    const cachedFields = cacheService.get(key);

    if (cachedFields) {
      // Interceptar res.json para combinar datos cacheados
      const originalJson = res.json;
      res.json = function(body) {
        const combined = { ...body };
        fields.forEach(field => {
          if (cachedFields[field]) {
            combined[field] = cachedFields[field];
          }
        });
        return originalJson.call(this, combined);
      };
    }

    // Interceptar res.json para cachear campos específicos
    const originalJson = res.json;
    res.json = function(body) {
      const toCache = {};
      fields.forEach(field => {
        if (body[field]) {
          toCache[field] = body[field];
        }
      });

      if (Object.keys(toCache).length > 0) {
        cacheService.set(key, toCache, duration);
      }

      return originalJson.call(this, body);
    };

    next();
  };
};

export default {
  cacheMiddleware,
  invalidateCacheMiddleware,
  conditionalCache,
  partialCache
};
