import { useState } from 'react';
import { Calendar, Clock, Filter } from 'lucide-react';
import DateRangeModal from '../modals/DateRangeModal';

// Barra de filtros de período (General, Hoy, Ayer y Personalizado).
// Recibe el rango actual y notifica cambios de preset o de fechas personalizadas;
// el preset Personalizado abre DateRangeModal para elegir un rango.
// Filtro de período compacto estilo tabs para reportes: presets (general, hoy,
// ayer, personalizado) y modal de rango para el personalizado.
// Props: dateRange ({ preset, startDate, endDate }), onPresetChange(key),
// onCustomDateChange(start, end), loading, availableDates y fluid (ancho completo).
export const SimpleDateFilter = ({
  dateRange,
  onPresetChange,
  onCustomDateChange,
  loading = false,
  className = '',
  availableDates = [],
  fluid = false,
}) => {
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);



  // Presets de período que se muestran como botones en la barra.
  // Presets disponibles; 'custom' abre el modal de rango en vez de emitir el preset directamente.
  const presets = [
    { key: 'all', label: 'General', icon: Filter, description: 'Todos los datos' },
    { key: 'today', label: 'Hoy', icon: Clock, description: 'Solo hoy' },
    { key: 'yesterday', label: 'Ayer', icon: Clock, description: 'Solo ayer' },
    { key: 'custom', label: 'Personalizado', icon: Calendar, description: 'Rango específico' }
  ];

  // Función para formatear las fechas del rango personalizado
  // Da formato corto (dd/mm/aa) al rango personalizado y lo colapsa si es un solo día.
  const formatDateRange = () => {
    if (!dateRange?.startDate || !dateRange?.endDate) return null;
    
    // Evitar problemas de zona horaria parseando directamente la string de fecha
    // Parsea la fecha como string para evitar corrimientos por zona horaria.
    const formatDate = (dateString) => {
      // Si ya es una string en formato YYYY-MM-DD, parsearla directamente
      if (typeof dateString === 'string' && dateString.includes('-')) {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year.slice(-2)}`;
      }
      
      // Si no, usar el constructor Date normalmente
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    };
    
    const startFormatted = formatDate(dateRange.startDate);
    const endFormatted = formatDate(dateRange.endDate);
    
    if (dateRange.startDate === dateRange.endDate) {
      return startFormatted;
    }
    
    return `${startFormatted} - ${endFormatted}`;
  };

  // Vista: título con la fecha activa, botones de preset y modal de rango personalizado.
  return (
    <>
      {/* Filtro compacto estilo tabs */}
      <div className={`flex flex-col gap-2 ${fluid ? 'items-stretch' : 'items-center'} ${className}`}>
        <div className={`bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm shadow-xl shadow-soft p-1 flex flex-col sm:flex-row gap-1 w-full ${fluid ? '' : 'max-w-full sm:max-w-2xl'}`}>
          {/* Título del filtro con indicador de fecha */}
          <div className="flex items-center justify-center gap-2 px-3 py-2.5 text-blue-300 font-medium text-xs sm:text-xs whitespace-nowrap border-r border-white/10 sm:border-r sm:border-white/10 border-b sm:border-b-0">
            <Filter size={14} />
            <div className="flex flex-col items-center">
              <span>Filtrar Período</span>
              {dateRange?.preset && dateRange.preset !== 'all' && (
                <span className="text-amber-300 text-[10px] font-normal mt-0.5">
                  {dateRange.preset === 'today' && <><Calendar className="w-4 h-4 inline" /> {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</>}
                  {dateRange.preset === 'yesterday' && <><Calendar className="w-4 h-4 inline" /> {new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</>}
                  {dateRange.preset === 'custom' && dateRange?.startDate && dateRange?.endDate && <><Calendar className="w-4 h-4 inline" /> {formatDateRange()}</>}
                </span>
              )}
            </div>
          </div>
          
          {/* Botones de filtro */}
          <div className="grid grid-cols-2 gap-1 flex-1 sm:flex sm:flex-row">
            {presets.map((preset) => {
              // El preset activo se resalta y muestra un spinner mientras la carga está en curso.
              const isActive = dateRange?.preset === preset.key;
              const Icon = preset.icon;
              
              // Siempre mostrar la etiqueta del preset, las fechas aparecen debajo del título
              const displayText = preset.label;
              
              return (
                <button
                  key={preset.key}
                  onClick={() => {
                    // 'custom' abre el modal de rango; el resto emite el preset al padre.
                    if (preset.key === 'custom') {
                      setShowDateRangeModal(true);
                    } else {
                      onPresetChange(preset.key);
                    }
                  }}
                  disabled={loading}
                  className={`group relative px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden backdrop-blur-sm flex-1 min-h-11 flex items-center justify-center gap-1.5 ${
                    isActive
                      ? 'border-blue-500/50 bg-blue-500/10 shadow-xl shadow-soft'
                      : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Icon size={14} className={`transition-all duration-300 ${
                    isActive ? 'text-blue-300' : 'text-white'
                  }`} />
                  <span className={`font-medium text-xs sm:text-xs whitespace-nowrap ${
                    isActive ? 'text-blue-300' : 'text-white'
                  }`}>
                    {displayText}
                  </span>
                  
                  {loading && isActive && (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400 ml-1"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de rango personalizado */}
      <DateRangeModal
        isOpen={showDateRangeModal}
        onClose={() => {
          setShowDateRangeModal(false);
        }}
        onSelectDateRange={(dateRange) => {
          if (onCustomDateChange && dateRange.startDate && dateRange.endDate) {
            onCustomDateChange(dateRange.startDate, dateRange.endDate);
          }
          
          if (onPresetChange) {
            onPresetChange('custom');
          }
          
          setShowDateRangeModal(false);
        }}
        currentRange={dateRange}
      />
    </>
  );
};
