import InvoiceUseCases from '../../core/application/usecases/InvoiceUseCases.js';
import printerService from '../../services/printerService.js';
import invoiceService from '../../services/invoiceService.js';
import emailService from '../../services/emailService.js';
import Sale from '../../core/domain/entities/Sale.js';
import Barber from '../../core/domain/entities/Barber.js';
import { asyncHandler } from '../middleware/index.js';
import { logger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/utils/errors.js';
import { getPrinterConfig, getBusinessInfo } from '../../../config/printer.config.js';
import { formatShort, formatInColombiaTime } from '../../shared/utils/dateUtils.js';

/**
 * @desc    Generar factura desde una venta
 * @route   POST /api/invoices/generate/:saleId
 * @access  Private (Barber/Admin)
 */
export const generateInvoice = asyncHandler(async (req, res) => {
  const { saleId } = req.params;
  const { notes, source, device } = req.body;

  const options = {
    notes,
    source: source || 'pos',
    device,
    ipAddress: req.ip,
    location: req.headers['x-forwarded-for'] || req.connection.remoteAddress
  };

  const invoice = await InvoiceUseCases.generateInvoiceFromSale(saleId, options);

  logger.info('Factura generada', {
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    saleId,
    userId: req.user.id
  });

  res.status(201).json({
    success: true,
    message: 'Factura generada exitosamente',
    data: invoice
  });
});

/**
 * @desc    Imprimir factura
 * @route   POST /api/invoices/print/:invoiceId
 * @access  Private (Barber/Admin)
 */
export const printInvoice = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const { printerInterface = 'tcp' } = req.body;

  // Formatear datos de la factura
  const invoiceData = await InvoiceUseCases.formatForPrint(invoiceId);

  // Agregar información del negocio
  invoiceData.business = getBusinessInfo();

  // Conectar a la impresora si no está conectada
  const printerStatus = printerService.getStatus();
  if (!printerStatus.connected) {
    const printerConfig = getPrinterConfig(printerInterface);
    await printerService.connectPrinter(printerConfig);
  }

  // Imprimir
  await printerService.printInvoice(invoiceData);

  // Marcar como impresa
  await InvoiceUseCases.markAsPrinted(invoiceId, req.user.id);

  logger.info('Factura impresa', {
    invoiceId,
    invoiceNumber: invoiceData.invoice.number,
    userId: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Factura impresa exitosamente',
    data: {
      invoiceId,
      invoiceNumber: invoiceData.invoice.number,
      printed: true
    }
  });
});

/**
 * @desc    Obtener factura por ID
 * @route   GET /api/invoices/:invoiceId
 * @access  Private (Barber/Admin)
 */
export const getInvoice = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;

  const invoice = await InvoiceUseCases.getInvoiceById(invoiceId);

  // Barbero: solo puede ver sus propias facturas
  if (req.user.role === 'barber') {
    const barber = await Barber.findOne({ user: req.user._id });
    const invoiceBarberId = invoice?.barber?.id;
    if (!barber || String(invoiceBarberId) !== String(barber._id)) {
      throw new AppError('No tienes permiso para ver esta factura', 403);
    }
  }

  res.status(200).json({
    success: true,
    data: invoice
  });
});

/**
 * @desc    Ver factura en HTML (navegador)
 * @route   GET /api/invoices/:invoiceId/view
 * @access  Private (Barber/Admin) o Public con token
 */
export const viewInvoiceHTML = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;

  // Obtener datos completos de la factura
  const invoiceData = await InvoiceUseCases.formatForPrint(invoiceId);
  
  // Formatear datos para el template
  const formattedData = invoiceService.formatInvoiceData(
    invoiceData.invoice,
    invoiceData.sale
  );

  // Generar HTML
  const html = invoiceService.generateInvoiceHTML(formattedData);

  // Enviar como HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);

  logger.info('Factura visualizada en HTML', {
    invoiceId,
    invoiceNumber: invoiceData.invoice.invoiceNumber,
    userId: req.user?.id
  });
});

/**
 * @desc    Obtener facturas de una venta
 * @route   GET /api/invoices/sale/:saleId
 * @access  Private (Barber/Admin)
 */
export const getInvoicesBySale = asyncHandler(async (req, res) => {
  const { saleId } = req.params;

  const invoices = await InvoiceUseCases.getInvoicesBySale(saleId);

  res.status(200).json({
    success: true,
    count: invoices.length,
    data: invoices
  });
});

/**
 * @desc    Listar facturas con filtros
 * @route   GET /api/invoices
 * @access  Private (Admin) / Barber (own invoices)
 */
export const listInvoices = asyncHandler(async (req, res) => {
  const { page, limit, sortBy, sortOrder, status, barberId, startDate, endDate, invoiceNumber } = req.query;

  const filters = {};
  if (status) filters.status = status;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (invoiceNumber) filters.invoiceNumber = invoiceNumber;

  // Si es barbero, solo ver sus propias facturas
  if (req.user.role === 'barber') {
    filters.barberId = req.user.barberId || req.user.id;
  } else if (barberId) {
    filters.barberId = barberId;
  }

  const pagination = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sortBy: sortBy || 'createdAt',
    sortOrder: sortOrder || 'desc'
  };

  const result = await InvoiceUseCases.listInvoices(filters, pagination);

  res.status(200).json({
    success: true,
    ...result
  });
});

/**
 * @desc    Obtener estadísticas de facturas
 * @route   GET /api/invoices/stats
 * @access  Private (Admin) / Barber (own stats)
 */
export const getInvoiceStats = asyncHandler(async (req, res) => {
  const { barberId, startDate, endDate } = req.query;

  const filters = {};
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  // Si es barbero, solo ver sus propias estadísticas
  if (req.user.role === 'barber') {
    filters.barberId = req.user.barberId || req.user.id;
  } else if (barberId) {
    filters.barberId = barberId;
  }

  const stats = await InvoiceUseCases.getInvoiceStats(filters);

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Cancelar factura
 * @route   PUT /api/invoices/:invoiceId/cancel
 * @access  Private (Admin)
 */
export const cancelInvoice = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new AppError('La razón de cancelación es requerida', 400);
  }

  const invoice = await InvoiceUseCases.cancelInvoice(invoiceId, reason);

  logger.info('Factura cancelada', {
    invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    reason,
    userId: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Factura cancelada exitosamente',
    data: invoice
  });
});

/**
 * @desc    Test de impresión
 * @route   POST /api/invoices/printer/test
 * @access  Private (Admin)
 */
export const testPrinter = asyncHandler(async (req, res) => {
  const { printerInterface = 'tcp' } = req.body;

  // Conectar a la impresora si no está conectada
  const printerStatus = printerService.getStatus();
  if (!printerStatus.connected) {
    const printerConfig = getPrinterConfig(printerInterface);
    await printerService.connectPrinter(printerConfig);
  }

  // Ejecutar test
  await printerService.printTest();

  logger.info('Test de impresión ejecutado', {
    userId: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Test de impresión ejecutado exitosamente'
  });
});

/**
 * @desc    Obtener estado de la impresora
 * @route   GET /api/invoices/printer/status
 * @access  Private (Admin)
 */
export const getPrinterStatus = asyncHandler(async (req, res) => {
  const status = printerService.getStatus();

  res.status(200).json({
    success: true,
    data: status
  });
});

/**
 * @desc    Conectar impresora
 * @route   POST /api/invoices/printer/connect
 * @access  Private (Admin)
 */
export const connectPrinter = asyncHandler(async (req, res) => {
  const { interface: printerInterface = 'tcp', host, port, deviceName } = req.body;

  const config = getPrinterConfig(printerInterface);

  // Sobrescribir con valores del request si existen
  if (host) config.host = host;
  if (port) config.port = port;
  if (deviceName) config.deviceName = deviceName;

  await printerService.connectPrinter(config);

  logger.info('Impresora conectada', {
    interface: printerInterface,
    userId: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Impresora conectada exitosamente',
    data: printerService.getStatus()
  });
});

/**
 * @desc    Generar reporte consolidado para un barbero en un período
 * @route   GET /api/invoices/consolidated/:barberId
 * @access  Private (Admin)
 * @query   startDate, endDate (opcional - si no se proporcionan, trae todos los registros)
 */
export const generateConsolidatedInvoice = asyncHandler(async (req, res) => {
  const { barberId } = req.params;
  const { startDate, endDate } = req.query;

  logger.info('Generando reporte consolidado', {
    barberId,
    startDate,
    endDate,
    userId: req.user.id
  });

  // Importar modelos necesarios
  const { default: Sale } = await import('../../core/domain/entities/Sale.js');
  const { default: Appointment } = await import('../../core/domain/entities/Appointment.js');
  const { default: Barber } = await import('../../core/domain/entities/Barber.js');

  // Buscar barbero
  const barber = await Barber.findById(barberId).populate('user', 'name email phone profilePicture');
  if (!barber) {
    throw new AppError('Barbero no encontrado', 404);
  }

  // Construir query de filtros
  const dateFilter = {};
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    dateFilter.createdAt = { $gte: start, $lte: end };
  }

  logger.info('Fechas recibidas y procesadas:', {
    startDateOriginal: startDate,
    endDateOriginal: endDate,
    startDateParsed: dateFilter.createdAt?.$gte,
    endDateParsed: dateFilter.createdAt?.$lte
  });

  // Obtener todas las ventas del barbero
  const sales = await Sale.find({
    barberId: barberId,
    status: { $ne: 'cancelled' },
    ...dateFilter
  }).sort({ createdAt: -1 }).lean();

  // Obtener todas las citas completadas del barbero
  const appointments = await Appointment.find({
    barber: barberId,
    status: 'completed',
    ...(dateFilter.createdAt && { date: dateFilter.createdAt })
  }).populate('service', 'name basePrice').sort({ date: -1 }).lean();

  // Calcular totales correctamente usando totalAmount o total
  const salesTotal = sales.reduce((sum, sale) => {
    return sum + (sale.totalAmount || 0);
  }, 0);

  const appointmentsTotal = appointments.reduce((sum, apt) => {
    return sum + (apt.price || apt.service?.basePrice || 0);
  }, 0);

  const grandTotal = salesTotal + appointmentsTotal;

  // Agrupar ventas por tipo
  const productSales = sales.filter(s => s.type === 'product');
  const walkInSales = sales.filter(s => s.type === 'walkIn');

  // Formatear fechas del período sin conversión de zona horaria
  const formatPeriodDate = (dateString) => {
    if (!dateString) return null;
    // Parsear directamente el string YYYY-MM-DD sin conversión
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  // Verificar si es un solo día o un rango
  const isSingleDay = startDate && endDate && startDate === endDate;
  const periodLabel = isSingleDay ? 'Día' : 'Período';
  const periodValue = isSingleDay 
    ? formatPeriodDate(startDate) 
    : `${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}`;

  // Formatear datos para la factura HTML
  const invoiceData = {
    invoiceNumber: `CONS-${barberId.slice(-6)}-${Date.now()}`,
    barber: {
      name: barber.user?.name || 'N/A',
      email: barber.user?.email || 'N/A',
      phone: barber.user?.phone || 'N/A'
    },
    period: {
      label: periodLabel,
      value: periodValue || (startDate ? `${formatPeriodDate(startDate)} - ${formatPeriodDate(endDate)}` : 'Todo el historial')
    },
    summary: {
      productSales: {
        count: productSales.reduce((sum, s) => sum + (s.quantity || 1), 0), // Suma de cantidades
        transactions: productSales.length, // Número de transacciones
        total: productSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0)
      },
      walkInSales: {
        count: walkInSales.length,
        total: walkInSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0)
      },
      appointments: {
        count: appointments.length,
        total: appointmentsTotal
      },
      grandTotal
    },
    details: {
      productSales,
      walkInSales,
      appointments
    },
    generatedAt: new Date(),
    generatedBy: req.user.name || req.user.email
  };

  // Generar HTML de la factura
  const html = generateConsolidatedInvoiceHTML(invoiceData);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/**
 * Genera el HTML para el reporte consolidado (formato térmico 80mm)
 */
function generateConsolidatedInvoiceHTML(data) {
  const formatCurrency = (amount) => {
    if (isNaN(amount) || amount === null || amount === undefined) return '$0';
    return '$' + Math.round(amount).toLocaleString('es-CO');
  };

  // Usar el sistema centralizado de fechas para formato consistente
  const formatDate = (date) => {
    return formatShort(date);
  };

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Consolidado - ${data.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
      @page { size: 80mm auto; margin: 2mm; }
    }
    
    body {
      font-family: 'Courier New', monospace;
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 5mm;
      color: #000;
      background: #fff;
      font-size: 9pt;
      line-height: 1.2;
      font-weight: 600;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    
    .header .business-name {
      font-size: 11pt;
      font-weight: bold;
      color: #000;
      margin-bottom: 3px;
    }
    
    .header h1 {
      font-size: 12pt;
      font-weight: bold;
      margin: 5px 0;
    }
    
    .header .invoice-number {
      font-size: 8pt;
      margin-top: 3px;
    }
    
    .section {
      margin-bottom: 10px;
    }
    
    .section-title {
      font-size: 9pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 5px;
      padding-bottom: 3px;
      border-bottom: 1px solid #000;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      margin-bottom: 3px;
      padding-bottom: 2px;
      border-bottom: 1px dotted #ccc;
    }
    
    .info-row strong {
      font-weight: bold;
      text-transform: uppercase;
    }
    
    .info-row span {
      text-align: right;
    }
    
    .separator {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    
    .summary-box {
      padding: 8px 0;
      margin: 10px 0 6px 0;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    
    .summary-title {
      font-size: 10pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 8px;
      text-align: center;
      color: #000;
    }
    
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      margin: 4px 0;
      color: #000;
      font-weight: 600;
    }
    
    .summary-row.total {
      font-size: 12pt;
      font-weight: bold;
      border-top: 2px solid #000;
      padding-top: 6px;
      margin-top: 8px;
      color: #000;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 6px 0;
      font-size: 8pt;
    }
    
    thead {
      border-bottom: 1px solid #000;
    }
    
    th {
      padding: 3px 2px;
      text-align: left;
      font-weight: bold;
      font-size: 7pt;
      text-transform: uppercase;
      color: #000;
    }
    
    td {
      padding: 3px 2px;
      font-size: 8pt;
      border-bottom: 1px dotted #ccc;
      color: #000;
      font-weight: 600;
    }
    
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    
    .footer {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #000;
      text-align: center;
      font-size: 7pt;
      line-height: 1.3;
    }
    
    .print-btn {
      padding: 12px 30px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      margin: 15px auto;
      display: block;
      width: 90%;
      max-width: 250px;
    }
    
    .print-btn:hover {
      background: #0056b3;
    }
    
    @media screen {
      body {
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        margin: 20px auto;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="business-name">THE BROTHERS</div>
    <div class="business-name">BARBER SHOP</div>
    <h1>REPORTE CONSOLIDADO</h1>
    <h1>    POR BARBERO    </h1>
    <div class="invoice-number">${data.invoiceNumber}</div>
  </div>
  
  <div class="section">
    <div class="info-row">
      <strong>Barbero:</strong>
      <span>${data.barber.name}</span>
    </div>
    <div class="info-row">
      <strong>${data.period.label}:</strong>
      <span>${data.period.value}</span>
    </div>
    <div class="info-row">
      <strong>Generado:</strong>
      <span>${formatDate(data.generatedAt)}</span>
    </div>
  </div>
  
  <div class="separator"></div>
  
  ${data.details.productSales.length > 0 ? `
  <div class="section">
    <div class="section-title">Ventas de Productos (${data.details.productSales.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width: 30%;">Fecha</th>
          <th style="width: 40%;">Producto</th>
          <th class="text-right" style="width: 30%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.details.productSales.map(sale => {
          const productName = sale.productName || 'Producto';
          const shortName = productName.length > 15 ? productName.substring(0, 15) + '...' : productName;
          const quantity = sale.quantity || 1;
          const displayText = quantity > 1 ? `${shortName} (x${quantity})` : shortName;
          return `
          <tr>
            <td>${formatDate(sale.saleDate || sale.createdAt)}</td>
            <td title="${productName}">${displayText}</td>
            <td class="text-right">${formatCurrency(sale.totalAmount || 0)}</td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  <div class="separator"></div>
  ` : ''}
  
  ${data.details.walkInSales.length > 0 ? `
  <div class="section">
    <div class="section-title">Cortes (${data.details.walkInSales.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width: 30%;">Fecha</th>
          <th style="width: 40%;">Servicio</th>
          <th class="text-right" style="width: 30%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${data.details.walkInSales.map(sale => {
          const serviceName = sale.serviceName || 'Corte';
          const shortName = serviceName.length > 18 ? serviceName.substring(0, 18) + '...' : serviceName;
          return `
          <tr>
            <td>${formatDate(sale.saleDate || sale.createdAt)}</td>
            <td title="${serviceName}">${shortName}</td>
            <td class="text-right">${formatCurrency(sale.totalAmount || 0)}</td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  <div class="separator"></div>
  ` : ''}
  
  ${data.details.appointments.length > 0 ? `
  <div class="section">
    <div class="section-title">Citas Completadas (${data.summary.appointments.count})</div>
    <table>
      <thead>
        <tr>
          <th style="width: 30%;">Fecha</th>
          <th style="width: 40%;">Servicio</th>
          <th class="text-right" style="width: 30%;">Precio</th>
        </tr>
      </thead>
      <tbody>
        ${data.details.appointments.map(apt => {
          const serviceName = apt.service?.name || 'N/A';
          const shortName = serviceName.length > 15 ? serviceName.substring(0, 15) + '...' : serviceName;
          return `
          <tr>
            <td>${formatDate(apt.date)}</td>
            <td title="${serviceName}">${shortName}</td>
            <td class="text-right">${formatCurrency(apt.price || apt.service?.basePrice || 0)}</td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>
  <div class="separator"></div>
  ` : ''}
  
  <div class="summary-box">
    <div class="summary-title">RESUMEN GENERAL</div>
    <div class="summary-row">
      <span>Productos (${data.summary.productSales.count} unidades):</span>
      <strong>${formatCurrency(data.summary.productSales.total)}</strong>
    </div>
    <div class="summary-row">
      <span>Cortes (${data.summary.walkInSales.count}):</span>
      <strong>${formatCurrency(data.summary.walkInSales.total)}</strong>
    </div>
    <div class="summary-row">
      <span>Citas (${data.summary.appointments.count}):</span>
      <strong>${formatCurrency(data.summary.appointments.total)}</strong>
    </div>
    <div class="summary-row total">
      <span>TOTAL:</span>
      <strong>${formatCurrency(data.summary.grandTotal)}</strong>
    </div>
  </div>
  
  <div class="footer">
    <p><strong>REPORTE GENERADO EL DIA ${formatDate(data.generatedAt)} </strong></p>
    <p>www.thebrothersbarber.com</p>
  </div>
  
  <button class="print-btn no-print" onclick="window.print()">
    Imprimir Reporte
  </button>
  
  <script>
    // Auto-focus en el botón de imprimir
    window.addEventListener('load', function() {
      document.querySelector('.print-btn').focus();
    });
    
    // Atajo de teclado Ctrl+P
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
      }
    });
  </script>
</body>
</html>
  `;
}

/**
 * @desc    Desconectar impresora
 * @route   POST /api/invoices/printer/disconnect
 * @access  Private (Admin)
 */
export const disconnectPrinter = asyncHandler(async (req, res) => {
  await printerService.disconnectPrinter();

  logger.info('Impresora desconectada', {
    userId: req.user.id
  });

  res.status(200).json({
    success: true,
    message: 'Impresora desconectada exitosamente'
  });
});

/**
 * @desc    Generar y enviar factura de carrito
 * @route   POST /api/invoices/cart
 * @access  Private (Barber/Admin)
 */
export const generateCartInvoice = asyncHandler(async (req, res) => {
  const { saleIds, clientData, sendEmail } = req.body;

  logger.info('Generando factura de carrito', {
    saleIdsCount: saleIds?.length,
    hasClientData: !!clientData,
    sendEmail,
    userId: req.user.id
  });

  // Validar que hay IDs de ventas
  if (!saleIds || !Array.isArray(saleIds) || saleIds.length === 0) {
    throw new AppError('Se requieren los IDs de las ventas del carrito', 400);
  }

  // Validar datos del cliente si se solicita envío por email
  if (sendEmail && (!clientData || !clientData.email)) {
    throw new AppError('Se requiere el email del cliente para enviar la factura', 400);
  }

  // Obtener las ventas del carrito
  const sales = await Sale.find({ _id: { $in: saleIds } })
    .populate('barberId', 'name phone')
    .populate('productId', 'name price');

  if (sales.length === 0) {
    throw new AppError('No se encontraron ventas para el carrito', 404);
  }

  // Generar factura para cada venta
  const invoices = [];
  for (const sale of sales) {
    const invoice = await InvoiceUseCases.generateInvoiceFromSale(sale._id.toString(), {
      source: 'cart',
      notes: `Factura de carrito - Cliente: ${clientData?.firstName} ${clientData?.lastName}`,
      ipAddress: req.ip,
      location: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });
    invoices.push(invoice);
  }

  // Preparar datos para el email
  const cartSummary = {
    invoices,
    sales,
    clientData,
    total: sales.reduce((sum, sale) => sum + sale.totalAmount, 0),
    itemCount: sales.reduce((sum, sale) => sum + sale.quantity, 0)
  };

  // Enviar email si se solicitó
  if (sendEmail && clientData?.email) {
    try {
      await emailService.sendCartInvoice(cartSummary, clientData);
      logger.info('Factura de carrito enviada por email', {
        email: clientData.email,
        invoiceCount: invoices.length
      });
    } catch (emailError) {
      logger.error('Error enviando email de factura de carrito:', emailError);
      // No fallar la request si el email falla
    }
  }

  res.status(201).json({
    success: true,
    message: sendEmail ? 'Factura generada y enviada por email' : 'Factura generada exitosamente',
    data: {
      invoices,
      cartSummary
    }
  });
});

/**
 * @desc    Obtener facturas de carrito con datos de cliente
 * @route   GET /api/invoices/cart
 * @access  Private (Barber/Admin)
 */
export const getCartInvoices = asyncHandler(async (req, res) => {
  const { startDate, endDate, barberId, includeUnregistered = 'true' } = req.query;

  logger.info('Obteniendo facturas de carrito', {
    startDate,
    endDate,
    barberId,
    includeUnregistered,
    userId: req.user.id
  });

  const invoicesList = [];

  // === PARTE 1: CARRITOS CON DATOS DE CLIENTE (FACTURAS FORMALES) ===
  const formalCartQuery = {
    clientData: { $exists: true, $ne: null },
    status: { $in: ['completed', 'refunded'] }
  };

  if (startDate || endDate) {
    formalCartQuery.saleDate = {};
    if (startDate) formalCartQuery.saleDate.$gte = new Date(startDate);
    if (endDate) formalCartQuery.saleDate.$lte = new Date(endDate);
  }

  if (barberId) {
    formalCartQuery.barberId = barberId;
  }

  // Obtener ventas con datos de cliente
  const formalSales = await Sale.find(formalCartQuery)
    .populate('barberId', 'name phone')
    .populate('productId', 'name price category')
    .sort({ saleDate: -1 })
    .limit(100);

  // Agrupar carritos formales por cliente y fecha
  const formalCartInvoices = formalSales.reduce((acc, sale) => {
    if (!sale.clientData?.email) return acc;

    const key = `${sale.clientData.email}-${sale.saleDate.toISOString().split('T')[0]}`;
    
    if (!acc[key]) {
      acc[key] = {
        type: 'formal', // Carrito con datos de cliente
        clientData: sale.clientData,
        barberId: sale.barberId,
        barberName: sale.barberName,
        saleDate: sale.saleDate,
        items: [],
        total: 0,
        saleIds: [],
        hasRefunds: false
      };
    }

    // Determinar si el item está reembolsado
    const isRefunded = sale.status === 'refunded';
    const displayQuantity = isRefunded ? 0 : sale.quantity;
    const displayTotal = isRefunded ? 0 : sale.totalAmount;

    acc[key].items.push({
      productName: sale.productName,
      quantity: displayQuantity,
      originalQuantity: sale.quantity, // Cantidad original para referencia
      unitPrice: sale.unitPrice,
      totalAmount: displayTotal,
      originalTotal: sale.totalAmount, // Total original para referencia
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      isRefunded: isRefunded,
      refundedAt: sale.refundedAt,
      refundReason: sale.refundReason
    });
    
    // Solo agregar al total si no está reembolsado
    acc[key].total += displayTotal;
    acc[key].saleIds.push(sale._id);
    
    // Marcar el carrito si tiene reembolsos
    if (isRefunded) {
      acc[key].hasRefunds = true;
    }

    return acc;
  }, {});

  invoicesList.push(...Object.values(formalCartInvoices));

  // === PARTE 2: CARRITOS SIN DATOS DE CLIENTE (VENTAS AGRUPADAS) ===
  if (includeUnregistered === 'true') {
    const informalCartQuery = {
      clientData: { $exists: false },
      status: { $in: ['completed', 'refunded'] }
    };

    if (startDate || endDate) {
      informalCartQuery.saleDate = {};
      if (startDate) informalCartQuery.saleDate.$gte = new Date(startDate);
      if (endDate) informalCartQuery.saleDate.$lte = new Date(endDate);
    }

    if (barberId) {
      informalCartQuery.barberId = barberId;
    }

    // Obtener ventas sin datos de cliente
    const informalSales = await Sale.find(informalCartQuery)
      .populate('barberId', 'name phone')
      .populate('productId', 'name price category')
      .sort({ saleDate: -1 })
      .limit(200);

    // Agrupar por barbero y fecha para detectar carritos
    const informalCartInvoices = informalSales.reduce((acc, sale) => {
      const dateKey = sale.saleDate.toISOString().split('T')[0];
      const key = `${sale.barberId._id}-${dateKey}`;
      
      if (!acc[key]) {
        acc[key] = {
          type: 'informal', // Carrito sin datos de cliente
          clientData: null,
          barberId: sale.barberId,
          barberName: sale.barberId?.name || sale.barberName,
          saleDate: sale.saleDate,
          items: [],
          total: 0,
          saleIds: [],
          hasRefunds: false
        };
      }

      // Determinar si el item está reembolsado
      const isRefunded = sale.status === 'refunded';
      const displayQuantity = isRefunded ? 0 : sale.quantity;
      const displayTotal = isRefunded ? 0 : sale.totalAmount;

      acc[key].items.push({
        productName: sale.productName,
        quantity: displayQuantity,
        originalQuantity: sale.quantity,
        unitPrice: sale.unitPrice,
        totalAmount: displayTotal,
        originalTotal: sale.totalAmount,
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        isRefunded: isRefunded,
        refundedAt: sale.refundedAt,
        refundReason: sale.refundReason
      });
      
      acc[key].total += displayTotal;
      acc[key].saleIds.push(sale._id);
      
      if (isRefunded) {
        acc[key].hasRefunds = true;
      }

      return acc;
    }, {});

    // Solo incluir carritos con múltiples items (2 o más)
    const multiItemCarts = Object.values(informalCartInvoices).filter(cart => cart.items.length >= 2);
    invoicesList.push(...multiItemCarts);

    logger.info('Carritos sin datos de cliente detectados', {
      totalInformalSales: informalSales.length,
      groupedCarts: Object.keys(informalCartInvoices).length,
      multiItemCarts: multiItemCarts.length
    });
  }

  // Ordenar por fecha descendente
  invoicesList.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));

  logger.info('Facturas de carrito obtenidas', {
    formalCarts: Object.keys(formalCartInvoices).length,
    informalCarts: includeUnregistered === 'true' ? invoicesList.length - Object.keys(formalCartInvoices).length : 0,
    totalInvoices: invoicesList.length
  });

  res.status(200).json({
    success: true,
    data: invoicesList,
    count: invoicesList.length,
    breakdown: {
      formal: Object.keys(formalCartInvoices).length,
      informal: includeUnregistered === 'true' ? invoicesList.length - Object.keys(formalCartInvoices).length : 0
    }
  });
});

/**
 * @desc    Obtener información de reembolsos de un carrito
 * @route   GET /api/invoices/cart/:cartId/refunds
 * @access  Private (Barber/Admin)
 */
export const getCartRefundInfo = asyncHandler(async (req, res) => {
  const { cartId } = req.params;

  logger.info('Obteniendo información de reembolsos del carrito', {
    cartId,
    userId: req.user.id
  });

  // Obtener todas las ventas del carrito (incluyendo reembolsadas)
  const sales = await Sale.find({
    _id: { $in: cartId.split(',') }
  }).populate('refundedBy', 'email name');

  if (!sales.length) {
    throw new AppError('Carrito no encontrado', 404);
  }

  // Analizar reembolsos
  const refundInfo = {
    totalItems: sales.length,
    refundedItems: sales.filter(s => s.status === 'refunded').length,
    completedItems: sales.filter(s => s.status === 'completed').length,
    cancelledItems: sales.filter(s => s.status === 'cancelled').length,
    originalTotal: sales.reduce((sum, s) => sum + s.totalAmount, 0),
    refundedAmount: sales.filter(s => s.status === 'refunded').reduce((sum, s) => sum + s.totalAmount, 0),
    currentTotal: sales.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.totalAmount, 0),
    refunds: sales.filter(s => s.status === 'refunded').map(s => ({
      saleId: s._id,
      productName: s.productName || s.serviceName,
      amount: s.totalAmount,
      refundedAt: s.refundedAt,
      refundReason: s.refundReason,
      refundedBy: s.refundedBy
    }))
  };

  res.status(200).json({
    success: true,
    data: refundInfo
  });
});
