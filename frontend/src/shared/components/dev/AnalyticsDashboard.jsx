import { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, Clock, Users, MousePointer, 
  Target, Route, Zap, ChevronRight, RefreshCw
} from 'lucide-react';
import { useNavigationAnalytics } from '../../hooks/useNavigationAnalytics';

// Dashboard de analytics de navegación.
// Solo visible en desarrollo (se activa con Ctrl+Shift+A); refresca cada 5s.
const AnalyticsDashboard = ({ isVisible, onToggle }) => {
  const { getAnalytics, cleanup } = useNavigationAnalytics();
  const [analytics, setAnalytics] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Refresca las métricas cada 5s mientras el panel está visible.
  useEffect(() => {
    if (!isVisible) return;

    const updateAnalytics = () => {
      const data = getAnalytics();
      setAnalytics(data);
    };

    updateAnalytics();
    const interval = setInterval(updateAnalytics, 5000); // Actualizar cada 5s

    return () => clearInterval(interval);
  }, [isVisible, getAnalytics, refreshKey]);

  // Fuerza un refresco inmediato incrementando refreshKey.
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Limpia los datos persistidos de analytics (con confirmación).
  const handleCleanup = () => {
    if (window.confirm('¿Limpiar datos de analytics?')) {
      cleanup();
      setRefreshKey(prev => prev + 1);
    }
  };

  // Helpers de formato para tiempos y porcentajes.
  const formatTime = (ms) => {
    if (!ms) return '0s';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatPercentage = (value) => {
    return `${Math.round(value || 0)}%`;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-4 z-50 bg-black/90 backdrop-blur-md border border-brand-400/30 rounded-xl max-w-sm w-80 shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-brand-400/20">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-brand-300" />
          <span className="text-sm font-semibold text-white">Navigation Analytics</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={handleRefresh}
            className="p-1 hover:bg-brand-400/20 rounded text-brand-300 hover:text-brand-200 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            onClick={handleCleanup}
            className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors"
            title="Cleanup Data"
          >
            <Target className="w-3 h-3" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-500/20 rounded text-gray-400 hover:text-gray-300 transition-colors"
            title="Hide Dashboard"
          >
            ×
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Overview Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
            <div className="flex items-center space-x-2 mb-1">
              <Users className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-blue-300">Sessions</span>
            </div>
            <span className="text-lg font-bold text-white">
              {analytics.overview?.totalSessions || 0}
            </span>
          </div>

          <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
            <div className="flex items-center space-x-2 mb-1">
              <Route className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-emerald-300">Pageviews</span>
            </div>
            <span className="text-lg font-bold text-white">
              {analytics.overview?.totalPageviews || 0}
            </span>
          </div>

          <div className="bg-brand-400/10 rounded-lg p-3 border border-brand-400/20">
            <div className="flex items-center space-x-2 mb-1">
              <Clock className="w-3 h-3 text-brand-300" />
              <span className="text-xs text-brand-200">Avg. Time</span>
            </div>
            <span className="text-sm font-bold text-white">
              {formatTime(analytics.overview?.averageSessionDuration)}
            </span>
          </div>

          <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="w-3 h-3 text-amber-400" />
              <span className="text-xs text-amber-300">Bounce</span>
            </div>
            <span className="text-sm font-bold text-white">
              {formatPercentage(analytics.overview?.bounceRate)}
            </span>
          </div>
        </div>

        {/* Performance */}
        <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-300 font-medium">Performance</span>
          </div>
          <div className="text-xs text-gray-300 space-y-1">
            <div className="flex justify-between">
              <span>Avg Load Time:</span>
              <span className="text-white font-semibold">
                {formatTime(analytics.performance?.averageLoadTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Samples:</span>
              <span className="text-white font-semibold">
                {analytics.performance?.totalLoadSamples || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Top Routes */}
        {analytics.routes?.topRoutes && analytics.routes.topRoutes.length > 0 && (
          <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
            <div className="flex items-center space-x-2 mb-2">
              <Route className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300 font-medium">Top Routes</span>
            </div>
            <div className="space-y-2">
              {analytics.routes.topRoutes.slice(0, 5).map((route, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 truncate flex-1 mr-2" title={route.path}>
                    {route.path}
                  </span>
                  <div className="flex items-center space-x-1">
                    <span className="text-white font-semibold">{route.visits}</span>
                    {route.conversions > 0 && (
                      <span className="text-emerald-400">({route.conversions})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Slowest Routes */}
        {analytics.routes?.slowestRoutes && analytics.routes.slowestRoutes.length > 0 && (
          <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-300 font-medium">Slowest Routes</span>
            </div>
            <div className="space-y-2">
              {analytics.routes.slowestRoutes.slice(0, 3).map((route, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 truncate flex-1 mr-2" title={route.path}>
                    {route.path}
                  </span>
                  <span className="text-red-300 font-semibold">
                    {formatTime(route.averageLoadTime)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Common Journey Patterns */}
        {analytics.userJourney?.commonPatterns && analytics.userJourney.commonPatterns.length > 0 && (
          <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
            <div className="flex items-center space-x-2 mb-2">
              <MousePointer className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300 font-medium">Journey Patterns</span>
            </div>
            <div className="space-y-1">
              {analytics.userJourney.commonPatterns.slice(0, 3).map(([pattern, count], index) => (
                <div key={index} className="text-xs text-gray-300">
                  <div className="flex items-center space-x-1">
                    <span className="text-emerald-400 font-semibold">{count}×</span>
                    <span className="truncate" title={pattern}>
                      {pattern.split(' -> ').map((step, i, arr) => (
                        <React.Fragment key={i}>
                          <span className="text-white">{step.split('/').pop() || '/'}</span>
                          {i < arr.length - 1 && (
                            <ChevronRight className="w-2 h-2 inline mx-1 text-gray-500" />
                          )}
                        </React.Fragment>
                      ))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Session */}
        {analytics.userJourney?.currentSession && (
          <div className="bg-gray-500/10 rounded-lg p-3 border border-gray-500/20">
            <div className="text-sm text-gray-300 font-medium mb-2">Current Session</div>
            <div className="text-xs text-gray-400 space-y-1">
              <div>Routes visited: {analytics.userJourney.currentSession.routes?.length || 0}</div>
              <div>Session duration: {formatTime(Date.now() - analytics.userJourney.currentSession.startTime)}</div>
              <div>Viewport: {analytics.userJourney.currentSession.viewport?.width}×{analytics.userJourney.currentSession.viewport?.height}</div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 pt-0 text-center border-t border-gray-600/50">
        <span className="text-xs text-gray-500">Development Mode • Real-time Data</span>
      </div>
    </div>
  );
};

// Hook que expone visibilidad, toggle y el componente del dashboard.
// Registra el atajo Ctrl+Shift+A solo cuando NODE_ENV es 'development'.
export const useAnalyticsDashboard = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const handleKeyDown = (e) => {
      // Ctrl + Shift + A para mostrar/ocultar analytics
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleDashboard = () => setIsVisible(prev => !prev);

  return {
    isVisible,
    toggleDashboard,
    AnalyticsDashboardComponent: () => (
      <AnalyticsDashboard 
        isVisible={isVisible} 
        onToggle={toggleDashboard}
      />
    )
  };
};

export default AnalyticsDashboard;
