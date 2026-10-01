import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  User, 
  Mail, 
  Phone, 
  Calendar,
  DollarSign,
  Printer,
  X,
  CreditCard,
  Banknote,
  ArrowLeftRight,
  ShoppingCart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import { PageContainer } from '@components/layout/PageContainer';
import GradientText from '@components/ui/GradientText';
import Modal from '@components/ui/Modal';
import { salesService } from '@services/salesService';
import { logger } from '@utils/logger';
import { CartInvoicesSkeleton } from '@components/ui/Skeleton';
import { BUSINESS, isIvaResponsible } from '@shared/config/business';

// Vista de Facturas de Carrito.
// Lista todas las facturas/carritos generados desde el punto de venta, los
// agrupa por carrito, permite buscar/filtrar y abrir el detalle en un modal.
const CartInvoices = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  // Estados
  // invoices: facturas consolidadas; filteredInvoices: resultado de búsqueda/fecha
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Cargar facturas de carrito
  useEffect(() => {
    loadCartInvoices();
  }, []);

  // Filtrar facturas cuando cambian los filtros
  useEffect(() => {
    filterInvoices();
  }, [searchTerm, dateFilter, invoices]);

  // Carga las facturas de carrito desde el servicio de ventas y las consolida
  const loadCartInvoices = async () => {
    try {
      setLoading(true);
      logger.info('📋 Cargando facturas de carrito...');

      // Llamar al endpoint específico de facturas de carrito
      const response = await salesService.getCartInvoices();

      logger.info('✅ Respuesta del servidor:', response);
      
      if (response.success && response.data) {
        logger.info(`📊 Total facturas recibidas: ${response.data.length}`);
        
        if (response.data.length > 0) {
          logger.info('🔍 Primera factura:', response.data[0]);
        }

        // Agrupar por fecha y cliente para crear facturas consolidadas
        const groupedInvoices = groupSalesByInvoice(response.data);
        
        setInvoices(groupedInvoices);
        logger.info(` ${groupedInvoices.length} facturas de carrito cargadas`);
      } else {
        logger.warn('No se recibieron datos o la respuesta no fue exitosa', response);
        setInvoices([]);
      }
    } catch (error) {
      logger.error('Error cargando facturas:', error);
      showError('Error al cargar las facturas de carrito');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  // Función helper para obtener resumen de métodos de pago
  // Agrupa los items por método, suma montos y calcula el porcentaje de cada uno
  const getPaymentMethodsSummary = (items) => {
    const paymentSummary = {};
    
    items.forEach(item => {
      const method = item.paymentMethod || 'efectivo';
      if (!paymentSummary[method]) {
        paymentSummary[method] = 0;
      }
      paymentSummary[method] += item.total;
    });

    return Object.entries(paymentSummary).map(([method, amount]) => ({
      method,
      amount,
      percentage: Math.round((amount / items.reduce((sum, item) => sum + item.total, 0)) * 100)
    }));
  };

  // Función helper para obtener icono de método de pago
  // Efectivo, tarjeta o transferencia (incluye billeteras) con fallback genérico
  const getPaymentIcon = (method) => {
    switch (method?.toLowerCase()) {
      case 'efectivo':
        return <Banknote className="w-3 h-3" />;
      case 'tarjeta':
        return <CreditCard className="w-3 h-3" />;
      case 'transferencia':
      case 'daviplata':
      case 'nequi':
        return <ArrowLeftRight className="w-3 h-3" />;
      default:
        return <DollarSign className="w-3 h-3" />;
    }
  };

  // Agrupar ventas por CARRITO (mismo minuto + mismo barbero)
  // Cada venta suelta (producto/servicio) se une a su carrito y los reembolsados
  // se incluyen con cantidad/total 0 para que la factura refleje el estado actual.
  const groupSalesByInvoice = (sales) => {
    const grouped = {};

    sales.forEach(sale => {
      // Crear key única por MINUTO + barberId
      // Productos y servicios del mismo carrito pueden tener timestamps ligeramente diferentes
      const saleDate = new Date(sale.saleDate);
      // Redondear al minuto para agrupar ventas del mismo carrito
      const minuteTimestamp = new Date(
        saleDate.getFullYear(),
        saleDate.getMonth(),
        saleDate.getDate(),
        saleDate.getHours(),
        saleDate.getMinutes()
      ).getTime();
      
      const barberId = sale.barberId?._id || sale.barberId || 'unknown';
      const cartKey = `${barberId}_${minuteTimestamp}`;

      if (!grouped[cartKey]) {
        grouped[cartKey] = {
          id: cartKey,
          clientData: sale.clientData || null, // Puede ser null para ventas POS
          date: sale.saleDate,
          items: [],
          total: 0,
          barberName: sale.barberId?.name || sale.barberName || 'Barbero',
          barberId: barberId,
          isPOSSale: !sale.clientData, // Marcar si es venta POS
          hasRefunds: false, // Marcar si el carrito tiene reembolsos
          type: sale.clientData ? 'formal' : 'informal' // Tipo de carrito
        };
      }

      // Usar datos de display para ventas reembolsadas
      const isRefunded = sale.isRefunded || sale.status === 'refunded';
      const displayQuantity = isRefunded ? 0 : (sale.displayQuantity ?? sale.quantity ?? 1);
      const displayTotal = isRefunded ? 0 : (sale.displayTotal ?? sale.totalAmount);

      grouped[cartKey].items.push({
        name: sale.productId?.name || sale.serviceId?.name || sale.productName || sale.serviceName || 'Item',
        quantity: displayQuantity,
        originalQuantity: sale.originalQuantity || sale.quantity || 1, // Cantidad original
        unitPrice: sale.unitPrice || sale.totalAmount,
        total: displayTotal,
        originalTotal: sale.originalTotal || sale.totalAmount, // Total original
        paymentMethod: sale.paymentMethod,
        category: sale.productId?.category || sale.category || 'Servicio',
        // Información de reembolso
        status: sale.status,
        isRefunded: isRefunded,
        refundedAt: sale.refundedAt,
        refundReason: sale.refundReason
      });

      // Solo agregar al total si no está reembolsado
      grouped[cartKey].total += displayTotal;
      
      // Marcar el carrito si tiene algún reembolso
      if (isRefunded) {
        grouped[cartKey].hasRefunds = true;
      }
    });

    return Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // Aplica búsqueda por texto (cliente/barbero/productos) y filtro por rango de fecha
  const filterInvoices = () => {
    let filtered = [...invoices];

    // Filtro por búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(invoice => {
        // Búsqueda en datos de cliente (si existen)
        if (invoice.clientData) {
          return invoice.clientData?.firstName?.toLowerCase().includes(search) ||
                 invoice.clientData?.lastName?.toLowerCase().includes(search) ||
                 invoice.clientData?.email?.toLowerCase().includes(search) ||
                 invoice.clientData?.phone?.toLowerCase().includes(search);
        }
        // Búsqueda en nombre de barbero para ventas POS y carritos sin datos
        return invoice.barberName?.toLowerCase().includes(search) ||
               'venta pos'.includes(search) ||
               'carrito'.includes(search) ||
               // Búsqueda en nombres de productos para carritos sin datos
               invoice.items?.some(item => 
                 item.productName?.toLowerCase().includes(search)
               );
      });
    }

    // Filtro por fecha
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(invoice => {
        const invoiceDate = new Date(invoice.date);
        const invoiceDateOnly = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), invoiceDate.getDate());

        switch (dateFilter) {
          case 'today':
            return invoiceDateOnly.getTime() === today.getTime();
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return invoiceDateOnly >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return invoiceDateOnly >= monthAgo;
          default:
            return true;
        }
      });
    }

    setFilteredInvoices(filtered);
  };

  // Formatea un monto como pesos colombianos sin decimales
  const formatPrice = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Formatea fecha y hora en formato corto es-CO
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Abre el modal de detalle guardando la factura seleccionada
  const openInvoiceModal = (invoice) => {
    setSelectedInvoice(invoice);
    setIsModalOpen(true);
  };

  // Cierra el modal y limpia la selección
  const closeInvoiceModal = () => {
    setSelectedInvoice(null);
    setIsModalOpen(false);
  };

  // Genera e imprime una factura cumpliendo con requisitos legales DIAN (Resolución 000165 de 2023)
  // usando la estructura de facturas consolidadas (formato térmico 80mm).
  //
  // Estructura de la factura:
  // - Header: "THE BROTHERS BARBER SHOP" + NIT + Dirección + Régimen fiscal
  // - Documento Equivalente POS con número consecutivo y resolución DIAN
  // - Información del Cliente: nombre, email, teléfono, dirección (solo si clientData existe)
  // - Información de la Venta: fecha, barbero, número de items
  // - Tabla de Items: descripción, cantidad, precio unitario, IVA, total
  // - Resumen: subtotal, impuestos (19% IVA si aplica), total final
  // - Métodos de Pago: desglose por método con montos
  // - Footer: mensaje de agradecimiento + Software POS + espacio para QR/CUDE futuro
  const printInvoice = (invoice) => {
    // Configuración del establecimiento (Requerimientos DIAN)
    const establecimiento = {
      nombre: BUSINESS.name,
      nit: BUSINESS.nit,
      direccion: BUSINESS.address,
      telefono: BUSINESS.phone,
      regimen: BUSINESS.taxRegime,
      resolucionDIAN: BUSINESS.dianResolution
    };

    // Generar número consecutivo POS (en producción debe ser secuencial desde BD)
    const consecutivoPOS = `POS-${String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0')}`;
    
    // Determinar si es responsable de IVA
    const esResponsableIVA = isIvaResponsible();
    const tarifaIVA = esResponsableIVA ? BUSINESS.ivaRate : 0;
    
    // Calcular impuestos por item y totales (PRECIOS YA INCLUYEN IVA)
    let subtotalGeneral = 0;
    let impuestosGenerales = 0;
    
    const itemsConIVA = invoice.items.map(item => {
      // Verificar si el item está reembolsado
      const isRefunded = item.status === 'refunded' || item.isRefunded;
      const cantidad = isRefunded ? 0 : (item.quantity || 1);
      const totalConIVA = isRefunded ? 0 : (item.total || item.totalAmount); // Este precio YA INCLUYE IVA
      const precioUnitarioConIVA = cantidad > 0 ? (totalConIVA / cantidad) : (item.unitPrice || 0);
      
      // Si es responsable de IVA, calcular el desglose
      let subtotalItem, ivaItem, precioUnitarioSinIVA;
      
      if (esResponsableIVA && tarifaIVA > 0) {
        // Calcular precio sin IVA: PrecioConIVA / (1 + tarifaIVA)
        precioUnitarioSinIVA = precioUnitarioConIVA / (1 + tarifaIVA);
        subtotalItem = precioUnitarioSinIVA * cantidad;
        ivaItem = totalConIVA - subtotalItem;
      } else {
        // Si no es responsable de IVA, no hay desglose
        precioUnitarioSinIVA = precioUnitarioConIVA;
        subtotalItem = totalConIVA;
        ivaItem = 0;
      }
      
      subtotalGeneral += subtotalItem;
      impuestosGenerales += ivaItem;
      
      return {
        descripcion: item.productName || item.name || item.serviceName,
        cantidad: cantidad,
        precioUnitario: precioUnitarioConIVA, // Mostrar precio con IVA
        subtotal: subtotalItem, // Subtotal sin IVA
        iva: ivaItem, // IVA desglosado
        total: totalConIVA, // Total que ya incluye IVA
        metodoPago: item.paymentMethod || 'efectivo',
        isRefunded: isRefunded,
        refundReason: item.refundReason || null
      };
    });
    
    // El total general es la suma de todos los totales que ya incluyen IVA
    const totalGeneral = invoice.total; // Usar el total original que ya incluye IVA

    const invoiceNumber = consecutivoPOS;
    const formatCurrency = (amount) => {
      if (isNaN(amount) || amount === null || amount === undefined) return '$0';
      return '$' + Math.round(amount).toLocaleString('es-CO');
    };

    // Crear estructura de datos completa para DIAN
    const facturaPOS = {
      tipoDocumento: "Documento Equivalente POS",
      consecutivo: consecutivoPOS,
      fecha: new Date(invoice.date).toISOString(),
      establecimiento: establecimiento,
      vendedor: invoice.barberName || 'Sin asignar',
      cliente: invoice.clientData ? 
        `${invoice.clientData.firstName} ${invoice.clientData.lastName}` : 
        invoice.type === 'informal' ? 
        `Carrito - ${invoice.barberName}` :
        'Consumidor Final',
      items: itemsConIVA,
      subtotal: subtotalGeneral,
      impuestos: impuestosGenerales,
      total: totalGeneral,
      metodosPago: getPaymentMethodsSummary(invoice.items).map(method => ({
        tipo: method.method.charAt(0).toUpperCase() + method.method.slice(1),
        valor: method.amount
      })),
      softwarePOS: "BrothersPOS v1.0"
    };

    const invoiceHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documento Equivalente POS - ${facturaPOS.consecutivo}</title>
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
      padding: 4mm;
      color: #000;
      background: #fff;
      font-size: 8pt;
      line-height: 1.1;
      font-weight: 600;
    }
    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
    .header .business-name { font-size: 10pt; font-weight: bold; color: #000; margin-bottom: 2px; }
    .header .business-info { font-size: 7pt; margin: 1px 0; color: #000; }
    .header .document-title { font-size: 9pt; font-weight: bold; margin: 4px 0; text-transform: uppercase; }
    .header .document-number { font-size: 7pt; margin-top: 2px; }
    .section { margin-bottom: 6px; }
    .section-title { font-size: 8pt; font-weight: bold; text-transform: uppercase; margin-bottom: 3px; padding-bottom: 1px; border-bottom: 1px solid #000; }
    .info-row { display: flex; justify-content: space-between; font-size: 7pt; margin-bottom: 2px; }
    .separator { border-top: 1px dashed #000; margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 7pt; }
    thead { border-bottom: 1px solid #000; }
    th { padding: 2px 1px; text-align: left; font-weight: bold; font-size: 6pt; text-transform: uppercase; }
    td { padding: 2px 1px; font-size: 7pt; border-bottom: 1px dotted #ccc; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .summary-box { padding: 4px 0; margin: 4px 0 3px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
    .summary-row { display:flex; justify-content: space-between; font-size: 8pt; margin: 3px 0; font-weight: 600; }
    .summary-row.total { font-size: 10pt; font-weight: bold; border-top: 2px solid #000; padding-top: 4px; margin-top: 6px; }
    .footer { margin-top: 6px; padding-top: 4px; border-top: 1px dashed #000; text-align: center; font-size: 6pt; line-height: 1.2; }
    .qr-space { margin: 4px 0; padding: 8px; border: 1px dotted #666; text-align: center; font-size: 6pt; color: #666; }
    .print-btn { padding: 6px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 600; display:block; margin:8px auto; }
    @media screen { body { box-shadow: 0 0 10px rgba(0,0,0,0.1); margin: 20px auto; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="business-name">${facturaPOS.establecimiento.nombre}</div>
    <div class="business-info">NIT: ${facturaPOS.establecimiento.nit}</div>
    <div class="business-info">${facturaPOS.establecimiento.direccion}</div>
    <div class="business-info">Tel: ${facturaPOS.establecimiento.telefono}</div>
    <div class="business-info">${facturaPOS.establecimiento.regimen}</div>
    <div class="business-info">Res. DIAN ${facturaPOS.establecimiento.resolucionDIAN}</div>
    <div class="document-title">${facturaPOS.tipoDocumento}</div>
    <div class="document-number">${facturaPOS.consecutivo}</div>
  </div>

  <div class="section">
    <div class="info-row"><strong>Fecha:</strong><span>${new Date(facturaPOS.fecha).toLocaleString('es-CO')}</span></div>
    <div class="info-row"><strong>Vendedor:</strong><span>${facturaPOS.vendedor}</span></div>
    <div class="info-row"><strong>Cliente:</strong><span>${facturaPOS.cliente}</span></div>
  </div>

  ${invoice.clientData ? `
  <div class="section">
    <div class="section-title">Datos del Cliente</div>
    ${invoice.clientData.email ? `<div class="info-row"><strong>Email:</strong><span>${invoice.clientData.email}</span></div>` : ''}
    ${invoice.clientData.phone ? `<div class="info-row"><strong>Teléfono:</strong><span>${invoice.clientData.phone}</span></div>` : ''}
    ${invoice.clientData.address ? `<div class="info-row"><strong>Dirección:</strong><span>${invoice.clientData.address}</span></div>` : ''}
  </div>
  ` : ''}

  <div class="separator"></div>

  <div class="section">
    <table>
      <thead>
        <tr>
          <th style="width:35%;">Descripción</th>
          <th style="width:12%;" class="text-right">Cant.</th>
          <th style="width:18%;" class="text-right">P.Unit*</th>
          <th style="width:15%;" class="text-right">IVA</th>
          <th style="width:20%;" class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${facturaPOS.items.map(item => `
          <tr ${item.isRefunded ? 'style="opacity: 0.5; background-color: #f5f5f5;"' : ''}>
            <td title="${item.descripcion}">
              ${item.isRefunded ? '[REEMBOLSADO] ' : ''}${item.descripcion.length > 25 ? item.descripcion.substring(0,25)+'...' : item.descripcion}
            </td>
            <td class="text-right">${item.cantidad}${item.isRefunded ? ' (0)' : ''}</td>
            <td class="text-right">${item.cantidad > 0 ? formatCurrency(item.subtotal / item.cantidad) : '$0'}</td>
            <td class="text-right">${formatCurrency(item.iva)}</td>
            <td class="text-right"><strong>${formatCurrency(item.total)}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="summary-box">
    <div class="summary-row">
      <span>Subtotal:</span>
      <strong>${formatCurrency(facturaPOS.subtotal)}</strong>
    </div>
    <div class="summary-row">
      <span>Impuestos (IVA ${Math.round(tarifaIVA * 100)}%):</span>
      <strong>${formatCurrency(facturaPOS.impuestos)}</strong>
    </div>
    <div class="summary-row total">
      <span>TOTAL A PAGAR:</span>
      <strong>${formatCurrency(facturaPOS.total)}</strong>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Métodos de Pago</div>
    ${facturaPOS.metodosPago.map(pago => `<div class="info-row"><span>${pago.tipo}</span><span>${formatCurrency(pago.valor)}</span></div>`).join('')}
  </div>

  <div class="qr-space">
     <!--[Espacio reservado para código QR / CUDE]-->
  </div>

  ${facturaPOS.items.some(item => item.isRefunded) ? `
  <div style="font-size: 6pt; text-align: center; margin: 4px 0; padding: 4px; border: 1px dotted #999; background-color: #f9f9f9;">
    <strong>NOTA:</strong> Los productos marcados como REEMBOLSADO aparecen con cantidad 0.<br>
    Esta factura refleja el estado actual tras los reembolsos procesados.
  </div>
  ` : ''}

  <div class="footer">
    <p><strong>¡GRACIAS POR SU PREFERENCIA!</strong></p>
    <p>${facturaPOS.establecimiento.nombre}</p>
    <p>Software: ${facturaPOS.softwarePOS}</p>
    <p>Documento válido como soporte contable</p>
  </div>

  <button class="print-btn no-print" onclick="window.print()">Imprimir Factura</button>
  <script>
    window.addEventListener('load', function(){ 
      document.querySelector('.print-btn')?.focus(); 
    });
    document.addEventListener('keydown', function(e){ 
      if((e.ctrlKey||e.metaKey) && e.key==='p'){ 
        e.preventDefault(); 
        window.print(); 
      } 
    });
  </script>
</body>
</html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    // La impresión se ejecuta solo cuando el usuario presiona el botón en la ventana
  };

  if (loading) {
    return (
      <PageContainer>
        <CartInvoicesSkeleton cards={6} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <GradientText className="text-3xl font-bold mb-2">
              Carritos Procesados
            </GradientText>
            <p className="text-gray-400">
              {filteredInvoices.length} carrito{filteredInvoices.length !== 1 ? 's' : ''} encontrado{filteredInvoices.length !== 1 ? 's' : ''}
              {/* Desglose: carritos con datos de cliente (factura) vs ventas POS */}
              {filteredInvoices.length > 0 && (
                <span className="ml-2 text-sm">
                  • {filteredInvoices.filter(i => i.clientData).length} con factura
                  • {filteredInvoices.filter(i => !i.clientData).length} POS
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por cliente, barbero o 'venta pos'..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-11 pl-10 pr-4 py-2 bg-white/5 border border-blue-500/30 rounded-lg text-base sm:text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtro por fecha */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full min-h-11 pl-10 pr-4 py-2 bg-white/5 border border-blue-500/30 rounded-lg text-base sm:text-sm text-white focus:outline-none focus:border-blue-500/50"
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Hoy</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
            </select>
          </div>
        </div>

        {/* Lista de facturas - Grid 3 columnas */}
        {/* Estado vacío (con/sin filtros) o grid de tarjetas de carrito */}
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl border border-blue-500/20">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No se encontraron carritos</p>
            <p className="text-gray-500 text-sm mt-2">
              {searchTerm || dateFilter !== 'all' 
                ? 'Intenta cambiar los filtros' 
                : 'Los carritos procesados aparecerán aquí'}
            </p>
            <button
              onClick={() => navigate('/admin/sales')}
              className="mt-4 min-h-11 px-6 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-600/30 transition-colors"
            >
              Ir al Punto de Venta
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInvoices.map((invoice) => (
              <div
                key={invoice.id}
                onClick={() => openInvoiceModal(invoice)}
                className="bg-white/5 backdrop-blur-md border border-blue-500/20 rounded-lg p-3 hover:border-blue-500/40 transition-all duration-300 cursor-pointer hover:scale-[1.02] hover:shadow-lg hover:shadow-soft"
              >
                {/* Header con badge y total */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <User className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-white truncate">
                      {invoice.isPOSSale ? (
                        `POS - ${invoice.barberName}`
                      ) : invoice.type === 'informal' || !invoice.clientData ? (
                        <><ShoppingCart className="w-4 h-4 inline" /> Carrito - {invoice.barberName}</>
                      ) : (
                        `${invoice.clientData?.firstName} ${invoice.clientData?.lastName}`
                      )}
                    </h3>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <div className="text-lg font-bold text-emerald-400 leading-none">
                      {formatPrice(invoice.total)}
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded ${
                        invoice.isPOSSale 
                          ? 'bg-amber-500/20 text-amber-400' 
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {invoice.isPOSSale ? 'POS' : 'Factura'}
                      </span>
                      {invoice.hasRefunds && (
                        <span className="inline-block text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                          REEMBOLSOS
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info compacta en grid */}
                <div className="space-y-1.5 text-xs">
                  {/* Fecha e items en una línea */}
                  <div className="flex items-center justify-between text-gray-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span className="text-[11px]">{new Date(invoice.date).toLocaleString('es-CO', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                    <span className="text-gray-500 text-[10px]">
                      {invoice.items.length} ítem{invoice.items.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Email si existe, o info de carrito */}
                  {invoice.clientData?.email ? (
                    <div className="flex items-center gap-1 text-gray-400 truncate">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate text-[11px]">{invoice.clientData.email}</span>
                    </div>
                  ) : invoice.type === 'informal' && (
                    <div className="flex items-center gap-1 text-gray-400 truncate">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate text-[11px]">Carrito sin datos de cliente</span>
                    </div>
                  )}

                  {/* Métodos de pago compactos */}
                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                    {getPaymentMethodsSummary(invoice.items).slice(0, 2).map((summary, idx) => (
                      <span key={idx} className="flex items-center gap-0.5 capitalize">
                        {getPaymentIcon(summary.method)}
                        {summary.method}
                      </span>
                    ))}
                    {getPaymentMethodsSummary(invoice.items).length > 2 && (
                      <span className="text-gray-400">+{getPaymentMethodsSummary(invoice.items).length - 2}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de detalles de factura */}
        {(selectedInvoice != null) && ((
        <Modal
          isOpen={isModalOpen}
          onClose={closeInvoiceModal}
          color="blue"
          icon={FileText}
          title={
            !selectedInvoice ? '' :
            selectedInvoice.isPOSSale
              ? `Venta POS - ${selectedInvoice.barberName}`
              : selectedInvoice.type === 'informal' || !selectedInvoice.clientData
                ? `Carrito - ${selectedInvoice.barberName}`
                : `Factura - ${selectedInvoice.clientData?.firstName} ${selectedInvoice.clientData?.lastName}`
          }
          subtitle={selectedInvoice ? new Date(selectedInvoice.date).toLocaleString('es-CO') : ''}
          size="2xl"
          footer={
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={closeInvoiceModal}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 hover:text-white text-sm font-medium transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => printInvoice(selectedInvoice)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Información del cliente */}
            {selectedInvoice?.clientData && (
              <div className="bg-white/5 border border-blue-500/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-300 mb-3">Información del Cliente</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-300">Nombre:</span>
                    <span className="text-white">{selectedInvoice.clientData.firstName} {selectedInvoice.clientData.lastName}</span>
                  </div>
                  {selectedInvoice.clientData.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-300">Email:</span>
                      <span className="text-white">{selectedInvoice.clientData.email}</span>
                    </div>
                  )}
                  {selectedInvoice.clientData.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-300">Teléfono:</span>
                      <span className="text-white">{selectedInvoice.clientData.phone}</span>
                    </div>
                  )}
                  {selectedInvoice.clientData.address && (
                    <div className="flex items-center gap-2 md:col-span-2">
                      <span className="text-gray-300">Dirección:</span>
                      <span className="text-white">{selectedInvoice.clientData.address}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Items de la factura */}
            <div className="bg-white/5 border border-blue-500/20 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-300 mb-3">Items de la Factura</h4>
              <div className="space-y-3">
                {selectedInvoice?.items.map((item, idx) => {
                  // Los items reembolsados se muestran con cantidad/total 0 y estilo rojo
                  const isRefunded = item.status === 'refunded' || item.isRefunded;
                  const displayQuantity = isRefunded ? 0 : item.quantity;
                  const displayTotal = isRefunded ? 0 : (item.total || item.totalAmount);
                  
                  return (
                    <div
                      key={idx}
                      className={`flex justify-between items-start p-3 rounded-lg border ${
                        isRefunded 
                          ? 'bg-red-900/20 border-red-500/30 opacity-70' 
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex-1">
                        <div className={`font-medium mb-1 ${isRefunded ? 'text-red-300' : 'text-white'}`}>
                          {isRefunded && <span className="text-red-400 text-xs font-bold mr-2">[REEMBOLSADO]</span>}
                          {item.productName || item.name || item.serviceName}
                        </div>
                        <div className={`text-sm mb-2 ${isRefunded ? 'text-red-400' : 'text-gray-400'}`}>
                          {displayQuantity} x {formatPrice(item.unitPrice)} = {formatPrice(displayTotal)}
                          {isRefunded && (
                            <div className="text-xs text-red-400 mt-1">
                              Original: {item.originalQuantity || item.quantity} x {formatPrice(item.unitPrice)} = {formatPrice(item.originalTotal || item.totalAmount)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {getPaymentIcon(item.paymentMethod)}
                          <span className={`capitalize ${isRefunded ? 'text-red-300' : 'text-blue-300'}`}>
                            {item.paymentMethod || 'efectivo'}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-400 capitalize">{item.category}</span>
                          {isRefunded && item.refundReason && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-red-400 text-xs">Motivo: {item.refundReason}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-semibold ${isRefunded ? 'text-red-400' : 'text-emerald-400'}`}>
                          {formatPrice(displayTotal)}
                        </div>
                        {isRefunded && (
                          <div className="text-xs text-red-400 line-through">
                            {formatPrice(item.originalTotal || item.totalAmount)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resumen de métodos de pago */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-300 mb-3">Resumen de Métodos de Pago</h4>
              <div className="space-y-2">
                {getPaymentMethodsSummary(selectedInvoice?.items || []).map((summary, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-white/5 rounded">
                    <span className="text-gray-300 capitalize flex items-center gap-2">
                      {getPaymentIcon(summary.method)}
                      {summary.method}
                    </span>
                    <span className="text-white font-medium">
                      {formatPrice(summary.amount)} ({summary.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium text-gray-300">Total de la Factura:</span>
                <span className="text-2xl font-bold text-emerald-400">
                  {formatPrice(selectedInvoice?.total)}
                </span>
              </div>
            </div>
          </div>
        </Modal>
        ))}
      </div>
    </PageContainer>
  );
};

export default CartInvoices;
