import { InventoryLog, logger } from '../../../barrel.js';

// Casos de uso de la bitácora de inventario.
// Centraliza la creación de logs de auditoría y las consultas/estadísticas
// usadas por el panel de administración.
class InventoryLogUseCases {
  // Crear un log de acción en inventario
  // Parámetros: acción, item, usuario/rol, detalles y estados previo/nuevo.
  // Copia a campos planos los valores presentes en `details` (mensaje, motivo,
  // notas, cantidades, stock y monto) y persiste el log. Relanza errores.
  static async createLog(action, itemId, itemName, userId, userRole, details, previousState = null, newState = null) {
    try {
      const logData = {
        action,
        itemId,
        itemName,
        performedBy: userId,
        userRole,
        details,
        previousState,
        newState
      };

      // Agregar campos específicos si están en details
      if (details) {
        if (details.message) logData.message = details.message;
        if (details.reason) logData.reason = details.reason;
        if (details.notes) logData.notes = details.notes;
        if (details.quantity) logData.quantity = details.quantity;
        if (details.oldStock !== undefined) logData.oldStock = details.oldStock;
        if (details.newStock !== undefined) logData.newStock = details.newStock;
        if (details.totalAmount) logData.totalAmount = details.totalAmount;
      }

      const log = new InventoryLog(logData);

      await log.save();
      logger.info(`Inventory log created: ${action} on ${itemName} by ${userRole} ${userId}`);
      return log;
    } catch (error) {
      logger.error('Error creating inventory log:', error);
      throw error;
    }
  }

  // Obtener logs para admin
  // Aplica filtros opcionales de rango de fechas, acción, usuario y rol;
  // popula usuario/ítem, ordena por timestamp descendente y limita (100 por defecto).
  static async getLogsForAdmin(filters = {}) {
    try {
      const query = {};
      
      // Filtros opcionales
      if (filters.startDate && filters.endDate) {
        query.timestamp = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }
      
      if (filters.action) {
        query.action = filters.action;
      }
      
      if (filters.performedBy) {
        query.performedBy = filters.performedBy;
      }
      
      if (filters.userRole) {
        query.userRole = filters.userRole;
      }

      const logs = await InventoryLog.find(query)
        .populate('performedBy', 'name email')
        .populate('itemId', 'name')
        .sort({ timestamp: -1 })
        .limit(filters.limit || 100);

      return logs;
    } catch (error) {
      logger.error('Error fetching inventory logs:', error);
      throw error;
    }
  }

  // Obtener logs por item específico
  // Historial completo del producto (más reciente primero) con el usuario que actuó.
  static async getLogsByItem(itemId) {
    try {
      const logs = await InventoryLog.find({ itemId })
        .populate('performedBy', 'name email')
        .sort({ timestamp: -1 });

      return logs;
    } catch (error) {
      logger.error('Error fetching logs for item:', error);
      throw error;
    }
  }

  // Obtener estadísticas de logs
  // Agregación en dos etapas: agrupa por acción+rol para contar, y luego por
  // acción sumando el total y armando el desglose byRole. Acepta rango de fechas.
  static async getLogStats(filters = {}) {
    try {
      const matchStage = {};
      
      if (filters.startDate && filters.endDate) {
        matchStage.timestamp = {
          $gte: new Date(filters.startDate),
          $lte: new Date(filters.endDate)
        };
      }

      const stats = await InventoryLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              action: '$action',
              userRole: '$userRole'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.action',
            totalCount: { $sum: '$count' },
            byRole: {
              $push: {
                role: '$_id.userRole',
                count: '$count'
              }
            }
          }
        }
      ]);

      return stats;
    } catch (error) {
      logger.error('Error fetching log stats:', error);
      throw error;
    }
  }
}

export default InventoryLogUseCases;
