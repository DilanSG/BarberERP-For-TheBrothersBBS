import InventoryUseCases from '../../core/application/usecases/InventoryUseCases.js';
import InventoryLogService from '../../core/application/usecases/InventoryLogUseCases.js';
import { InventoryLog, Inventory, Sale, AppError, logger } from '../../barrel.js';
import { asyncHandler } from '../middleware/index.js';
import { emitInventoryUpdated } from '../../services/websocketService.js';

// @desc    Obtener lista de items del inventario
// @route   GET /api/inventory
// @access  Privado
export const getInventory = asyncHandler(async (req, res) => {
  const filters = {};
  if (req.query.category) filters.category = req.query.category;
  if (req.query.minStock) filters.stock = { $lte: parseInt(req.query.minStock) };

  const items = await InventoryUseCases.getAllItems(filters);
  res.json({ 
    success: true, 
    count: items.length,
    data: items 
  });
});

// @desc    Obtener un item específico
// @route   GET /api/inventory/:id
// @access  Privado
export const getInventoryItem = asyncHandler(async (req, res) => {
  const item = await InventoryUseCases.getItemById(req.params.id);
  res.json({ success: true, data: item });
});

// @desc    Crear nuevo item
// @route   POST /api/inventory
// @access  Privado/Admin
export const createInventoryItem = asyncHandler(async (req, res) => {
  const item = await InventoryUseCases.createItem(req.body);
  
  // Registrar log de creación
  await InventoryLogService.createLog(
    'create',
    item._id,
    item.name,
    req.user._id,
    req.user.role,
    {
      message: `Producto "${item.name}" añadido al inventario`,
      category: item.category,
      initialStock: item.stock,
      price: item.price,
      minStock: item.minStock,
      description: `Nuevo producto agregado: ${item.name} - Categoría: ${item.category || 'Sin categoría'} - Stock inicial: ${item.stock || 0} unidades - Precio: $${item.price || 0}`
    },
    null,
    item
  );

  res.status(201).json({ 
    success: true, 
    message: 'Item creado exitosamente',
    data: item 
  });
});

// @desc    Actualizar item
// @route   PUT /api/inventory/:id
// @access  Privado/Admin
export const updateInventoryItem = asyncHandler(async (req, res) => {
  // Obtener estado anterior
  const previousItem = await InventoryUseCases.getItemById(req.params.id);
  const item = await InventoryUseCases.updateItem(req.params.id, req.body);
  
  // Detectar cambios específicos
  const changes = [];
  const fieldsTranslation = {
    name: 'Nombre',
    code: 'Código',
    category: 'Categoría',
    price: 'Precio',
    description: 'Descripción',
    minStock: 'Stock mínimo',
    unit: 'Unidad',
    initialStock: 'Stock inicial',
    entries: 'Entradas',
    exits: 'Salidas',
    sales: 'Ventas',
    realStock: 'Stock real',
    stock: 'Stock'
  };

  // Analizar cambios específicos
  Object.keys(req.body).forEach(field => {
    const oldValue = previousItem[field];
    const newValue = req.body[field];
    const fieldName = fieldsTranslation[field] || field;
    
    if (oldValue !== newValue) {
      if (field === 'price') {
        changes.push(`${fieldName}: $${oldValue || 0} → $${newValue || 0}`);
      } else if (field === 'category') {
        changes.push(`${fieldName}: "${oldValue || 'N/A'}" → "${newValue || 'N/A'}"`);
      } else if (field === 'minStock' || field === 'initialStock' || field === 'realStock' || field === 'stock' || field === 'entries' || field === 'exits') {
        changes.push(`${fieldName}: ${oldValue || 0} → ${newValue || 0}`);
      } else {
        changes.push(`${fieldName}: "${oldValue || 'N/A'}" → "${newValue || 'N/A'}"`);
      }
    }
  });
  
  // Detectar si es un movimiento de entrada o salida
  const isMovement = req.body.entries !== undefined || req.body.exits !== undefined;
  let logAction = 'update';
  let logDetails = {
    // Solo mostrar mensaje genérico si no hay cambios específicos
    message: changes.length > 0 
      ? null  // No mostrar mensaje cuando hay cambios específicos
      : `Item "${item.name}" actualizado`,
    updatedFields: Object.keys(req.body),
    changes: changes
  };

  if (isMovement) {
    const prevEntries = previousItem.entries || 0;
    const newEntries = item.entries || 0;
    const prevExits = previousItem.exits || 0;
    const newExits = item.exits || 0;
    
    if (newEntries > prevEntries) {
      // Es una entrada
      logAction = 'movement_entry';
      const quantity = newEntries - prevEntries;
      logDetails = {
        message: req.body.reason || `Entrada registrada: ${quantity} unidades`,
        quantity: quantity,
        reason: req.body.reason || 'Entrada de stock',
        notes: req.body.notes,
        oldStock: previousItem.stock || 0,
        newStock: item.stock || 0
      };
    } else if (newExits > prevExits) {
      // Es una salida
      logAction = 'movement_exit';
      const quantity = newExits - prevExits;
      logDetails = {
        message: req.body.reason || `Salida registrada: ${quantity} unidades`,
        quantity: quantity,
        reason: req.body.reason || 'Salida de stock',
        notes: req.body.notes,
        oldStock: previousItem.stock || 0,
        newStock: item.stock || 0
      };
    }
  }
  
  // Registrar log de actualización o movimiento
  await InventoryLogService.createLog(
    logAction,
    item._id,
    item.name,
    req.user._id,
    req.user.role,
    logDetails,
    previousItem,
    item
  );

  emitInventoryUpdated(item);

  res.json({ 
    success: true, 
    message: 'Item actualizado exitosamente',
    data: item 
  });
});

// @desc    Eliminar item
// @route   DELETE /api/inventory/:id
// @access  Privado/Admin
export const deleteInventoryItem = asyncHandler(async (req, res) => {
  // Obtener el item antes de eliminarlo para el log
  const item = await InventoryUseCases.getItemById(req.params.id);
  
  const result = await InventoryUseCases.deleteItem(req.params.id);
  
  // Registrar log de eliminación
  await InventoryLogService.createLog(
    'delete',
    item._id,
    item.name,
    req.user._id,
    req.user.role,
    {
      message: `Producto "${item.name}" eliminado del inventario`,
      previousStock: item.stock || item.currentStock || item.quantity || 0,
      category: item.category,
      price: item.price,
      description: `Producto eliminado: ${item.name} - Categoría: ${item.category || 'Sin categoría'} - Stock perdido: ${item.stock || item.currentStock || item.quantity || 0} unidades - Valor unitario: $${item.price || 0}`
    },
    item,
    null
  );
  
  res.json({ 
    success: true, 
    message: result.message 
  });
});

// @desc    Ajustar stock de un item
// @route   POST /api/inventory/:id/stock
// @access  Privado/Admin
export const adjustStock = asyncHandler(async (req, res) => {
  const { quantity, type, reason, cost, paymentMethod } = req.body;
  
  if (!quantity || !type || !reason) {
    throw new AppError('Cantidad, tipo y razón son requeridos', 400);
  }

  // Preparar opciones para el servicio
  const options = {
    userId: req.user._id
  };

  // Si es una entrada de inventario y tiene costo, agregarlo a las opciones
  if (type === 'add' && cost && cost > 0) {
    options.cost = parseFloat(cost);
    options.paymentMethod = paymentMethod || 'cash';
  }

  const item = await InventoryUseCases.adjustStock(
    req.params.id,
    Number(quantity),
    type,
    reason,
    options
  );

  emitInventoryUpdated(item);

  res.json({ 
    success: true, 
    message: type === 'add' && cost > 0 
      ? 'Stock ajustado exitosamente y gasto registrado' 
      : 'Stock ajustado exitosamente',
    data: item 
  });
});

// @desc    Obtener items por categoría
// @route   GET /api/inventory/category/:category
// @access  Privado
export const getItemsByCategory = asyncHandler(async (req, res) => {
  const items = await InventoryUseCases.getItemsByCategory(req.params.category);
  res.json({ 
    success: true, 
    count: items.length,
    data: items 
  });
});

// @desc    Obtener items con bajo stock
// @route   GET /api/inventory/low-stock
// @access  Privado
export const getLowStockItems = asyncHandler(async (req, res) => {
  const threshold = req.query.threshold ? parseInt(req.query.threshold) : 5;
  const items = await InventoryUseCases.getLowStockItems(threshold);
  res.json({ 
    success: true, 
    count: items.length,
    data: items 
  });
});

// @desc    Obtener historial de movimientos
// @route   GET /api/inventory/:id/history
// @access  Privado
export const getMovementHistory = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const history = await InventoryUseCases.getMovementHistory(
    req.params.id,
    startDate,
    endDate
  );
  res.json({ 
    success: true, 
    data: history 
  });
});

// @desc    Obtener estadísticas del inventario
// @route   GET /api/inventory/stats
// @access  Privado/Admin
export const getInventoryStats = asyncHandler(async (req, res) => {
  const stats = await InventoryUseCases.getInventoryStats();
  res.json({ 
    success: true, 
    data: stats 
  });
});

// @desc    Obtener logs de inventario (solo admin)
// @route   GET /api/inventory/logs
// @access  Privado/Admin
export const getInventoryLogs = asyncHandler(async (req, res) => {
  const filters = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    action: req.query.action,
    performedBy: req.query.performedBy,
    userRole: req.query.userRole,
    limit: parseInt(req.query.limit) || 100
  };

  const logs = await InventoryLogService.getLogsForAdmin(filters);
  res.json({ 
    success: true, 
    count: logs.length,
    data: logs 
  });
});

// @desc    Obtener estadísticas de logs
// @route   GET /api/inventory/logs/stats
// @access  Privado/Admin
export const getInventoryLogStats = asyncHandler(async (req, res) => {
  const filters = {
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  const stats = await InventoryLogService.getLogStats(filters);
  res.json({ 
    success: true, 
    data: stats 
  });
});

// @desc    Obtener reporte diario de inventario
// @route   GET /api/v1/inventory/daily-report
// @access  Privado/Admin
export const getDailyInventoryReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const report = await InventoryUseCases.getDailyReport(date);
  
  res.json({
    success: true,
    data: report
  });
});

// @desc    Debug - Verificar logs en la base de datos
// @route   GET /api/v1/inventory/debug/logs
// @access  Privado/Admin
export const debugLogs = asyncHandler(async (req, res) => {
  try {
    // Obtener todas las acciones únicas
    const actions = await InventoryLog.distinct('action');
    
    // Contar logs por acción
    const actionCounts = await InventoryLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Obtener los últimos 10 logs
    const recentLogs = await InventoryLog.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('action itemName message reason notes quantity totalAmount createdAt');
    
    // Verificar logs de ventas
    const salesLogs = await InventoryLog.find({ action: 'sale' }).limit(3);
    
    // Verificar logs de movimientos
    const movementLogs = await InventoryLog.find({ 
      action: { $in: ['movement_entry', 'movement_exit'] } 
    }).limit(3);
    
    res.json({
      success: true,
      data: {
        uniqueActions: actions,
        actionCounts: actionCounts,
        recentLogs: recentLogs,
        salesLogsCount: salesLogs.length,
        movementLogsCount: movementLogs.length,
        sampleSalesLog: salesLogs[0] || null,
        sampleMovementLog: movementLogs[0] || null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error debugging logs',
      error: error.message
    });
  }
});

// @desc    Fix inventory consistency issues
// @route   POST /api/v1/inventory/fix-consistency
// @access  Admin
export const fixInventoryConsistency = asyncHandler(async (req, res) => {
  try {
    logger.debug('🔧 Iniciando corrección de consistencia de inventario');
    
    // Obtener todos los productos del inventario
    const inventoryItems = await Inventory.find({});
    let fixedCount = 0;
    
    // Batch query: get sales count per product in one aggregation
    const salesAggregation = await Sale.aggregate([
      { $match: { type: 'product', status: 'completed' } },
      { $group: { _id: '$productId', totalSold: { $sum: '$quantity' } } }
    ]);
    const salesMap = new Map(salesAggregation.map(s => [s._id.toString(), s.totalSold]));
    
    for (const item of inventoryItems) {
      logger.debug(`🔍 Procesando: ${item.name}`);
      
      const completedSales = salesMap.get(item._id.toString()) || 0;
      
      // Calcular el stock esperado
      const expectedStock = item.initialStock + (item.entries || 0) - (item.exits || 0) - completedSales;
      
      // Verificar si necesita corrección
      const needsStockCorrection = item.stock !== expectedStock;
      const needsRealStockCorrection = !item.realStock || item.realStock !== expectedStock;
      const needsSalesCorrection = item.sales !== completedSales;
      
      if (needsStockCorrection || needsRealStockCorrection || needsSalesCorrection) {
        logger.debug(`⚠️ Corrigiendo ${item.name}:`, {
          oldStock: item.stock,
          newStock: expectedStock,
          oldRealStock: item.realStock,
          newRealStock: expectedStock,
          oldSales: item.sales,
          newSales: completedSales
        });
        
        // Aplicar correcciones
        await Inventory.findByIdAndUpdate(item._id, {
          stock: expectedStock,
          realStock: expectedStock,
          sales: completedSales
        });
        
        fixedCount++;
      }
    }
    
    logger.debug(`✅ Corrección de consistencia completada: ${fixedCount} productos actualizados`);
    
    res.status(200).json({
      success: true,
      message: 'Consistencia de inventario corregida exitosamente',
      data: {
        totalProducts: inventoryItems.length,
        fixedProducts: fixedCount
      },
      fixed: fixedCount
    });
    
  } catch (error) {
    logger.error('❌ Error corrigiendo consistencia de inventario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al corregir consistencia de inventario',
      error: error.message
    });
  }
});
