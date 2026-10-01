import { PaymentMethod, Sale, Expense, Appointment, AppError, CommonErrors, logger } from '../../../barrel.js';

// Use case: Inicializar métodos de pago del sistema
// Crea (idempotente con upsert) el método efectivo como único método de sistema.
export class InitializePaymentMethods {
  // Crea cash/efectivo si no existe usando $setOnInsert y retorna el conteo
  // de métodos de sistema. No sobrescribe métodos ya creados.
  static async execute() {
    try {
      logger.info('Inicializando métodos de pago del sistema...');
      
      // Único método predeterminado del sistema: efectivo.
      // El resto de métodos son dinámicos y los crea el administrador.
      const systemMethods = [
        {
          backendId: 'cash',
          name: 'Efectivo',
          description: 'Pago en efectivo',
          color: '#10b981',
          category: 'cash',
          isSystem: true,
          displayOrder: 1,
          aliases: ['efectivo']
        }
      ];

      for (const methodData of systemMethods) {
        await PaymentMethod.findOneAndUpdate(
          { backendId: methodData.backendId },
          { $setOnInsert: methodData },
          { upsert: true, new: true }
        );
      }

      const count = await PaymentMethod.countDocuments({ isSystem: true });
      logger.info(`Métodos de pago del sistema inicializados: ${count}`);
      
      return { success: true, count };
    } catch (error) {
      logger.error('Error inicializando métodos de pago:', error);
      throw new AppError('Error inicializando métodos de pago', 500);
    }
  }
}

// Use case: Obtener todos los métodos de pago activos
// Devuelve solo los campos necesarios para la UI (formato frontend).
export class GetPaymentMethods {
  static async execute() {
    try {
      logger.debug('Obteniendo métodos de pago activos...');
      
      const methods = await PaymentMethod.getActiveOrderedMethods();
      
      logger.debug(`Métodos de pago obtenidos: ${methods.length}`);
      
      return methods.map(method => ({
        _id: method._id,
        backendId: method.backendId,
        name: method.name,
        description: method.description,
        color: method.color,
        category: method.category,
        isSystem: method.isSystem
      }));
    } catch (error) {
      logger.error('Error obteniendo métodos de pago:', error);
      throw new AppError('Error obteniendo métodos de pago', 500);
    }
  }
}

// Use case: Crear un nuevo método de pago
// No permite ids duplicados (también captura el índice único de Mongo 11000).
export class CreatePaymentMethod {
  static async execute({ backendId, name, description, color, category }) {
    try {
      logger.info(`Creando método de pago: ${backendId}`);
      
      // Verificar que no exista
      const existing = await PaymentMethod.findOne({ backendId });
      if (existing) {
        throw new AppError('El método de pago ya existe', 400);
      }
      
      const method = new PaymentMethod({
        backendId,
        name,
        description,
        color: color || '#6b7280',
        category: category || 'digital',
        isSystem: false,
        displayOrder: 100
      });
      
      await method.save();
      
      logger.info(`Método de pago creado: ${method.backendId}`);
      return method.toFrontendFormat();
    } catch (error) {
      logger.error('Error creando método de pago:', error);
      if (error.code === 11000) {
        throw new AppError('El método de pago ya existe', 400);
      }
      throw new AppError('Error creando método de pago', 500);
    }
  }
}

// Use case: Actualizar un método de pago
// El backendId nunca se modifica: se descarta del payload y se aplican el resto
// de campos de forma segura (incluido efectivo, que sí puede editarse).
export class UpdatePaymentMethod {
  static async execute(backendId, updateData) {
    try {
      logger.info(`Actualizando método de pago: ${backendId}`);
      
      const method = await PaymentMethod.findOne({ backendId });
      if (!method) {
        throw new AppError('Método de pago no encontrado', 404);
      }
      
      // El backendId nunca se modifica; el resto de campos sí (incluido efectivo)
      const { backendId: _ignored, allowSystemUpdate: _ignored2, ...safeUpdate } = updateData;
      Object.assign(method, safeUpdate);
      await method.save();
      
      logger.info(`Método de pago actualizado: ${method.backendId}`);
      return method.toFrontendFormat();
    } catch (error) {
      logger.error('Error actualizando método de pago:', error);
      throw new AppError('Error actualizando método de pago', 500);
    }
  }
}

// Use case: Eliminar/desactivar un método de pago
// Efectivo es intocable; si el método está referenciado en ventas/gastos/citas
// y no viene forceDelete=true, rechaza la eliminación con el conteo de uso.
export class DeletePaymentMethod {
  static async execute(backendId, forceDelete = false) {
    try {
      logger.info(`Eliminando método de pago: ${backendId}`);
      
      const method = await PaymentMethod.findOne({ backendId });
      if (!method) {
        throw new AppError('Método de pago no encontrado', 404);
      }
      
      // El efectivo es el único método esencial: nunca se elimina
      if (method.backendId === 'cash') {
        throw new AppError('No se puede eliminar el efectivo - método esencial', 403);
      }
      
      // Verificar si está en uso
      const [salesCount, expensesCount, appointmentsCount] = await Promise.all([
        Sale.countDocuments({ paymentMethod: backendId }),
        Expense.countDocuments({ paymentMethod: backendId }),
        Appointment.countDocuments({ paymentMethod: backendId })
      ]);
      
      const totalUsage = salesCount + expensesCount + appointmentsCount;
      
      if (totalUsage > 0 && !forceDelete) {
        throw new AppError(
          `No se puede eliminar. Método en uso: ${totalUsage} registros (${salesCount} ventas, ${expensesCount} gastos, ${appointmentsCount} citas)`,
          400
        );
      }
      
      await PaymentMethod.deleteOne({ backendId });
      logger.info(`Método de pago eliminado permanentemente: ${backendId}`);
      return { deleted: true };

    } catch (error) {
      logger.error('Error eliminando método de pago:', error);
      throw error instanceof AppError ? error : new AppError('Error eliminando método de pago', 500);
    }
  }
}

// Use case: Normalizar métodos de pago existentes en la BD
// Recolecta los valores distintos de paymentMethod en ventas, gastos y citas,
// mapea cada uno a un backendId canónico y actualiza masivamente; los valores
// null/undefined/null-string se convierten a 'cash'. Retorna conteo normalizado.
export class NormalizeExistingPaymentMethods {
  static async execute() {
    try {
      logger.info('Normalizando métodos de pago existentes...');
      
      // Obtener todos los métodos únicos de todas las colecciones
      const [salesMethods, expensesMethods, appointmentsMethods] = await Promise.all([
        Sale.distinct('paymentMethod'),
        Expense.distinct('paymentMethod'),
        Appointment.distinct('paymentMethod', { paymentMethod: { $exists: true, $ne: null } })
      ]);
      
      const allMethods = [...new Set([...salesMethods, ...expensesMethods, ...appointmentsMethods])]
        .filter(method => method && method !== 'null');
      
      logger.info(`Métodos únicos encontrados: ${allMethods.join(', ')}`);
      
      let normalizedCount = 0;
      
      for (const method of allMethods) {
        const normalizedMethod = await PaymentMethod.normalizePaymentMethod(method);
        
        if (method !== normalizedMethod) {
          logger.info(`Normalizando: ${method} → ${normalizedMethod}`);
          
          // Actualizar en todas las colecciones
          await Promise.all([
            Sale.updateMany(
              { paymentMethod: method },
              { $set: { paymentMethod: normalizedMethod } }
            ),
            Expense.updateMany(
              { paymentMethod: method },
              { $set: { paymentMethod: normalizedMethod } }
            ),
            Appointment.updateMany(
              { paymentMethod: method },
              { $set: { paymentMethod: normalizedMethod } }
            )
          ]);
          
          normalizedCount++;
        }
      }
      
      // Normalizar valores nulos/undefined
      await Promise.all([
        Sale.updateMany(
          { paymentMethod: { $in: [null, undefined, 'null', 'undefined'] } },
          { $set: { paymentMethod: 'cash' } }
        ),
        Expense.updateMany(
          { paymentMethod: { $in: [null, undefined, 'null', 'undefined'] } },
          { $set: { paymentMethod: 'cash' } }
        ),
        Appointment.updateMany(
          { paymentMethod: { $in: [null, undefined, 'null', 'undefined'] } },
          { $set: { paymentMethod: 'cash' } }
        )
      ]);
      
      logger.info(`Normalización completada. ${normalizedCount} métodos normalizados`);
      
      return { normalizedCount, totalMethods: allMethods.length };
    } catch (error) {
      logger.error('Error en normalización:', error);
      throw new AppError('Error normalizando métodos de pago', 500);
    }
  }
}

// Use case: Validar método de pago
// Retorna false para valores vacíos/nulos; si no, comprueba que exista un
// método activo con ese backendId o alias. Nunca lanza: ante error retorna false.
export class ValidatePaymentMethod {
  static async execute(paymentMethod) {
    try {
      if (!paymentMethod || paymentMethod === 'null' || paymentMethod === 'undefined') {
        return false;
      }
      
      const method = await PaymentMethod.findByIdOrAlias(paymentMethod);
      return !!method;
    } catch (error) {
      logger.error('Error validando método de pago:', error);
      return false;
    }
  }
}