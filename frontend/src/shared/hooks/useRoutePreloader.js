// Hooks de precarga y performance de navegación: importa en segundo plano los
// chunks de las rutas probables según el rol y la ruta actual, y expone helpers
// de navegación optimizada.
import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

import logger from '../utils/logger';
// Hook para precargar rutas frecuentes de forma inteligente
// Mejora la performance cargando componentes antes de navegar
export const useRoutePreloader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Mapeo de rutas frecuentes por rol (usadas por la precarga en background)
  const getFrequentRoutes = useCallback(() => {
    const commonRoutes = ['/barbers', '/appointment'];
    
    if (!user) return ['/login', '/register', ...commonRoutes];
    
    switch (user.role) {
      case 'admin':
        return [
          '/admin/barbers',
          '/admin/reports', 
          '/admin/services',
          '/appointment',
          '/admin/inventory'
        ];
      case 'barber':
        return [
          '/admin/sales',
          '/appointment',
          '/admin/inventory',
          '/profile'
        ];
      default:
        return [
          '/appointment',
          '/profile',
          '/barbers'
        ];
    }
  }, [user]);

  // Importa dinámicamente el chunk de una ruta sin navegar (code-splitting).
  // Usa requestIdleCallback (o setTimeout 100ms) para no competir con la carga
  // inicial; los errores de import se ignoran (la ruta se cargará al navegar).
  const preloadRoute = useCallback(async (route) => {
    try {
      // Map de rutas a imports dinámicos
      const routeImports = {

        '/barbers': () => import('../../pages/PublicBarbers'),
        '/appointment': () => import('../../features/appointments/AppointmentRouter'),
        '/profile': () => import('../../pages/Profile'),
        '/admin/barbers': () => import('../../features/admin/AdminBarbers'),
        '/admin/services': () => import('../../features/admin/AdminServices'),
        '/admin/sales': () => import('../../features/barbers/BarberSales'),
        '/admin/reports': () => import('../../features/admin/Reports'),
        '/admin/inventory': () => import('../../features/admin/Inventory'),
        '/login': () => import('../../features/auth/Login'),
        '/register': () => import('../../features/auth/Register')
      };

      const importFunction = routeImports[route];
      if (importFunction) {
        // Usar requestIdleCallback si está disponible, sino setTimeout
        if (window.requestIdleCallback) {
          window.requestIdleCallback(async () => {
            await importFunction();
            // logger.debug(`📦 Preloaded route: ${route}`);
          });
        } else {
          setTimeout(async () => {
            await importFunction();
            // logger.debug(`📦 Preloaded route: ${route}`);
          }, 100);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to preload route ${route}:`, error);
    }
  }, []);

  // Precargar rutas basadas en la ubicación actual
  const preloadBasedOnCurrentRoute = useCallback(() => {
    const currentPath = location.pathname;
    
    // Lógica de predicción inteligente
    const predictions = {
      '/': ['/barbers', '/appointment'], // Home -> probables siguientes
      '/barbers': ['/appointment'], // Barberos -> agendar con barbero específico
      '/login': ['/appointment', '/profile'], // Login -> después del login
      '/appointment': ['/appointment/edit', '/appointment/view'], // Citas -> acciones de cita
      '/admin/barbers': ['/admin/services', '/admin/reports'], // Admin barberos -> otras gestiones
      '/profile': ['/profile-edit', '/appointment'] // Perfil -> editar o citas
    };

    // Precargar rutas predichas (a los 2s, sin interferir con la carga inicial)
    const predictedRoutes = predictions[currentPath] || [];
    predictedRoutes.forEach(route => {
      setTimeout(() => preloadRoute(route), 2000); // Delay de 2s para no interferir con carga inicial
    });

    // Precargar rutas frecuentes según rol (con más delay)
    setTimeout(() => {
      const frequentRoutes = getFrequentRoutes();
      frequentRoutes.forEach(route => {
        if (route !== currentPath) { // No precargar la ruta actual
          preloadRoute(route);
        }
      });
    }, 5000); // Delay de 5s para rutas frecuentes
  }, [location.pathname, preloadRoute, getFrequentRoutes]);

  // Precargar en hover (para enlaces importantes).
  // Devuelve props listas para esparcir en un elemento: { onMouseEnter }.
  const preloadOnHover = useCallback((route) => {
    return {
      onMouseEnter: () => {
        preloadRoute(route);
      }
    };
  }, [preloadRoute]);

  // Efecto principal para activar el preloading
  useEffect(() => {
    // Solo precargar si el usuario ha estado en la página por más de 3 segundos
    const timer = setTimeout(() => {
      preloadBasedOnCurrentRoute();
    }, 3000);

    return () => clearTimeout(timer);
  }, [preloadBasedOnCurrentRoute]);

  return {
    preloadRoute,
    preloadOnHover,
    getFrequentRoutes
  };
};

// Hook para medir performance de navegación
export const useNavigationPerformance = () => {
  const location = useLocation();

  useEffect(() => {
    // Marcar el inicio de la navegación
    const navigationStart = performance.now();

    // Medir cuando se completa la navegación
    const timer = setTimeout(() => {
      const navigationEnd = performance.now();
      const duration = navigationEnd - navigationStart;
      
      // Log para desarrollo (remover en producción)
      if (process.env.NODE_ENV === 'development') {
        // logger.debug(`📊 Navigation to ${location.pathname}: ${duration.toFixed(2)}ms`);
      }

      // Opcional: Enviar métricas a analytics
      // sendNavigationMetrics(location.pathname, duration);
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname]);
};

// Hook para navegación optimizada con preloading.
// Devuelve navigate (precarga el chunk y navega a los 50ms) y navigateImmediate.
export const useOptimizedNavigation = () => {
  const navigate = useNavigate();
  const { preloadRoute } = useRoutePreloader();

  const navigateWithPreload = useCallback((to, options = {}) => {
    // Precargar la ruta antes de navegar
    preloadRoute(to);
    
    // Pequeño delay para permitir que el preloading inicie
    setTimeout(() => {
      navigate(to, options);
    }, 50);
  }, [navigate, preloadRoute]);

  return {
    navigate: navigateWithPreload,
    navigateImmediate: navigate // Para casos donde no queremos preloading
  };
};

