import { useState, useEffect } from 'react';
import { 
  Download,
  FileText,
  Calendar,
  User,
  BarChart3,
  Trash2,
  Archive
} from 'lucide-react';
import { inventorySnapshotService } from '../../services/inventorySnapshotService';
import GradientButton from '../ui/GradientButton';
import Modal from '../ui/Modal';
import { ListSkeleton, Skeleton } from '@components/ui/Skeleton';
import { useNotification } from '../../contexts/NotificationContext';

// Modal con el historial de inventarios guardados (snapshots).
// Permite descargar cada inventario en Excel y eliminarlo.
const SavedInventoriesModal = ({ isOpen, onClose }) => {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState({});
  const [deleting, setDeleting] = useState({});
  const { showSuccess, showError } = useNotification();

  // Carga los inventarios guardados cada vez que se abre el modal.
  useEffect(() => {
    if (isOpen) {
      fetchSnapshots();
    }
  }, [isOpen]);

  // Obtiene los últimos 50 snapshots de inventario.
  const fetchSnapshots = async () => {
    try {
      setLoading(true);
      const response = await inventorySnapshotService.getSnapshots({ 
        limit: 50, 
        page: 1 
      });
      setSnapshots(response.data || []);
    } catch (error) {
      console.error('Error al cargar inventarios guardados:', error);
      showError('Error al cargar los inventarios guardados');
    } finally {
      setLoading(false);
    }
  };

  // Descarga un snapshot como archivo Excel generando un enlace temporal
  // y liberando la URL al terminar.
  const handleDownload = async (snapshot) => {
    try {
      setDownloading(prev => ({ ...prev, [snapshot._id]: true }));
      
      const blob = await inventorySnapshotService.downloadSnapshot(snapshot._id);
      
      // Crea una URL temporal para forzar la descarga del blob.
      // Crear URL temporal para la descarga
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Formatear fecha para el nombre del archivo
      // Nombre del archivo con la fecha del inventario.
      const formattedDate = new Date(snapshot.date).toLocaleDateString('es-ES').replace(/\//g, '-');
      link.download = `inventario-guardado-${formattedDate}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpiar URL temporal
      // Libera la URL temporal después de la descarga.
      window.URL.revokeObjectURL(url);
      
      showSuccess('Inventario descargado exitosamente');
    } catch (error) {
      console.error('Error al descargar inventario:', error);
      showError('Error al descargar el inventario');
    } finally {
      setDownloading(prev => ({ ...prev, [snapshot._id]: false }));
    }
  };

  // Elimina el inventario previa confirmación y lo quita de la lista local.
  const handleDelete = async (snapshot) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este inventario guardado? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setDeleting(prev => ({ ...prev, [snapshot._id]: true }));
      
      await inventorySnapshotService.deleteSnapshot(snapshot._id);
      
      // Actualiza la lista local sin volver a pedir los datos al backend.
      // Actualizar la lista local removiendo el elemento eliminado
      setSnapshots(prev => prev.filter(s => s._id !== snapshot._id));
      
      showSuccess('Inventario eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar inventario:', error);
      showError('Error al eliminar el inventario');
    } finally {
      setDeleting(prev => ({ ...prev, [snapshot._id]: false }));
    }
  };

  // Formatea fecha y hora en formato largo español.
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Da color y signo a la diferencia de inventario (positiva o negativa).
  const formatDifference = (difference) => {
    if (difference === 0) return { text: '0', color: 'text-gray-600' };
    if (difference > 0) return { text: `+${difference}`, color: 'text-emerald-600' };
    return { text: difference.toString(), color: 'text-red-600' };
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista: carga, estado vacío o listado de snapshots con descarga y borrado.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="blue"
      title="Inventarios Guardados"
      subtitle="Historial de inventarios registrados"
      icon={Archive}
      size="4xl"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors w-full sm:w-auto"
          >
            Cerrar
          </button>
        </div>
      }
    >
      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <ListSkeleton rows={3} />
          <span className="ml-2 text-gray-300">Cargando inventarios...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && snapshots.length === 0 && (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-blue-200">
            No hay inventarios guardados
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            Aún no se han registrado inventarios.
          </p>
        </div>
      )}

      {/* Snapshots List */}
      {!loading && snapshots.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          {snapshots.map((snapshot) => {
            // Diferencia formateada y banderas de descarga/eliminación de este inventario.
            const difference = formatDifference(snapshot.totalDifference);
            const isDownloading = downloading[snapshot._id];
            const isDeleting = deleting[snapshot._id];
            
            return (
              <div 
                key={snapshot._id}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
              >
                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-2">
                      <div className="flex items-center text-sm text-gray-300">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(snapshot.date)}
                      </div>
                      <div className="flex items-center text-sm text-gray-300">
                        <User className="h-4 w-4 mr-1" />
                        {snapshot.createdBy?.name || 'Usuario'}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center text-sm">
                        <BarChart3 className="h-4 w-4 mr-1 text-blue-400" />
                        <span className="text-blue-200 font-medium">
                          {snapshot.totalItems} productos
                        </span>
                      </div>
                      
                      <div className="flex items-center text-sm">
                        <span className="text-blue-200 font-medium mr-1">Diferencia:</span>
                        <span className={`font-semibold ${difference.color === 'text-gray-600' ? 'text-gray-300' : difference.color === 'text-emerald-600' ? 'text-emerald-300' : 'text-red-300'}`}>
                          {difference.text}
                        </span>
                      </div>
                    </div>
                    
                    {snapshot.notes && (
                      <p className="text-sm text-gray-300 mt-2 italic">
                        "{snapshot.notes}"
                      </p>
                    )}
                  </div>
                  
                  <div className="ml-4 flex items-center gap-3">
                    <GradientButton
                      onClick={() => handleDownload(snapshot)}
                      disabled={isDownloading}
                      className="inline-flex items-center justify-center px-3 py-2 text-sm leading-4 font-medium"
                    >
                      {isDownloading ? (
                        <div className="flex items-center">
                          <Skeleton className="h-4 w-4 rounded-full" />
                          <span>Descargando...</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                          <span>Descargar</span>
                        </div>
                      )}
                    </GradientButton>
                    
                    <button
                      onClick={() => handleDelete(snapshot)}
                      disabled={isDeleting}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Eliminar inventario"
                    >
                      {isDeleting ? (
                        <Skeleton className="h-3 w-3 rounded-full" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="block sm:hidden space-y-3">
                  {/* Header with date and difference */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center text-xs text-gray-300 mb-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(snapshot.date)}
                      </div>
                      <div className="flex items-center text-xs text-gray-300">
                        <User className="h-3 w-3 mr-1" />
                        {snapshot.createdBy?.name || 'Usuario'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400 mb-1">Diferencia</div>
                      <span className={`font-semibold text-sm ${difference.color === 'text-gray-600' ? 'text-gray-300' : difference.color === 'text-emerald-600' ? 'text-emerald-300' : 'text-red-300'}`}>
                        {difference.text}
                      </span>
                    </div>
                  </div>

                  {/* Products count */}
                  <div className="flex items-center text-sm border-t border-white/10 pt-2">
                    <BarChart3 className="h-4 w-4 mr-1 text-blue-400" />
                    <span className="text-blue-200 font-medium">
                      {snapshot.totalItems} productos
                    </span>
                  </div>

                  {/* Notes */}
                  {snapshot.notes && (
                    <p className="text-xs text-gray-300 italic border-t border-white/10 pt-2">
                      "{snapshot.notes}"
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <GradientButton
                      onClick={() => handleDownload(snapshot)}
                      disabled={isDownloading}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 text-xs leading-4 font-medium"
                    >
                      {isDownloading ? (
                        <div className="flex items-center">
                          <Skeleton className="h-3 w-3 rounded-full" />
                          <span>Descargando...</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Download className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>Descargar</span>
                        </div>
                      )}
                    </GradientButton>
                    
                    <button
                      onClick={() => handleDelete(snapshot)}
                      disabled={isDeleting}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Eliminar inventario"
                    >
                      {isDeleting ? (
                        <Skeleton className="h-3 w-3 rounded-full" />
                      ) : (
                        <Trash2 className="h-3 h-3" />
                      )}
                    </button>
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

export default SavedInventoriesModal;
