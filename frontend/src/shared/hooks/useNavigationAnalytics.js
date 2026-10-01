import { useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

import logger from '../utils/logger';
// Sistema de analytics para navegación y comportamiento de usuario.
// Rastrea patrones de uso, performance y user journey en memoria (singleton);
// no persiste nada: los datos viven mientras dure la pestaña.
class NavigationAnalytics {
  constructor() {
    this.sessions = new Map();
    this.routes = new Map();
    this.userJourneys = [];
    this.performance = new Map();
    this.currentSession = null;
    this.startTime = Date.now();
    
    this.initSession();
  }

  initSession() {
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      routes: [],
      totalTime: 0,
      bounceRate: 0,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      connectionType: this.getConnectionType()
    };
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getConnectionType() {
    if ('connection' in navigator) {
      return navigator.connection?.effectiveType || 'unknown';
    }
    return 'unknown';
  }

  // Trackear visita a una ruta: acumula visitas, roles y referrers de la ruta
  trackRouteVisit(path, userRole = null, referrer = null) {
    const timestamp = Date.now();
    const routeData = {
      path,
      timestamp,
      userRole,
      referrer,
      sessionId: this.currentSession.id,
      loadTime: null,
      timeSpent: null,
      interactions: 0
    };

    // Actualizar estadísticas de ruta
    if (!this.routes.has(path)) {
      this.routes.set(path, {
        visits: 0,
        totalTime: 0,
        averageTime: 0,
        bounces: 0,
        conversions: 0,
        userRoles: new Set(),
        referrers: new Set(),
        performance: {
          fastest: Infinity,
          slowest: 0,
          average: 0,
          samples: []
        }
      });
    }

    const route = this.routes.get(path);
    route.visits++;
    route.userRoles.add(userRole);
    if (referrer) route.referrers.add(referrer);

    // Añadir a sesión actual
    this.currentSession.routes.push(routeData);

    // logger.debug(`📊 Analytics: Route visited - ${path} (${userRole || 'anonymous'})`);
    return routeData;
  }

  // Trackear tiempo de carga de ruta (guarda muestras para mínimo/máximo/promedio)
  trackRouteLoadTime(path, loadTime) {
    const route = this.routes.get(path);
    if (route) {
      route.performance.samples.push(loadTime);
      route.performance.fastest = Math.min(route.performance.fastest, loadTime);
      route.performance.slowest = Math.max(route.performance.slowest, loadTime);
      route.performance.average = route.performance.samples.reduce((a, b) => a + b, 0) / route.performance.samples.length;
      
      // Mantener solo las últimas 100 muestras
      if (route.performance.samples.length > 100) {
        route.performance.samples = route.performance.samples.slice(-100);
      }
    }

    // logger.debug(`⚡ Analytics: Load time - ${path}: ${loadTime}ms`);
  }

  // Trackear tiempo que el usuario pasó en una ruta
  trackTimeSpent(path, timeSpent) {
    const route = this.routes.get(path);
    if (route) {
      route.totalTime += timeSpent;
      route.averageTime = route.totalTime / route.visits;
    }

    // Actualizar última entrada en sesión
    const lastRoute = this.currentSession.routes[this.currentSession.routes.length - 1];
    if (lastRoute && lastRoute.path === path) {
      lastRoute.timeSpent = timeSpent;
    }

    // logger.debug(`⏱️ Analytics: Time spent - ${path}: ${(timeSpent / 1000).toFixed(1)}s`);
  }

  // Trackear interacciones en una página
  trackInteraction(path, interactionType, target = null) {
    const route = this.routes.get(path);
    if (route) {
      // Crear o actualizar contador de interacciones
      if (!route.interactions) {
        route.interactions = new Map();
      }
      
      const key = target ? `${interactionType}:${target}` : interactionType;
      route.interactions.set(key, (route.interactions.get(key) || 0) + 1);
    }

    // Actualizar sesión
    const lastRoute = this.currentSession.routes[this.currentSession.routes.length - 1];
    if (lastRoute && lastRoute.path === path) {
      lastRoute.interactions++;
    }

    // logger.debug(`👆 Analytics: Interaction - ${path}: ${interactionType} ${target || ''}`);
  }

  // Trackear conversión (acción importante completada)
  trackConversion(path, conversionType, value = null) {
    const route = this.routes.get(path);
    if (route) {
      route.conversions++;
    }

    this.userJourneys.push({
      sessionId: this.currentSession.id,
      path,
      conversionType,
      value,
      timestamp: Date.now(),
      journey: this.currentSession.routes.map(r => r.path)
    });

    // logger.debug(`🎯 Analytics: Conversion - ${path}: ${conversionType} (${value || 'no value'})`);
  }

  // Obtener estadísticas completas (overview, top rutas, rutas lentas, journeys)
  getAnalytics() {
    const totalSessions = 1; // Por ahora solo sesión actual
    const totalPageviews = Array.from(this.routes.values()).reduce((sum, route) => sum + route.visits, 0);
    
    // Top rutas por visitas
    const topRoutes = Array.from(this.routes.entries())
      .sort(([,a], [,b]) => b.visits - a.visits)
      .slice(0, 10);

    // Rutas más lentas
    const slowestRoutes = Array.from(this.routes.entries())
      .filter(([,route]) => route.performance.samples.length > 0)
      .sort(([,a], [,b]) => b.performance.average - a.performance.average)
      .slice(0, 5);

    // Journey patterns más comunes
    const journeyPatterns = this.getCommonJourneyPatterns();

    return {
      overview: {
        totalSessions,
        totalPageviews,
        averageSessionDuration: this.currentSession.routes.reduce((sum, r) => sum + (r.timeSpent || 0), 0) / this.currentSession.routes.length || 0,
        bounceRate: this.calculateBounceRate(),
        conversionRate: this.calculateConversionRate()
      },
      routes: {
        total: this.routes.size,
        topRoutes: topRoutes.map(([path, data]) => ({
          path,
          visits: data.visits,
          averageTime: data.averageTime,
          conversions: data.conversions
        })),
        slowestRoutes: slowestRoutes.map(([path, data]) => ({
          path,
          averageLoadTime: data.performance.average,
          slowestLoadTime: data.performance.slowest
        }))
      },
      performance: {
        averageLoadTime: this.getAverageLoadTime(),
        totalLoadSamples: this.getTotalLoadSamples()
      },
      userJourney: {
        commonPatterns: journeyPatterns,
        currentSession: this.currentSession,
        totalConversions: this.userJourneys.length
      }
    };
  }

  getCommonJourneyPatterns() {
    const patterns = new Map();
    
    // Analizar patrones de 2-3 pasos
    for (let i = 0; i < this.currentSession.routes.length - 1; i++) {
      const pattern = this.currentSession.routes.slice(i, i + 2).map(r => r.path).join(' -> ');
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }

    return Array.from(patterns.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
  }

  calculateBounceRate() {
    return this.currentSession.routes.length <= 1 ? 100 : 0;
  }

  calculateConversionRate() {
    const totalVisits = Array.from(this.routes.values()).reduce((sum, route) => sum + route.visits, 0);
    return totalVisits > 0 ? (this.userJourneys.length / totalVisits) * 100 : 0;
  }

  getAverageLoadTime() {
    const allSamples = Array.from(this.routes.values())
      .flatMap(route => route.performance.samples);
    
    return allSamples.length > 0 ? 
      allSamples.reduce((sum, time) => sum + time, 0) / allSamples.length : 0;
  }

  getTotalLoadSamples() {
    return Array.from(this.routes.values())
      .reduce((sum, route) => sum + route.performance.samples.length, 0);
  }

  // Limpiar datos antiguos (mantener solo datos recientes)
  cleanup() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 horas
    
    // Limpiar muestras de performance antiguas
    for (const route of this.routes.values()) {
      route.performance.samples = route.performance.samples.slice(-50); // Mantener solo 50 muestras
    }

    // Limpiar journeys antiguos
    this.userJourneys = this.userJourneys.filter(journey => journey.timestamp > cutoff);

    // logger.debug('🧹 Analytics: Cleanup completed');
  }
}

// Instancia singleton compartida por todos los componentes
const analytics = new NavigationAnalytics();

// Hook principal de analytics: registra cada cambio de ruta, el tiempo pasado en
// la ruta anterior y el tiempo de carga; expone helpers ligados a la ruta actual.
export const useNavigationAnalytics = () => {
  const location = useLocation();
  const { user } = useAuth();
  const routeStartTime = useRef(Date.now());
  const previousPath = useRef(null);

  // Trackear cambio de ruta
  useEffect(() => {
    const currentTime = Date.now();
    const currentPath = location.pathname;

    // Trackear tiempo en ruta anterior
    if (previousPath.current) {
      const timeSpent = currentTime - routeStartTime.current;
      analytics.trackTimeSpent(previousPath.current, timeSpent);
    }

    // Trackear nueva ruta
    const referrer = previousPath.current;
    const routeData = analytics.trackRouteVisit(currentPath, user?.role, referrer);
    
    // Medir tiempo de carga
    const loadStart = performance.now();
    
    // Usar requestAnimationFrame para medir cuando la ruta se haya renderizado
    requestAnimationFrame(() => {
      const loadTime = performance.now() - loadStart;
      analytics.trackRouteLoadTime(currentPath, loadTime);
    });

    // Actualizar referencias
    routeStartTime.current = currentTime;
    previousPath.current = currentPath;

  }, [location.pathname, user?.role]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (previousPath.current) {
        const timeSpent = Date.now() - routeStartTime.current;
        analytics.trackTimeSpent(previousPath.current, timeSpent);
      }
    };
  }, []);

  return {
    trackInteraction: (type, target) => analytics.trackInteraction(location.pathname, type, target),
    trackConversion: (type, value) => analytics.trackConversion(location.pathname, type, value),
    getAnalytics: () => analytics.getAnalytics(),
    cleanup: () => analytics.cleanup()
  };
};

// Hook para trackear interacciones específicas
export const useInteractionTracking = () => {
  const { trackInteraction } = useNavigationAnalytics();

  const trackClick = useCallback((target) => {
    trackInteraction('click', target);
  }, [trackInteraction]);

  const trackFormSubmit = useCallback((formName) => {
    trackInteraction('form_submit', formName);
  }, [trackInteraction]);

  const trackSearch = useCallback((searchTerm) => {
    trackInteraction('search', searchTerm);
  }, [trackInteraction]);

  const trackDownload = useCallback((fileName) => {
    trackInteraction('download', fileName);
  }, [trackInteraction]);

  return {
    trackClick,
    trackFormSubmit,
    trackSearch,
    trackDownload
  };
};

// Hook para trackear conversiones
export const useConversionTracking = () => {
  const { trackConversion } = useNavigationAnalytics();

  const trackAppointmentBooked = useCallback((appointmentData) => {
    trackConversion('appointment_booked', appointmentData.serviceId);
  }, [trackConversion]);

  const trackUserRegistration = useCallback((userRole) => {
    trackConversion('user_registration', userRole);
  }, [trackConversion]);

  const trackProfileUpdate = useCallback(() => {
    trackConversion('profile_update');
  }, [trackConversion]);

  const trackServicePurchase = useCallback((serviceId, price) => {
    trackConversion('service_purchase', `${serviceId}:${price}`);
  }, [trackConversion]);

  return {
    trackAppointmentBooked,
    trackUserRegistration,
    trackProfileUpdate,
    trackServicePurchase
  };
};

export default analytics;

