import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';

// Formatea un valor como precio en pesos colombianos (COP).
const formatPrice = (price) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price || 0);
};

// Modal de confirmación para eliminar un servicio del catálogo.
// Resume nombre, precio, duración, estado y visibilidad antes de borrar.
const DeleteServiceModal = ({ 
  isOpen, 
  onClose, 
  service, 
  onDelete,
  isLoading = false 
}) => {
  // Lanza la eliminación del servicio seleccionado a través de onDelete.
  const handleDelete = async () => {
    if (service) {
      await onDelete(service._id);
    }
  };

  // No se muestra si está cerrado o no hay servicio que eliminar.
  if (!isOpen || !service) return null;

  // Contenido: advertencias de la acción irreversible y ficha del servicio.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="red"
      title="Eliminar Servicio"
      subtitle="Esta acción no se puede deshacer"
      icon={Trash2}
      size="md"
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading}
            className="flex-1 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {isLoading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      }
    >
      <p className="text-gray-300 mb-4">
        ¿Estás seguro de que deseas eliminar el servicio{' '}
        <span className="font-semibold text-red-200">"{service.name}"</span>?
      </p>

      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-200">
            <p className="font-medium mb-1">Esta acción no se puede deshacer</p>
            <ul className="list-disc list-inside space-y-1 text-red-300">
              <li>Se eliminará permanentemente de la base de datos</li>
              <li>Las citas futuras con este servicio serán afectadas</li>
              <li>Se removerá automáticamente de la página principal</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Service Info */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <h4 className="text-red-200 font-medium mb-2">Información del servicio:</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Nombre:</span>
            <span className="text-red-200">{service.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Precio:</span>
            <span className="text-red-200">{formatPrice(service.price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Duración:</span>
            <span className="text-red-200">{service.duration} min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Estado:</span>
            <span className={`${service.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
              {service.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">En Home:</span>
            <span className={`${service.showInHome ? 'text-blue-400' : 'text-gray-400'}`}>
              {service.showInHome ? 'Sí' : 'No'}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteServiceModal;
