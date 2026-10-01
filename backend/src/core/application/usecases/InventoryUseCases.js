// InventoryUseCases - Casos de uso para gestión de inventario
// ✅ MIGRACIÓN COMPLETA A REPOSITORY PATTERN
//
// Gestión integral de inventario con Repository Pattern

import { AppError, logger, Inventory, PaymentMethod } from '../../../barrel.js';
import ExpenseService from '../services/ExpenseService.js';
import DIContainer from '../../../shared/container/index.js';

// Casos de uso de inventario.
// El CRUD delega en InventoryRepository (DI); los ajustes de stock y las
// estadísticas/órdenes de compra usan el modelo o agregaciones directamente.
class InventoryUseCases {
  // Resuelve el repositorio de inventario desde el contenedor DI.
  constructor() {
    // Obtener repositorios del contenedor DI
    this.inventoryRepository = DIContainer.get('InventoryRepository');
    logger.debug('InventoryUseCases: Repositorios inyectados correctamente');
  }

  // Método estático para obtener instancia con DI
  static getInstance() {
    return new InventoryUseCases();
  }

  // Obtener inventario completo (✅ MIGRADO)
  // Aplica filtros y paginación sobre el repositorio (orden por nombre) y
  // normaliza la respuesta a { data, total, pagination } con valores por defecto.
  async getInventory(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 50 } = pagination;
      
      logger.debug('InventoryUseCases: Obteniendo inventario', { filters });

      // Construir query para repository
      const query = this._buildInventoryQuery(filters);

      const result = await this.inventoryRepository.findAll({
        filters: query,
        limit,
        page,
        sort: { name: 1 }
      });

      const products = Array.isArray(result?.products) ? result.products : [];
      logger.debug(`InventoryUseCases: Recuperados ${products.length} items de inventario`);
      return {
        data: products,
        total: result?.total ?? products.length,
        pagination: {
          page: result?.page ?? page,
          limit,
          totalPages: result?.totalPages ?? 1
        }
      };
    } catch (error) {
      logger.error('InventoryUseCases: Error al obtener inventario:', error);
      throw new AppError('Error al obtener inventario', 500);
    }
  }

  // Obtener item de inventario por ID (✅ MIGRADO)
  // Lanza 404 si el repositorio no lo encuentra.
  async getInventoryItemById(id) {
    try {
      logger.debug(`InventoryUseCases: Buscando item por ID: ${id}`);
      
      const item = await this.inventoryRepository.findById(id);
      if (!item) {
        throw new AppError('Item de inventario no encontrado', 404);
      }
      
      logger.debug(`InventoryUseCases: Item encontrado: ${item.name}`);
      return item;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`InventoryUseCases: Error al obtener item ${id}:`, error);
      throw new AppError('Error al obtener item de inventario', 500);
    }
  }

  // Crear nuevo item de inventario (✅ MIGRADO)
  // Agrega createdBy del usuario autenticado antes de persistir.
  async createInventoryItem(itemData, user) {
    try {
      logger.debug('InventoryUseCases: Creando nuevo item de inventario');
      
      // Agregar información del usuario
      const enhancedData = {
        ...itemData,
        createdBy: user._id
      };

      const newItem = await this.inventoryRepository.create(enhancedData);
      
      logger.debug(`InventoryUseCases: Item creado exitosamente: ${newItem._id}`);
      return newItem;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('InventoryUseCases: Error al crear item:', error);
      throw new AppError('Error al crear item de inventario', 500);
    }
  }

  // Actualizar item de inventario (✅ MIGRADO)
  // Delega la actualización parcial al repositorio.
  async updateInventoryItem(id, updateData, user) {
    try {
      logger.debug(`InventoryUseCases: Actualizando item ${id}`);
      
      const updatedItem = await this.inventoryRepository.update(id, updateData);
      
      logger.debug(`InventoryUseCases: Item actualizado exitosamente: ${id}`);
      return updatedItem;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`InventoryUseCases: Error al actualizar item ${id}:`, error);
      throw new AppError('Error al actualizar item de inventario', 500);
    }
  }

  // Eliminar item de inventario (✅ MIGRADO)
  // Delega el borrado al repositorio.
  async deleteInventoryItem(id, user) {
    try {
      logger.debug(`InventoryUseCases: Eliminando item ${id}`);
      
      const result = await this.inventoryRepository.delete(id);
      
      logger.debug(`InventoryUseCases: Item eliminado exitosamente: ${id}`);
      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`InventoryUseCases: Error al eliminar item ${id}:`, error);
      throw new AppError('Error al eliminar item de inventario', 500);
    }
  }

  // Actualizar stock de item (✅ MIGRADO)
  // quantity positivo agrega y negativo quita. Verifica que el nuevo stock no
  // quede negativo y actualiza atómicamente stock + contadores entries/exits +
  // un movimiento en el historial embebido. Retorna el item actualizado.
  async updateStock(id, quantity, user, reason = 'Ajuste manual') {
    try {
      logger.debug(`InventoryUseCases: Actualizando stock del item ${id} en ${quantity}`);
      
      const item = await this.getInventoryItemById(id);
      if (!item) {
        throw new AppError('Item de inventario no encontrado', 404);
      }

      const previousStock = item.stock;
      const newStock = previousStock + quantity;
      
      if (newStock < 0) {
        throw new AppError('El stock no puede ser negativo', 400);
      }

      // Normalizar usuario (puede venir como documento, id o null)
      const userId = user?._id || user || null;

      const movement = {
        type: quantity > 0 ? 'add' : 'remove',
        quantity: Math.abs(quantity),
        previousStock,
        newStock,
        reason,
        date: new Date(),
        ...(userId ? { user: userId } : {})
      };

      // Actualización atómica: stock + contadores + historial de movimientos
      const incFields = { stock: quantity, lastUpdated: new Date() };
      if (quantity > 0) {
        incFields.entries = Math.abs(quantity);
      } else {
        incFields.exits = Math.abs(quantity);
      }

      const updatedItem = await Inventory.findByIdAndUpdate(
        id,
        {
          $inc: incFields,
          $push: { movements: movement }
        },
        { new: true, runValidators: true }
      );
      
      logger.debug(`InventoryUseCases: Stock actualizado para ${id}: ${previousStock} -> ${newStock}`);
      return updatedItem;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`InventoryUseCases: Error al actualizar stock ${id}:`, error);
      throw new AppError('Error al actualizar stock', 500);
    }
  }

  // Obtener items con stock bajo (✅ MIGRADO)
  // Usa $expr stock <= minStock, ordena de menor a mayor y limita a 1000.
  async getLowStockItems() {
    try {
      logger.debug('InventoryUseCases: Obteniendo items con stock bajo');
      
      const result = await this.inventoryRepository.findAll({
        filters: {
          $expr: { $lte: ['$stock', '$minStock'] }
        },
        sort: { stock: 1 },
        limit: 1000,
        page: 1
      });

      const items = Array.isArray(result?.products) ? result.products : [];
      logger.debug(`InventoryUseCases: Encontrados ${items.length} items con stock bajo`);
      return items;
    } catch (error) {
      logger.error('InventoryUseCases: Error al obtener items con stock bajo:', error);
      throw new AppError('Error al obtener items con stock bajo', 500);
    }
  }

  // Construir query para filtros de inventario
  // Solo permite category/supplier/isActive; agrega búsqueda regex por
  // name/description/code y el filtro lowStock con $expr.
  // @private, retorna la query de MongoDB.
  _buildInventoryQuery(filters) {
    const query = {};

    // Filtros básicos permitidos
    const allowedFilters = ['category', 'supplier', 'isActive'];
    allowedFilters.forEach(f => {
      if (filters[f] !== undefined) query[f] = filters[f];
    });

    // Búsqueda por texto
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { code: { $regex: filters.search, $options: 'i' } }
      ];
    }

    // Filtro de stock bajo
    if (filters.lowStock) {
      query.$expr = { $lte: ['$stock', '$minStock'] };
    }

    return query;
  }

  // ========================================================================
  // ADAPTADORES DE COMPATIBILIDAD PARA MÉTODOS ESTÁTICOS
  // Cada wrapper obtiene una instancia con DI y delega en el método interno.
  // ========================================================================

  static async getInventory(filters = {}, pagination = {}) {
    const instance = InventoryUseCases.getInstance();
    return await instance.getInventory(filters, pagination);
  }

  static async getInventoryItemById(id) {
    const instance = InventoryUseCases.getInstance();
    return await instance.getInventoryItemById(id);
  }

  static async createInventoryItem(itemData, user) {
    const instance = InventoryUseCases.getInstance();
    return await instance.createInventoryItem(itemData, user);
  }

  static async updateInventoryItem(id, updateData, user) {
    const instance = InventoryUseCases.getInstance();
    return await instance.updateInventoryItem(id, updateData, user);
  }

  static async deleteInventoryItem(id, user) {
    const instance = InventoryUseCases.getInstance();
    return await instance.deleteInventoryItem(id, user);
  }

  static async updateStock(id, quantity, user, reason) {
    const instance = InventoryUseCases.getInstance();
    return await instance.updateStock(id, quantity, user, reason);
  }

  static async getLowStockItems() {
    const instance = InventoryUseCases.getInstance();
    return await instance.getLowStockItems();
  }

  // ========================================================================
  // ADAPTADORES DE COMPATIBILIDAD PARA inventoryService.js (nombres legacy)
  // Traducen nombres antiguos a los métodos nuevos; los que no reciben usuario
  // pasan null y adjustStock convierte { type, options } al formato interno.
  // ========================================================================

  static async getAllItems(filters = {}) {
    const instance = InventoryUseCases.getInstance();
    const { data } = await instance.getInventory(filters);
    return data; // Retornar solo el array sin paginación
  }

  static async getItemById(itemId) {
    const instance = InventoryUseCases.getInstance();
    return await instance.getInventoryItemById(itemId);
  }

  static async createItem(itemData) {
    const instance = InventoryUseCases.getInstance();
    // inventoryService.js no pasa user, usar null como fallback
    return await instance.createInventoryItem(itemData, null);
  }

  static async updateItem(itemId, updateData) {
    const instance = InventoryUseCases.getInstance();
    // inventoryService.js no pasa user, usar null como fallback
    return await instance.updateInventoryItem(itemId, updateData, null);
  }

  static async deleteItem(itemId) {
    const instance = InventoryUseCases.getInstance();
    return await instance.deleteInventoryItem(itemId, null);
  }

  static async adjustStock(itemId, quantity, type = 'add', reason, options = {}) {
    const instance = InventoryUseCases.getInstance();
    // Convertir el parámetro 'type' al formato esperado
    // 'subtract' → cantidad negativa; el resto → positiva.
    const finalQuantity = type === 'subtract' ? -Math.abs(quantity) : Math.abs(quantity);
    const user = options.userId ? { _id: options.userId } : null;

    // Validar método de pago ANTES de tocar el stock (si viene costo)
    // Así se evita actualizar inventario si el método es inválido.
    let paymentMethod = null;
    if (options.cost && options.cost > 0) {
      paymentMethod = await PaymentMethod.findByIdOrAlias(options.paymentMethod || 'efectivo');
      if (!paymentMethod) {
        throw new AppError(`Método de pago no válido: ${options.paymentMethod}`, 400);
      }
    }

    const updatedItem = await instance.updateStock(itemId, finalQuantity, user, reason);

    // Registrar gasto por entrada de inventario con costo
    // Si falla el gasto, el stock ya quedó actualizado: se informa ese estado.
    if (options.cost && options.cost > 0) {
      try {
        await ExpenseService.createExpense({
          description: `Compra de inventario: ${updatedItem?.name || itemId} (${Math.abs(quantity)} unidades)`,
          amount: options.cost,
          category: 'supplies',
          paymentMethodId: paymentMethod._id,
          paymentMethod: paymentMethod.backendId || options.paymentMethod,
          date: new Date()
        }, options.userId);
      } catch (expenseError) {
        logger.error('InventoryUseCases: Error registrando gasto de inventario:', expenseError);
        throw new AppError('El stock fue actualizado, pero no se pudo registrar el gasto', 500);
      }
    }

    return updatedItem;
  }

  static async getItemsByCategory(category) {
    const instance = InventoryUseCases.getInstance();
    const { data } = await instance.getInventory({ category });
    return data;
  }

  static async getMovementHistory(itemId, startDate, endDate) {
    return await InventoryUseCases.getInventoryMovements(startDate, endDate);
  }

  static async getDailyReport(dateString) {
    // Este método necesita implementación específica
    // Arma un reporte simple: estadísticas globales + items con stock bajo.
    logger.debug(`Generando reporte diario para: ${dateString}`);
    try {
      const stats = await InventoryUseCases.getInventoryStats();
      const instance = InventoryUseCases.getInstance();
      const lowStock = await instance.getLowStockItems();
      
      return {
        date: dateString,
        stats,
        lowStockItems: lowStock,
        generatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error generando reporte diario:', error);
      throw new AppError('Error al generar reporte diario', 500);
    }
  }

  // ========================================================================
  // MÉTODOS COMPLEJOS SIN MIGRAR (⏳)
  // Mantenidos por complejidad específica
  // ========================================================================

  // Obtener estadísticas de inventario
  // Agregación única: total de items, valor total (stock*precio), stock promedio
  // y cantidad de items con stock <= minStock. Retorna ceros si no hay datos.
  static async getInventoryStats() {
    logger.debug('Obteniendo estadísticas de inventario');
    
    try {
      const stats = await Inventory.aggregate([
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            totalValue: { $sum: { $multiply: ['$stock', '$price'] } },
            averageStock: { $avg: '$stock' },
            lowStockCount: {
              $sum: {
                $cond: [{ $lte: ['$stock', '$minStock'] }, 1, 0]
              }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalItems: 0,
        totalValue: 0,
        averageStock: 0,
        lowStockCount: 0
      };

      logger.debug('Estadísticas de inventario calculadas:', result);
      return result;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de inventario:', error);
      throw new AppError('Error al obtener estadísticas de inventario', 500);
    }
  }

  // Obtener reporte de movimientos de inventario
  // Placeholder: los movimientos viven embebidos en cada item, por lo que
  // devuelve un arreglo vacío hasta implementar la consulta agregada.
  static async getInventoryMovements(startDate, endDate) {
    logger.debug(`Obteniendo movimientos de inventario: ${startDate} - ${endDate}`);
    
    try {
      // Esta funcionalidad requeriría un modelo separado de movimientos
      // Por ahora devolvemos un array vacío como placeholder
      const movements = [];
      
      logger.debug(`Encontrados ${movements.length} movimientos de inventario`);
      return movements;
    } catch (error) {
      logger.error('Error obteniendo movimientos de inventario:', error);
      throw new AppError('Error al obtener movimientos de inventario', 500);
    }
  }

  // Procesar orden de compra automática para items con stock bajo
  // Sugiere recomprar max(minStock * 2, 10) unidades por item y calcula el
  // costo estimado con el precio actual. Retorna { items, totalOrderValue,
  // generatedAt } sin persistir nada.
  static async processAutomaticPurchaseOrder() {
    logger.debug('Procesando orden de compra automática');
    
    try {
      const lowStockItems = await this.getLowStockItems();
      
      if (lowStockItems.length === 0) {
        logger.debug('No hay items con stock bajo para procesar');
        return { items: [], totalOrderValue: 0 };
      }

      const orderItems = lowStockItems.map(item => ({
        item: item._id,
        name: item.name,
        currentStock: item.stock,
        minStock: item.minStock,
        suggestedQuantity: Math.max(item.minStock * 2, 10), // Sugerir el doble del mínimo
        estimatedCost: (item.price || 0) * Math.max(item.minStock * 2, 10)
      }));

      const totalOrderValue = orderItems.reduce((sum, item) => sum + item.estimatedCost, 0);

      const result = {
        items: orderItems,
        totalOrderValue,
        generatedAt: new Date()
      };

      logger.debug(`Orden de compra automática generada: ${orderItems.length} items, valor estimado: $${totalOrderValue}`);
      return result;
    } catch (error) {
      logger.error('Error procesando orden de compra automática:', error);
      throw new AppError('Error al procesar orden de compra automática', 500);
    }
  }
}

export default InventoryUseCases;