import mongoose from "mongoose";
import { asyncHandler } from "../middleware/index.js";
import RefundService from "../../services/refundService.js";
import { logger, AppError } from "../../barrel.js";
import DataNormalizationService from "../../shared/utils/dataNormalization.js";

// @desc    Procesar reembolso de una venta
// @route   POST /api/refunds/:saleId
// @access  Privado (Barberos con código admin)
export const processRefund = asyncHandler(async (req, res) => {
  const { saleId } = req.params;
  const { reason, adminCode } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  if (!reason || reason.trim().length === 0) {
    throw new AppError('La razón del reembolso es requerida', 400);
  }

  // Solo requerir adminCode si el usuario NO es admin
  if (userRole !== 'admin' && !adminCode) {
    throw new AppError('Código de verificación de administrador requerido', 400);
  }

  logger.info('Solicitud de reembolso recibida', {
    saleId,
    reason: reason.substring(0, 100),
    userId,
    userEmail: req.user.email,
    userRole,
    requiresAdminCode: userRole !== 'admin'
  });

  const result = await RefundService.processRefund(saleId, reason, adminCode, userId, userRole);

  res.status(200).json({
    success: true,
    message: result.message,
    data: {
      refundedSale: {
        id: result.refundedSale._id,
        productName: result.refundedSale.productName,
        totalAmount: result.refundedSale.totalAmount,
        refundedAt: result.refundedSale.refundedAt,
        refundReason: result.refundedSale.refundReason,
        type: result.refundedSale.type
      }
    }
  });
});

// @desc    Obtener todas las ventas reembolsadas
// @route   GET /api/refunds
// @access  Privado
export const getRefundedSales = asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    barberId,
    type,
    limit,
    page
  } = req.query;

  // Validar que solo admins o el barbero vea sus propios reembolsos
  const filters = {};
  
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (type) filters.type = type;
  if (limit) filters.limit = parseInt(limit);
  if (page) filters.page = parseInt(page);

  // Si no es admin, solo mostrar sus propios reembolsos
  if (req.user.role !== 'admin') {
    filters.barberId = req.user.id;
  } else if (barberId) {
    filters.barberId = barberId;
  }

  logger.info('Consultando ventas reembolsadas', {
    filters,
    requestedBy: req.user.email,
    userRole: req.user.role
  });

  const result = await RefundService.getRefundedSales(filters);

  res.status(200).json({
    success: true,
    message: 'Ventas reembolsadas obtenidas exitosamente',
    data: result.refundedSales,
    stats: result.stats,
    pagination: result.pagination
  });
});

// @desc    Obtener resumen de reembolsos por barbero
// @route   GET /api/refunds/summary
// @access  Admin
export const getRefundsSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  logger.info('Consultando resumen de reembolsos', {
    startDate,
    endDate,
    requestedBy: req.user.email
  });

  const summary = await RefundService.getRefundsSummaryByBarber(startDate, endDate);

  res.status(200).json({
    success: true,
    message: 'Resumen de reembolsos obtenido exitosamente',
    data: summary
  });
});

// @desc    Obtener código de verificación actual
// @route   GET /api/refunds/verification-code
// @access  Admin
export const getVerificationCode = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new AppError('Acceso denegado. Solo administradores pueden ver el código', 403);
  }

  const codeInfo = RefundService.getCurrentVerificationCode();

  logger.info('Código de verificación solicitado', {
    requestedBy: req.user.email,
    timeUntilNext: `${Math.ceil(codeInfo.timeUntilNext / 60000)} minutos`
  });

  res.status(200).json({
    success: true,
    message: 'Código de verificación obtenido',
    data: {
      code: codeInfo.code,
      timeUntilNext: codeInfo.timeUntilNext,
      expiresIn: `${Math.ceil(codeInfo.timeUntilNext / 60000)} minutos`
    }
  });
});

// @desc    Obtener ventas del barbero (para reembolsar)
// @route   GET /api/refunds/my-sales
// @access  Privado (Barberos)
export const getMySalesForRefund = asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    type,
    limit = 20,
    page = 1
  } = req.query;

  const userId = new mongoose.Types.ObjectId(req.user.id);

  logger.info('Consultando ventas del barbero para reembolso', {
    userId,
    userEmail: req.user.email
  });

  // Importar modelos necesarios
  const Sale = (await import('../../core/domain/entities/Sale.js')).default;
  const Appointment = (await import('../../core/domain/entities/Appointment.js')).default;
  const Barber = (await import('../../core/domain/entities/Barber.js')).default;

  // Buscar el barbero por user ID para obtener el barberId real
  const barber = await Barber.findOne({ 'user': userId })
    .populate('user', 'name email')
    .lean();

  if (!barber) {
    return res.status(404).json({
      success: false,
      message: 'Barbero no encontrado'
    });
  }

  const barberId = barber._id;
  logger.info('Barbero encontrado para consulta de reembolsos', { 
    userId, 
    barberId 
  });

  // Construir query para ventas regulares
  const saleQuery = { 
    barberId,
    status: 'completed'  // Solo ventas completadas, excluyendo refunded
  };

  // Filtros de fecha sobre saleDate para ventas regulares
  if (startDate || endDate) {
    saleQuery.saleDate = {};
    if (startDate) {
      saleQuery.saleDate.$gte = new Date(startDate);
    }
    if (endDate) {
      saleQuery.saleDate.$lte = new Date(endDate);
    }
  }

  if (type && type !== 'appointment') {
    saleQuery.type = type;
  }

  // Obtener ventas regulares (incluye products y walkIn)
  const sales = await Sale.find(saleQuery)
    .sort({ saleDate: -1 })
    .lean();

  logger.info('Ventas regulares encontradas', { count: sales.length });

  // Construir query para citas completadas
  const appointmentQuery = {
    barber: barberId,
    status: 'completed',
    paymentMethod: { $exists: true, $nin: [null, ''] }
  };

  // Filtros de fecha sobre date para citas
  if (startDate || endDate) {
    appointmentQuery.date = {};
    if (startDate) {
      appointmentQuery.date.$gte = new Date(startDate);
    }
    if (endDate) {
      appointmentQuery.date.$lte = new Date(endDate);
    }
  }

  // Si se especifica type 'appointment', solo incluir citas
  const appointments = (!type || type === 'appointment') ? 
    await Appointment.find(appointmentQuery)
      .populate('service', 'name')
      .populate('user', 'name')
      .sort({ date: -1 })
      .lean() : [];

  logger.info('Citas completadas encontradas', { count: appointments.length });

  // Normalizar ventas con datos completos
  const normalizedSales = await Promise.all(
    sales.map(sale => DataNormalizationService.normalizeSaleData(sale))
  );

  // Filtrar ventas reembolsadas después de normalización
  const completedSales = normalizedSales.filter(sale => sale.status === 'completed');

  // Normalizar citas como ventas
  const normalizedAppointments = appointments
    .map(apt => DataNormalizationService.normalizeAppointmentAsSale(apt))
    .filter(Boolean); // Remover nulls

  // Combinar todas las transacciones normalizadas (solo completed)
  const allTransactions = [
    ...completedSales,
    ...normalizedAppointments
  ];

  // Ordenar por fecha
  allTransactions.sort((a, b) => new Date(b.saleDate || b.createdAt) - new Date(a.saleDate || a.createdAt));

  logger.info('Total de transacciones disponibles para reembolso', { 
    total: allTransactions.length,
    sales: completedSales.length,
    appointments: normalizedAppointments.length
  });

  // Aplicar paginación
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const paginatedSales = allTransactions.slice(skip, skip + parseInt(limit));
  const total = allTransactions.length;

  const pagination = {
    currentPage: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
    totalItems: total,
    limit: parseInt(limit),
    hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
    hasPrevPage: parseInt(page) > 1
  };

  res.status(200).json({
    success: true,
    message: 'Ventas disponibles para reembolso obtenidas',
    data: paginatedSales,
    pagination
  });
});

// @desc    Eliminar reembolso (reversar a venta normal)
// @route   DELETE /api/refunds/:saleId
// @access  Solo Admin
export const deleteRefund = asyncHandler(async (req, res) => {
  const { saleId } = req.params;
  const userId = req.user.id;
  const userEmail = req.user.email;

  logger.info('Solicitud de eliminación de reembolso', {
    saleId,
    adminUserId: userId,
    adminEmail: userEmail
  });

  const result = await RefundService.deleteRefund(saleId, userId);

  res.status(200).json({
    success: true,
    message: result.message,
    data: {
      restoredSale: {
        id: result.restoredSale._id,
        productName: result.restoredSale.productName,
        totalAmount: result.restoredSale.totalAmount,
        createdAt: result.restoredSale.createdAt,
        type: result.restoredSale.type
      }
    }
  });
});

// @desc    Eliminar reembolso permanentemente del sistema
// @route   DELETE /api/refunds/:saleId/permanent
// @access  Solo Admin
export const permanentDeleteRefund = asyncHandler(async (req, res) => {
  const { saleId } = req.params;
  const userId = req.user.id;
  const userEmail = req.user.email;

  logger.info('Solicitud de eliminación permanente de reembolso', {
    saleId,
    adminUserId: userId,
    adminEmail: userEmail
  });

  const result = await RefundService.permanentDeleteRefund(saleId, userId);

  res.status(200).json({
    success: true,
    message: result.message,
    data: {
      deletedRefund: {
        id: result.deletedRefund._id,
        productName: result.deletedRefund.productName,
        totalAmount: result.deletedRefund.totalAmount,
        refundReason: result.deletedRefund.refundReason
      }
    }
  });
});