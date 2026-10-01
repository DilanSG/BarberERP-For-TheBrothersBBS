import { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Package, Scissors } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Modal from '../ui/Modal';
import { refundService } from '../../services/refundService';
import { toast } from 'react-toastify';
import { formatCurrency } from '@utils/formatters';

// Constantes
// Tipos de venta locales para no depender del módulo de constantes.
const SALE_TYPES = {
  PRODUCT: 'product',
  SERVICE: 'service'
};

// Funciones utilitarias

// Formatea fecha y hora (dd/MM/yyyy HH:mm) con respaldo ante errores.
const formatDate = (date) => {
  if (!date) return 'Fecha no disponible';
  try {
    return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: es });
  } catch (error) {
    return 'Fecha inválida';
  }
};

// Traduce el método de pago a su nombre legible.
const getPaymentMethodDisplayName = (method) => {
  const PAYMENT_METHOD_LABELS = {
    'efectivo': 'Efectivo',
    'tarjeta': 'Tarjeta',
    'transferencia': 'Transferencia',
    'daviplata': 'Daviplata',
    'nequi': 'Nequi'
  };
  return PAYMENT_METHOD_LABELS[method] || method || 'No especificado';
};

// Colores del badge según el método de pago.
const getPaymentMethodColor = (method) => {
  const colors = {
    'efectivo': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    'tarjeta': { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    'transferencia': { bg: 'bg-brand-400/10', border: 'border-brand-400/30', text: 'text-brand-300' },
    'daviplata': { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    'nequi': { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' }
  };
  return colors[method] || { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400' };
};

// Icono correspondiente al tipo de venta.
const getTypeIcon = (type) => {
  switch (type) {
    case SALE_TYPES.PRODUCT:
      return <Package className="w-4 h-4" />;
    case SALE_TYPES.SERVICE:
      return <Scissors className="w-4 h-4" />;
    default:
      return <Package className="w-4 h-4" />;
  }
};

// Etiqueta legible del tipo de venta.
const getTypeLabel = (type) => {
  switch (type) {
    case SALE_TYPES.PRODUCT:
      return 'Producto';
    case SALE_TYPES.SERVICE:
      return 'Servicio';
    default:
      return 'Item';
  }
};

// Modal de confirmación para eliminar permanentemente un reembolso o revertirlo.
// El modo (delete/revert) cambia textos, colores y la acción ejecutada.
const DeleteRefundModal = ({ 
  isOpen, 
  onClose, 
  refund, 
  onDelete,
  onRevert,
  isDeleting = false,
  isReverting = false,
  actionType = 'delete' 
}) => {
  const [localDeleting, setLocalDeleting] = useState(false);
  const [localReverting, setLocalReverting] = useState(false);

  // No renderiza si está cerrado o no hay reembolso.
  if (!isOpen || !refund) return null;

  // Elimina el reembolso usando onDelete o el servicio como respaldo.
  const handleDelete = async () => {
    try {
      setLocalDeleting(true);
      
      // Usar diferentes formas de obtener el ID
      const refundId = refund._id || refund.saleId || refund.id;
      console.log('🗑️ Eliminando reembolso con ID:', refundId, 'Objeto completo:', refund);
      
      if (onDelete) {
        await onDelete(refundId);
      } else {
        // Fallback si no se pasa el callback
        // Fallback cuando el padre no pasa onDelete.
        const result = await refundService.permanentDeleteRefund(refundId);
        if (result.success) {
          toast.success('Reembolso eliminado permanentemente');
          onClose();
        }
      }
    } catch (error) {
      console.error('Error al eliminar reembolso:', error);
      toast.error(error.message || 'Error al eliminar el reembolso');
    } finally {
      setLocalDeleting(false);
    }
  };

  // Revierte el reembolso usando onRevert o el servicio como respaldo.
  const handleRevert = async () => {
    try {
      setLocalReverting(true);
      
      // Usar diferentes formas de obtener el ID
      const refundId = refund._id || refund.saleId || refund.id;
      console.log('🔄 Revirtiendo reembolso con ID:', refundId, 'Objeto completo:', refund);
      
      if (onRevert) {
        await onRevert(refundId);
      } else {
        // Fallback si no se pasa el callback
        // Fallback cuando el padre no pasa onRevert.
        const result = await refundService.deleteRefund(refundId);
        if (result.success) {
          toast.success('Reembolso revertido exitosamente');
          onClose();
        }
      }
    } catch (error) {
      console.error('Error al revertir reembolso:', error);
      toast.error(error.message || 'Error al revertir el reembolso');
    } finally {
      setLocalReverting(false);
    }
  };

  // Modo actual del modal.
  const isDelete = actionType === 'delete';
  const isRevert = actionType === 'revert';
  
  // Usar los estados locales o los pasados como props
  // Combina los estados de carga locales con los recibidos por props.
  const currentlyDeleting = isDeleting || localDeleting;
  const currentlyReverting = isReverting || localReverting;
  const isBusy = currentlyDeleting || currentlyReverting;

  // Vista: descripción de la acción, detalles del reembolso y consecuencias.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color={isDelete ? 'red' : 'amber'}
      title={isDelete ? 'Eliminar Reembolso' : 'Revertir Reembolso'}
      subtitle={isDelete ? 'Eliminación permanente' : 'Restaurar venta original'}
      icon={isDelete ? Trash2 : RotateCcw}
      size="md"
      footer={
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isBusy}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          
          <button
            onClick={isDelete ? handleDelete : handleRevert}
            disabled={isBusy}
            className={`flex-1 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              isDelete
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isBusy ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>{isDelete ? 'Eliminando...' : 'Revirtiendo...'}</span>
              </>
            ) : (
              <>
                {isDelete ? (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar Permanentemente</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Revertir Reembolso</span>
                  </>
                )}
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4 sm:space-y-6">
        
        {/* Descripción de la acción */}
        <div className={`flex items-start space-x-3 p-3 sm:p-4 rounded-xl border ${
          isDelete
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
            isDelete ? 'text-red-400' : 'text-amber-400'
          }`} />
          <div>
            <p className={`text-sm font-medium mb-1 ${
              isDelete ? 'text-red-300' : 'text-amber-300'
            }`}>
              {isDelete 
                ? '¿Estás seguro de que deseas eliminar permanentemente este reembolso?'
                : '¿Estás seguro de que deseas revertir este reembolso?'
              }
            </p>
            <p className={`text-xs ${
              isDelete ? 'text-red-400/80' : 'text-amber-400/80'
            }`}>
              {isDelete
                ? 'Esta acción eliminará completamente el registro del sistema y generará un log de auditoría.'
                : 'Esta acción restaurará la venta original y ajustará el inventario si es necesario.'
              }
            </p>
          </div>
        </div>

        {/* Detalles del Reembolso */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 sm:p-4 space-y-4">
          <h4 className="text-red-200 font-semibold text-sm uppercase tracking-wide">
            Detalles del Reembolso
          </h4>
          
          {/* Nombre del producto/servicio con cantidad */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-1.5 rounded-lg bg-white/10 ${
                refund.type === SALE_TYPES.PRODUCT ? 'text-blue-400' : 'text-emerald-400'
              }`}>
                {getTypeIcon(refund.type)}
              </div>
              <div>
                <p className="text-red-200 font-semibold">
                  {refund.productName || refund.name || 'Sin nombre'}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-gray-400 text-xs">
                    {getTypeLabel(refund.type)}
                  </p>
                  {refund.type === SALE_TYPES.PRODUCT && refund.quantity && (
                    <span className="text-xs text-blue-400">
                      (x{refund.quantity})
                    </span>
                  )}
                </div>
              </div>
            </div>
            {refund.category && (
              <span className="text-xs px-2 py-1 bg-white/10 text-gray-300 rounded-md border border-white/20">
                {refund.category}
              </span>
            )}
          </div>

          {/* Grid de información principal */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Monto reembolsado:</p>
              <p className="text-red-200 font-bold">
                {formatCurrency(refund.totalAmount || refund.price || refund.amount)}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Método de pago:</p>
              <div className="flex items-center gap-2">
                <span className="text-red-200 font-semibold">
                  {getPaymentMethodDisplayName(refund.paymentMethod)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-gray-400">Fecha de reembolso:</p>
              <p className="text-red-200 font-semibold">
                {formatDate(refund.refundedAt || refund.updatedAt)}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Fecha original de venta:</p>
              <p className="text-red-200 font-semibold">
                {formatDate(refund.saleDate || refund.createdAt)}
              </p>
            </div>
          </div>

          {/* Grid de información adicional */}
          <div className="grid grid-cols-2 gap-4 text-sm border-t border-white/10 pt-3">
            <div>
              <p className="text-gray-400">Barbero:</p>
              <p className="text-red-200 font-semibold">
                {refund.barberName || refund.barbero?.name || 'No especificado'}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Cliente:</p>
              <p className="text-red-200 font-semibold">
                {refund.customerName || 'Cliente walk-in'}
              </p>
            </div>
          </div>

          {/* Razón del reembolso */}
          {refund.refundReason && (
            <div className="border-t border-white/10 pt-3">
              <p className="text-gray-400 text-sm mb-2 font-semibold uppercase tracking-wide">Razón del reembolso:</p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="text-amber-200 italic text-sm">"{refund.refundReason}"</p>
              </div>
            </div>
          )}
        </div>

        {/* Consecuencias de la acción */}
        <div className={`p-3 sm:p-4 rounded-xl border ${
          isDelete
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          <p className={`font-semibold text-sm mb-2 ${
            isDelete ? 'text-red-300' : 'text-amber-300'
          }`}>
            {isDelete ? 'Al eliminar este reembolso:' : 'Al revertir este reembolso:'}
          </p>
          <ul className={`text-xs space-y-1 ${
            isDelete ? 'text-red-200/90' : 'text-amber-200/90'
          }`}>
            {isDelete ? (
              <>
                <li>• El registro se eliminará permanentemente del sistema</li>
                <li>• Se generará un log de auditoría con tu usuario</li>
                <li>• Esta acción NO es reversible</li>
                <li>• Los reportes se actualizarán automáticamente</li>
              </>
            ) : (
              <>
                <li>• La venta volverá a su estado original</li>
                <li>• Se eliminará el motivo del reembolso</li>
                <li>• Se ajustará el inventario del producto</li>
                <li>• Se generará un registro en los logs del sistema</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteRefundModal;
