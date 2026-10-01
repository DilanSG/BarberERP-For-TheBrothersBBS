import { useState, useEffect } from 'react';
import { Minus, Shield, AlertTriangle, Clock, DollarSign, Package, Scissors, Calendar, Filter, SendHorizontal, Trash2, CreditCard, ArrowLeft } from 'lucide-react';
import { refundService } from '../../services/refundService';
import { api } from '../../services/api';
import * as invoiceService from '../../services/invoiceService';
import logger from '@utils/logger';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ListSkeleton, Skeleton } from '@components/ui/Skeleton';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import DateRangeModal from '../modals/DateRangeModal';
import Modal from '../ui/Modal';
import { 
  SALE_TYPES, 
  SALE_TYPE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_COLORS,
  DEFAULT_PAYMENT_COLOR,
  SALE_TYPE_ICONS,
  SALE_TYPE_COLORS
} from '../../constants/salesConstants';
import { formatCurrency } from '@utils/formatters';

// Modal para procesar reembolsos de ventas (barberos) o gestionarlas (admins).
// Lista las ventas no reembolsadas con filtros por fecha, tipo, categoría y pago;
// el panel derecho captura motivo obligatorio y, si no es admin, el código de verificación.
// Para admins permite elegir primero el barbero cuyas ventas se revisan.
// Modal para procesar reembolsos de ventas.
// - Barbero: solo ve sus ventas y requiere código de administrador.
// - Admin: puede filtrar por barbero (`selectedBarberId`) y reembolsar sin código.
// Props: isOpen, onClose, selectedBarberId (opcional, vista admin).
// Flujo: seleccionar venta → motivo (+ código si barbero) → confirmar (irreversible).
const RefundSaleModal = ({ isOpen, onClose, selectedBarberId = null }) => {
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();
  // Datos, filtros y estado del formulario de reembolso.
  const [mySales, setMySales] = useState([]);
  const [selectedBarberInfo, setSelectedBarberInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: '',
    category: '',
    paymentMethod: ''
  });

  // Cargar ventas cuando el modal se abre
  // Al abrir el modal (o cambiar filtros/barbero) recarga las ventas elegibles.
  useEffect(() => {
    if (isOpen) {
      loadMySales();
    }
  }, [isOpen, filters, selectedBarberId]);

  // Carga las ventas según el rol: un admin ve las del barbero seleccionado (con
  // sus datos) y un barbero ve las propias. Descarta las ya reembolsadas.
  // Deriva las opciones de filtro a partir de los datos recibidos.
  // Carga las ventas del barbero (o de un barbero concreto si es admin) y
  // descarta explícitamente las ya reembolsadas como medida de seguridad.
  const loadMySales = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      
      if (user?.role === 'admin' && selectedBarberId) {
        // Admin viendo ventas de un barbero específico
        const adminFilters = {
          barberId: selectedBarberId,
          ...filters
        };
        
        response = await refundService.getAllSalesForAdmin(adminFilters);
        
        // Cargar información del barbero seleccionado
        try {
          const barberResponse = await api.get(`/barbers/by-user/${selectedBarberId}`);
          if (barberResponse.success && barberResponse.data) {
            setSelectedBarberInfo(barberResponse.data);
          }
        } catch (barberError) {
          console.warn('No se pudo cargar información del barbero:', barberError);
          setSelectedBarberInfo(null);
        }
        
        // Mostrar todos los datos sin paginación
        if (response.success && response.data) {
          // Filtrar explícitamente las ventas ya reembolsadas
          const activeSales = response.data.filter(sale => sale.status !== 'refunded');
          logger.info('Ventas cargadas para admin', {
            totalFetched: response.data.length,
            refundedFiltered: response.data.length - activeSales.length,
            activeSales: activeSales.length,
            barberId: selectedBarberId
          });
          setMySales(activeSales);
          // Actualizar opciones de filtro con todos los datos disponibles
          updateFilterOptions(activeSales);
        } else {
          setMySales([]);
        }
      } else {
        // Comportamiento normal para barberos
        setSelectedBarberInfo(null);
        response = await refundService.getMySalesForRefund(filters);
        
        // Filtrar explícitamente las ventas ya reembolsadas como medida de seguridad
        const salesData = response.data || [];
        const activeSales = salesData.filter(sale => sale.status !== 'refunded');
        logger.info('Ventas cargadas para barbero', {
          totalFetched: salesData.length,
          refundedFiltered: salesData.length - activeSales.length,
          activeSales: activeSales.length
        });
        setMySales(activeSales);
        
        // Actualizar opciones de filtro
        if (activeSales.length > 0) {
          updateFilterOptions(activeSales);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading sales:', error);
      setError(error.message || 'Error al cargar las ventas');
      setLoading(false);
      setMySales([]);
    }
  };

  // Extrae las categorías y métodos de pago únicos presentes en las ventas.
  // Extrae categorías y métodos de pago únicos para poblar los selects de filtros.
  const updateFilterOptions = (sales) => {
    const categories = [...new Set(sales.map(sale => sale.category).filter(Boolean))];
    const paymentMethods = [...new Set(sales.map(sale => sale.paymentMethod).filter(Boolean))];
    
    setAvailableCategories(categories);
    setAvailablePaymentMethods(paymentMethods);
  };

  // Nombre legible del método de pago (o el valor original si no está mapeado).
  // Nombre legible y color del método de pago según las constantes de ventas.
  const getPaymentMethodDisplayName = (method) => {
    return PAYMENT_METHOD_LABELS[method] || method || 'Sin especificar';
  };

  // Colores del badge del método de pago según la constante de la paleta.
  const getPaymentMethodColor = (methodId) => {
    return PAYMENT_METHOD_COLORS[methodId?.toLowerCase()] || DEFAULT_PAYMENT_COLOR;
  };

  // Función para obtener el ícono de tipo de venta
  // Resuelve el componente de icono correspondiente al tipo de venta.
  const getSaleTypeIcon = (saleType) => {
    const IconComponent = SALE_TYPE_ICONS[saleType];
    if (IconComponent === 'Package') return Package;
    if (IconComponent === 'Scissors') return Scissors;
    if (IconComponent === 'Calendar') return Calendar;
    return Package; // Por defecto
  };

  // Función para obtener el color del tipo de venta
  // Clase de color para el tipo de venta según la paleta definida.
  const getSaleTypeColor = (saleType) => {
    return SALE_TYPE_COLORS[saleType] || 'text-gray-400';
  };

  // Procesa el reembolso tras validar venta seleccionada, motivo, estado no
  // reembolsado y código de administrador cuando el usuario no es admin.
  // Valida selección/motivo, evita reembolsos duplicados y exige código si no es admin.
  const handleRefundSale = async () => {
    if (!selectedSale || !refundReason.trim()) {
      setError('Por favor, completa todos los campos requeridos');
      return;
    }

    // Verificar que la venta no esté ya reembolsada
    if (selectedSale.status === 'refunded') {
      setError('Esta venta ya ha sido reembolsada');
      logger.warn('Intento de reembolsar venta ya reembolsada', {
        saleId: selectedSale._id,
        status: selectedSale.status
      });
      return;
    }

    if (user?.role !== 'admin' && !adminCode.trim()) {
      setError('Se requiere código de administrador');
      return;
    }

    try {
      setRefunding(true);
      setError(null);

      // El código de administrador solo viaja si quien reembolsa no es admin.
      const refundData = {
        saleId: selectedSale._id,
        reason: refundReason,
        adminCode: user?.role !== 'admin' ? adminCode : undefined
      };

      const response = await refundService.refundSale(refundData);

      if (response.success) {
        showSuccess('Reembolso procesado exitosamente');
        setSelectedSale(null);
        setRefundReason('');
        setAdminCode('');
        await loadMySales();
        onClose();
      } else {
        throw new Error(response.message || 'Error al procesar el reembolso');
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      setError(error.message || 'Error al procesar el reembolso');
    } finally {
      setRefunding(false);
    }
  };

  // Cierra el modal limpiando venta, motivo, código y error pendientes.
  // Limpia el formulario y el error antes de cerrar.
  const handleClose = () => {
    setSelectedSale(null);
    setRefundReason('');
    setAdminCode('');
    setError(null);
    onClose();
  };

  

  // Da formato dd/MM/yyyy a una fecha.
  // Formatea fechas en español (dd/MM/yyyy) con date-fns.
  const formatDate = (date) => {
    return format(new Date(date), 'dd/MM/yyyy', { locale: es });
  };

  // Manejar selección de rango de fechas
  // Guarda el rango de fechas elegido en el modal de calendario.
  const handleDateRangeSelect = (dateRange) => {
    setFilters(prev => ({
      ...prev,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate
    }));
  };

  // Limpiar filtros
  // Restablece todos los filtros a su valor vacío.
  // Limpia todos los filtros a su estado inicial.
  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      type: '',
      category: '',
      paymentMethod: ''
    });
  };

  // El modal no se renderiza mientras esté cerrado.
  if (!isOpen) return null;

  // Vista en dos paneles: a la izquierda la lista filtrable de ventas y a la
  // derecha el formulario de reembolso, más el modal de rango de fechas.
  // En móvil se alterna entre lista y formulario según haya venta seleccionada.
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        color="red"
        title={user?.role === 'admin' ? 'Gestionar Ventas' : 'Procesar Reembolso'}
        subtitle="Reembolsos y anulaciones"
        icon={Minus}
        size="6xl"
        zIndex="top"
        headerExtra={
          <div className="flex items-center gap-1 sm:gap-2 lg:gap-3">
            {/* Badge de rol - compacto */}
            <div className={`flex items-center gap-1 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md border ${
              user?.role === 'admin' 
                ? 'bg-blue-500/20 border-blue-500/30' 
                : 'bg-emerald-500/20 border-emerald-500/30'
            }`}>
              <Shield className={`w-3 h-3 sm:w-4 sm:h-4 ${
                user?.role === 'admin' ? 'text-blue-400' : 'text-emerald-400'
              }`} />
              <span className={`text-xs font-medium ${
                user?.role === 'admin' ? 'text-blue-300' : 'text-emerald-300'
              }`}>
                {user?.role === 'admin' ? 'Admin' : 'Barbero'}
              </span>
            </div>
            {/* Alerta compacta - oculta en móvil muy pequeño */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 bg-amber-500/20 border border-amber-500/30 rounded-md">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span className="text-amber-300 text-xs font-medium">Irreversible</span>
            </div>
          </div>
        }
        footer={
          <div className="flex gap-3 sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleRefundSale}
              disabled={
                !selectedSale || 
                !refundReason.trim() || 
                (user?.role !== 'admin' && !adminCode.trim()) || 
                refunding
              }
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 border border-red-500/50 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {refunding ? (
                <>
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <SendHorizontal className="w-4 h-4" />
                  <span>Procesar Reembolso</span>
                </>
              )}
            </button>
          </div>
        }
      >
          {/* Contenido principal - Layout responsivo */}
          <div className="h-full flex flex-col md:flex-row gap-2 sm:gap-4">
              
              {/* Panel de ventas - se oculta en móvil cuando hay venta seleccionada */}
              <div className={`flex-1 flex flex-col bg-red-500/5 backdrop-blur-sm rounded-lg border border-red-500/20 overflow-hidden ${
                selectedSale ? 'hidden md:flex' : 'flex'
              }`}>
                <div className="p-2 border-b border-red-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">
                        {user?.role === 'admin' ? 'Ventas del Barbero' : 'Mis Ventas Completadas'}
                      </h3>
                      {user?.role === 'admin' && selectedBarberInfo && (
                        <div className="flex items-center gap-2 mt-1">
                          {selectedBarberInfo.photo?.url && (
                            <img 
                              src={selectedBarberInfo.photo.url} 
                              alt={selectedBarberInfo.user?.name}
                              className="w-5 h-5 rounded-full object-cover border border-gray-500"
                            />
                          )}
                          <span className="text-xs text-blue-400 font-medium">
                            {selectedBarberInfo.user?.name || 'Barbero'}
                          </span>
                          {selectedBarberInfo.specialty && (
                            <span className="text-xs text-gray-400">
                              • {selectedBarberInfo.specialty}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex min-h-10 items-center gap-1.5 px-3 py-2 rounded-md transition-colors text-xs ${
                        showFilters 
                          ? 'bg-red-500/20 border border-red-500/30 text-red-300' 
                          : 'bg-gray-500/20 border border-gray-500/30 text-gray-300 hover:bg-red-500/10'
                      }`}
                    >
                      <Filter className="w-3 h-3" />
                      <span className="font-medium">Filtros</span>
                    </button>
                  </div>
                  
                  {/* Filtros colapsables */}
                  {showFilters && (
                    <div className="space-y-2 p-2 bg-red-500/5 rounded-lg border border-red-500/20">
                      {/* Fila de filtros principales */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {/* Selector de fechas */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Fechas</label>
                          <button
                            onClick={() => setShowDateRangeModal(true)}
                            className="w-full min-h-11 flex items-center gap-1 px-2 py-2 bg-gray-800/50 border border-gray-600/50 rounded-md text-base sm:text-xs text-white hover:bg-gray-700/50 transition-colors"
                          >
                            <Calendar className="w-3 h-3" />
                            <span className="flex-1 text-left">
                              {filters.startDate && filters.endDate 
                                ? `${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`
                                : 'Seleccionar'
                              }
                            </span>
                          </button>
                        </div>

                        {/* Tipo */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
                          <div className="relative">
                            <Package className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                            <select
                              value={filters.type}
                              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                              className="w-full min-h-11 pl-6 pr-6 py-2 bg-gray-800/50 border border-gray-600/50 rounded-md text-base sm:text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 appearance-none"
                            >
                              <option value="">Todos</option>
                              <option value={SALE_TYPES.PRODUCT}>{SALE_TYPE_LABELS[SALE_TYPES.PRODUCT]}</option>
                              <option value={SALE_TYPES.SERVICE}>{SALE_TYPE_LABELS[SALE_TYPES.SERVICE]}</option>
                              <option value={SALE_TYPES.APPOINTMENT}>{SALE_TYPE_LABELS[SALE_TYPES.APPOINTMENT]}</option>
                            </select>
                          </div>
                        </div>

                        {/* Categoría */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Categoría</label>
                          <div className="relative">
                            <Package className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                            <select
                              value={filters.category}
                              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                              className="w-full min-h-11 pl-6 pr-6 py-2 bg-gray-800/50 border border-gray-600/50 rounded-md text-base sm:text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 appearance-none"
                              disabled={availableCategories.length === 0}
                            >
                              <option value="">Todas</option>
                              {availableCategories.map(category => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Método de pago */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Pago</label>
                          <div className="relative">
                            <CreditCard className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                            <select
                              value={filters.paymentMethod}
                              onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                              className="w-full min-h-11 pl-6 pr-6 py-2 bg-gray-800/50 border border-gray-600/50 rounded-md text-base sm:text-xs text-white focus:outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 appearance-none"
                              disabled={availablePaymentMethods.length === 0}
                            >
                              <option value="">Todos</option>
                              {availablePaymentMethods.map(method => (
                                <option key={method} value={method}>
                                  {getPaymentMethodDisplayName(method)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex items-center justify-between pt-1 border-t border-gray-600/30">
                        <div className="text-xs text-gray-500">
                          {mySales.length} resultado{mySales.length !== 1 ? 's' : ''}
                          {(filters.startDate || filters.endDate || filters.type || filters.category || filters.paymentMethod) && 
                            ' (filtrado)'
                          }
                        </div>
                        <button
                          onClick={clearFilters}
                          className="flex min-h-10 items-center gap-1 px-3 py-2 bg-gray-600/50 hover:bg-gray-500/50 text-gray-300 text-xs rounded-md transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Limpiar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[55vh] lg:max-h-none">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <ListSkeleton rows={3} />
                        <p className="text-gray-300 font-medium mb-1 mt-2">Cargando ventas...</p>
                        <p className="text-gray-400 text-xs">Por favor espera</p>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                        <p className="text-red-300 font-medium mb-1">Error al cargar ventas</p>
                        <p className="text-gray-400 text-xs mb-3">{error}</p>
                        <button
                          onClick={loadMySales}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors"
                        >
                          Reintentar
                        </button>
                      </div>
                    </div>
                  ) : mySales.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-300 font-medium mb-1">No hay ventas disponibles</p>
                        <p className="text-gray-400 text-xs">No se encontraron ventas para mostrar</p>
                      </div>
                    </div>
                  ) : (
                    mySales.map((sale) => (
                      // Tarjeta de venta con tipo, nombre, fecha, monto y método de pago.
                      <div
                        key={sale._id}
                        className={`p-2 rounded-lg border transition-all ${
                          sale.status === 'refunded' 
                            ? 'bg-gray-800/50 border-gray-600/50 opacity-50 cursor-not-allowed'
                            : selectedSale?._id === sale._id
                            ? 'bg-red-500/20 border-red-500/40'
                            : 'bg-gray-500/10 border-gray-500/30'
                        }`}
                      >
                        {sale.status === 'refunded' && (
                          <div className="mb-1 px-1 py-0.5 bg-gray-600/50 border border-gray-500/50 rounded text-center">
                            <span className="text-xs font-bold text-gray-300">REEMBOLSADO</span>
                          </div>
                        )}
                        <div 
                          onClick={() => sale.status !== 'refunded' && setSelectedSale(sale)}
                          className={sale.status === 'refunded' ? '' : 'cursor-pointer'}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-0.5">
                                {sale.type === SALE_TYPES.PRODUCT ? (
                                  <Package className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                ) : (
                                  <Scissors className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                )}
                                <span className="text-xs font-medium text-gray-400">
                                  {sale.type === SALE_TYPES.PRODUCT ? 'Producto' : 'Servicio'}
                                </span>
                                {sale.type === SALE_TYPES.PRODUCT && sale.quantity && (
                                  <span className="text-xs text-blue-300 ml-1">
                                    (x{sale.quantity})
                                  </span>
                                )}
                              </div>
                              
                              <h4 className="text-white font-medium text-xs truncate mb-0.5">
                                {sale.productName || sale.serviceName || 'Servicio'}
                              </h4>
                              
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400">
                                    {formatDate(sale.saleDate)}
                                  </span>
                                  <span className="text-gray-500">
                                    {format(new Date(sale.saleDate), 'HH:mm', { locale: es })}
                                  </span>
                                </div>
                                {sale.category && (
                                  <span className="text-xs text-blue-400 truncate max-w-[60px]">
                                    {sale.category}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-right ml-2 flex-shrink-0">
                              <p className="text-white font-bold text-xs mb-0.5">
                                {formatCurrency(sale.totalAmount)}
                              </p>
                              <span className={`text-xs px-1 py-0.5 rounded ${getPaymentMethodColor(sale.paymentMethod).bg} ${getPaymentMethodColor(sale.paymentMethod).border} ${getPaymentMethodColor(sale.paymentMethod).text}`}>
                                {getPaymentMethodDisplayName(sale.paymentMethod)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Panel derecho - Formulario de reembolso - Responsivo */}
              <div className={`w-full md:w-80 lg:w-96 bg-red-500/5 backdrop-blur-sm rounded-lg border border-red-500/20 flex flex-col ${
                selectedSale ? 'flex' : 'hidden md:flex'
              }`}>
                {/* Header del panel con botón de regreso en móvil */}
                <div className="p-2 border-b border-red-500/20 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 bg-red-500/20 rounded-lg border border-red-500/30">
                        <Shield className="w-3 h-3 text-red-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-white">
                        {selectedSale ? 'Procesar Reembolso' : 'Selecciona una Venta'}
                      </h3>
                    </div>
                    {/* Botón de regreso solo visible en móvil */}
                    {selectedSale && (
                      <button
                        onClick={() => setSelectedSale(null)}
                        className="md:hidden flex items-center gap-1 px-2 py-1 bg-gray-500/20 hover:bg-gray-500/30 rounded-md transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">Volver</span>
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 p-2 overflow-y-auto">
                  {selectedSale ? (
                    // Formulario de reembolso: resumen de la venta, motivo y código si no es admin.
                    <div className="space-y-2">
                      {/* Resumen de la venta seleccionada */}
                      <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20">
                        <h4 className="font-medium text-blue-300 mb-1 flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          <span className="text-xs">Venta Seleccionada</span>
                        </h4>
                        <div className="space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-blue-400 font-medium text-xs">Producto:</span>
                            <span className="text-blue-200 font-semibold text-xs text-right">{selectedSale.productName || 'Servicio'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-400 font-medium text-xs">Monto:</span>
                            <span className="text-blue-200 font-bold text-xs">{formatCurrency(selectedSale.totalAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-blue-400 font-medium text-xs">Fecha:</span>
                            <span className="text-blue-200 font-semibold text-xs">{formatDate(selectedSale.saleDate)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Razón del reembolso */}
                      <div>
                        <label className="block text-xs font-medium text-white mb-1">
                          Motivo del Reembolso *
                        </label>
                        <textarea
                          value={refundReason}
                          onChange={(e) => setRefundReason(e.target.value)}
                          placeholder="Motivo del reembolso..."
                          className="w-full px-2 py-1.5 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white text-xs placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50 resize-none"
                          rows={2}
                          maxLength={500}
                        />
                        <div className="flex justify-between items-center mt-0.5">
                          <p className="text-xs text-gray-400">{refundReason.length}/500</p>
                        </div>
                      </div>

                      {/* Código de verificación - Solo si no es admin */}
                      {user?.role !== 'admin' && (
                        <div className="bg-transparent">
                          <label className="block text-xs font-medium text-white mb-1">
                            Código de Verificación *
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={adminCode}
                              onChange={(e) => setAdminCode(e.target.value.toUpperCase())}
                              placeholder="CÓDIGO"
                              className="w-full px-2 py-1.5 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 text-center font-mono text-xs tracking-[0.2em] font-bold focus:outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/50"
                              maxLength={6}
                            />
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                              <Clock className="w-3 h-3 text-gray-400" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Solicitar código al administrador
                          </p>
                        </div>
                      )}

                      {/* Error */}
                      {error && (
                        <div className="p-1.5 bg-red-500/20 border border-red-500/40 rounded-lg">
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            <p className="text-red-300 font-medium text-xs">{error}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gray-500/20 rounded-full flex items-center justify-center mb-3 mx-auto">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-gray-300 font-medium mb-1 text-sm">Selecciona una Venta</p>
                        <p className="text-gray-400 text-xs">Elige una venta de la lista para procesar su reembolso</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>
      </Modal>

      {/* Modal de selección de rango de fechas */}
      <DateRangeModal
        isOpen={showDateRangeModal}
        onClose={() => setShowDateRangeModal(false)}
        onSelectDateRange={handleDateRangeSelect}
        currentRange={filters.startDate && filters.endDate ? {
          startDate: filters.startDate,
          endDate: filters.endDate
        } : null}
      />
    </>
  );
};

export default RefundSaleModal;