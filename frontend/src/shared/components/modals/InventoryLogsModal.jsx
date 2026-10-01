import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  User, 
  Package,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Edit,
  Trash2,
  AlertCircle,
  Camera,
  History
} from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';
import { inventorySnapshotService } from '../../services/inventorySnapshotService';
import Modal from '../ui/Modal';
import { ListSkeleton } from '@components/ui/Skeleton';
import { useNotification } from '../../contexts/NotificationContext';

import logger from '../../utils/logger';
// Modal con el historial del inventario: movimientos y reportes guardados.
// La pestaña de movimientos permite filtrar por acción y cantidad; la de
// inventarios lista los snapshots con su diferencia total.
const InventoryLogsModal = ({ isOpen, onClose, onRefresh }) => {
  const [logs, setLogs] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('movements'); // 'movements' or 'snapshots'
  const [filters, setFilters] = useState({
    action: '',
    userRole: '',
    limit: 100
  });
  const { showError } = useNotification();

  // Carga la pestaña activa (movimientos o snapshots) al abrir o cambiar filtros.
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'movements') {
        fetchLogs();
      } else {
        fetchSnapshots();
      }
    }
  }, [isOpen, activeTab, filters]);

  // Cierra el modal y avisa al padre para refrescar el inventario principal.
  const handleClose = () => {
    onClose();
    // Llamar onRefresh si se proporciona para actualizar el inventario principal
    if (onRefresh) {
      onRefresh();
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'movements') {
        fetchLogs();
      } else {
        fetchSnapshots();
      }
    }
  }, [isOpen, activeTab, filters]);

  // Obtiene los logs de movimientos con los filtros activos.
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await inventoryService.getLogs(queryParams.toString());
      
      if (response.success) {
        logger.debug('Logs recibidos:', response.data);
        logger.debug('Total logs:', response.data?.length || 0);
        logger.debug('Acciones encontradas:', [...new Set(response.data?.map(log => log.action) || [])]);
        setLogs(response.data || []);
      } else {
        showError('Error al cargar los logs de movimientos');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      showError('Error al cargar los logs de movimientos');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Obtiene los inventarios guardados (snapshots) con el límite elegido.
  const fetchSnapshots = async () => {
    try {
      setLoading(true);
      const response = await inventorySnapshotService.getSnapshots({ 
        limit: filters.limit || 100, 
        page: 1 
      });
      setSnapshots(response.data || []);
    } catch (error) {
      console.error('Error fetching snapshots:', error);
      showError('Error al cargar los inventarios guardados');
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  // Icono correspondiente a cada tipo de acción del log.
  const getActionIcon = (action) => {
    switch (action) {
      case 'create': return <Plus className="w-4 h-4" />;
      case 'update': return <Edit className="w-4 h-4" />;
      case 'delete': return <Trash2 className="w-4 h-4" />;
      case 'movement_entry': return <TrendingUp className="w-4 h-4" />;
      case 'movement_exit': return <TrendingDown className="w-4 h-4" />;
      case 'sale': return <Minus className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  // Colores del icono según el tipo de acción.
  const getActionColor = (action) => {
    switch (action) {
      case 'create': return 'text-emerald-400 bg-emerald-400/20';
      case 'update': return 'text-blue-400 bg-blue-400/20';
      case 'delete': return 'text-red-400 bg-red-400/20';
      case 'movement_entry': return 'text-emerald-400 bg-emerald-400/20';
      case 'movement_exit': return 'text-amber-400 bg-amber-400/20';
      case 'sale': return 'text-amber-400 bg-amber-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  // Texto legible de la acción registrada.
  const getActionText = (action) => {
    switch (action) {
      case 'create': return 'Producto Añadido';
      case 'update': return 'Producto Actualizado';
      case 'delete': return 'Producto Eliminado';
      case 'movement_entry': return 'Entrada de Stock';
      case 'movement_exit': return 'Salida de Stock';
      case 'sale': return 'Venta Registrada';
      default: return action?.charAt(0).toUpperCase() + action?.slice(1) || 'Acción';
    }
  };

  // Formatea fecha y hora en formato largo español.
  const formatDate = (dateString) => {
    if (!dateString) return 'Fecha no disponible';
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Renderiza los detalles variables del log (descripción, cambios, notas, etc.).
  const renderLogDetails = (log) => {
    if (!log.details) return null;
    
    return (
      <div className="text-gray-300 text-sm mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        {typeof log.details === 'string' ? log.details : (
          <div>
            {/* Mostrar descripción detallada para creación y eliminación */}
            {(log.action === 'create' || log.action === 'delete') && log.details.description && (
              <div className="text-sm text-gray-300 mb-2 leading-relaxed">
                {log.details.description}
              </div>
            )}
            
            {/* Solo mostrar mensaje si no hay cambios específicos y no es creación/eliminación con descripción */}
            {log.details.message && (!log.details.changes || log.details.changes.length === 0) && 
             !(((log.action === 'create' || log.action === 'delete') && log.details.description)) && (
              <div>{log.details.message}</div>
            )}
            
            {/* Solo mostrar razón si no hay mensaje y no hay cambios específicos */}
            {!log.details.message && log.details.reason && (!log.details.changes || log.details.changes.length === 0) && (
              <div>{log.details.reason}</div>
            )}
            
            {/* Mostrar cambios específicos para actualizaciones */}
            {log.action === 'update' && log.details.changes && log.details.changes.length > 0 && (
              <div className="text-xs text-gray-300">
                <div className="font-medium text-blue-400 mb-2">Cambios realizados:</div>
                <div className="space-y-1 pl-2">
                  {log.details.changes.map((change, index) => (
                    <div key={index} className="text-xs text-gray-300 leading-relaxed">
                      • {change}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {log.details.notes && (
              <div className="text-xs text-gray-400 mt-2">
                Notas: {log.details.notes}
              </div>
            )}
            {log.details.totalAmount && (
              <div className="text-xs text-emerald-400 mt-2 font-semibold">
                Total: ${log.details.totalAmount.toLocaleString()}
              </div>
            )}
            {log.details.quantity && (
              <div className="text-xs text-blue-400 mt-2">
                Cantidad: {log.details.quantity} unidades
              </div>
            )}
            {/* Solo mostrar campos si no hay cambios específicos */}
            {log.details.updatedFields && (!log.details.changes || log.details.changes.length === 0) && (
              <div className="text-xs text-gray-400 mt-2">
                Campos modificados: {log.details.updatedFields.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Da color y signo a la diferencia de inventario.
  const formatDifference = (difference) => {
    if (!difference && difference !== 0) return { text: 'N/A', color: 'text-gray-400' };
    if (difference === 0) return { text: '0', color: 'text-gray-400' };
    if (difference > 0) return { text: `+${difference}`, color: 'text-emerald-400' };
    return { text: difference.toString(), color: 'text-red-400' };
  };

  // No renderiza si el modal está cerrado.
  if (!isOpen) return null;

  // Vista en pestañas de movimientos e inventarios guardados, con filtros y listas.
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      color="blue"
      title="Historial del Inventario"
      subtitle="Movimientos y reportes guardados"
      icon={History}
      size="6xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-gray-300">
            {activeTab === 'movements' ? (
              `${logs.length} movimientos`
            ) : (
              `${snapshots.length} inventarios guardados`
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="mb-4 flex overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
        <button
          onClick={() => setActiveTab('movements')}
          className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
            activeTab === 'movements'
              ? 'text-blue-400 bg-blue-400/10'
              : 'text-gray-300 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Movimientos</span>
            <span className="sm:hidden">Mov.</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('snapshots')}
          className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-colors ${
            activeTab === 'snapshots'
              ? 'text-blue-400 bg-blue-400/10'
              : 'text-gray-300 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Inventarios</span>
            <span className="sm:hidden">Inv.</span>
          </div>
        </button>
      </div>

      {/* Movements Tab */}
      {activeTab === 'movements' && (
        <div>
          {/* Filters */}
          <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={filters.action}
                onChange={(e) => setFilters({...filters, action: e.target.value})}
                className="glassmorphism-select flex-1 text-sm"
              >
                <option value="">Todas las acciones</option>
                <option value="create">Productos Creados</option>
                <option value="update">Productos Actualizados</option>
                <option value="delete">Productos Eliminados</option>
                <option value="movement_entry">Entradas de Stock</option>
                <option value="movement_exit">Salidas de Stock</option>
                <option value="sale">Ventas</option>
              </select>
              <select
                value={filters.limit}
                onChange={(e) => setFilters({...filters, limit: parseInt(e.target.value)})}
                className="glassmorphism-select w-full sm:w-32 text-sm"
              >
                <option value={50}>50 registros</option>
                <option value={100}>100 registros</option>
                <option value={200}>200 registros</option>
              </select>
            </div>
          </div>

          {/* Movements List */}
          {loading ? (
            <ListSkeleton rows={4} />
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No hay movimientos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log._id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]">
                  {/* Desktop Layout */}
                  <div className="hidden sm:flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2 rounded-lg ${getActionColor(log.action)}`}>
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-blue-200 text-sm">
                            {getActionText(log.action)}
                          </h3>
                          {(log.productName || log.itemName || log.itemId?.name || log.details?.productName) && (
                            <span className="text-blue-400 text-sm">• {log.productName || log.itemName || log.itemId?.name || log.details?.productName}</span>
                          )}
                          {log.details?.products && (
                            <span className="text-blue-400 text-sm">• {log.details.products}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{log.performedBy?.name || log.userName || 'Usuario desconocido'}</span>
                            {log.userRole && (
                              <span className="text-blue-400 capitalize">({log.userRole})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(log.timestamp || log.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {log.quantity && (
                      <div className="text-right ml-4">
                        <div className="text-xs text-gray-400">Cantidad</div>
                        <div className={`font-semibold text-sm ${log.action === 'movement_entry' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {log.action === 'movement_entry' ? '+' : '-'}{log.quantity}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mobile Layout */}
                  <div className="block sm:hidden">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getActionColor(log.action)} flex-shrink-0`}>
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col gap-1 mb-2">
                          <h3 className="font-medium text-blue-200 text-sm">
                            {getActionText(log.action)}
                          </h3>
                          {(log.productName || log.itemName || log.itemId?.name || log.details?.productName) && (
                            <span className="text-blue-400 text-sm">{log.productName || log.itemName || log.itemId?.name || log.details?.productName}</span>
                          )}
                          {log.details?.products && (
                            <span className="text-blue-400 text-sm">{log.details.products}</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{log.performedBy?.name || log.userName || 'Usuario desconocido'}</span>
                            {log.userRole && (
                              <span className="text-blue-400 capitalize">({log.userRole})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(log.timestamp || log.createdAt)}</span>
                          </div>
                        </div>
                        {log.quantity && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-400">Cantidad: </span>
                            <span className={`font-semibold text-sm ${log.action === 'movement_entry' ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {log.action === 'movement_entry' ? '+' : '-'}{log.quantity}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detalles del log - Una sola vez para ambos layouts */}
                  {renderLogDetails(log)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Snapshots Tab */}
      {activeTab === 'snapshots' && (
        <div>
          {loading ? (
            <ListSkeleton rows={4} />
          ) : snapshots.length === 0 ? (
            <div className="text-center py-8">
              <Camera className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No hay inventarios guardados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snapshot) => {
                // Diferencia total del snapshot con su color según el signo.
                const difference = formatDifference(snapshot.totalDifference);
                
                return (
                  <div key={snapshot._id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]">
                    {/* Desktop Layout */}
                    <div className="hidden sm:flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-2 rounded-lg text-blue-400 bg-blue-400/20">
                          <Camera className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-blue-200 text-sm">
                              Inventario Guardado
                            </h3>
                            <span className="text-blue-400 text-sm">• {snapshot.totalItems} productos</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{snapshot.createdBy?.name || 'Usuario'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(snapshot.date)}</span>
                            </div>
                          </div>
                          {snapshot.notes && (
                            <p className="text-gray-300 text-sm mt-2 italic">"{snapshot.notes}"</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-xs text-gray-400 mb-1">Diferencia Total</div>
                        <div className={`font-semibold text-sm ${difference.color}`}>
                          {difference.text}
                        </div>
                      </div>
                    </div>

                    {/* Mobile Layout */}
                    <div className="block sm:hidden">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg text-blue-400 bg-blue-400/20 flex-shrink-0">
                          <Camera className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col gap-1 mb-2">
                            <h3 className="font-medium text-blue-200 text-sm">
                              Inventario Guardado
                            </h3>
                            <span className="text-blue-400 text-sm">{snapshot.totalItems} productos</span>
                          </div>
                          <div className="flex flex-col gap-1 text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{snapshot.createdBy?.name || 'Usuario'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDate(snapshot.date)}</span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-400">Diferencia Total:</span>
                            <span className={`font-semibold text-sm ${difference.color}`}>
                              {difference.text}
                            </span>
                          </div>
                          {snapshot.notes && (
                            <p className="text-gray-300 text-sm mt-2 italic">"{snapshot.notes}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

export default InventoryLogsModal;
