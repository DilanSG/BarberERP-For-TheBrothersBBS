import React, { useState, useEffect } from 'react';
import { Camera, Save, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { inventorySnapshotService } from '../../services/inventorySnapshotService';
import { inventoryService } from '../../services/inventoryService';
import GradientButton from '../ui/GradientButton';
import Modal from '../ui/Modal';

import logger from '../../utils/logger';
// Modal para guardar un snapshot del inventario (foto del stock por producto).
// Props: isOpen, onClose, inventory (items), onSnapshotCreated, onInventoryReset.
// Al guardar: crea el snapshot y reinicia los contadores, usando el stock real
// como nuevo stock inicial (initialStock = realStock).
const InventorySnapshot = ({ 
  isOpen, 
  onClose, 
  inventory = [],
  onSnapshotCreated,
  onInventoryReset // Nuevo callback para notificar que se reinició el inventario
}) => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useNotification();
  
  // Datos del snapshot en edición y flags de carga/guardado.
  const [snapshotData, setSnapshotData] = useState({
    items: []
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inicializar datos del snapshot cuando se abre el modal.
  // Calcula el stock esperado (inicial + entradas - salidas - ventas) y su
  // diferencia contra el stock real, replicando la lógica del inventario principal.
  useEffect(() => {
    if (isOpen && inventory.length > 0) {
      const items = inventory.map(item => {
        const initialStock = item.initialStock || 0;
        const entries = item.entries || 0;
        const exits = item.exits || 0;
        const sales = item.sales || 0;
        const expectedStock = initialStock + entries - exits - sales;
        // Usar EXACTAMENTE la misma lógica que en el inventario principal
        const currentStock = item.stock || item.currentStock || item.quantity || 0;
        const realStock = item.realStock || currentStock;
        
        return {
          productId: item._id,
          productName: item.name || 'Sin nombre',
          category: item.category || 'Sin categoría',
          initialStock: initialStock,
          entries: entries,
          exits: exits,
          sales: sales,
          expectedStock: expectedStock,
          realStock: realStock,
          difference: realStock - expectedStock
        };
      });

      setSnapshotData({
        items
      });
    }
  }, [isOpen, inventory]);

  // Función para reiniciar el inventario después de guardar
  // Reinicia el inventario tras guardar: el stock real pasa a ser el nuevo stock
  // inicial y entradas/salidas/ventas vuelven a 0 (actualiza producto por producto).
  const resetInventoryAfterSnapshot = async () => {
    try {
      logger.debug('Reiniciando inventario después del snapshot...');
      // Mapear los datos originales del inventario para asegurar todos los campos obligatorios
      const resetData = snapshotData.items.map(item => {
        // Buscar el producto original en el inventario por _id
        const original = inventory.find(prod => prod._id === item.productId);
        if (!original) return null;
        return {
          productId: item.productId,
          name: original.name,
          code: original.code,
          category: original.category,
          price: original.price,
          description: original.description,
          minStock: original.minStock,
          unit: original.unit,
          // Reinicio de campos
          initialStock: item.realStock, // El stock real se convierte en el nuevo stock inicial
          entries: 0,
          exits: 0,
          sales: 0,
          realStock: item.realStock,
          stock: item.realStock // stock y realStock igualados
        };
      }).filter(Boolean);

      logger.debug('Datos para reiniciar inventario:', resetData);

      // Llamar al servicio para actualizar todos los productos
      for (const item of resetData) {
        await inventoryService.updateInventoryItem(item.productId, {
          name: item.name,
          code: item.code,
          category: item.category,
          price: item.price,
          description: item.description,
          minStock: item.minStock,
          unit: item.unit,
          initialStock: item.initialStock,
          entries: item.entries,
          exits: item.exits,
          sales: item.sales,
          realStock: item.realStock,
          stock: item.stock
        });
      }

      logger.debug('Inventario reiniciado exitosamente');
      
    } catch (error) {
      console.error('Error al reiniciar inventario:', error);
      showError('Error al reiniciar el inventario: ' + error.message);
      throw error; // Re-lanzar para que el caller pueda manejar el error
    }
  };

  // Guarda el snapshot y, solo si la API responde OK, reinicia el inventario.
  const handleSaveSnapshot = async () => {
    try {
      setSaving(true);

      // Validar que hay items
      if (snapshotData.items.length === 0) {
        showWarning('No hay productos para guardar en el snapshot');
        return;
      }

      logger.debug('Guardando snapshot de inventario:', snapshotData);

      // 1. Primero guardar el snapshot
      const response = await inventorySnapshotService.createSnapshot(snapshotData);

      if (response.success) {
        logger.debug('Snapshot guardado, ahora reiniciando inventario...');
        
        // 2. Después reiniciar el inventario
        await resetInventoryAfterSnapshot();
        
        showSuccess('Inventario guardado y reiniciado exitosamente');
        onSnapshotCreated && onSnapshotCreated();
        onInventoryReset && onInventoryReset(); // Notificar que se reinició el inventario
        onClose();
      }

    } catch (error) {
      console.error('Error al guardar snapshot o reiniciar inventario:', error);
      showError(error.message || 'Error al guardar el snapshot de inventario');
    } finally {
      setSaving(false);
    }
  };

  // Devuelve icono, texto y clase de color según la diferencia (+ / - / 0).
  const getDifferenceDisplay = (difference) => {
    if (difference > 0) {
      return {
        icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
        text: `+${difference}`,
        className: 'text-emerald-400 bg-emerald-900/30'
      };
    } else if (difference < 0) {
      return {
        icon: <TrendingDown className="w-4 h-4 text-red-400" />,
        text: difference.toString(),
        className: 'text-red-400 bg-red-900/30'
      };
    } else {
      return {
        icon: <Minus className="w-4 h-4 text-gray-400" />,
        text: '0',
        className: 'text-gray-400 bg-gray-900/30'
      };
    }
  };

  // Suma de diferencias para el badge "Diferencia total" del header.
  const totalDifference = snapshotData.items.reduce((sum, item) => sum + item.difference, 0);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      color="blue"
      title="Guardar Inventario"
      subtitle="Registra el estado actual del inventario"
      icon={Camera}
      size="4xl"
      headerExtra={
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="hidden sm:inline text-xs text-gray-400">Diferencia total</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            totalDifference > 0 ? 'text-emerald-300 bg-emerald-900/30' :
            totalDifference < 0 ? 'text-red-300 bg-red-900/30' :
            'text-gray-300 bg-gray-900/30'
          }`}>
            {totalDifference > 0 ? '+' : ''}{totalDifference}
          </span>
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div className="text-xs sm:text-sm text-gray-300 order-2 sm:order-1">
            {snapshotData.items.length} productos • Registro del {new Date().toLocaleDateString('es-ES')}
          </div>
          
          <div className="flex items-center gap-3 order-1 sm:order-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors flex-1 sm:flex-none"
            >
              Cancelar
            </button>
            
            <GradientButton
              onClick={handleSaveSnapshot}
              disabled={saving || snapshotData.items.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 flex-1 sm:flex-none"
            >
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{saving ? 'Guardando...' : 'Guardar Inventario'}</span>
                <span className="sm:hidden">{saving ? 'Guardando...' : 'Guardar'}</span>
              </div>
            </GradientButton>
          </div>
        </div>
      }
    >
      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
        <table className="w-full">
          <thead className="bg-white/5 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Producto
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                Inicial
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                Entradas
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                Salidas
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                Ventas
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                Stock Sistema
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                Stock Real
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                Diferencia
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {snapshotData.items.map((item, index) => {
              const diff = getDifferenceDisplay(item.difference);
              
              return (
                <tr key={item.productId} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="font-medium text-white">
                      {item.productName}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">
                      {item.category}
                    </div>
                  </td>
                  
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="font-medium text-gray-300">
                      {item.initialStock}
                    </span>
                  </td>
                  
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="font-medium text-emerald-400">
                      {item.entries}
                    </span>
                  </td>
                  
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="font-medium text-red-400">
                      {item.exits}
                    </span>
                  </td>
                  
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="font-medium text-amber-400">
                      {item.sales}
                    </span>
                  </td>
                  
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="font-medium text-brand-300">
                      {item.expectedStock}
                    </span>
                  </td>
                  
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <span className="font-medium text-blue-400">
                      {item.realStock}
                    </span>
                  </td>
                  
                  <td className="px-4 py-4 whitespace-nowrap text-center">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${diff.className}`}>
                      {diff.icon}
                      {diff.text}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="block md:hidden space-y-4">
        {snapshotData.items.map((item, index) => {
          const diff = getDifferenceDisplay(item.difference);
          
          return (
            <div key={item.productId} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              {/* Product Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div>
                  <h3 className="font-medium text-white text-sm">
                    {item.productName}
                  </h3>
                  <p className="text-xs text-gray-400 capitalize mt-1">
                    {item.category}
                  </p>
                </div>
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${diff.className}`}>
                  {diff.icon}
                  {diff.text}
                </div>
              </div>

              {/* Stock Information Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block">Inicial</label>
                  <div className="mt-1">
                    <span className="px-2 py-1 bg-gray-600/20 text-gray-300 font-semibold text-xs rounded block">{item.initialStock}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-emerald-400 uppercase tracking-wide block">Entradas</label>
                  <div className="mt-1">
                    <span className="px-2 py-1 bg-emerald-600/20 text-emerald-400 font-semibold text-xs rounded block">{item.entries}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-red-400 uppercase tracking-wide block">Salidas</label>
                  <div className="mt-1">
                    <span className="px-2 py-1 bg-red-600/20 text-red-400 font-semibold text-xs rounded block">{item.exits}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-amber-400 uppercase tracking-wide block">Ventas</label>
                  <div className="mt-1">
                    <span className="px-2 py-1 bg-amber-600/20 text-amber-400 font-semibold text-xs rounded block">{item.sales}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-brand-300 uppercase tracking-wide block">Sistema</label>
                  <div className="mt-1">
                    <span className="px-2 py-1 bg-brand-500/20 text-brand-300 font-semibold text-xs rounded block">{item.expectedStock}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-blue-400 uppercase tracking-wide block">Real</label>
                  <div className="mt-1">
                    <span className="px-2 py-1 bg-blue-600/20 text-blue-400 font-semibold text-xs rounded block">{item.realStock}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default InventorySnapshot;
