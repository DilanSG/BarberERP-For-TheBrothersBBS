import ExpenseService from '../../core/application/services/ExpenseService.js';
import { validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/index.js';
import { AppError, logger } from '../../barrel.js';

/**
 * Controlador para manejo de gastos, delegando la lógica a ExpenseService.
 */
class ExpenseController {
  /**
   * Obtener lista de gastos con filtros y paginación.
   */
  getExpenses = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, ...filters } = req.query;

    const result = await ExpenseService.getExpenses({
      user: req.user,
      filters,
      pagination: { page, limit },
    });

    res.json({
      success: true,
      ...result,
    });
  });

  /**
   * Obtener una plantilla de gasto recurrente por ID.
   */
  getRecurringExpenseById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const template = await ExpenseService.getRecurringExpenseTemplateById(id, req.user);
    res.json({
      success: true,
      data: template,
    });
  });
  
  /**
   * Obtener todas las plantillas de gastos recurrentes.
   */
  getRecurringExpenses = asyncHandler(async (req, res) => {
    const templates = await ExpenseService.getRecurringExpenseTemplates(req.user);
    const migratedInlineCount = templates?._migratedInlineCount || 0;
    // Serializar removiendo propiedad ad-hoc
    const plain = Array.isArray(templates) ? templates.map(t => t) : templates;
    // DEBUG: Log diagnóstico de retorno de plantillas
    try {
      const sampleIds = Array.isArray(plain) ? plain.slice(0, 5).map(p => p._id?.toString()) : [];
      logger.debug('[ExpenseController.getRecurringExpenses] count:', Array.isArray(plain) ? plain.length : 'n/a', 'migratedInlineCount:', migratedInlineCount, 'sampleIds:', sampleIds);
    } catch (e) {
      logger.warn('[ExpenseController.getRecurringExpenses] No se pudo loggear diagnóstico:', e.message);
    }
    res.json({
      success: true,
      data: plain,
      meta: { migratedInlineCount }
    });
  });

  /**
   * Crear un gasto único.
   */
  createExpense = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Datos de entrada inválidos', 400, errors.array());
    }

    const savedExpense = await ExpenseService.createExpense(req.body, req.user.id);
    await savedExpense.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Gasto creado exitosamente',
      data: savedExpense,
    });
  });

  /**
   * Crear una plantilla de gasto recurrente.
   */
  createRecurringExpense = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Datos de entrada inválidos', 400, errors.array());
    }

    // DEBUG: log entrada bruta para creación de recurrente
    logger.debug('[ExpenseController.createRecurringExpense] payload recibido', {
      keys: Object.keys(req.body || {}),
      hasRecurrence: !!req.body?.recurrence,
      hasRecurringConfig: !!req.body?.recurringConfig,
      type: req.body?.type
    });

    // Si viene sólo recurringConfig (formato legacy frontend), intentar mapear a recurrence
    if (!req.body.recurrence && req.body.recurringConfig) {
      try {
        const cfg = req.body.recurringConfig;
        req.body.recurrence = {
          pattern: cfg.frequency || 'monthly',
          interval: parseInt(cfg.interval || 1, 10),
          startDate: cfg.startDate || new Date().toISOString().split('T')[0],
          endDate: cfg.endDate || null,
          isActive: cfg.isActive !== undefined ? cfg.isActive : true,
          config: {}
        };
        if (req.body.recurrence.pattern === 'weekly' && cfg.dayOfWeek != null) {
          req.body.recurrence.config.weekDays = [parseInt(cfg.dayOfWeek, 10)];
        }
        if (req.body.recurrence.pattern === 'monthly' && cfg.dayOfMonth != null) {
          req.body.recurrence.config.monthDays = [parseInt(cfg.dayOfMonth, 10)];
        }
        logger.debug('[ExpenseController.createRecurringExpense] Generada recurrence desde recurringConfig');
      } catch (e) {
        logger.warn('[ExpenseController.createRecurringExpense] Falló conversión legacy->recurrence', e.message);
      }
    }

    // DEBUG: confirmar normalización de método de pago post-validador
    try {
      logger.debug('[ExpenseController.createRecurringExpense] normalized payment fields:', {
        paymentMethod: req.body?.paymentMethod,
        paymentMethodId: req.body?.paymentMethodId
      });
    } catch {}

    const savedExpense = await ExpenseService.createRecurringExpense(req.body, req.user.id);
    await savedExpense.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Gasto recurrente creado exitosamente',
      data: savedExpense,
    });
  });

  /**
   * Actualizar un gasto (único o plantilla recurrente).
   */
  updateExpense = asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Datos de entrada inválidos', 400, errors.array());
    }

    const { id } = req.params;
    const updatedExpense = await ExpenseService.updateExpense(id, req.body, req.user);
    await updatedExpense.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Gasto actualizado exitosamente',
      data: updatedExpense,
    });
  });

  /**
   * Eliminar un gasto (único o plantilla recurrente).
   */
  deleteExpense = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await ExpenseService.deleteExpense(id, req.user);

    res.json({
      success: true,
      message: 'Gasto eliminado exitosamente',
    });
  });

  /**
   * Activar/desactivar una plantilla de gasto recurrente.
   */
  toggleRecurringExpense = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedExpense = await ExpenseService.toggleRecurringExpense(id, isActive, req.user);

    res.json({
      success: true,
      message: `Gasto recurrente ${isActive ? 'activado' : 'desactivado'} exitosamente`,
      data: updatedExpense,
    });
  });

  /**
   * Procesar gastos automáticos pendientes (generar instancias).
   * Acceso: Admin
   */
  processAutomaticExpenses = asyncHandler(async (req, res) => {
    const result = await ExpenseService.processScheduledExpenses();
    res.json({
      success: true,
      message: `Procesados ${result.created} gastos automáticos.`,
      data: result,
    });
  });

  /**
   * Obtener resumen de gastos para reportes financieros.
   */
  getExpenseSummary = asyncHandler(async (req, res) => {
    const { startDate, endDate, ...filters } = req.query;
    // DEBUG: log de entrada para diagnosticar 400 desde frontend
    logger.debug('[ExpenseController.getExpenseSummary] query params recibidos:', { startDate, endDate, filters });
    if (!startDate || !endDate) {
      throw new AppError('Los parámetros startDate y endDate son requeridos', 400);
    }

    const summaryData = await ExpenseService.getExpenseSummary({
      startDate,
      endDate,
      filters,
      user: req.user,
    });

    res.json({
      success: true,
      data: summaryData,
      meta: {
        receivedRange: { startDate, endDate }
      }
    });
  });

  /**
   * Obtener categorías de gastos con estadísticas opcionales.
   */
  getExpenseCategories = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const categories = await ExpenseService.getExpenseCategories(startDate, endDate);
    res.json({
      success: true,
      data: categories,
    });
  });

  /**
   * Obtener ajustes diarios de una plantilla recurrente para un mes
   */
  getDailyAdjustments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { yearMonth } = req.query;
    const data = await ExpenseService.getDailyAdjustments(id, yearMonth);
    res.json({ success: true, data });
  });

  /**
   * Actualizar ajustes diarios de una plantilla recurrente
   */
  updateDailyAdjustments = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { yearMonth, adjustments } = req.body || {};
    if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new AppError('Parámetro yearMonth inválido. Formato esperado YYYY-MM', 400);
    }
    if (!adjustments || typeof adjustments !== 'object') {
      throw new AppError('El objeto adjustments es requerido', 400);
    }
    const updated = await ExpenseService.updateDailyAdjustments(id, yearMonth, adjustments);
    res.json({
      success: true,
      message: 'Ajustes diarios actualizados',
      data: {
        templateId: updated._id.toString(),
        yearMonth,
        // Devolver sólo los ajustes relevantes si coincide el mes almacenado
        adjustments: (updated.recurrence && updated.recurrence.adjustmentsMonth === yearMonth)
          ? (updated.recurrence.dailyAdjustments || {})
          : (updated.recurringConfig && updated.recurringConfig.adjustmentsMonth === yearMonth)
            ? (updated.recurringConfig.dailyAdjustments || {})
            : {}
      }
    });
  });
}

export default new ExpenseController();
