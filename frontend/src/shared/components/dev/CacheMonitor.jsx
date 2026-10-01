import { useState, useEffect } from 'react';
import { Monitor, RefreshCw, Trash2, BarChart3, Clock, Database } from 'lucide-react';
import { useNavigationCache, cacheUtils } from '../../hooks/useNavigationCache';

// Monitor de desarrollo del caché de navegación: entradas, accesos y antigüedad.
// Solo visible en desarrollo (se activa con Ctrl+Shift+C); refresca cada segundo.
const CacheMonitor = ({ isVisible, onToggle }) => {
  const { getCacheStats, clearCache } = useNavigationCache();
  const [stats, setStats] = useState({});
  const [debugInfo, setDebugInfo] = useState({});

  // Refresca las estadísticas cada segundo mientras el monitor está visible.
  useEffect(() => {
    if (!isVisible) return;

    const updateStats = () => {
      const newStats = getCacheStats();
      const newDebugInfo = cacheUtils.getDebugInfo();
      setStats(newStats);
      setDebugInfo(newDebugInfo);
    };

    // Actualizar estadísticas cada segundo cuando esté visible
    updateStats();
    const interval = setInterval(updateStats, 1000);

    return () => clearInterval(interval);
  }, [isVisible, getCacheStats]);

  // Limpia todo el caché de navegación (con confirmación).
  const handleClearCache = () => {
    if (window.confirm('¿Limpiar todo el caché de navegación?')) {
      clearCache();
      setStats({});
      setDebugInfo({});
    }
  };

  // Formatea milisegundos a un texto legible (h/m/s).
  const formatAge = (ms) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-black/90 backdrop-blur-md border border-blue-500/30 rounded-xl p-4 max-w-md shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Database className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Cache Monitor</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={handleClearCache}
            className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300 transition-colors"
            title="Clear Cache"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-500/20 rounded text-gray-400 hover:text-gray-300 transition-colors"
            title="Hide Monitor"
          >
            ×
          </button>
        </div>
      </div>

      <div className="space-y-3 text-xs text-gray-300">
        {/* Estadísticas principales */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-500/10 rounded p-2 border border-blue-500/20">
            <div className="flex items-center space-x-1 mb-1">
              <BarChart3 className="w-3 h-3 text-blue-400" />
              <span className="text-blue-300 font-medium">Entries</span>
            </div>
            <span className="text-white font-bold text-lg">{stats.totalItems || 0}</span>
          </div>

          <div className="bg-emerald-500/10 rounded p-2 border border-emerald-500/20">
            <div className="flex items-center space-x-1 mb-1">
              <RefreshCw className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-300 font-medium">Accesses</span>
            </div>
            <span className="text-white font-bold text-lg">{stats.totalAccesses || 0}</span>
          </div>
        </div>

        {/* Edad promedio */}
        {stats.averageAge && (
          <div className="bg-brand-400/10 rounded p-2 border border-brand-400/20">
            <div className="flex items-center space-x-1 mb-1">
              <Clock className="w-3 h-3 text-brand-300" />
              <span className="text-brand-200 font-medium">Avg. Age</span>
            </div>
            <span className="text-white font-semibold">{formatAge(stats.averageAge)}</span>
          </div>
        )}

        {/* Entrada más accedida */}
        {stats.mostAccessed && (
          <div className="bg-amber-500/10 rounded p-2 border border-amber-500/20">
            <div className="text-amber-300 font-medium mb-1">Most Accessed</div>
            <div className="text-white font-semibold truncate">
              {debugInfo.cacheEntries?.find(key => key.includes('services')) || 'N/A'}
            </div>
            <div className="text-amber-200 text-xs">
              {stats.mostAccessed.accessCount} accesses
            </div>
          </div>
        )}

        {/* Lista de entradas del caché */}
        {debugInfo.cacheEntries && debugInfo.cacheEntries.length > 0 && (
          <div className="border-t border-gray-600/50 pt-3">
            <div className="text-gray-400 font-medium mb-2">Cache Entries:</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {debugInfo.cacheEntries.map((entry, index) => (
                <div key={index} className="bg-gray-800/50 rounded px-2 py-1 text-xs">
                  <span className="text-blue-300 font-mono">{entry}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-gray-600/50 text-center">
        <span className="text-xs text-gray-500">Development Mode Only</span>
      </div>
    </div>
  );
};

// Hook que expone visibilidad, toggle y el componente del monitor.
// Registra el atajo Ctrl+Shift+C solo cuando NODE_ENV es 'development'.
export const useCacheMonitor = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Solo disponible en desarrollo
    if (process.env.NODE_ENV !== 'development') return;

    const handleKeyDown = (e) => {
      // Ctrl + Shift + C para mostrar/ocultar monitor
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleMonitor = () => setIsVisible(prev => !prev);

  return {
    isVisible,
    toggleMonitor,
    CacheMonitorComponent: () => (
      <CacheMonitor 
        isVisible={isVisible} 
        onToggle={toggleMonitor}
      />
    )
  };
};

export default CacheMonitor;
