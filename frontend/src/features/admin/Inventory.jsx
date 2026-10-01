import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, Search, Package2, AlertTriangle, CheckCircle, 
  Calculator, RotateCcw, 
  ShoppingCart, Minus, ChevronDown, 
  DollarSign, Calendar, Download, Camera, FileText,
  PackagePlus, Save
} from 'lucide-react';
import { inventoryService } from '@services/inventoryService';
import { useInventoryRefresh } from '@contexts/InventoryContext';
import { useAuth } from '@contexts/AuthContext';
import { usePaymentMethods } from '@shared/config/paymentMethods';
import { PageContainer } from '@components/layout/PageContainer';
import GradientButton from '@components/ui/GradientButton';
import Modal from '@components/ui/Modal';
import InventorySnapshot from '@components/inventory/InventorySnapshot';
import SavedInventoriesModal from '@components/modals/SavedInventoriesModal';
import InventoryLogsModal from '@components/modals/InventoryLogsModal';
import { Skeleton, InventorySkeleton } from '@components/ui/Skeleton';

import logger from '@utils/logger';

// Límite de filas visibles en el flujo de la página antes de activar scroll interno
const MAX_VISIBLE_PRODUCTS = 100;

// Componente moderno de gestión de inventario para The Brothers Barber Shop.
// Diseño moderno con fondo de puntos, gradient text y diseño tipo lista lateral.
// Carga el inventario, permite CRUD de productos, movimientos (entrada/salida/
// venta/conteo), exportación a Excel, snapshots e historial.
const Inventory = () => {
  const { user } = useAuth();
  const { refreshTrigger, needsRefresh, markRefreshed } = useInventoryRefresh();
  const { paymentMethods, getOptions: getPaymentMethodOptions, mapToBackend: mapPaymentMethodToBackend } = usePaymentMethods();
  // Lista de productos y estados de carga/mensajes de la página
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('alphabetical'); // 'alphabetical', 'createdAt'
  // Visibilidad de cada modal de la página (producto, entrada, salida, venta, conteo, etc.)
  const [showProductModal, setShowProductModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  // Datos del formulario de producto (crear/editar)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'insumos',
    initialStock: '',
    entries: '',
    exits: '',
    minStock: '',
    realStock: '',
    price: '',
    description: ''
  });
  // Ítem en edición, ítem seleccionado para movimientos y datos de cada modal
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [movementData, setMovementData] = useState({
    type: 'entry',
    quantity: '',
    reason: '',
    notes: '',
    cost: '',
    paymentMethod: 'efectivo'
  });
  const [saleData, setSaleData] = useState({
    quantity: '1'
  });
  const [countData, setCountData] = useState({
    realStock: '',
    entries: '',
    exits: '',
    notes: ''
  });
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showSavedInventoriesModal, setShowSavedInventoriesModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deletionReason, setDeletionReason] = useState('');

  // Categorías disponibles para clasificar productos
  const categories = [
    'cannabicos', 'gorras', 'insumos', 'productos_pelo', 'lociones',
    'ceras', 'geles', 'maquinas', 'accesorios', 'otros'
  ];

  useEffect(() => {
    loadInventory();
  }, []);

  // Auto-recarga cuando hay ventas nuevas
  useEffect(() => {
    logger.debug('🔄 InventoryAdmin: useEffect trigger -', { 
      refreshTrigger, 
      lastRefreshTime, 
      needsRefresh: needsRefresh(lastRefreshTime) 
    });
    
    if (needsRefresh(lastRefreshTime)) {
      logger.debug('🔄 InventoryAdmin: Detectada venta nueva, recargando...');
      loadInventory();
    }
  }, [refreshTrigger, lastRefreshTime, needsRefresh]);

  // También agregar un useEffect que se ejecute al montar el componente
  useEffect(() => {
    logger.debug('🔄 InventoryAdmin: Componente montado, verificando si necesita recarga...');
    if (needsRefresh(lastRefreshTime)) {
      logger.debug('🔄 InventoryAdmin: Necesita recarga al montar, ejecutando...');
      loadInventory();
    }
  }, []);

  // Carga el inventario desde el servicio y normaliza los distintos formatos de respuesta
  const loadInventory = async () => {
    try {
      setLoading(true);
      logger.debug('🔄 InventoryAdmin: Cargando inventario...');
      
      const response = await inventoryService.getInventory();
      
      let inventoryData = [];
      // La API devuelve { success: true, data: { products: [...], total, page, ... } }
      if (response?.success && response?.data?.products && Array.isArray(response.data.products)) {
        inventoryData = response.data.products;
      } else if (response?.data && Array.isArray(response.data)) {
        inventoryData = response.data;
      } else if (Array.isArray(response)) {
        inventoryData = response;
      }
      
      setInventory(inventoryData);
      setLastRefreshTime(markRefreshed());
      logger.debug('✅ InventoryAdmin: Inventario cargado, productos:', inventoryData.length);
    } catch (error) {
      console.error('❌ InventoryAdmin: Error al cargar inventario:', error);
      setError('Error al cargar el inventario');
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  // Crea o actualiza un producto según haya editingItem.
  // Convierte los campos numéricos del formulario antes de enviarlos al API.
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const processedData = {
        ...formData,
        initialStock: formData.initialStock ? parseInt(formData.initialStock, 10) : 0,
        entries: formData.entries ? parseInt(formData.entries, 10) : 0,
        exits: formData.exits ? parseInt(formData.exits, 10) : 0,
        stock: formData.initialStock ? parseInt(formData.initialStock, 10) : 0, // Stock calculado = inicial
        minStock: formData.minStock ? parseInt(formData.minStock, 10) : 0,
        realStock: formData.realStock ? parseInt(formData.realStock, 10) : undefined,
        price: formData.price ? parseFloat(formData.price) : 0
      };

      if (editingItem) {
        await inventoryService.updateInventoryItem(editingItem._id, processedData);
        setSuccess('Producto actualizado exitosamente');
      } else {
        await inventoryService.createInventoryItem(processedData);
        setSuccess('Producto creado exitosamente');
      }
      
      resetForm();
      setShowProductModal(false);
      loadInventory();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error al guardar producto:', error);
      setError(error.message || 'Error al guardar el producto');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Restablece el formulario de producto y sale del modo edición
  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      category: 'insumos',
      initialStock: '',
      entries: '',
      exits: '',
      minStock: '',
      realStock: '',
      price: '',
      description: ''
    });
    setEditingItem(null);
  };

  // Prellena el formulario con el ítem y abre el modal en modo edición
  const handleEdit = (item) => {
    setFormData({
      name: item.name,
      code: item.code || '',
      category: item.category,
      initialStock: item.initialStock?.toString() || '',
      entries: item.entries?.toString() || '',
      exits: item.exits?.toString() || '',
      minStock: item.minStock?.toString() || '',
      realStock: item.realStock?.toString() || '',
      price: item.price?.toString() || '',
      description: item.description || ''
    });
    setEditingItem(item);
    setShowProductModal(true);
  };

  // Abre el modal de confirmación de eliminación del producto
  const handleDelete = (item) => {
    setItemToDelete(item);
    setDeletionReason('');
    setShowDeleteModal(true);
  };

  // Elimina el producto confirmado y recarga el inventario
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      await inventoryService.deleteInventoryItem(itemToDelete._id);
      setSuccess('Producto eliminado exitosamente');
      loadInventory();
      setShowDeleteModal(false);
      setItemToDelete(null);
      setDeletionReason('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      setError('Error al eliminar el producto');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Cancela la eliminación y limpia el estado del modal
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setItemToDelete(null);
    setDeletionReason('');
  };

  // Abre el modal de producto en modo creación con el formulario limpio
  const handleNewProduct = () => {
    resetForm();
    setShowProductModal(true);
  };

  // Reinicia los datos del formulario de movimiento (entrada o salida)
  const resetMovementData = (type = 'entry') => {
    setMovementData({ type, quantity: '', reason: '', notes: '', cost: '', paymentMethod: 'efectivo' });
  };

  // Abre el modal de entrada de stock para el ítem
  const handleEntry = (item) => {
    setSelectedItem(item);
    resetMovementData('entry');
    setShowEntryModal(true);
  };

  // Abre el modal de salida de stock para el ítem
  const handleExit = (item) => {
    setSelectedItem(item);
    resetMovementData('exit');
    setShowExitModal(true);
  };

  // Abre el modal de venta directa (cantidad inicial 1)
  const handleSale = (item) => {
    setSelectedItem(item);
    setSaleData({ quantity: '1' });
    setShowSaleModal(true);
  };

  // Abre el modal de conteo físico, precargando el stock real actual
  const handleCount = (item) => {
    setSelectedItem(item);
    setCountData({
      realStock: item.realStock || item.stock || '',
      entries: '',
      exits: '',
      notes: ''
    });
    setShowCountModal(true);
  };

  // Cierra el modal de snapshot y recarga el inventario tras crearlo
  const handleSnapshotCreated = () => {
    setShowSnapshotModal(false);
    loadInventory(); // Recargar inventario después de crear snapshot
  };

  // Determina el estado visual del stock (sin stock, bajo o normal) según el mínimo
  const getStockStatus = (item) => {
    const realStock = item.realStock || item.stock || item.currentStock || item.quantity || 0;
    const minStock = item.minStock || 0;
    
    if (realStock <= 0) return { status: 'out', label: 'Sin stock', color: 'text-red-400', bgColor: 'bg-red-500/10' };
    if (realStock <= minStock) return { status: 'low', label: 'Stock bajo', color: 'text-amber-400', bgColor: 'bg-amber-500/10' };
    return { status: 'good', label: 'Stock normal', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' };
  };

  // Función para filtrar y ordenar el inventario
  // Búsqueda por nombre/categoría y orden por alfabético, fecha, categoría o stock
  const filteredAndSortedInventory = () => {
    let filtered = Array.isArray(inventory) ? inventory.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    // Ordenamiento
    switch (sortBy) {
      case 'alphabetical':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'createdAt':
        filtered.sort((a, b) => new Date(b.createdAt || b._id) - new Date(a.createdAt || a._id));
        break;
      case 'category':
        filtered.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case 'stock':
        filtered.sort((a, b) => {
          const stockA = a.realStock || a.stock || a.currentStock || a.quantity || 0;
          const stockB = b.realStock || b.stock || b.currentStock || b.quantity || 0;
          return stockB - stockA; // Mayor stock primero
        });
        break;
      default:
        break;
    }

    return filtered;
  };

  const filteredInventory = filteredAndSortedInventory();

  // Mostrar máximo 100 productos en el flujo normal de la página.
  // Si hay más, se limita a 100 y el grid habilita scroll interno.
  const exceedsVisibleLimit = filteredInventory.length > MAX_VISIBLE_PRODUCTS;
  const visibleInventory = exceedsVisibleLimit
    ? filteredInventory.slice(0, MAX_VISIBLE_PRODUCTS)
    : filteredInventory;

  // Registra una entrada o salida de stock.
  // Si es entrada con costo, el backend también registra el gasto asociado.
  const handleMovementSubmit = async (e) => {
    e.preventDefault();
    try {
      const quantity = parseInt(movementData.quantity);
      
      // Preparar datos para el ajuste de stock
      const adjustmentData = {
        quantity,
        type: movementData.type === 'entry' ? 'add' : 'remove',
        reason: movementData.reason,
        notes: movementData.notes
      };

      // Si es una entrada y tiene costo, agregar campos de costo
      if (movementData.type === 'entry' && movementData.cost && parseFloat(movementData.cost) > 0) {
        adjustmentData.cost = parseFloat(movementData.cost);
        adjustmentData.paymentMethod = mapPaymentMethodToBackend(movementData.paymentMethod);
      }

      await inventoryService.adjustStock(selectedItem._id, adjustmentData);
      
      const successMessage = movementData.type === 'entry' && movementData.cost && parseFloat(movementData.cost) > 0
        ? `Entrada de ${quantity} unidades registrada exitosamente y gasto de $${parseFloat(movementData.cost).toFixed(2)} agregado`
        : `Movimiento registrado exitosamente: ${movementData.type === 'entry' ? 'Entrada' : 'Salida'} de ${quantity} unidades`;
      
      setSuccess(successMessage);
      
      setMovementData({ type: 'entry', quantity: '', reason: '', notes: '', cost: '', paymentMethod: 'efectivo' });
      setShowEntryModal(false);
      setShowExitModal(false);
      loadInventory();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error al registrar movimiento:', error);
      setError('Error al registrar el movimiento');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Registra una venta directa del producto: valida stock, crea la venta vía API
  // y actualiza el inventario (stock, salidas y contador de ventas).
  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    try {
      const quantity = parseInt(saleData.quantity);
      const currentStock = selectedItem.stock || selectedItem.currentStock || selectedItem.quantity || 0;
      
      if (quantity > currentStock) {
        setError('No hay suficiente stock para realizar esta venta');
        setTimeout(() => setError(''), 3000);
        return;
      }
      
      const salePayload = {
        productId: selectedItem._id,
        quantity: quantity,
        barberId: user._id, // Usar el ID del usuario actual
        customerName: `Venta directa - ${user.name}`, // Asignar automáticamente
        notes: `Venta registrada por ${user.name} desde inventario`
      };
      
      const response = await fetch('/api/v1/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(salePayload)
      });
      
      if (!response.ok) {
        throw new Error('Error al registrar la venta');
      }
      
      const newCurrentStock = currentStock - quantity;
      const newExits = (selectedItem.exits || 0) + quantity;
      const newSales = (selectedItem.sales || 0) + quantity; // Agregar a ventas también
      
      const updateData = {
        ...selectedItem,
        stock: newCurrentStock,
        exits: newExits,
        sales: newSales, // Incluir campo de ventas
        quantity: newCurrentStock
      };
      
      await inventoryService.updateInventoryItem(selectedItem._id, updateData);
      
      setSuccess(`Venta registrada exitosamente: ${quantity} unidades`);
      setSaleData({ quantity: '1' });
      setShowSaleModal(false);
      loadInventory();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error al registrar venta:', error);
      setError('Error al registrar la venta');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Registra un conteo físico: guarda el stock real y acumula entradas/salidas manuales
  const handleCountSubmit = async (e) => {
    e.preventDefault();
    try {
      const realStock = parseInt(countData.realStock) || 0;
      const entries = parseInt(countData.entries) || 0;
      const exits = parseInt(countData.exits) || 0;
      
      const updateData = {
        ...selectedItem,
        realStock: realStock,
        entries: (selectedItem.entries || 0) + entries,
        exits: (selectedItem.exits || 0) + exits,
        notes: countData.notes
      };
      
      await inventoryService.updateInventoryItem(selectedItem._id, updateData);
      
      setSuccess(`Conteo registrado exitosamente para ${selectedItem.name}`);
      setCountData({ realStock: '', entries: '', exits: '', notes: '' });
      setShowCountModal(false);
      loadInventory();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error al registrar conteo:', error);
      setError('Error al registrar el conteo');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Función para exportar inventario a Excel — dynamic import para no bloquear bundle (Fase 5 polish)
  // Calcula stock esperado/diferencia por producto, aplica estilos y descarga el .xlsx
  const exportToExcel = async () => {
    try {
      const { default: ExcelJS } = await import('exceljs');
      // Preparar datos para Excel
      const excelData = filteredInventory.map(item => {
        const initialStock = item.initialStock || 0;
        const entries = item.entries || 0;
        const exits = item.exits || 0;
        const sales = item.sales || 0;
        const currentStock = item.stock || item.currentStock || item.quantity || 0;
        const realStock = item.realStock !== undefined ? item.realStock : currentStock;
        const expectedStock = initialStock + entries - exits - sales;
        const difference = realStock - expectedStock;

        return {
          'Producto': item.name || '',
          'Categoría': item.category ? item.category.replace('_', ' ').toUpperCase() : '',
          'Código': item.code || '',
          'Stock Inicial': initialStock,
          'Entradas': entries,
          'Salidas': exits,
          'Ventas': sales,
          'Stock Sistema': expectedStock,
          'Stock Real': realStock,
          'Diferencia': difference,
          'Stock Mínimo': item.minStock || 0,
          'Estado': realStock <= 0 ? 'Sin Stock' : realStock <= (item.minStock || 0) ? 'Stock Bajo' : 'Normal',
          'Precio': item.price ? `$${item.price.toLocaleString('es-CO')}` : '$0',
          'Descripción': item.description || ''
        };
      });

      // Crear workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Inventario');

      // Definir columnas con anchos calculados
      const headers = Object.keys(excelData[0] || {});
      worksheet.columns = headers.map(header => {
        const maxWidth = Math.max(
          header.length,
          ...excelData.map(row => (row[header] || '').toString().length)
        );
        return {
          header: header,
          key: header,
          width: Math.min(Math.max(maxWidth + 2, 10), 50)
        };
      });

      // Agregar datos
      excelData.forEach(row => {
        const addedRow = worksheet.addRow(row);
        
        // Colorear diferencias negativas en rojo
        const diffCell = addedRow.getCell('Diferencia');
        if (row['Diferencia'] < 0) {
          diffCell.font = { color: { argb: 'FFFF0000' }, bold: true };
        } else if (row['Diferencia'] > 0) {
          diffCell.font = { color: { argb: 'FF008000' } };
        }

        // Colorear estado
        const statusCell = addedRow.getCell('Estado');
        if (row['Estado'] === 'Sin Stock') {
          statusCell.font = { color: { argb: 'FFFF0000' }, bold: true };
        } else if (row['Estado'] === 'Stock Bajo') {
          statusCell.font = { color: { argb: 'FFFF8800' } };
        }
      });

      // Estilo para header
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Generar y descargar
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const now = new Date();
      const fileName = `inventario_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}.xlsx`;
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(`Inventario exportado exitosamente: ${fileName}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error al exportar inventario:', error);
      setError('Error al exportar el inventario');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Pide confirmación y ejecuta la corrección de inconsistencias de stock en el backend
  const handleFixConsistency = async () => {
    if (!window.confirm('¿Estás seguro de que deseas corregir las inconsistencias del inventario?\n\nEsto ajustará los stocks para que coincidan con las ventas registradas.')) {
      return;
    }

    try {
      setLoading(true);
      setSuccess('Corrigiendo inconsistencias del inventario...');
      
      const response = await inventoryService.fixConsistency();
      
      if (response.success) {
        setSuccess(`Inconsistencias corregidas: ${response.fixed || 0} productos actualizados`);
        loadInventory(); // Recargar inventario para ver los cambios
      } else {
        setError('Error al corregir inconsistencias');
      }
      
      setTimeout(() => setSuccess(''), 5000);
    } catch (error) {
      console.error('Error al corregir inconsistencias:', error);
      setError(error.message || 'Error al corregir inconsistencias');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Formulario reutilizable para entrada/salida de stock (cambia según el tipo;
  // las entradas permiten registrar costo y método de pago como gasto).
  const renderMovementForm = (type) => {
    const isEntry = type === 'entry';
    return (
      <form id={`movement-form-${type}`} onSubmit={handleMovementSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Cantidad</label>
            <input
              type="number"
              value={movementData.quantity}
              onChange={(e) => setMovementData({...movementData, quantity: e.target.value})}
              className="glassmorphism-input w-full"
              min="1"
              placeholder="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Motivo</label>
            <input
              type="text"
              value={movementData.reason}
              onChange={(e) => setMovementData({...movementData, reason: e.target.value})}
              className="glassmorphism-input w-full"
              placeholder={isEntry ? 'Ej: Compra, Devolución, Reposición' : 'Ej: Pérdida, Daño, Uso interno'}
              required
            />
          </div>
        </div>

        {isEntry && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-4">
            <h4 className="text-sm font-medium text-emerald-300 flex items-center gap-2">
              <DollarSign size={16} />
              Información de Costo (Opcional)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Costo Total
                  <span className="text-gray-500 text-xs ml-1">(Se registrará como gasto automáticamente)</span>
                </label>
                <input
                  type="number"
                  value={movementData.cost}
                  onChange={(e) => setMovementData({...movementData, cost: e.target.value})}
                  className="glassmorphism-input w-full"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Método de Pago</label>
                <select
                  value={movementData.paymentMethod}
                  onChange={(e) => setMovementData({...movementData, paymentMethod: e.target.value})}
                  className="glassmorphism-select w-full"
                >
                  {paymentMethods.map(method => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Notas Adicionales
            <span className="text-gray-500 text-xs ml-1">(Opcional)</span>
          </label>
          <textarea
            value={movementData.notes}
            onChange={(e) => setMovementData({...movementData, notes: e.target.value})}
            className="glassmorphism-textarea w-full"
            rows={3}
            placeholder="Observaciones adicionales del movimiento..."
          />
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <h4 className="text-sm font-medium text-blue-300 mb-3">Producto Seleccionado</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-gray-400">Stock actual:</span>
              <span className="text-white ml-2">{selectedItem?.stock ?? 0}</span>
            </div>
            <div>
              <span className="text-gray-400">Categoría:</span>
              <span className="text-white ml-2">{selectedItem?.category?.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div>
              <span className="text-gray-400">Precio:</span>
              <span className="text-emerald-400 ml-2 font-semibold">${selectedItem?.price || 0}</span>
            </div>
          </div>
        </div>
      </form>
    );
  };

  return (
    <>
      <PageContainer>
        <div className="relative z-10 w-full pb-6 space-y-5">
          {/* ── Top bar ── */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Título */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Package2 className="w-5 h-5 sm:w-6 sm:h-6 text-brand-300" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">Gestión de Inventario</h1>
                <p className="text-xs sm:text-sm text-gray-400">
                  {exceedsVisibleLimit
                    ? `Mostrando ${MAX_VISIBLE_PRODUCTS} de ${filteredInventory.length} productos`
                    : `${filteredInventory.length} producto${filteredInventory.length !== 1 ? 's' : ''} en inventario`}
                </p>
              </div>
            </div>

            {/* Acciones */}
            {/* Botones de administrador: crear, exportar, snapshot, inventarios guardados e historial */}
            <div className="flex-1 flex flex-wrap items-center gap-2 lg:justify-end">
              {user?.role === 'admin' && (
                <GradientButton
                  onClick={handleNewProduct}
                  className="text-sm px-4 py-2.5 shadow-soft"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>Nuevo Producto</span>
                  </div>
                </GradientButton>
              )}

              {user?.role === 'admin' && (
                <button
                  onClick={exportToExcel}
                  disabled={filteredInventory.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-emerald-500/30 rounded-xl text-gray-300 hover:text-emerald-300 text-xs sm:text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar</span>
                </button>
              )}

              {user?.role === 'admin' && (
                <button
                  onClick={() => setShowSnapshotModal(true)}
                  disabled={filteredInventory.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-blue-500/30 rounded-xl text-gray-300 hover:text-blue-300 text-xs sm:text-sm font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">Guardar</span>
                </button>
              )}

              {user?.role === 'admin' && (
                <button
                  onClick={() => setShowSavedInventoriesModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-brand-500/30 rounded-xl text-gray-300 hover:text-brand-300 text-xs sm:text-sm font-medium transition-colors duration-200"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">Ver</span>
                </button>
              )}

              {user?.role === 'admin' && (
                <button
                  onClick={() => setShowLogsModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-amber-500/30 rounded-xl text-gray-300 hover:text-amber-300 text-xs sm:text-sm font-medium transition-colors duration-200"
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Historial</span>
                </button>
              )}
            </div>
          </div>

        {/* Mensajes de error y éxito */}
        {/* Alertas temporales de la página (se autolimpian a los pocos segundos) */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-xl backdrop-blur-sm flex items-center gap-2 shadow-soft">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl backdrop-blur-sm flex items-center gap-2 shadow-soft">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Container principal */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm overflow-hidden">

          {/* Toolbar: búsqueda + orden + corrección */}
          {/* Filtros de la tabla; "Corregir" solo para admin */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center p-4 border-b border-white/[0.08]">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glassmorphism-input pl-9"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="glassmorphism-select sm:w-48"
            >
              <option value="alphabetical">Alfabético (A-Z)</option>
              <option value="createdAt">Fecha de Creación</option>
              <option value="category">Por Categoría</option>
              <option value="stock">Por Stock</option>
            </select>

            {user?.role === 'admin' && (
              <button
                onClick={handleFixConsistency}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white/[0.03] hover:bg-red-500/10 border border-white/[0.08] hover:border-red-500/30 rounded-xl text-gray-400 hover:text-red-300 text-xs sm:text-sm font-medium transition-colors duration-200 flex-shrink-0"
                title="Corregir inconsistencias en el inventario"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">Corregir</span>
              </button>
            )}
          </div>

              {/* ── Tabla tipo Excel (fluye con la página; scroll interno solo si supera el límite) ── */}
              <div
                className={`overflow-x-auto custom-scrollbar ${exceedsVisibleLimit ? 'max-h-[70vh] overflow-y-auto' : ''}`}
              >
                <div className="min-w-[940px]">
                  {/* Encabezado */}
                  <div className={`grid grid-cols-12 bg-[#151821] border-b border-white/[0.10] text-[11px] font-semibold uppercase tracking-wide sticky top-0 z-20`}>
                    <div className="sticky left-0 z-10 col-span-2 px-3 py-3 border-r border-white/[0.06] text-gray-400 bg-[#151821]">Producto</div>
                    <div className="col-span-1 px-2 py-3 border-r border-white/[0.06] text-center text-gray-400">Inicial</div>
                    <div className="col-span-1 px-2 py-3 border-r border-white/[0.06] text-center text-emerald-400">Entradas</div>
                    <div className="col-span-1 px-2 py-3 border-r border-white/[0.06] text-center text-red-400">Salidas</div>
                    <div className="col-span-1 px-2 py-3 border-r border-white/[0.06] text-center text-amber-400">Ventas</div>
                    <div className="col-span-1 px-2 py-3 border-r border-white/[0.06] text-center text-brand-300">Esperado</div>
                    <div className="col-span-1 px-2 py-3 border-r border-white/[0.06] text-center text-blue-400">Real</div>
                    <div className="col-span-1 px-2 py-3 border-r border-white/[0.06] text-center text-amber-400">Dif.</div>
                    <div className="col-span-1 px-2 py-3 border-r border-white/[0.06] text-center text-blue-400">Estado</div>
                    <div className="col-span-2 px-3 py-3 text-center text-gray-400">Acciones</div>
                  </div>

                  {/* Filas */}
                  {loading ? (
                    <InventorySkeleton rows={8} />
                  ) : visibleInventory.length === 0 ? (
                    <div className="p-12 text-center">
                      <Package2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">No hay productos en el inventario</p>
                    </div>
                  ) : (
                    visibleInventory.map((item) => {
                      // Métricas de la fila: esperado = inicial + entradas - salidas - ventas
                      const stockStatus = getStockStatus(item);
                      const currentStock = item.stock || item.currentStock || item.quantity || 0;
                      const initialStock = item.initialStock || 0;
                      const entries = item.entries || 0;
                      const exits = item.exits || 0;
                      const sales = item.sales || 0;
                      const realStock = item.realStock || currentStock;
                      const expectedStock = initialStock + entries - exits - sales;
                      const difference = realStock - expectedStock;

                      return (
                        <div
                          key={item._id}
                          className="grid grid-cols-12 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.04] transition-colors duration-150 odd:bg-white/[0.015]"
                        >
                          {/* Producto */}
                          <div className="sticky left-0 z-10 col-span-2 px-3 py-2.5 border-r border-white/[0.05] flex flex-col justify-center min-w-0 bg-[#14171d]">
                            <p className="text-sm font-medium text-white truncate" title={item.name}>{item.name}</p>
                            <p className="text-[11px] text-gray-500 capitalize truncate">{item.category?.replace('_', ' ')}</p>
                          </div>

                          {/* Inicial */}
                          <div className="col-span-1 px-2 py-2.5 border-r border-white/[0.05] flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-300 tabular-nums">{initialStock}</span>
                          </div>

                          {/* Entradas */}
                          <div className="col-span-1 px-2 py-2.5 border-r border-white/[0.05] flex items-center justify-center">
                            <span className="text-sm font-medium text-emerald-400 tabular-nums">{entries}</span>
                          </div>

                          {/* Salidas */}
                          <div className="col-span-1 px-2 py-2.5 border-r border-white/[0.05] flex items-center justify-center">
                            <span className="text-sm font-medium text-red-400 tabular-nums">{exits}</span>
                          </div>

                          {/* Ventas */}
                          <div className="col-span-1 px-2 py-2.5 border-r border-white/[0.05] flex items-center justify-center">
                            <span className="text-sm font-medium text-amber-400 tabular-nums">{sales}</span>
                          </div>

                          {/* Esperado */}
                          <div className="col-span-1 px-2 py-2.5 border-r border-white/[0.05] flex items-center justify-center">
                            <span className="text-sm font-medium text-brand-300 tabular-nums">{expectedStock}</span>
                          </div>

                          {/* Real */}
                          <div className="col-span-1 px-2 py-2.5 border-r border-white/[0.05] flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-400 tabular-nums">{realStock}</span>
                          </div>

                          {/* Diferencia */}
                          <div className="col-span-1 px-2 py-2.5 border-r border-white/[0.05] flex items-center justify-center">
                            <span
                              className={`text-sm font-semibold tabular-nums cursor-help ${
                                difference === 0 ? 'text-gray-500' :
                                difference > 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                              title={
                                difference === 0 ? 'Inventario consistente' :
                                difference > 0 ? `Sobrante de ${difference} unidades` :
                                `Faltante de ${Math.abs(difference)} unidades. Puede deberse a reembolsos o conteos manuales.`
                              }
                            >
                              {difference === 0 ? '0' : difference > 0 ? `+${difference}` : `${difference}`}
                            </span>
                          </div>

                          {/* Estado */}
                          <div className="col-span-1 px-2 py-2.5 border-r border-white/[0.05] flex items-center justify-center">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${stockStatus.bgColor} ${stockStatus.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                stockStatus.status === 'out' ? 'bg-red-400' :
                                stockStatus.status === 'low' ? 'bg-amber-400' : 'bg-emerald-400'
                              }`} />
                              {stockStatus.status === 'out' ? 'Sin' : stockStatus.status === 'low' ? 'Bajo' : 'OK'}
                            </span>
                          </div>

                          {/* Acciones */}
                          {/* Admin: editar, entrada, salida, venta y eliminar; otros roles: solo conteo */}
                          <div className="col-span-2 px-3 py-2.5 flex items-center justify-center gap-1">
                            {user?.role === 'admin' ? (
                              <>
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-2 min-h-11 min-w-11 flex items-center justify-center rounded-md text-blue-400 hover:bg-blue-500/15 transition-colors duration-150"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleEntry(item)}
                                  className="p-2 min-h-11 min-w-11 flex items-center justify-center rounded-md text-emerald-400 hover:bg-emerald-500/15 transition-colors duration-150"
                                  title="Agregar stock (entrada)"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleExit(item)}
                                  className="p-2 min-h-11 min-w-11 flex items-center justify-center rounded-md text-red-400 hover:bg-red-500/15 transition-colors duration-150"
                                  title="Retirar stock (salida)"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleSale(item)}
                                  className="p-1.5 rounded-md text-brand-300 hover:bg-brand-500/15 transition-colors duration-150"
                                  title="Venta"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item)}
                                  className="p-2 min-h-11 min-w-11 flex items-center justify-center rounded-md text-red-400 hover:bg-red-500/15 transition-colors duration-150"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleCount(item)}
                                className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/15 transition-colors duration-150"
                                title="Conteo de Stock"
                              >
                                <Calculator className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
      </PageContainer>

      {/* Modal de Snapshot */}
      <InventorySnapshot
        isOpen={showSnapshotModal}
        onClose={() => setShowSnapshotModal(false)}
        inventory={inventory}
        onSnapshotCreated={handleSnapshotCreated}
        onInventoryReset={loadInventory}
      />

      {/* Modal de Inventarios Guardados */}
      <SavedInventoriesModal
        isOpen={showSavedInventoriesModal}
        onClose={() => setShowSavedInventoriesModal(false)}
      />

      {/* Modal de Historial de Inventario */}
      <InventoryLogsModal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
        onRefresh={loadInventory}
      />

      {/* Modal: Nuevo / Editar Producto */}
      <Modal
        isOpen={showProductModal}
        onClose={() => { resetForm(); setShowProductModal(false); }}
        title={editingItem ? 'Editar Producto' : 'Nuevo Producto'}
        subtitle={editingItem ? editingItem.name : 'Completa los datos del producto'}
        icon={editingItem ? Edit : PackagePlus}
        iconClassName="text-brand-300"
        iconBoxClassName="bg-brand-500/10 border-brand-500/20"
        accentClassName="bg-[#151821] border-white/[0.10]"
        size="2xl"
        footer={
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => { resetForm(); setShowProductModal(false); }}
              className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <GradientButton type="submit" form="product-form" size="sm" className="shadow-soft">
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                {editingItem ? 'Actualizar Producto' : 'Crear Producto'}
              </span>
            </GradientButton>
          </div>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nombre</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="glassmorphism-input w-full"
                placeholder="Nombre del producto"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Código</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value})}
                className="glassmorphism-input w-full"
                placeholder="Ej: PRD001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Categoría</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="glassmorphism-select w-full"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Stock Inicial</label>
              <input
                type="number"
                value={formData.initialStock}
                onChange={(e) => setFormData({...formData, initialStock: e.target.value})}
                className="glassmorphism-input w-full"
                min="0"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Stock Mínimo</label>
              <input
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                className="glassmorphism-input w-full"
                min="0"
                placeholder="0"
              />
            </div>
            {user?.role === 'admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Stock Real (Conteo)</label>
                <input
                  type="number"
                  value={formData.realStock || ''}
                  onChange={(e) => setFormData({...formData, realStock: e.target.value})}
                  className="glassmorphism-input w-full"
                  min="0"
                  placeholder="Stock físico contado"
                />
                <p className="text-xs text-blue-400/70 mt-1">Stock físico verificado por conteo manual</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Precio</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                className="glassmorphism-input w-full"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Descripción</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="glassmorphism-input w-full"
                placeholder="Descripción del producto (opcional)"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Entrada de Stock */}
      <Modal
        isOpen={showEntryModal && !!selectedItem}
        onClose={() => { setShowEntryModal(false); resetMovementData('entry'); }}
        title="Entrada de Stock"
        subtitle={selectedItem?.name}
        icon={Plus}
        iconClassName="text-emerald-400"
        iconBoxClassName="bg-emerald-500/10 border-emerald-500/20"
        accentClassName="bg-emerald-500/5 border-emerald-500/20"
        size="xl"
        footer={
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => { setShowEntryModal(false); resetMovementData('entry'); }}
              className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <GradientButton type="submit" form="movement-form-entry" size="sm" className="shadow-soft">
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Registrar Entrada
              </span>
            </GradientButton>
          </div>
        }
      >
        {renderMovementForm('entry')}
      </Modal>

      {/* Modal: Salida de Stock */}
      <Modal
        isOpen={showExitModal && !!selectedItem}
        onClose={() => { setShowExitModal(false); resetMovementData('exit'); }}
        title="Salida de Stock"
        subtitle={selectedItem?.name}
        icon={Minus}
        iconClassName="text-red-400"
        iconBoxClassName="bg-red-500/10 border-red-500/20"
        accentClassName="bg-red-500/5 border-red-500/20"
        size="xl"
        footer={
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => { setShowExitModal(false); resetMovementData('exit'); }}
              className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <GradientButton type="submit" form="movement-form-exit" size="sm" className="shadow-soft">
              <span className="flex items-center gap-2">
                <Minus className="w-4 h-4" />
                Registrar Salida
              </span>
            </GradientButton>
          </div>
        }
      >
        {renderMovementForm('exit')}
      </Modal>

      {/* Modal: Venta Directa */}
      <Modal
        isOpen={showSaleModal && !!selectedItem}
        onClose={() => { setShowSaleModal(false); setSaleData({ quantity: '1' }); }}
        title="Registrar Venta"
        subtitle={selectedItem?.name}
        icon={ShoppingCart}
        iconClassName="text-emerald-400"
        iconBoxClassName="bg-emerald-500/10 border-emerald-500/20"
        accentClassName="bg-[#151821] border-white/[0.10]"
        size="xl"
        footer={
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => { setShowSaleModal(false); setSaleData({ quantity: '1' }); }}
              className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <GradientButton type="submit" form="sale-form" size="sm" className="shadow-soft">
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Registrar Venta
              </span>
            </GradientButton>
          </div>
        }
      >
        <form id="sale-form" onSubmit={handleSaleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cantidad a Vender</label>
              <input
                type="number"
                value={saleData.quantity}
                onChange={(e) => setSaleData({...saleData, quantity: e.target.value})}
                className="glassmorphism-input w-full text-lg text-center font-semibold"
                min="1"
                max={selectedItem?.stock || selectedItem?.currentStock || selectedItem?.quantity || 0}
                placeholder="0"
                required
              />
              <p className="text-xs text-gray-400 mt-2 text-center">
                Stock disponible: <span className="text-emerald-400 font-medium">{selectedItem?.stock || selectedItem?.currentStock || selectedItem?.quantity || 0}</span> unidades
              </p>
            </div>
            <div className="flex flex-col justify-center">
              <label className="block text-sm font-medium text-gray-300 mb-2">Total a Pagar</label>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 text-center">
                <div className="text-xs text-emerald-300 mb-1">Total</div>
                <span className="text-3xl font-bold text-emerald-400">
                  ${((parseFloat(saleData.quantity) || 0) * (parseFloat(selectedItem?.price) || 0)).toFixed(2)}
                </span>
                <div className="text-xs text-gray-400 mt-2">
                  {saleData.quantity || 0} × ${selectedItem?.price || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <h4 className="text-sm font-medium text-blue-300 mb-3">Detalles del Producto</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Precio unitario:</span>
                <span className="text-emerald-400 ml-2 font-semibold">${selectedItem?.price || 0}</span>
              </div>
              <div>
                <span className="text-gray-400">Categoría:</span>
                <span className="text-white ml-2">{selectedItem?.category?.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div>
                <span className="text-gray-400">Stock después:</span>
                <span className="text-blue-400 ml-2 font-semibold">
                  {(selectedItem?.stock || 0) - (parseInt(saleData.quantity) || 0)} unidades
                </span>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Conteo de Stock */}
      <Modal
        isOpen={showCountModal && !!selectedItem}
        onClose={() => { setShowCountModal(false); setCountData({ realStock: '', entries: '', exits: '', notes: '' }); }}
        title="Conteo de Stock"
        subtitle={selectedItem?.name}
        icon={Calculator}
        iconClassName="text-amber-400"
        iconBoxClassName="bg-amber-500/10 border-amber-500/20"
        accentClassName="bg-[#151821] border-white/[0.10]"
        size="xl"
        footer={
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => { setShowCountModal(false); setCountData({ realStock: '', entries: '', exits: '', notes: '' }); }}
              className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <GradientButton type="submit" form="count-form" size="sm" className="shadow-soft">
              <span className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Guardar Conteo
              </span>
            </GradientButton>
          </div>
        }
      >
        <form id="count-form" onSubmit={handleCountSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Stock Físico Contado</label>
              <input
                type="number"
                value={countData.realStock}
                onChange={(e) => setCountData({...countData, realStock: e.target.value})}
                className="glassmorphism-input w-full text-lg text-center font-semibold"
                min="0"
                placeholder="Ingrese stock real"
                required
              />
              <p className="text-xs text-gray-400 mt-1 text-center">Stock verificado físicamente</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Entradas Adicionales</label>
              <input
                type="number"
                value={countData.entries}
                onChange={(e) => setCountData({...countData, entries: e.target.value})}
                className="glassmorphism-input w-full text-lg text-center"
                min="0"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1 text-center">Productos recibidos</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Salidas Adicionales</label>
              <input
                type="number"
                value={countData.exits}
                onChange={(e) => setCountData({...countData, exits: e.target.value})}
                className="glassmorphism-input w-full text-lg text-center"
                min="0"
                placeholder="0"
              />
              <p className="text-xs text-gray-400 mt-1 text-center">Productos enviados</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            {/* Comparativa: stock esperado (sistema) vs stock actual vs diferencia */}
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Stock Esperado</div>
              <div className="text-lg font-bold text-brand-300">
                {(selectedItem?.initialStock || 0) + (selectedItem?.entries || 0) - (selectedItem?.exits || 0) - (selectedItem?.sales || 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Stock Actual</div>
              <div className="text-lg font-bold text-blue-400">
                {selectedItem?.realStock || selectedItem?.stock || 0}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Diferencia</div>
              <div className={`text-lg font-bold ${
                ((selectedItem?.realStock || selectedItem?.stock || 0) - ((selectedItem?.initialStock || 0) + (selectedItem?.entries || 0) - (selectedItem?.exits || 0) - (selectedItem?.sales || 0))) >= 0
                  ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {((selectedItem?.realStock || selectedItem?.stock || 0) - ((selectedItem?.initialStock || 0) + (selectedItem?.entries || 0) - (selectedItem?.exits || 0) - (selectedItem?.sales || 0))) >= 0 ? '+' : ''}
                {(selectedItem?.realStock || selectedItem?.stock || 0) - ((selectedItem?.initialStock || 0) + (selectedItem?.entries || 0) - (selectedItem?.exits || 0) - (selectedItem?.sales || 0))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notas del Conteo
              <span className="text-gray-500 text-xs ml-1">(Opcional)</span>
            </label>
            <textarea
              value={countData.notes}
              onChange={(e) => setCountData({...countData, notes: e.target.value})}
              className="glassmorphism-textarea w-full"
              rows={3}
              placeholder="Observaciones del conteo, discrepancias encontradas, etc."
            />
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmación de Eliminación */}
      <Modal
        isOpen={showDeleteModal && !!itemToDelete}
        onClose={handleCancelDelete}
        title="Eliminar Producto"
        icon={Trash2}
        iconClassName="text-red-400"
        iconBoxClassName="bg-red-500/10 border-red-500/20"
        accentClassName="bg-red-500/5 border-red-500/20"
        size="lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={handleCancelDelete}
              className="px-5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 border border-red-500/50 text-white text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Confirmar Eliminación
            </button>
          </div>
        }
      >
        {itemToDelete && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300 leading-relaxed">
              ¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
              <Package2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{itemToDelete.name}</p>
                <p className="text-gray-500 text-xs capitalize">
                  {itemToDelete.category?.replace('_', ' ')} • Stock: {itemToDelete.realStock || itemToDelete.stock || itemToDelete.currentStock || 0}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Motivo de eliminación <span className="text-gray-500">(opcional)</span>
              </label>
              <textarea
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="Escribe el motivo de la eliminación..."
                className="glassmorphism-textarea w-full"
                rows={3}
                maxLength={200}
              />
              <div className="text-right text-[11px] text-gray-500 mt-1">
                {deletionReason.length}/200 caracteres
              </div>
            </div>
          </div>
        )}
      </Modal>

    </>
  );
};

export default Inventory;

