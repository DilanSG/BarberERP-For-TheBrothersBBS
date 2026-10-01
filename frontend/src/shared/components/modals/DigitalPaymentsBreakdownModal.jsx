import React, { useState, useEffect } from 'react';
import { CreditCard, Filter, ShoppingCart, Scissors, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '../ui/Modal';
import { api } from '@services/api';
import { SALE_TYPES } from '../../constants/salesConstants';
import { BreakdownListSkeleton, BreakdownSummarySkeleton } from '@components/ui/Skeleton';
import { formatCurrency } from '@utils/formatters';

// Modal de desglose de ventas pagadas con métodos digitales (no efectivo).
// Combina ventas y citas completadas, elimina duplicados y permite filtrar
// por tipo de venta y por método de pago.
const DigitalPaymentsBreakdownModal = ({ isOpen, onClose, revenueData, dashboardData, dateRange, formatCurrency: externalFormatCurrency }) => {
  const [digitalSales, setDigitalSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [saleTypeFilter, setSaleTypeFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([]);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  // Tipos de venta disponibles
  // Tipos de venta disponibles para el filtro.
  const saleTypes = [
    { id: 'all', label: 'Todos', icon: Filter },
    { id: 'corte', label: 'Cortes', icon: Scissors },
    { id: 'cita', label: 'Citas', icon: Calendar },
    { id: 'producto', label: 'Productos', icon: ShoppingCart }
  ];

  // Función para convertir ID del método de pago a nombre legible
  // Traduce el id del método de pago a un nombre legible.
  const getPaymentMethodDisplayName = (methodId) => {
    const paymentNames = {
      'cash': 'Efectivo',
      'nequi': 'Nequi',
      'daviplata': 'Daviplata',
      'bancolombia': 'Bancolombia',
      'nu': 'Nu Bank',
      'tarjeta': 'Tarjeta',
      'transferencia': 'Transferencia',
      'digital': 'Pago Digital',
      'pagodigital': 'Pago Digital'
    };
    
    const methodLower = methodId?.toLowerCase() || '';
    for (const [key, displayName] of Object.entries(paymentNames)) {
      if (methodLower.includes(key)) {
        return displayName;
      }
    }
    return methodId || 'Método desconocido';
  };

  // Colores para métodos de pago (del contexto PaymentMethods)
  // Colores del badge según el método de pago.
  const getPaymentMethodColor = (method) => {
    const colors = {
      'cash': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300' },
      'nequi': { bg: 'bg-brand-400/10', border: 'border-brand-400/30', text: 'text-brand-200' },
      'daviplata': { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300' },
      'bancolombia': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300' },
      'nu': { bg: 'bg-brand-400/10', border: 'border-brand-400/30', text: 'text-brand-200' },
      'tarjeta': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' },
      'transferencia': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300' },
      'digital': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' },
      'pagodigital': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' }
    };

    const methodLower = method.toLowerCase();
    for (const [key, color] of Object.entries(colors)) {
      if (methodLower.includes(key)) {
        return color;
      }
    }
    
    // Color por defecto para métodos no reconocidos
    return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300' };
  };

  // Cargar ventas digitales al abrir el modal
  // Al abrir el modal (o cambiar rango/dashboard) carga las transacciones digitales.
  useEffect(() => {
    if (isOpen) {
      loadDigitalSales();
    }
  }, [isOpen, dateRange, dashboardData]); // ✅ Agregar dashboardData como dependencia

  // Análisis de tipos cuando se cargan las transacciones
  // Análisis silencioso de transacciones digitales

  // Filtrar ventas cuando cambien los filtros (igual que otros modales)
  // Aplica los filtros de tipo de venta y método de pago sobre las transacciones.
  useEffect(() => {
    let filtered = digitalSales;

    // Filtrar por tipo de venta
    if (saleTypeFilter !== 'all') {
      filtered = filtered.filter(sale => {
        const saleType = getSaleTypeInfo(sale);
        return saleType.id === saleTypeFilter;
      });
    }

    // Filtrar por método de pago
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(sale => sale.paymentMethod === paymentMethodFilter);
    }

    setFilteredSales(filtered);
  }, [digitalSales, saleTypeFilter, paymentMethodFilter]);

  // Carga ventas y citas completadas del rango (caché de 2 min), conserva las
  // pagadas con métodos digitales y convierte las citas a formato de venta.
  const loadDigitalSales = async () => {
    setLoading(true);
    try {
      // Caché (2 min) + stale-while-revalidate: reabrir el modal es instantáneo
      const dateParams = dateRange ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined;
      const [allSalesResult, appointmentsResult] = await Promise.all([
        api.get('/sales', { params: dateParams, cacheTTL: 120000 }),
        api.get('/appointments', { params: { status: 'completed', ...(dateParams || {}) }, cacheTTL: 120000 }),
      ]);

      if (allSalesResult && appointmentsResult) {
        
        const allSales = allSalesResult.data || [];
        const completedAppointments = appointmentsResult.data || [];
        
        // Métodos de pago digitales (no efectivo) - Solo métodos autorizados
        const digitalMethods = ['nequi', 'daviplata', 'bancolombia', 'nu', 'tarjeta', 'card', 'transfer', 'transferencia'];
        
        // ✅ Filtrar usando EXACTAMENTE la misma lógica del backend
        // Sales: status: 'completed' + métodos digitales
        const digitalSalesFiltered = allSales.filter(sale => 
          sale.status === 'completed' && // ✅ MISMO FILTRO DEL BACKEND
          digitalMethods.includes(sale.paymentMethod?.toLowerCase())
        );
        
        // Appointments: status: 'completed' + métodos digitales
        const digitalAppointments = completedAppointments.filter(apt => 
          apt.status === 'completed' && // ✅ MISMO FILTRO DEL BACKEND
          digitalMethods.includes(apt.paymentMethod?.toLowerCase())
        );
        
        // ✅ Convertir citas a formato de venta (igual estructura que ventas)
        // Adapta las citas al formato de venta para unificar la lista.
        const appointmentsAsSales = digitalAppointments.map(apt => ({
            _id: apt._id,
            type: 'appointment', // ✅ Usar tipo específico para citas
            paymentMethod: apt.paymentMethod,
            totalAmount: apt.price,
            total: apt.price,
            serviceName: apt.service?.name || 'Servicio de Cita',
            serviceId: apt.service?._id,
            barberId: apt.barber?._id,
            createdAt: apt.date || apt.createdAt,
            // ✅ Campos para identificación
            isFromAppointment: true,
            originalAppointment: apt
          }));
        
        // Une ventas y citas evitando duplicados, priorizando las citas convertidas.
        // ✅ Combinar evitando duplicados por ID
        const allDigitalTransactions = [...digitalSalesFiltered, ...appointmentsAsSales];
        
        // ✅ ELIMINAR DUPLICADOS - Priorizar citas convertidas sobre ventas originales
        const uniqueTransactions = [];
        const seenIds = new Set();
        
        // Primero agregar las citas convertidas (tienen isFromAppointment: true)
        appointmentsAsSales.forEach(transaction => {
          uniqueTransactions.push(transaction);
          seenIds.add(transaction._id);
        });
        
        // Luego agregar ventas que NO sean duplicados de citas
        digitalSalesFiltered.forEach(transaction => {
          if (!seenIds.has(transaction._id)) {
            uniqueTransactions.push(transaction);
          }
        });
        
        // Obtener métodos de pago únicos
        const uniquePaymentMethods = [...new Set(uniqueTransactions.map(sale => sale.paymentMethod))];
        setAvailablePaymentMethods(uniquePaymentMethods);
        
        setDigitalSales(uniqueTransactions);
      }
    } catch (error) {
      console.error('❌ Error al cargar transacciones digitales:', error);
    } finally {
      setLoading(false);
    }
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

  // Determina el tipo de la transacción (cita, producto o corte).
  const getSaleTypeInfo = (sale) => {
    // ✅ PRIMERO verificar si es cita (tiene prioridad absoluta)
    if (sale.isFromAppointment || sale.type === 'appointment') {
      return saleTypes.find(t => t.id === 'cita');
    } 
    // Luego verificar productos
    else if (sale.type === SALE_TYPES.PRODUCT || sale.productId || sale.productName) {
      return saleTypes.find(t => t.id === 'producto');
    } 
    // Finalmente cortes (walk-ins)
    else if (sale.type === SALE_TYPES.SERVICE || sale.serviceId || sale.serviceName) {
      return saleTypes.find(t => t.id === 'corte');
    } 
    // Default a corte
    else {
      return saleTypes.find(t => t.id === 'corte');
    }
  };

  // Cuenta las transacciones de un tipo (o todas).
  const calculateCountByType = (type) => {
    if (type === 'all') return digitalSales.length;
    
    const sales = digitalSales.filter(sale => {
      const saleType = getSaleTypeInfo(sale);
      return saleType.id === type;
    });
    
    return sales.length;
  };

  // Cuenta transacciones por método de pago considerando el filtro de tipo activo.
  const calculateCountByPaymentMethod = (method) => {
    if (method === 'all') {
      // Si hay filtro de tipo, aplicarlo también
      if (saleTypeFilter !== 'all') {
        return digitalSales.filter(sale => {
          const saleType = getSaleTypeInfo(sale);
          return saleType.id === saleTypeFilter;
        }).length;
      }
      return digitalSales.length;
    }
    
    // Filtrar por método de pago y opcionalmente por tipo
    let sales = digitalSales.filter(sale => sale.paymentMethod === method);
    
    if (saleTypeFilter !== 'all') {
      sales = sales.filter(sale => {
        const saleType = getSaleTypeInfo(sale);
        return saleType.id === saleTypeFilter;
      });
    }
    
    return sales.length;
  };

  // Método para alternar la visibilidad de los filtros
  // Muestra u oculta el panel de filtros.
  const toggleFilters = () => {
    setFiltersExpanded(!filtersExpanded);
  };

  // Verificar si hay filtros activos (no todos en 'all')
  // Indica si hay algún filtro activo.
  const hasActiveFilters = () => {
    return saleTypeFilter !== 'all' || paymentMethodFilter !== 'all';
  };

  // Vista: resumen, filtros por método y tipo, y lista de transacciones digitales.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="blue"
      title="Desglose de Pagos Digitales"
      subtitle={dateRange ? `${dateRange.startDate} - ${dateRange.endDate}` : 'Detalle de ventas con métodos digitales'}
      icon={CreditCard}
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
            <p className="text-xs text-blue-300">Total Ventas</p>
            <p className="text-sm sm:text-base font-bold text-blue-300">{filteredSales.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-blue-300">Total Digital</p>
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
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-blue-400" />
            <span className="font-medium text-sm text-blue-400">Filtros</span>
            {hasActiveFilters() && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-medium">
                Activos
              </span>
            )}
          </div>
          <button
            onClick={toggleFilters}
            className="p-1 hover:bg-white/5 rounded-md transition-colors duration-200 text-blue-400 hover:text-blue-300"
          >
            {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {filtersExpanded && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-in slide-in-from-top-2 duration-300">
            {/* Filtros por método de pago */}
            <div>
              <p className="text-xs text-blue-300 mb-2 font-medium">Método de pago:</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setPaymentMethodFilter('all')}
                  className={`group relative px-2 py-1 rounded-lg border cursor-pointer transition-all duration-300 hover:scale-105 overflow-hidden backdrop-blur-sm flex items-center gap-1.5 touch-manipulation ${
                    paymentMethodFilter === 'all'
                      ? 'border-blue-500/50 bg-blue-500/20 shadow-lg shadow-soft'
                      : 'border-white/20 bg-white/5 hover:border-blue-500/40 hover:bg-blue-500/10'
                  }`}
                >
                  <Filter size={12} className={`transition-colors duration-300 ${
                    paymentMethodFilter === 'all' ? 'text-blue-300' : 'text-blue-400'
                  }`} />
                  <span className={`font-medium text-xs ${
                    paymentMethodFilter === 'all' ? 'text-blue-300' : 'text-blue-200'
                  }`}>
                    Todos
                  </span>
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    paymentMethodFilter === 'all' 
                      ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50'
                      : 'bg-blue-500/10 text-blue-200 border border-blue-500/25'
                  }`}>
                    {calculateCountByPaymentMethod('all')}
                  </span>
                </button>
                {availablePaymentMethods.map((method) => {
                  // Colores y estado activo del método para el botón de filtro.
                  const methodColor = getPaymentMethodColor(method);
                  const isActive = paymentMethodFilter === method;
                  return (
                    <button
                      key={method}
                      onClick={() => setPaymentMethodFilter(method)}
                      className={`group relative px-2 py-1 rounded-lg border cursor-pointer transition-all duration-300 hover:scale-105 overflow-hidden backdrop-blur-sm flex items-center gap-1.5 touch-manipulation ${
                        isActive
                          ? `${methodColor.border} ${methodColor.bg} shadow-lg`
                          : 'border-white/20 bg-white/5 hover:border-blue-500/40 hover:bg-blue-500/10'
                      }`}
                    >
                      <CreditCard size={12} className={`transition-colors duration-300 ${
                        isActive ? methodColor.text : 'text-blue-400'
                      }`} />
                      <span className={`font-medium text-xs ${
                        isActive ? methodColor.text : 'text-blue-200'
                      }`}>
                        {getPaymentMethodDisplayName(method)}
                      </span>
                      <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        isActive 
                          ? `${methodColor.bg} ${methodColor.text} ${methodColor.border}`
                          : 'bg-blue-500/10 text-blue-200 border border-blue-500/25'
                      }`}>
                        {calculateCountByPaymentMethod(method)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtros por tipo de venta */}
            <div>
              <p className="text-xs text-blue-300 mb-2 font-medium">Tipo de venta:</p>
              <div className="flex flex-wrap gap-1.5">
                {saleTypes.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setSaleTypeFilter(id)}
                    className={`group relative px-2 py-1 rounded-lg border cursor-pointer transition-all duration-300 hover:scale-105 overflow-hidden backdrop-blur-sm flex items-center gap-1.5 touch-manipulation ${
                      saleTypeFilter === id
                        ? 'border-blue-500/50 bg-blue-500/20 shadow-lg shadow-soft'
                        : 'border-white/20 bg-white/5 hover:border-blue-500/40 hover:bg-blue-500/10'
                    }`}
                  >
                    <Icon size={12} className={`transition-colors duration-300 ${
                      saleTypeFilter === id ? 'text-blue-300' : 'text-blue-400'
                    }`} />
                    <span className={`font-medium text-xs ${
                      saleTypeFilter === id ? 'text-blue-300' : 'text-blue-200'
                    }`}>
                      {label}
                    </span>
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                      saleTypeFilter === id 
                        ? 'bg-blue-500/30 text-blue-200 border border-blue-500/50'
                        : 'bg-blue-500/10 text-blue-200 border border-blue-500/25'
                    }`}>
                      {calculateCountByType(id)}
                    </span>
                  </button>
                ))}
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
            <CreditCard className="w-8 h-8 text-blue-400" />
          </div>
          <p className="text-gray-400">No hay ventas digitales</p>
          <p className="text-blue-300 text-sm mt-1">
            No se encontraron ventas con los filtros seleccionados
          </p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredSales.map((sale, index) => {
            // Tipo, icono y color de la transacción digital listada.
            const typeInfo = getSaleTypeInfo(sale);
            const TypeIcon = typeInfo.icon;
            const methodColor = getPaymentMethodColor(sale.paymentMethod);
            
            return (
              <div
                key={`${sale.isFromAppointment ? 'digital-appointment' : 'digital-sale'}-${sale._id || sale.id || `${index}-${sale.createdAt || sale.saleDate || Date.now()}`}`}
                className={`group relative p-3 sm:p-4 ${methodColor.bg} border ${methodColor.border} rounded-lg sm:rounded-xl hover:scale-[1.02] transition-all duration-300`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className={`p-1.5 sm:p-2 ${methodColor.bg} rounded-lg border ${methodColor.border} flex-shrink-0`}>
                      <TypeIcon className={`w-3 h-3 sm:w-4 sm:h-4 ${methodColor.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                        <h4 className="font-medium text-blue-200 text-xs sm:text-sm truncate">
                          {sale.productName || sale.serviceName || 'Servicio'}
                        </h4>
                        <div className="flex gap-1 flex-wrap">
                          <span className={`px-1.5 sm:px-2 py-0.5 ${methodColor.bg} ${methodColor.text} border ${methodColor.border} rounded-full text-xs font-medium self-start flex-shrink-0`}>
                            {typeInfo.label}
                          </span>
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
                      Digital
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

export default DigitalPaymentsBreakdownModal;
