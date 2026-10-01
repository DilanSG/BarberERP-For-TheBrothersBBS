import geoip from 'geoip-lite';
import { logger } from './logger.js';

// Detecta la ubicación geográfica desde una dirección IP
// @param {string} ip - Dirección IP del cliente
// @returns {string} - Ubicación en formato "Ciudad, País" o "País" o "Unknown"
export const getLocationFromIP = (ip) => {
  try {
    // Manejar IPs locales o de desarrollo
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      logger.debug('IP local detectada, usando ubicación por defecto');
      return 'Colombia'; // Default para desarrollo local
    }

    // Limpiar IP (remover prefijo ::ffff: de IPv6-mapped IPv4)
    const cleanIP = ip.replace(/^::ffff:/, '');
    
    const geo = geoip.lookup(cleanIP);
    
    if (!geo) {
      logger.warn(`No se pudo detectar ubicación para IP: ${cleanIP}`);
      return 'Unknown';
    }

    // Formatear ubicación: "Ciudad, País" o solo "País"
    const country = geo.country || 'Unknown';
    const city = geo.city;
    
    const location = city ? `${city}, ${country}` : country;
    
    logger.debug(`Ubicación detectada para ${cleanIP}: ${location}`);
    return location;
    
  } catch (error) {
    logger.error('Error detectando ubicación desde IP:', error);
    return 'Unknown';
  }
};

// Extrae la IP real del cliente desde req (considera proxies y load balancers)
// @param {Object} req - Request de Express
// @returns {string} - IP del cliente
export const getRealIP = (req) => {
  // Prioridad de headers para detectar IP real
  const ip = 
    req.headers['x-forwarded-for']?.split(',')[0].trim() || // Cloudflare, AWS ALB, etc.
    req.headers['x-real-ip'] || // Nginx
    req.headers['cf-connecting-ip'] || // Cloudflare
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip;
  
  return ip;
};

// Obtiene ubicación completa desde el request
// @param {Object} req - Request de Express
// @returns {Object} - {ip, location, country, city}
export const getLocationInfo = (req) => {
  const ip = getRealIP(req);
  const cleanIP = ip.replace(/^::ffff:/, '');
  
  // Para IPs locales
  if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return {
      ip: cleanIP,
      location: 'Colombia',
      country: 'CO',
      city: 'Local'
    };
  }
  
  const geo = geoip.lookup(cleanIP);
  
  if (!geo) {
    return {
      ip: cleanIP,
      location: 'Unknown',
      country: 'Unknown',
      city: 'Unknown'
    };
  }
  
  return {
    ip: cleanIP,
    location: geo.city ? `${geo.city}, ${geo.country}` : geo.country,
    country: geo.country || 'Unknown',
    city: geo.city || 'Unknown'
  };
};
