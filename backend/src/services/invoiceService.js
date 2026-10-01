// Servicio de Generación de Facturas
// Genera facturas en formato HTML para visualización en navegador

import { getBusinessInfo } from '../../config/printer.config.js';
import { logger } from '../shared/utils/logger.js';

// Generar HTML de factura para mostrar en navegador
// Valida que la factura tenga número y construye el documento con estilos inline
// e información de negocio/cliente/barbero obtenida del printer.config.
// @param {Object} invoiceData - Datos de la factura
// @returns {string} HTML de la factura
export const generateInvoiceHTML = (invoiceData) => {
  try {
    logger.info('🔵 INICIO generateInvoiceHTML', { 
      receivedData: typeof invoiceData,
      keys: Object.keys(invoiceData || {})
    });

    const business = getBusinessInfo();
    
    logger.info('🟡 Business info obtenida', { businessName: business.name });
    
    const { invoice, sale, customer, barber, items, totals } = invoiceData;

    logger.info('🟢 Desestructuración completada');
    logger.info('Invoice:', invoice);
    logger.info('Sale:', sale);
    logger.info('Customer:', customer);
    logger.info('Items count:', items?.length);

    // Validar que invoice existe
    if (!invoice || !invoice.number) {
      logger.error('Invoice validation failed', { invoice });
      throw new Error('Invoice data is missing or invalid');
    }

  // Formatear fecha
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Formatear moneda colombiana
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: business.currency || 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Generar filas de items
  const itemsHTML = items.map(item => `
    <tr>
      <td class="item-name">${item.name}</td>
      <td class="text-center">${item.quantity}</td>
      <td class="text-right">${formatCurrency(item.unitPrice)}</td>
      <td class="text-right font-semibold">${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

  // HTML completo de la factura
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${invoice.number} - ${business.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }

    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .invoice-header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white;
      padding: 40px 40px 30px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
    }

    .business-info h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .business-info p {
      font-size: 14px;
      opacity: 0.9;
      line-height: 1.6;
    }

    .invoice-number {
      text-align: right;
    }

    .invoice-number .label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
      margin-bottom: 4px;
    }

    .invoice-number .number {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -1px;
    }

    .invoice-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    .meta-item {
      font-size: 13px;
    }

    .meta-label {
      opacity: 0.8;
      margin-bottom: 4px;
    }

    .meta-value {
      font-weight: 600;
      font-size: 14px;
    }

    .invoice-body {
      padding: 40px;
    }

    .section {
      margin-bottom: 30px;
    }

    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 12px;
      font-weight: 600;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .info-card {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .info-card h3 {
      font-size: 14px;
      color: #1f2937;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .info-card p {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.6;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }

    .items-table thead {
      background: #f9fafb;
    }

    .items-table th {
      padding: 12px 16px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e5e7eb;
    }

    .items-table td {
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
      color: #1f2937;
    }

    .item-name {
      font-weight: 500;
    }

    .text-center {
      text-align: center;
    }

    .text-right {
      text-align: right;
    }

    .font-semibold {
      font-weight: 600;
    }

    .totals-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
    }

    .totals-grid {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      min-width: 300px;
      font-size: 14px;
    }

    .total-row.subtotal .label,
    .total-row.discount .label,
    .total-row.tax .label {
      color: #6b7280;
    }

    .total-row.final {
      padding-top: 12px;
      border-top: 2px solid #3b82f6;
      font-size: 20px;
      font-weight: 700;
      color: #1e3a8a;
    }

    .payment-info {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }

    .payment-info h4 {
      font-size: 14px;
      color: #1e40af;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .payment-details {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      font-size: 13px;
      color: #1e40af;
    }

    .payment-detail {
      display: flex;
      gap: 8px;
    }

    .payment-detail .label {
      opacity: 0.8;
    }

    .payment-detail .value {
      font-weight: 600;
    }

    .invoice-footer {
      background: #f9fafb;
      padding: 30px 40px;
      border-top: 1px solid #e5e7eb;
    }

    .footer-content {
      text-align: center;
    }

    .footer-message {
      font-size: 16px;
      color: #3b82f6;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .footer-details {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.8;
    }

    .print-button {
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
      color: white;
      border: none;
      padding: 16px 32px;
      border-radius: 50px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .print-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 15px 40px rgba(59, 130, 246, 0.5);
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .invoice-container {
        box-shadow: none;
        border-radius: 0;
      }

      .print-button {
        display: none;
      }
    }

    @media (max-width: 640px) {
      body {
        padding: 10px;
      }

      .invoice-header {
        padding: 30px 20px 20px;
      }

      .header-top {
        flex-direction: column;
        gap: 20px;
      }

      .invoice-number {
        text-align: left;
      }

      .invoice-body {
        padding: 20px;
      }

      .info-grid {
        grid-template-columns: 1fr;
      }

      .items-table {
        font-size: 12px;
      }

      .items-table th,
      .items-table td {
        padding: 8px;
      }

      .total-row {
        min-width: 100%;
      }

      .print-button {
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        font-size: 14px;
      }
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-paid {
      background: #d1fae5;
      color: #065f46;
    }

    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }

    .status-cancelled {
      background: #fee2e2;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="invoice-header">
      <div class="header-top">
        <div class="business-info">
          <h1>${business.name}</h1>
          <p>${business.address}</p>
          <p>${business.city}, ${business.country}</p>
          <p>${business.phone} • ${business.email}</p>
          <p>${business.taxId}</p>
        </div>
        <div class="invoice-number">
          <div class="label">Factura</div>
          <div class="number">#${invoice.number}</div>
        </div>
      </div>
      
      <div class="invoice-meta">
        <div class="meta-item">
          <div class="meta-label">Fecha de emisión</div>
          <div class="meta-value">${formatDate(invoice.date)}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Estado</div>
          <div class="meta-value">
            <span class="status-badge status-${invoice.status}">${invoice.status === 'paid' ? 'Pagada' : invoice.status === 'pending' ? 'Pendiente' : 'Cancelada'}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="invoice-body">
      <!-- Información del Cliente y Barbero -->
      <div class="info-grid">
        <div class="info-card">
          <h3>Cliente</h3>
          <p><strong>${customer.name}</strong></p>
          ${customer.email ? `<p>${customer.email}</p>` : ''}
          ${customer.phone ? `<p>${customer.phone}</p>` : ''}
        </div>
        
        <div class="info-card">
          <h3>Atendido por</h3>
          <p><strong>${barber.name}</strong></p>
          <p>Barbero profesional</p>
        </div>
      </div>

      <!-- Items -->
      <div class="section">
        <h2 class="section-title">Detalles del servicio</h2>
        <table class="items-table">
          <thead>
            <tr>
              <th>Descripción</th>
              <th class="text-center">Cantidad</th>
              <th class="text-right">Precio Unit.</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
      </div>

      <!-- Totales -->
      <div class="totals-section">
        <div class="totals-grid">
          ${totals.subtotal ? `
            <div class="total-row subtotal">
              <span class="label">Subtotal:</span>
              <span class="value">${formatCurrency(totals.subtotal)}</span>
            </div>
          ` : ''}
          
          ${totals.discount > 0 ? `
            <div class="total-row discount">
              <span class="label">Descuento:</span>
              <span class="value">-${formatCurrency(totals.discount)}</span>
            </div>
          ` : ''}
          
          ${totals.tax > 0 ? `
            <div class="total-row tax">
              <span class="label">IVA (${totals.taxRate}%):</span>
              <span class="value">${formatCurrency(totals.tax)}</span>
            </div>
          ` : ''}
          
          <div class="total-row final">
            <span class="label">Total:</span>
            <span class="value">${formatCurrency(totals.total)}</span>
          </div>
        </div>
      </div>

      <!-- Información de Pago -->
      ${sale.paymentMethod ? `
        <div class="payment-info">
          <h4>Información de Pago</h4>
          <div class="payment-details">
            <div class="payment-detail">
              <span class="label">Método:</span>
              <span class="value">${sale.paymentMethod}</span>
            </div>
            ${sale.paymentDate ? `
              <div class="payment-detail">
                <span class="label">Fecha de pago:</span>
                <span class="value">${formatDate(sale.paymentDate)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      ${invoice.notes ? `
        <div class="section">
          <h2 class="section-title">Notas</h2>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">${invoice.notes}</p>
        </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="footer-content">
        <div class="footer-message">${business.footer}</div>
        <div class="footer-details">
          ${business.slogan}<br>
          ${business.website}
        </div>
      </div>
    </div>
  </div>

  <!-- Botón de Impresión -->
  <button class="print-button" onclick="window.print()">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
      <path d="M6 14h12v8H6z"/>
    </svg>
    Imprimir
  </button>
</body>
</html>
  `;

  return html;
  } catch (error) {
    logger.error('Error generando HTML de factura', { 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
};

// Generar datos formateados para la factura
// Combina servicios y productos de la venta en una lista de items homogénea
// y calcula subtotal, descuento, IVA (0 por ahora) y total.
// @param {Object} invoice - Documento de factura de la DB
// @param {Object} sale - Venta asociada
// @returns {Object} Datos formateados
export const formatInvoiceData = (invoice, sale) => {
  const items = [];
  
  // Agregar servicios
  if (sale.services && sale.services.length > 0) {
    sale.services.forEach(service => {
      items.push({
        name: service.name || 'Servicio',
        quantity: 1,
        unitPrice: service.price,
        total: service.price
      });
    });
  }

  // Agregar productos
  if (sale.products && sale.products.length > 0) {
    sale.products.forEach(product => {
      items.push({
        name: product.name || 'Producto',
        quantity: product.quantity,
        unitPrice: product.price,
        total: product.price * product.quantity
      });
    });
  }

  // Calcular totales
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discount = sale.discount || 0;
  const taxRate = 0; // Modificar si hay IVA
  const tax = 0;
  const total = subtotal - discount + tax;

  return {
    invoice: {
      number: invoice.invoiceNumber,
      date: invoice.createdAt,
      status: invoice.status || 'paid',
      notes: invoice.notes
    },
    sale: {
      paymentMethod: sale.paymentMethod?.name || sale.paymentMethod || 'Efectivo',
      paymentDate: sale.createdAt
    },
    customer: {
      name: sale.client?.name || sale.clientName || 'Cliente General',
      email: sale.client?.email || '',
      phone: sale.client?.phone || ''
    },
    barber: {
      name: sale.barber?.name || 'Barbero',
      email: sale.barber?.email || ''
    },
    items,
    totals: {
      subtotal,
      discount,
      tax,
      taxRate,
      total
    }
  };
};

export default {
  generateInvoiceHTML,
  formatInvoiceData
};
