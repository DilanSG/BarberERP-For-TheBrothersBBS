import { useState, useEffect } from 'react';
import { Minus, AlertTriangle, Clock, DollarSign, Package, Scissors, Filter, Trash2, RotateCcw } from 'lucide-react';
import Modal from '../ui/Modal';
import { refundService } from '../../services/refundService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  SALE_TYPES, 
  SALE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS 
} from '../../constants/salesConstants';
import DeleteRefundModal from '../modals/DeleteRefundModal';
import { ListSkeleton } from '@components/ui/Skeleton';
import { useNotification } from '@contexts/NotificationContext';
import { formatCurrency } from '@utils/formatters';

// Modal de consulta y gestión de ventas reembolsadas.
// Lista los reembolsos con filtros y paginación; para admins muestra el código
// de verificación vigente y permite revertir o eliminar definitivamente un reembolso.
// Modal de historial de ventas reembolsadas con filtros, stats y paginación.
// Props: isOpen, onClose, isAdmin (muestra el código de verificación para los
// barberos y habilita revertir/eliminar permanentemente cada reembolso).
// Incluye un try/catch de render como error boundary para no tumbar la app.
const RefundedSalesModal = ({ isOpen, onClose, isAdmin = false }) => {
  const { showSuccess, showError } = useNotification();
  // Datos, stats, código de verificación y estado del modal de confirmación.
  const [refundedSales, setRefundedSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [verificationCode, setVerificationCode] = useState(null);
  const [codeExpiration, setCodeExpiration] = useState(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    type: '',
    category: '',
    paymentMethod: '',
    page: 1,
    limit: 10
  });
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([]);
  
  // Estados para el modal de eliminar reembolso
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [refundToDelete, setRefundToDelete] = useState(null);
  const [deletingRefund, setDeletingRefund] = useState(false);
  const [revertingRefund, setRevertingRefund] = useState(false);
  const [modalActionType, setModalActionType] = useState('delete'); // 'delete' o 'revert'

  // Cargar datos cuando el modal se abre
  // Al abrir el modal carga los reembolsos y, si es admin, el código de verificación.
  useEffect(() => {
    if (isOpen) {
      loadRefundedSales();
      if (isAdmin) {
        loadVerificationCode();
      }
    }
  }, [isOpen, filters]);

  // Si el modal no está abierto, no renderizar nada
  if (!isOpen) return null;

  // Obtiene las ventas reembolsadas aplicando los filtros, las ordena de la más
  // reciente a la más antigua y guarda estadísticas y opciones de filtro.
  // Carga los reembolsos aplicando filtros y los ordena del más reciente al más antiguo.
  const loadRefundedSales = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await refundService.getRefundedSales(filters);
      const salesData = response.data || [];
      
      // Ordenar por fecha más reciente primero
      const sortedSales = salesData.sort((a, b) => {
        const dateA = new Date(a.refundedAt || a.updatedAt || a.saleDate || a.createdAt);
        const dateB = new Date(b.refundedAt || b.updatedAt || b.saleDate || b.createdAt);
        return dateB - dateA; // Más reciente primero
      });
      
      setRefundedSales(sortedSales);
      setStats(response.stats);
      
      // Actualizar opciones de filtros
      updateFilterOptions(sortedSales);
    } catch (err) {
      setError('Error al cargar las ventas reembolsadas');
      console.error('Error loading refunded sales:', err);
    } finally {
      setLoading(false);
    }
  };

  // Recopila categorías y métodos de pago únicos para los selectores de filtro.
  // Categorías y métodos de pago únicos (ordenados) para los selects.
  const updateFilterOptions = (sales) => {
    // Extraer categorías únicas
    const categories = [...new Set(
      sales
        .map(sale => sale.category)
        .filter(Boolean)
    )].sort();
    
    // Extraer métodos de pago únicos
    const paymentMethods = [...new Set(
      sales
        .map(sale => sale.paymentMethod)
        .filter(Boolean)
    )].sort();
    
    setAvailableCategories(categories);
    setAvailablePaymentMethods(paymentMethods);
  };

  // Obtiene el código de verificación vigente y calcula cuándo expira.
  // Código de verificación rotativo (solo admin); guarda cuándo expira para el contador.
  const loadVerificationCode = async () => {
    if (!isAdmin) return;
    try {
      const response = await refundService.getVerificationCode();
      if (response?.data) {
        setVerificationCode(response.data.code);
        setCodeExpiration(Date.now() + (response.data.timeUntilNext || 3600000));
      }
    } catch (err) {
      console.error('Error loading verification code:', err);
    }
  };

  // Copia el código al portapapeles con feedback visual en el botón y respaldo
  // mediante execCommand para navegadores sin Clipboard API.
  // Copia el código con Clipboard API y feedback visual; si falla, usa execCommand.
  const copyCodeToClipboard = async (event) => {
    console.log('Función copyCodeToClipboard ejecutada, código:', verificationCode);
    
    if (verificationCode) {
      try {
        await navigator.clipboard.writeText(verificationCode);
        
        // Mostrar feedback visual directo en el elemento clickeado
        const buttonElement = event.currentTarget;
        const spanElement = buttonElement.querySelector('[data-code-display]');
        
        if (spanElement) {
          const originalContent = spanElement.textContent;
          const originalClasses = spanElement.className;
          
          spanElement.textContent = '¡COPIADO!';
          spanElement.className = originalClasses + ' text-emerald-800';
          buttonElement.className = buttonElement.className.replace('bg-white/60', 'bg-emerald-100/80');
          
          setTimeout(() => {
            spanElement.textContent = originalContent;
            spanElement.className = originalClasses;
            buttonElement.className = buttonElement.className.replace('bg-emerald-100/80', 'bg-white/60');
          }, 1500);
        }
        
        console.log('Código copiado:', verificationCode);
      } catch (err) {
        console.error('Error al copiar código:', err);
        // Fallback para navegadores que no soportan clipboard API
        try {
          const textArea = document.createElement('textarea');
          textArea.value = verificationCode;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          console.log('Código copiado con fallback:', verificationCode);
        } catch (fallbackErr) {
          console.error('Error en fallback:', fallbackErr);
        }
      }
    }
  };

  // Funciones para manejar eliminación de reembolsos
  // Abre el modal de confirmación en modo eliminación permanente.
  // Abre el modal de confirmación con la acción indicada (eliminar o revertir).
  const handleDeleteRefund = (refund) => {
    console.log('Preparando eliminación permanente de reembolso:', refund);
    setRefundToDelete(refund);
    setModalActionType('delete');
    setDeleteModalOpen(true);
  };

  // Abre el modal de confirmación en modo reversión del reembolso.
  const handleRevertRefund = (refund) => {
    console.log('Preparando reversión de reembolso:', refund);
    setRefundToDelete(refund);
    setModalActionType('revert');
    setDeleteModalOpen(true);
  };

  // Elimina definitivamente el reembolso y refresca la lista.
  // Elimina permanentemente el reembolso y recarga la lista.
  const confirmDeleteRefund = async (refundId) => {
    try {
      setDeletingRefund(true);
      
      await refundService.permanentDeleteRefund(refundId);
      
      // Actualizar la lista de reembolsos
      await loadRefundedSales();
      
      setDeleteModalOpen(false);
      setRefundToDelete(null);
      
      showSuccess('Reembolso eliminado permanentemente');
    } catch (error) {
      console.error('Error eliminando reembolso:', error);
      showError(error.message || 'Error al eliminar permanentemente el reembolso');
    } finally {
      setDeletingRefund(false);
    }
  };

  // Revierte el reembolso (la venta vuelve a quedar activa) y refresca la lista.
  // Revierte el reembolso (la venta vuelve a quedar activa) y recarga la lista.
  const confirmRevertRefund = async (refundId) => {
    try {
      setRevertingRefund(true);
      
      await refundService.deleteRefund(refundId);
      
      // Actualizar la lista de reembolsos
      await loadRefundedSales();
      
      setDeleteModalOpen(false);
      setRefundToDelete(null);
      
      showSuccess('Reembolso revertido exitosamente');
    } catch (error) {
      console.error('Error revirtiendo reembolso:', error);
      showError(error.message || 'Error al revertir el reembolso');
    } finally {
      setRevertingRefund(false);
    }
  };

  // Cierra el modal de confirmación salvo que haya una operación en curso.
  // Evita cerrar el modal de confirmación mientras hay una operación en curso.
  const closeDeleteModal = () => {
    if (!deletingRefund && !revertingRefund) {
      setDeleteModalOpen(false);
      setRefundToDelete(null);
      setModalActionType('delete');
    }
  };

  // Formatea fecha y hora con validaciones y mensajes de respaldo.
  // Formatea con guardas para fechas nulas o inválidas (no lanza).
  const formatDate = (date) => {
    try {
      if (!date) return 'No disponible';
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return 'Fecha inválida';
      return format(dateObj, 'dd/MM/yyyy HH:mm', { locale: es });
    } catch (error) {
      console.warn('Error formateando fecha:', date, error);
      return 'Error en fecha';
    }
  };

  // Devuelve el icono que corresponde al tipo de venta reembolsada.
  // Icono según el tipo de venta (producto/servicio).
  const getTypeIcon = (type) => {
    switch (type) {
      case SALE_TYPES.PRODUCT:
        return <Package className="w-4 h-4 text-blue-400" />;
      case SALE_TYPES.SERVICE:
        return <Scissors className="w-4 h-4 text-emerald-400" />;
      default:
        return <DollarSign className="w-4 h-4 text-gray-400" />;
    }
  };

  // Tiempo restante del código de verificación en minutos.
  // Tiempo restante hasta la renovación del código, en minutos.
  const getTimeUntilExpiration = () => {
    if (!codeExpiration) return '';
    const remaining = Math.max(0, codeExpiration - Date.now());
    const minutes = Math.ceil(remaining / 60000);
    return minutes > 0 ? `${minutes} min` : 'Expirando...';
  };

  // Nombre legible del método de pago.
  const getPaymentMethodDisplayName = (method) => {
    return PAYMENT_METHOD_LABELS[method] || method || 'No especificado';
  };

  // Colores del badge por método de pago con gris como valor por defecto.
  // Colores por método de pago (efectivo, tarjeta, transferencia, Daviplata, Nequi).
  const getPaymentMethodColor = (method) => {
    const colors = {
      'efectivo': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
      'tarjeta': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
      'transferencia': { bg: 'bg-brand-400/10', border: 'border-brand-400/30', text: 'text-brand-300' },
      'daviplata': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
      'nequi': { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' }
    };
    return colors[method?.toLowerCase()] || { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400' };
  };

  // Muestra u oculta el panel de filtros.
  const toggleFilters = () => {
    setFiltersExpanded(!filtersExpanded);
  };

  // Indica si hay algún filtro activo para mostrar la insignia.
  // Indica si hay al menos un filtro activo (para el badge "Activos").
  const hasActiveFilters = () => {
    return filters.startDate || filters.endDate || filters.type || filters.category || filters.paymentMethod;
  };

  // Segunda verificación de apertura antes de renderizar el contenido.
  if (!isOpen) return null;

  // Error boundary para evitar crashes
  try {
    // Vista: código y estadísticas para admin, filtros colapsables, lista de
    // reembolsos con acciones de revertir/eliminar y paginación; además el modal
    // de confirmación DeleteRefundModal.
    return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        color="red"
        title="Ventas Reembolsadas"
        subtitle="Gestión de reembolsos del sistema"
        icon={RotateCcw}
        size="6xl"
      >
        {/* Código de verificación admin y estadísticas */}
        {isAdmin && verificationCode && (
          <div className="mb-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            {/* Header con título y tiempo - alineado a la izquierda */}
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-sm">Código de Verificación</span>
              <Clock className="w-3 h-3 text-amber-400" />
              <span className="text-xs text-gray-300 font-medium">{getTimeUntilExpiration()}</span>
            </div>
            
            {/* Layout horizontal: código y estadísticas al mismo nivel */}
            <div className="grid grid-cols-4 gap-3 items-center">
              {/* Código de verificación */}
              <div className="text-center">
                <p className="text-xs text-gray-400 font-semibold mb-1">Código</p>
                <button
                  onClick={copyCodeToClipboard}
                  className="bg-white/60 text-base font-mono text-slate-900 font-bold tracking-[0.2em] hover:scale-105 transition-all duration-300 cursor-copy group active:scale-95 px-3 py-1 rounded-lg"
                  title="Clic para copiar el código"
                >
                  <span 
                    data-code-display 
                    className="group-hover:scale-105 transition-all duration-200 select-none text-slate-900 drop-shadow-sm"
                  >
                    {verificationCode}
                  </span>
                </button>
              </div>
              
              {/* Estadísticas distribuidas uniformemente */}
              {stats && (
                <>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-semibold mb-1">Total</p>
                    <p className="text-sm font-bold text-red-400">{formatCurrency(stats.totalAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-semibold mb-1">Cantidad</p>
                    <p className="text-sm font-bold text-white">{stats.totalRefunded}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-semibold mb-1">Página</p>
                    <p className="text-sm font-bold text-white">{stats.currentPage}/{stats.totalPages}</p>
                  </div>
                </>
              )}
            </div>
            
            {/* Descripción centrada */}
            <div className="text-center mt-2">
              <p className="text-xs text-gray-400 font-medium">
                Los barberos necesitan este código para procesar reembolsos. Se renueva cada hora.
              </p>
            </div>
          </div>
        )}

        {/* Filtros colapsables */}
        <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-red-400" />
              Filtros
              {hasActiveFilters() && (
                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded-full text-xs font-medium">
                  Activos
                </span>
              )}
            </h4>
            <button
              onClick={toggleFilters}
              className="text-xs text-red-400 hover:text-red-300 transition-colors px-1 font-medium"
            >
              {filtersExpanded ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {filtersExpanded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 animate-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">Fecha Inicio:</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })}
                  className="glassmorphism-input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">Fecha Fin:</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })}
                  className="glassmorphism-input w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">Tipo:</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value, page: 1 })}
                  className="glassmorphism-select w-full text-sm"
                >
                  <option value="">Todos los tipos</option>
                  <option value={SALE_TYPES.PRODUCT}>{SALE_TYPE_LABELS[SALE_TYPES.PRODUCT]}</option>
                  <option value={SALE_TYPES.SERVICE}>{SALE_TYPE_LABELS[SALE_TYPES.SERVICE]}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">Categoría:</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
                  className="glassmorphism-select w-full text-sm"
                >
                  <option value="">Todas las categorías</option>
                  {availableCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">Método de Pago:</label>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value, page: 1 })}
                  className="glassmorphism-select w-full text-sm"
                >
                  <option value="">Todos los métodos</option>
                  {availablePaymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {getPaymentMethodDisplayName(method)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-medium mb-1">Por Página:</label>
                <select
                  value={filters.limit}
                  onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), page: 1 })}
                  className="glassmorphism-select w-full text-sm"
                >
                  <option value="10">10 por página</option>
                  <option value="25">25 por página</option>
                  <option value="50">50 por página</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Estadísticas para usuarios no admin */}
        {!isAdmin && stats && (
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 min-w-0">
              <p className="text-xs text-red-300 font-semibold">Total Reembolsado</p>
              <p className="text-xs font-bold text-white">{formatCurrency(stats.totalAmount)}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 py-2 min-w-0">
              <p className="text-xs text-gray-400 font-semibold">Cantidad</p>
              <p className="text-xs font-bold text-white">{stats.totalRefunded}</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 min-w-0">
              <p className="text-xs text-blue-300 font-semibold">Página</p>
              <p className="text-xs font-bold text-white">{stats.currentPage}/{stats.totalPages}</p>
            </div>
          </div>
        )}

        {/* Lista de ventas reembolsadas */}
        <div>
          {loading && (
            <ListSkeleton rows={4} />
          )}

          {error && (
            <div className="text-center py-8">
              <div className="bg-red-500/10 backdrop-blur-md border border-red-500/30 rounded-2xl p-4 max-w-md mx-auto shadow-lg shadow-red-500/10">
                <div className="flex items-center justify-center mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 mr-2" />
                  <span className="font-semibold text-red-300">Error</span>
                </div>
                <p className="text-red-200 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && refundedSales.length === 0 && (
            <div className="text-center py-8">
              <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-6 max-w-md mx-auto">
                <Minus className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">No se encontraron ventas reembolsadas</p>
                <p className="text-gray-400 text-sm">Intenta ajustar los filtros de búsqueda</p>
              </div>
            </div>
          )}

          {!loading && !error && refundedSales.length > 0 && (
            <div className="space-y-2">
              {refundedSales.map((sale) => {
                // Validación segura de datos
                if (!sale || !sale._id) return null;
                
                return (
                  <div key={sale._id} className="relative group bg-white/[0.02] border border-white/[0.08] rounded-xl p-4 hover:bg-white/[0.04] transition-all duration-300">
                    
                    {/* Botones de acción - abajo a la derecha */}
                    {isAdmin && (
                      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1 z-10">
                        {/* Botón para revertir */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevertRefund(sale);
                          }}
                          className="p-1.5 bg-amber-500/80 hover:bg-amber-600/90 text-white rounded-lg shadow-lg backdrop-blur-sm border border-amber-400/50 hover:border-amber-300"
                          title="Revertir reembolso"
                        >
                          <RotateCcw size={12} />
                        </button>
                        
                        {/* Botón para eliminar permanentemente */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRefund(sale);
                          }}
                          className="p-1.5 bg-red-500/80 hover:bg-red-600/90 text-white rounded-lg shadow-lg backdrop-blur-sm border border-red-400/50 hover:border-red-300"
                          title="Eliminar permanentemente"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                    
                    {/* Header compacto con tipo, nombre y badge */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="flex items-center gap-1">
                            {getTypeIcon(sale.type)}
                            <span className="text-xs font-medium text-gray-300">
                              {sale.type === SALE_TYPES.PRODUCT ? 'Producto' : 'Servicio'}
                            </span>
                            {sale.type === SALE_TYPES.PRODUCT && sale.quantity && (
                              <span className="text-xs text-gray-400">
                                (x{sale.quantity})
                              </span>
                            )}
                          </div>
                          <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-300 font-semibold rounded-full border border-red-500/40">
                            REEMBOLSADO
                          </span>
                        </div>
                        
                        <h4 className="font-bold text-white text-sm mb-1 truncate">
                          {sale.productName || sale.name || 'Producto/Servicio'}
                        </h4>
                        
                        {/* Información básica en línea más compacta */}
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 font-medium">
                              {formatDate(sale.refundedAt || sale.updatedAt)}
                            </span>
                          </div>
                          {sale.category && (
                            <span className="text-xs text-gray-300 bg-white/5 px-1.5 py-0.5 rounded-md border border-white/10">
                              {sale.category}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Monto y método de pago más compacto */}
                      <div className="text-right ml-2 flex-shrink-0">
                        <p className="text-red-400 font-bold text-sm mb-1">
                          {sale.totalAmount ? formatCurrency(sale.totalAmount) : (sale.price ? formatCurrency(sale.price) : '$0')}
                        </p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-md border ${getPaymentMethodColor(sale.paymentMethod).bg} ${getPaymentMethodColor(sale.paymentMethod).border} ${getPaymentMethodColor(sale.paymentMethod).text} font-medium`}>
                          {getPaymentMethodDisplayName(sale.paymentMethod)}
                        </span>
                      </div>
                    </div>
                        
                    {/* Grid de información detallada más compacto */}
                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                      <div>
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Barbero</p>
                        <p className="text-gray-200 font-bold text-xs">{sale.barberName || sale.barbero?.name || 'No especificado'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Fecha Original</p>
                        <p className="text-gray-200 font-semibold text-xs">{formatDate(sale.saleDate || sale.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Cliente</p>
                        <p className="text-gray-200 font-semibold text-xs">{sale.customerName || 'Cliente'}</p>
                      </div>
                    </div>
                    
                    {/* Razón del reembolso más compacta */}
                    {sale.refundReason && (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
                        <p className="text-amber-300 text-xs font-semibold mb-0.5 uppercase tracking-wide">Razón:</p>
                        <p className="text-gray-200 text-xs font-medium italic">"{sale.refundReason}"</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginación */}
          {stats && stats.totalPages > 1 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex justify-center items-center gap-4">
                <button
                  onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                  disabled={filters.page === 1}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <div className="bg-white/[0.02] border border-white/[0.08] rounded-xl px-3 py-1.5">
                  <span className="text-gray-300 text-xs font-bold">
                    Página {filters.page} de {stats.totalPages}
                  </span>
                </div>
                <button
                  onClick={() => setFilters({ ...filters, page: Math.min(stats.totalPages, filters.page + 1) })}
                  disabled={filters.page === stats.totalPages}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal de confirmación para eliminar o revertir reembolso */}
      <DeleteRefundModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        refund={refundToDelete}
        onDelete={confirmDeleteRefund}
        onRevert={confirmRevertRefund}
        isDeleting={deletingRefund}
        isReverting={revertingRefund}
        actionType={modalActionType}
      />
    </>
    );
  } catch (renderError) {
    console.error('Error renderizando RefundedSalesModal:', renderError);
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        color="red"
        title="Error en el Modal"
        icon={AlertTriangle}
        size="md"
        footer={
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            Cerrar
          </button>
        }
      >
        <p className="text-gray-300 font-medium">
          Ocurrió un error al cargar el modal de ventas reembolsadas. Por favor, inténtalo de nuevo.
        </p>
      </Modal>
    );
  }
};

export default RefundedSalesModal;
