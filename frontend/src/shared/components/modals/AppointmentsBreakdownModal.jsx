import React, { useState, useEffect } from 'react';
import { Calendar, Filter } from 'lucide-react';
import { BreakdownListSkeleton, BreakdownSummarySkeleton } from '@components/ui/Skeleton';
import Modal from '../ui/Modal';
import { api } from '@services/api';
import { formatCurrency } from '@utils/formatters';

// Modal de desglose de citas completadas en el período.
// Consulta las citas completadas y permite filtrarlas por método de pago.
const AppointmentsBreakdownModal = ({ isOpen, onClose, revenueData, dashboardData, dateRange, formatCurrency: externalFormatCurrency }) => {
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([]);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  

  // Formatea fecha y hora en formato colombiano.
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Traduce el método de pago a su nombre legible, incluido 'sin-metodo'.
  const getPaymentMethodDisplayName = (method) => {
    const methodNames = {
      'efectivo': 'Efectivo',
      'cash': 'Efectivo',

      'tarjeta': 'Tarjeta',
      'nequi': 'Nequi',
      'daviplata': 'Daviplata',
      'bancolombia': 'Bancolombia',
      'transferencia': 'Transferencia',
      'digital': 'Digital',
      'nu': 'Nu',
      'sin-metodo': 'Sin método de pago'
    };
    
    // Si no hay método o es null/undefined/vacío, retornar "Sin método"
    if (!method || method === null || method === '' || method === 'sin-metodo') {
      return 'Sin método de pago';
    }
    
    return methodNames[method] || method || 'Sin método';
  };

  // Colores del badge según el método de pago; 'sin-metodo' en gris.
  const getPaymentMethodColor = (method) => {
    const colors = {
      'efectivo': {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-300'
      },
      'cash': {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-300'
      },
      'transferencia': {
        bg: 'bg-brand-400/10',
        border: 'border-brand-400/30',
        text: 'text-brand-200'
      },
      'digital': {
        bg: 'bg-brand-400/10',
        border: 'border-brand-400/30',
        text: 'text-brand-200'
      },
      'nequi': {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-300'
      },
      'daviplata': {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-300'
      },
      'bancolombia': {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-300'
      },
      'nu': {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-300'
      },
      'tarjeta': {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-300'
      },
      'sin-metodo': {
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/30',
        text: 'text-gray-300'
      }
    };
    
    // Si no hay método o es null/undefined/vacío, usar el color de "sin-metodo"
    if (!method || method === null || method === '' || method === 'sin-metodo') {
      return colors['sin-metodo'];
    }
    
    return colors[method] || colors['sin-metodo'];
  };

  // Al abrir el modal (o cambiar rango/dashboard) carga las citas completadas.
  useEffect(() => {
    if (isOpen) {
      fetchAppointments();
    }
  }, [isOpen, dateRange, dashboardData]); // Agregar dashboardData como dependencia

  // Refiltra la lista cada vez que cambian las citas o el método elegido.
  useEffect(() => {
    filterAppointments();
  }, [appointments, paymentMethodFilter]);

  // Obtiene las citas completadas del rango (caché de 2 min) y extrae
  // los métodos de pago presentes, usando 'sin-metodo' para los vacíos.
  const fetchAppointments = async () => {
    setLoading(true);
    try {
      // Caché (2 min) + stale-while-revalidate
      const dateParams = dateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined;
      const data = await api.get('/appointments', {
        params: { status: 'completed', ...(dateParams || {}) },
        cacheTTL: 120000,
      });
      const response = { ok: true };

      if (response.ok) {
        
        // Tomar TODAS las citas completadas, sin filtrar por método de pago
        const completedAppointments = data.data || [];
        
        setAppointments(completedAppointments);
        
        // Extraer métodos de pago únicos (incluyendo null/undefined como "Sin método")
        const methods = [...new Set(completedAppointments.map(appointment => appointment.paymentMethod || 'sin-metodo').filter(Boolean))];
        setAvailablePaymentMethods(methods);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch appointments:', response.status, response.statusText);
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Aplica el filtro por método de pago, con caso especial para 'sin-metodo'.
  const filterAppointments = () => {
    let filtered = [...appointments];
    
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(appointment => {
        // Manejar el caso especial "sin-metodo"
        if (paymentMethodFilter === 'sin-metodo') {
          return !appointment.paymentMethod || appointment.paymentMethod === null || appointment.paymentMethod === '';
        }
        return appointment.paymentMethod === paymentMethodFilter;
      });
    }
    
    setFilteredAppointments(filtered);
  };

  // Cuenta cuántas citas hay por método de pago.
  const getPaymentMethodCounts = () => {
    const counts = {};
    appointments.forEach(appointment => {
      const method = appointment.paymentMethod;
      if (method) {
        counts[method] = (counts[method] || 0) + 1;
      }
    });
    return counts;
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: resumen de totales, filtros por método y lista de citas completadas.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="blue"
      title="Reservas Completadas"
      subtitle={dateRange ? `${dateRange.startDate} - ${dateRange.endDate}` : 'Desglose por método de pago'}
      icon={Calendar}
      size="2xl"
    >
      {/* Resumen */}
      {loading && filteredAppointments.length === 0 ? (
        <BreakdownSummarySkeleton color="blue" />
      ) : (
      <div className="mb-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-xs text-blue-300">Total Citas</p>
            <p className="text-sm sm:text-base font-bold text-blue-300">{filteredAppointments.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-blue-300">Total Ingresos</p>
            <p className="text-sm sm:text-base font-bold text-blue-400">
              {formatCurrency(
                filteredAppointments.reduce((sum, appointment) => 
                  sum + (appointment.totalRevenue || appointment.price || 0), 0
                )
              )}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </h4>
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {filtersExpanded ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {filtersExpanded && (
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Método de Pago:</label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setPaymentMethodFilter('all')}
                  className={`px-2 py-1 rounded text-xs border transition-all duration-300 ${
                    paymentMethodFilter === 'all'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-white/5 text-gray-300 border-white/20 hover:border-blue-500/40'
                  }`}
                >
                  Todos ({appointments.length})
                </button>
                {Object.entries(getPaymentMethodCounts()).map(([method, count]) => {
                  // Colores del método para el botón de filtro.
                  const colors = getPaymentMethodColor(method);
                  return (
                    <button
                      key={method}
                      onClick={() => setPaymentMethodFilter(method)}
                      className={`px-2 py-1 rounded text-xs border transition-all duration-300 ${
                        paymentMethodFilter === method
                          ? `${colors.bg} ${colors.text} ${colors.border}`
                          : 'bg-white/5 text-gray-300 border-white/20 hover:border-blue-500/40'
                      }`}
                    >
                      {getPaymentMethodDisplayName(method)} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de citas */}
      <div>
        {loading && filteredAppointments.length === 0 ? (
          <div className="py-2">
            <BreakdownListSkeleton rows={3} color="blue" />
            <p className="text-xs sm:text-sm text-blue-300 text-center mt-3">Cargando citas...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-6 sm:py-8">
            <Calendar className="w-8 h-8 sm:w-12 sm:h-12 text-blue-400 mx-auto mb-2 sm:mb-3" />
            <p className="text-xs sm:text-sm text-blue-300">No hay citas completadas</p>
            <p className="text-xs text-gray-400 mt-1">
              {paymentMethodFilter !== 'all' 
                ? `con el método de pago: ${getPaymentMethodDisplayName(paymentMethodFilter)}`
                : 'para mostrar'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {filteredAppointments.map((appointment, index) => {
              // Color del método de pago de la cita listada.
              const methodColor = getPaymentMethodColor(appointment.paymentMethod);
              return (
                <div
                  key={appointment._id || index}
                  className={`group relative p-3 sm:p-4 ${methodColor.bg} border ${methodColor.border} rounded-lg sm:rounded-xl hover:scale-[1.02] transition-all duration-300`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                      <div className={`p-1.5 sm:p-2 ${methodColor.bg} rounded-lg border ${methodColor.border} flex-shrink-0`}>
                        <Calendar className={`w-3 h-3 sm:w-4 sm:h-4 ${methodColor.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                          <h4 className="font-medium text-blue-200 text-xs sm:text-sm truncate">
                            {appointment.service?.name || 'Servicio no especificado'}
                          </h4>
                          <div className="flex gap-1 flex-wrap">
                            <span className={`px-1.5 sm:px-2 py-0.5 ${methodColor.bg} ${methodColor.text} border ${methodColor.border} rounded-full text-xs font-medium self-start flex-shrink-0`}>
                              {getPaymentMethodDisplayName(appointment.paymentMethod)}
                            </span>
                          </div>
                        </div>
                        <p className={`text-xs ${methodColor.text} mb-1 sm:mb-2`}>
                          Cliente: {appointment.user?.name || 'Cliente'} • {formatDate(appointment.date)}
                        </p>
                        <p className="text-xs text-gray-400">
                          Barbero: {appointment.barber?.user?.name || 'Barbero no especificado'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm sm:text-base font-bold ${methodColor.text}`}>
                        {formatCurrency(appointment.totalRevenue || appointment.price || 0)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Cita
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AppointmentsBreakdownModal;
