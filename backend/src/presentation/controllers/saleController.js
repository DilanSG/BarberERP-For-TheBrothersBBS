import SaleUseCases from '../../core/application/usecases/SaleUseCases.js';
import { asyncHandler } from '../middleware/index.js';
import { AppError, logger, Barber } from '../../barrel.js';
import DataNormalizationService from '../../shared/utils/dataNormalization.js';
import { emitSaleCreated } from '../../services/websocketService.js';

// @desc    Crear nueva venta
// @route   POST /api/v1/sales
// @access  Privado/Barbero+
export const createSale = asyncHandler(async (req, res) => {
  logger.debug('Creando nueva venta', { 
    userId: req.user.id, 
    role: req.user.role,
    hasItems: !!req.body.items
  });
  
  const sale = await SaleUseCases.createSale(req.body);
  
  // Normalizar datos de respuesta
  const normalizedSale = await DataNormalizationService.normalizeSaleData(sale);
  
  emitSaleCreated(sale);

  res.status(201).json({
    success: true,
    message: 'Venta registrada exitosamente',
    data: normalizedSale
  });
});

// @desc    Crear venta walk-in (sin cliente registrado)
// @route   POST /api/v1/sales/walk-in
// @access  Privado/Barbero+
export const createWalkInSale = asyncHandler(async (req, res) => {
  const sale = await SaleUseCases.createWalkInSale(req.body);
  
  // Normalizar datos de respuesta
  const normalizedSale = await DataNormalizationService.normalizeSaleData(sale);
  
  emitSaleCreated(sale);

  res.status(201).json({
    success: true,
    message: 'Venta walk-in registrada exitosamente',
    data: normalizedSale
  });
});

// @desc    Crear venta desde carrito con métodos de pago múltiples
// @route   POST /api/v1/sales/cart
// @access  Privado/Barbero+
export const createCartSale = asyncHandler(async (req, res) => {
  logger.debug('Creando venta desde carrito', { 
    userId: req.user.id, 
    role: req.user.role,
    itemsCount: req.body.cart?.length || 0
  });
  
  // DIAGNÓSTICO: Ver qué está recibiendo el endpoint
  logger.debug('PAYLOAD RECIBIDO:');
  logger.debug(`  - hasCart: ${!!req.body.cart}`);
  logger.debug(`  - cartLength: ${req.body.cart?.length || 0}`);
  logger.debug(`  - hasBarberId: ${!!req.body.barberId}`);
  logger.debug(`  - hasNotes: ${!!req.body.notes}`);
  logger.debug(`  - hasClientData: ${!!req.body.clientData}`);
  logger.debug(`  - clientDataType: ${typeof req.body.clientData}`);
  
  if (req.body.clientData) {
    logger.debug('CLIENT DATA RECIBIDO:');
    logger.debug(`  - Keys: ${Object.keys(req.body.clientData).join(', ')}`);
    logger.debug(`  - JSON: ${JSON.stringify(req.body.clientData, null, 2)}`);
  } else {
    logger.warn('CLIENT DATA ES NULL/UNDEFINED');
  }
  
  const result = await SaleUseCases.createCartSale(req.body);
  
  // Extraer las ventas del resultado
  const sales = result.sales;
  
  // Normalizar todos los datos de respuesta
  const normalizedSales = await Promise.all(
    sales.map(sale => DataNormalizationService.normalizeSaleData(sale))
  );

  sales.forEach(sale => emitSaleCreated(sale));
  
  res.status(201).json({
    success: true,
    message: result.message || 'Venta desde carrito registrada exitosamente',
    data: normalizedSales,
    totalAmount: result.totalAmount,
    itemsCount: result.itemsCount
  });
});

// @desc    Obtener reporte por período
// @route   GET /api/v1/sales/reports
// @access  Privado/Admin
export const getReports = asyncHandler(async (req, res) => {
  const { type, date, barberId } = req.query;

  if (!type || !date) {
    throw new AppError('El tipo de reporte y la fecha son requeridos', 400);
  }

  if (!['daily', 'weekly', 'monthly'].includes(type)) {
    throw new AppError('Tipo de reporte no válido. Use: daily, weekly, monthly', 400);
  }

  const report = await SaleUseCases.getReportByPeriod(type, new Date(date));

  // Si se pasa barberId, filtrar solo ese barbero
  if (barberId) {
    const productSalesArr = Array.isArray(report.productSales) ? report.productSales : [];
    const filtered = productSalesArr.filter(b => String(b._id) === String(barberId));
    res.json({
      success: true,
      ...report,
      productSales: filtered
    });
    return;
  }

  res.json({
    success: true,
    ...report
  });
});

// @desc    Obtener reporte diario (mantener compatibilidad)
// @route   GET /api/v1/sales/daily-report
// @access  Privado/Admin
export const getDailyReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  
  if (!date) {
    throw new AppError('La fecha es requerida', 400);
  }
  
  const report = await SaleUseCases.getDailyReport(new Date(date));
  
  res.json({
    success: true,
    date: date,
    data: report
  });
});

// @desc    Obtener todas las ventas
// @route   GET /api/v1/sales
// @access  Privado/Admin
export const getAllSales = asyncHandler(async (req, res) => {
  const sales = await SaleUseCases.getAllSales(req.query);
  
  res.json({
    success: true,
    count: sales.length,
    data: sales
  });
});

// @desc    Obtener facturas de carrito (TODAS las ventas desde carrito, con o sin clientData)
// @route   GET /api/v1/sales/cart-invoices
// @access  Privado/Barbero+ (barberos ven sus facturas, admins ven todas)
export const getCartInvoices = asyncHandler(async (req, res) => {
  logger.debug('Obteniendo TODAS las ventas de carrito', {
    userId: req.user.id,
    role: req.user.role
  });

  // Si es barbero, obtener su barberId
  let barberId = null;
  if (req.user.role === 'barber') {
    const barber = await SaleUseCases.findBarberByIdOrUserId(req.user.id);
    barberId = barber._id;
    logger.debug('Barbero autenticado', { barberId });
  }

  // Llamar al método que filtra por notas de carrito
  const cartInvoices = await SaleUseCases.getCartInvoices(barberId);

  logger.debug(`Ventas de carrito encontradas: ${cartInvoices.length}`, {
    role: req.user.role,
    barberId: barberId || 'admin',
    ventasConClientData: cartInvoices.filter(s => s.clientData).length,
    ventasPOS: cartInvoices.filter(s => !s.clientData).length,
    sampleData: cartInvoices.length > 0 ? {
      firstInvoice: {
        id: cartInvoices[0]._id,
        clientName: cartInvoices[0].clientData 
          ? `${cartInvoices[0].clientData?.firstName} ${cartInvoices[0].clientData?.lastName}`
          : 'Venta POS',
        date: cartInvoices[0].saleDate
      }
    } : 'Sin ventas de carrito'
  });

  res.json({
    success: true,
    count: cartInvoices.length,
    data: cartInvoices
  });
});

// @desc    Obtener venta por ID
// @route   GET /api/v1/sales/:id
// @access  Privado/Admin
export const getSale = asyncHandler(async (req, res) => {
  const sale = await SaleUseCases.getSaleById(req.params.id);

  // Barbero: solo puede ver sus propias ventas
  if (req.user.role === 'barber') {
    const barber = await Barber.findOne({ user: req.user._id });
    const saleBarberId = sale?.barberId?._id || sale?.barberId;
    if (!barber || String(saleBarberId) !== String(barber._id)) {
      throw new AppError('No tienes permiso para ver esta venta', 403);
    }
  }
  
  res.json({
    success: true,
    data: sale
  });
});

// @desc    Cancelar venta
// @route   PUT /api/v1/sales/:id/cancel
// @access  Privado/Admin
export const cancelSale = asyncHandler(async (req, res) => {
  const sale = await SaleUseCases.cancelSale(req.params.id);
  
  res.json({
    success: true,
    message: 'Venta cancelada exitosamente',
    data: sale
  });
});

// @desc    Obtener estadísticas de ventas por barbero
// @route   GET /api/v1/sales/barber/:barberId/stats
// @access  Privado/Admin
export const getBarberSalesStats = asyncHandler(async (req, res) => {
  const { barberId } = req.params;
  const { date, startDate, endDate } = req.query;
  
  logger.debug(`[Controller] getBarberSalesStats llamado - barberId: ${barberId}, filters:`, { date, startDate, endDate });
  
  const stats = await SaleUseCases.getBarberSalesStats(barberId, {
    date,
    startDate,
    endDate
  });
  
  logger.debug(`[Controller] Stats recibidas del UseCase:`, { stats, isNull: stats === null, type: typeof stats });
  
  res.json({
    success: true,
    data: stats
  });
});

// @desc    Obtener estadísticas de ventas para varios barberos (batch)
// @route   GET /api/v1/sales/barbers/stats?ids=a,b,c
// @access  Privado/Admin
export const getBarbersSalesStats = asyncHandler(async (req, res) => {
  const { ids, date, startDate, endDate } = req.query;

  const barberIds = String(ids || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (barberIds.length === 0) {
    throw new AppError('Se requiere al menos un id de barbero', 400);
  }

  const stats = await SaleUseCases.getBarbersSalesStats(barberIds, { date, startDate, endDate });

  res.json({
    success: true,
    data: stats
  });
});

// @desc    Obtener reporte diario de ventas
// @route   GET /api/v1/sales/daily-report
// @access  Privado/Admin
export const getDailySalesReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const report = await SaleUseCases.getDailyReport(date);
  
  res.json({
    success: true,
    data: report
  });
});

// @desc    Obtener fechas disponibles con datos de ventas para un barbero
// @route   GET /api/v1/sales/barber/:barberId/available-dates
// @access  Privado/Admin
export const getAvailableDates = asyncHandler(async (req, res) => {
  const { barberId } = req.params;
  
  let dates = [];
  if (barberId) {
    dates = await SaleUseCases.getAvailableDates(barberId);
  } else {
    dates = await SaleUseCases.getAvailableDates();
  }
  
  res.status(200).json({
    success: true,
    message: 'Fechas disponibles obtenidas correctamente',
    data: dates
  });
});

// @desc    Obtener reporte detallado de ventas por producto y día
// @route   GET /api/v1/sales/detailed-report
// @access  Privado/Admin
export const getDetailedSalesReport = asyncHandler(async (req, res) => {
  const { barberId, startDate, endDate } = req.query;
  
  if (!barberId) {
    throw new AppError('barberId es requerido', 400);
  }

  const detailedReport = await SaleUseCases.getDetailedSalesReport(barberId, startDate, endDate);
  
  res.status(200).json({
    success: true,
    message: 'Reporte detallado de ventas obtenido correctamente',
    data: detailedReport
  });
});

// @desc    Obtener detalles de cortes walk-in por barbero y rango de fechas
// @route   GET /api/v1/sales/walk-in-details
// @access  Privado/Admin
export const getWalkInDetails = asyncHandler(async (req, res) => {
  const { barberId, startDate, endDate } = req.query;
  
  if (!barberId) {
    throw new AppError('barberId es requerido', 400);
  }

  const walkInDetails = await SaleUseCases.getWalkInDetails(barberId, startDate, endDate);
  
  res.status(200).json({
    success: true,
    message: 'Detalles de cortes walk-in obtenidos correctamente',
    data: walkInDetails
  });
});

// @desc    Obtener reporte detallado de cortes por barbero y rango de fechas
// @route   GET /api/v1/sales/detailed-cuts-report
// @access  Privado/Admin
export const getDetailedCutsReport = asyncHandler(async (req, res) => {
  const { barberId, startDate, endDate } = req.query;
  
  if (!barberId) {
    throw new AppError('barberId es requerido', 400);
  }

  const detailedReport = await SaleUseCases.getDetailedCutsReport(barberId, startDate, endDate);
  
  res.status(200).json({
    success: true,
    message: 'Reporte detallado de cortes obtenido correctamente',
    data: detailedReport
  });
});

// @desc    Obtener resumen financiero completo para reportes
// @route   GET /api/v1/sales/financial-summary
// @access  Privado/Admin
export const getFinancialSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  if (!startDate || !endDate) {
    throw new AppError('startDate y endDate son requeridos', 400);
  }

  const financialSummary = await SaleUseCases.getFinancialSummary(startDate, endDate);
  
  res.status(200).json({
    success: true,
    message: 'Resumen financiero obtenido correctamente',
    data: financialSummary
  });
});
