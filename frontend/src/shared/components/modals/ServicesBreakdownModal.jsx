import React, { useState, useEffect } from 'react';
import { Scissors, Filter } from 'lucide-react';
import Modal from '../ui/Modal';
import { api } from '@services/api';
import { SALE_TYPES } from '../../constants/salesConstants';
import { BreakdownListSkeleton, BreakdownSummarySkeleton } from '@components/ui/Skeleton';
import { formatCurrency } from '@utils/formatters';

// Modal de desglose de cortes/servicios vendidos en el período.
// Consulta las ventas, filtra solo servicios completados y permite filtrar por método de pago.
const ServicesBreakdownModal = ({ isOpen, onClose, revenueData, dashboardData, dateRange, formatCurrency: externalFormatCurrency }) => {
  const [serviceSales, setServiceSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([]);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  // Función para convertir ID del método de pago a nombre legible
  // Traduce el id del método de pago a su nombre legible.
  const getPaymentMethodDisplayName = (methodId) => {
    const paymentNames = {
      'cash': 'Efectivo',
 
      'nequi': 'Nequi',
      'daviplata': 'Daviplata',
      'bancolombia': 'Bancolombia',
      'nu': 'Nu',
      'digital': 'Digital'
    };
    
    return paymentNames[methodId] || methodId || 'Método desconocido';
  };

  // Colores para métodos de pago
  // Devuelve los colores del badge según el método de pago.
  const getPaymentMethodColor = (method) => {
    const colors = {
      'cash': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300' },

      'nequi': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300' },
      'daviplata': { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300' },
      'bancolombia': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' },
      'nu': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300' },
      'digital': { bg: 'bg-brand-400/10', border: 'border-brand-400/30', text: 'text-brand-200' }
    };
    
    return colors[method] || { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-300' };
  };

  // Al abrir el modal (o cambiar rango/dashboard) carga las ventas de servicios.
  useEffect(() => {
    if (isOpen) {
      loadServiceSales();
    }
  }, [isOpen, dateRange, dashboardData]); // ✅ Agregar dashboardData como dependencia

  // Aplica el filtro por método de pago sobre las ventas cargadas.
  useEffect(() => {
    let filtered = serviceSales;
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(sale => sale.paymentMethod === paymentMethodFilter);
    }
    setFilteredSales(filtered);
  }, [serviceSales, paymentMethodFilter]);

  // Obtiene las ventas del período (con caché de 2 min) y conserva solo los
  // servicios completados con método de pago, igual que el backend.
  const loadServiceSales = async () => {
    setLoading(true);
    try {
      // Caché (2 min) + stale-while-revalidate
      const dateParams = dateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined;
      const allSalesResult = await api.get('/sales', { params: dateParams, cacheTTL: 120000 });

      if (allSalesResult) {
        const allSales = allSalesResult.data || [];
        
        // ✅ Filtrar usando EXACTAMENTE la misma lógica del backend
        // Solo ventas de servicios (walkIn type) con status: 'completed'
        const serviceSalesFiltered = allSales.filter(sale => 
          sale.type === SALE_TYPES.SERVICE && 
          sale.status === 'completed' && // ✅ MISMO FILTRO DEL BACKEND
          sale.paymentMethod
        );
        
        // Obtener métodos de pago únicos
        const uniquePaymentMethods = [...new Set(serviceSalesFiltered.map(sale => sale.paymentMethod))];
        setAvailablePaymentMethods(uniquePaymentMethods);
        setServiceSales(serviceSalesFiltered);
      }
    } catch (error) {
      console.error('❌ Error al cargar ventas de servicios:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cuenta las ventas de un método de pago (o todas).
  const calculateCountByPaymentMethod = (method) => {
    if (method === 'all') return serviceSales.length;
    return serviceSales.filter(sale => sale.paymentMethod === method).length;
  };

  // Muestra u oculta el panel de filtros.
  const toggleFilters = () => {
    setFiltersExpanded(!filtersExpanded);
  };

  // Indica si hay un filtro de método de pago activo.
  const hasActiveFilters = () => {
    return paymentMethodFilter !== 'all';
  };

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

  // Vista: resumen de totales, filtro por método de pago y listado de ventas.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="blue"
      title="Cortes Realizados"
      subtitle={dateRange ? `${dateRange.startDate} - ${dateRange.endDate}` : 'Detalle de ventas de servicios'}
      icon={Scissors}
      size="2xl"
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      }
    >
      {/* Resumen */}
      {loading && filteredSales.length === 0 ? (
        <BreakdownSummarySkeleton color="blue" />
      ) : (
      <div className="mb-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-xs text-blue-300">Total Cortes</p>
            <p className="text-sm sm:text-base font-bold text-blue-300">{filteredSales.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-blue-300">Total Servicios</p>
            <p className="text-sm sm:text-base font-bold text-blue-400">
              {formatCurrency(filteredSales.reduce((total, sale) => total + (sale.totalAmount || sale.total || sale.amount || 0), 0))}
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Filtros */}
      <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-blue-300 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
            {hasActiveFilters() && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-medium">
                Activos
              </span>
            )}
          </h4>
          <button
            onClick={toggleFilters}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {filtersExpanded ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {filtersExpanded && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
            <div>
              <label className="block text-xs text-blue-300 mb-1">Método de Pago:</label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setPaymentMethodFilter('all')}
                  className={`px-2 py-1 rounded text-xs border transition-all duration-300 ${
                    paymentMethodFilter === 'all'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-white/5 text-gray-300 border-white/20 hover:border-blue-500/40'
                  }`}
                >
                  Todos ({filteredSales.length})
                </button>
                {availablePaymentMethods.map((method) => {
                  // Conteo y colores del método de pago para el botón de filtro.
                  const count = serviceSales.filter(s => s.paymentMethod === method).length;
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

      {/* Contenido */}
      {loading && filteredSales.length === 0 ? (
        <div className="py-2">
          <BreakdownListSkeleton rows={3} color="blue" />
          <p className="text-blue-300 text-center mt-3">Cargando ventas...</p>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
            <Scissors className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-gray-400">No hay ventas de servicios</p>
          <p className="text-blue-300 text-sm mt-1">
            No se encontraron ventas con los filtros seleccionados
          </p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredSales.map((sale, index) => {
            // Color correspondiente al método de pago de la venta.
            const methodColor = getPaymentMethodColor(sale.paymentMethod);
            return (
              <div
                key={sale._id || index}
                className={`group relative p-3 sm:p-4 ${methodColor.bg} border ${methodColor.border} rounded-lg sm:rounded-xl hover:scale-[1.02] transition-all duration-300`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className={`p-1.5 sm:p-2 ${methodColor.bg} rounded-lg border ${methodColor.border} flex-shrink-0`}>
                      <Scissors className={`w-3 h-3 sm:w-4 sm:h-4 ${methodColor.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                        <h4 className="font-medium text-blue-200 text-xs sm:text-sm truncate">
                          {sale.serviceName || sale.productName || 'Servicio'}
                        </h4>
                        <div className="flex gap-1 flex-wrap">
                          <span className={`px-1.5 sm:px-2 py-0.5 ${methodColor.bg} ${methodColor.text} border ${methodColor.border} rounded-full text-xs font-medium self-start flex-shrink-0`}>
                            {getPaymentMethodDisplayName(sale.paymentMethod)}
                          </span>
                        </div>
                      </div>
                      <p className={`text-xs ${methodColor.text} mb-1 sm:mb-2`}>
                        {sale.barberName && `${sale.barberName} • `}
                        {formatDate(sale.saleDate || sale.createdAt)}
                      </p>
                      {sale.notes && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{sale.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm sm:text-base font-bold ${methodColor.text}`}>
                      {formatCurrency(sale.totalAmount || sale.total || sale.amount || 0)}
                    </div>
                    <div className="text-xs text-gray-400">
                      Servicio
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default ServicesBreakdownModal;
