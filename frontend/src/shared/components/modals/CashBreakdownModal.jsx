import React, { useState, useEffect } from 'react';
import { Filter, ShoppingCart, Scissors, Calendar, ChevronDown, ChevronUp, DollarSign, Wallet } from 'lucide-react';
import Modal from '../ui/Modal';
import { api } from '@services/api';
import { BreakdownListSkeleton, BreakdownSummarySkeleton } from '@components/ui/Skeleton';
import { 
  SALE_TYPES, 
  SALE_TYPE_LABELS,
  SALE_TYPE_ICONS,
  SALE_TYPE_COLORS 
} from '../../constants/salesConstants';
import { formatCurrency } from '@utils/formatters';

// Modal de desglose de los pagos recibidos en efectivo.
// Combina ventas y citas completadas pagadas en efectivo, elimina duplicados
// y permite filtrar por tipo de venta (servicios, citas o productos).
const CashBreakdownModal = ({ isOpen, onClose, revenueData, dashboardData, dateRange, formatCurrency: externalFormatCurrency }) => {
  const [cashSales, setCashSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [saleTypeFilter, setSaleTypeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  // Tipos de venta disponibles - Usando constantes estandarizadas
  // Tipos de venta disponibles para el filtro.
  const saleTypes = [
    { id: 'all', label: 'Todos', icon: Filter },
    { id: SALE_TYPES.SERVICE, label: SALE_TYPE_LABELS[SALE_TYPES.SERVICE], icon: Scissors },
    { id: SALE_TYPES.APPOINTMENT, label: SALE_TYPE_LABELS[SALE_TYPES.APPOINTMENT], icon: Calendar },
    { id: SALE_TYPES.PRODUCT, label: SALE_TYPE_LABELS[SALE_TYPES.PRODUCT], icon: ShoppingCart }
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

  // Cargar ventas en efectivo al abrir el modal
  // Al abrir el modal (o cambiar rango/dashboard) carga las transacciones en efectivo.
  useEffect(() => {
    if (isOpen) {
      loadCashSales();
    }
  }, [isOpen, dateRange, dashboardData]); // ✅ Agregar dashboardData como dependencia

  // Solo detectar elementos problemáticos sin spam
  useEffect(() => {
  // Verificación silenciosa de calidad de datos
  }, [cashSales]);

  // Filtrar ventas cuando cambie el filtro (igual que otros modales)
  // Refiltra las transacciones según el tipo de venta elegido.
  useEffect(() => {
    let filtered = cashSales;
    
    if (saleTypeFilter !== 'all') {
      filtered = filtered.filter(sale => {
        const saleType = getSaleTypeInfo(sale);
        return saleType.id === saleTypeFilter;
      });
    }
    
    setFilteredSales(filtered);
  }, [cashSales, saleTypeFilter]);

  // Carga ventas y citas completadas del rango (caché de 2 min), conserva solo
  // las pagadas en efectivo y convierte las citas en transacciones homogéneas.
  const loadCashSales = async () => {
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
        
        console.log('🐛 DEBUG - Respuestas de APIs:');
        console.log(`   API Sales response: ${allSales.length} records`);
        console.log(`   API Appointments response: ${completedAppointments.length} records`);
        
        // Log de algunos ejemplos de appointments para verificar paymentMethod
        console.log('   Primeras 5 appointments:');
        completedAppointments.slice(0, 5).forEach(apt => {
          console.log(`     • ${apt._id}: ${apt.paymentMethod} - $${apt.price} - ${apt.status}`);
        });
        
        // ✅ Filtrar usando EXACTAMENTE la misma lógica del backend
        // Sales: status: 'completed' + métodos de efectivo
        const cashMethods = ['cash', 'efectivo', 'contado'];
        const cashSalesFiltered = allSales.filter(sale => 
          sale.status === 'completed' && // ✅ MISMO FILTRO DEL BACKEND
          cashMethods.includes(sale.paymentMethod?.toLowerCase())
        );
        
        // Appointments: status: 'completed' + métodos de efectivo
        const cashAppointments = completedAppointments.filter(apt => 
          apt.status === 'completed' && // ✅ MISMO FILTRO DEL BACKEND
          cashMethods.includes(apt.paymentMethod?.toLowerCase())
        );
        
        console.log('🐛 DEBUG - Transacciones encontradas:');
        console.log(`   Sales efectivo filtradas: ${cashSalesFiltered.length}`);
        console.log(`   Appointments efectivo filtradas: ${cashAppointments.length}`);
        
        const salesTotal = cashSalesFiltered.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        const appointmentsTotal = cashAppointments.reduce((sum, a) => sum + (a.price || 0), 0);
        console.log(`   Sales total: ${salesTotal.toLocaleString()}`);
        console.log(`   Appointments total: ${appointmentsTotal.toLocaleString()}`);
        console.log(`   TOTAL COMBINADO: ${(salesTotal + appointmentsTotal).toLocaleString()}`);
        
        // Adapta las citas al formato de venta para poder listarlas juntas.
        const appointmentsAsSales = cashAppointments
          .map(apt => {
            const convertedSale = {
              _id: apt._id,
              type: 'appointment', // ✅ Usar tipo específico para citas
              paymentMethod: apt.paymentMethod,
              totalAmount: apt.price,
              total: apt.price,
              serviceName: apt.service?.name || 'Servicio de Cita',
              serviceId: apt.service?._id,
              barberId: apt.barber?._id,
              createdAt: apt.date || apt.createdAt,
              // ✅ Campos para identificación (PRINCIPAL)
              isFromAppointment: true,
              originalAppointment: apt
            };
            
            return convertedSale;
          });
        
        // Evita duplicados: las citas convertidas tienen prioridad sobre las ventas.
        // ✅ ELIMINAR DUPLICADOS - Priorizar citas convertidas sobre ventas originales
        const uniqueTransactions = [];
        const seenIds = new Set();
        
        console.log('🐛 DEBUG - Eliminando duplicados...');
        
        // Primero agregar las citas convertidas (tienen isFromAppointment: true)
        appointmentsAsSales.forEach(transaction => {
          uniqueTransactions.push(transaction);
          seenIds.add(transaction._id);
        });
        
        console.log(`   Citas agregadas: ${appointmentsAsSales.length}`);
        
        // Luego agregar ventas que NO sean duplicados de citas
        let duplicatesFound = 0;
        cashSalesFiltered.forEach(transaction => {
          if (!seenIds.has(transaction._id)) {
            uniqueTransactions.push(transaction);
          } else {
            duplicatesFound++;
          // Duplicado encontrado
          }
        });
        
        console.log(`   Sales agregadas: ${cashSalesFiltered.length - duplicatesFound}`);
        console.log(`   Duplicados omitidos: ${duplicatesFound}`);
        console.log(`   TOTAL FINAL: ${uniqueTransactions.length} transacciones`);
        
        const finalTotal = uniqueTransactions.reduce((sum, t) => sum + (t.totalAmount || t.total || 0), 0);
        console.log(`   MONTO TOTAL FINAL: ${finalTotal.toLocaleString()}`);
        
        setCashSales(uniqueTransactions);
      }
    } catch (error) {
      console.error('❌ Error al cargar transacciones:', error);
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

  // Determina el tipo de una transacción (cita, producto o servicio).
  const getSaleTypeInfo = (sale) => {
    // ✅ PRIMERO verificar si es cita (tiene prioridad absoluta)
    if (sale.isFromAppointment || sale.type === SALE_TYPES.APPOINTMENT) {
      return saleTypes.find(t => t.id === SALE_TYPES.APPOINTMENT);
    } 
    // Luego verificar productos
    else if (sale.type === SALE_TYPES.PRODUCT || sale.productId || sale.productName) {
      return saleTypes.find(t => t.id === SALE_TYPES.PRODUCT);
    } 
    // Finalmente servicios (walk-ins)
    else if (sale.type === SALE_TYPES.SERVICE || sale.serviceId || sale.serviceName) {
      return saleTypes.find(t => t.id === SALE_TYPES.SERVICE);
    } 
    // Default a servicio
    else {
      return saleTypes.find(t => t.id === SALE_TYPES.SERVICE);
    }
  };

  // Cuenta las transacciones de un tipo (o todas).
  const calculateCountByType = (type) => {
    if (type === 'all') return cashSales.length;
    
    const sales = cashSales.filter(sale => {
      const saleType = getSaleTypeInfo(sale);
      return saleType.id === type;
    });
    
    return sales.length;
  };

  // Suma los montos de un tipo (o de todas las transacciones).
  const calculateTotalByType = (type) => {
    if (type === 'all') return cashSales.reduce((total, sale) => total + (sale.totalAmount || sale.total || sale.amount || 0), 0);
    
    const sales = cashSales.filter(sale => {
      const saleType = getSaleTypeInfo(sale);
      return saleType.id === type;
    });
    
    return sales.reduce((total, sale) => total + (sale.totalAmount || sale.total || sale.amount || 0), 0);
  };

  // Método para alternar la visibilidad de los filtros
  // Muestra u oculta el panel de filtros.
  const toggleFilters = () => {
    setFiltersExpanded(!filtersExpanded);
  };

  // Verificar si hay filtros activos (no todos en 'all')
  // Indica si hay un filtro de tipo activo.
  const hasActiveFilters = () => {
    return saleTypeFilter !== 'all';
  };

  // Vista: resumen de totales, filtros por tipo y lista de transacciones en efectivo.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="emerald"
      title="Desglose de Pagos en Efectivo"
      subtitle={dateRange ? `${dateRange.startDate} - ${dateRange.endDate}` : 'Detalle de ventas en efectivo'}
      icon={Wallet}
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
        <BreakdownSummarySkeleton color="emerald" />
      ) : (
      <div className="mb-4 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-xs text-emerald-300">Total Ventas</p>
            <p className="text-sm sm:text-base font-bold text-emerald-300">{filteredSales.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-emerald-300">Total Efectivo</p>
            <p className="text-sm sm:text-base font-bold text-emerald-400">
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
            <Filter size={14} className="text-emerald-400" />
            <span className="font-medium text-sm text-emerald-400">Filtros</span>
            {saleTypeFilter !== 'all' && (
              <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-medium">
                Activos
              </span>
            )}
          </div>
          <button
            onClick={toggleFilters}
            className="p-1 hover:bg-white/5 rounded-md transition-colors duration-200 text-emerald-400 hover:text-emerald-300"
          >
            {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {filtersExpanded && (
          <div className="mt-3 pt-3 border-t border-white/10 animate-in slide-in-from-top-2 duration-300">
            <p className="text-xs text-emerald-300 mb-2 font-medium">Tipo de venta:</p>
            <div className="flex flex-wrap gap-1.5">
              {saleTypes.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSaleTypeFilter(id)}
                  className={`group relative px-2 py-1 rounded-lg border cursor-pointer transition-all duration-300 hover:scale-105 overflow-hidden backdrop-blur-sm flex items-center gap-1.5 touch-manipulation ${
                    saleTypeFilter === id
                      ? 'border-emerald-500/50 bg-emerald-500/20 shadow-lg shadow-soft'
                      : 'border-white/20 bg-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/10'
                  }`}
                >
                  <Icon size={12} className={`transition-colors duration-300 ${
                    saleTypeFilter === id ? 'text-emerald-300' : 'text-emerald-400'
                  }`} />
                  <span className={`font-medium text-xs ${
                    saleTypeFilter === id ? 'text-emerald-300' : 'text-emerald-200'
                  }`}>
                    {label}
                  </span>
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    saleTypeFilter === id 
                      ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-500/50'
                      : 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/25'
                  }`}>
                    {calculateCountByType(id)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contenido */}
      {loading && filteredSales.length === 0 ? (
        <div className="py-2">
          <BreakdownListSkeleton rows={3} color="emerald" />
          <p className="text-emerald-300 text-center mt-3">Cargando ventas...</p>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <DollarSign className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-gray-400">No hay ventas en efectivo</p>
          <p className="text-emerald-300 text-sm mt-1">
            {saleTypeFilter === 'all' 
              ? 'No se encontraron ventas pagadas en efectivo' 
              : `No se encontraron ${saleTypes.find(t => t.id === saleTypeFilter)?.label.toLowerCase()} pagados en efectivo`}
          </p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredSales.map((sale, index) => {
            // Tipo e icono de la transacción para pintar la fila.
            const typeInfo = getSaleTypeInfo(sale);
            const TypeIcon = typeInfo.icon;
            
            return (
              <div
                key={`${sale.isFromAppointment ? 'cash-appointment' : 'cash-sale'}-${sale._id || sale.id || `${index}-${sale.createdAt || sale.saleDate || Date.now()}`}`}
                className="group relative p-3 sm:p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg sm:rounded-xl hover:bg-emerald-500/10 transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="p-1.5 sm:p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30 flex-shrink-0">
                      <TypeIcon className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                        <h4 className="font-medium text-emerald-200 text-xs sm:text-sm truncate">
                          {sale.productName || sale.serviceName || 'Servicio'}
                        </h4>
                        <span className="px-1.5 sm:px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-medium self-start sm:flex-shrink-0">
                          {typeInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-300 mb-1 sm:mb-2">
                        {sale.barberName && `${sale.barberName} • `}
                        {formatDate(sale.saleDate || sale.createdAt)}
                      </p>
                      {sale.notes && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{sale.notes}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm sm:text-base font-bold text-emerald-400">
                      {formatCurrency(sale.totalAmount || sale.total || sale.amount || 0)}
                    </div>
                    <div className="text-xs text-emerald-300">
                      Efectivo
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

export default CashBreakdownModal;
