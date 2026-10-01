import { Invoice, Sale, Barber, User, Appointment, Inventory } from '../../domain/entities/index.js';
import { logger } from '../../../shared/utils/logger.js';
import { AppError } from '../../../shared/utils/errors.js';
import { now, formatInColombiaTime } from '../../../shared/utils/dateUtils.js';

// Casos de uso para gestión de facturas
class InvoiceUseCases {
  
  // Generar factura desde una venta
  // Acepta el id de una Sale o de una Appointment completada (la convierte a un
  // objeto compatible con Sale, sin persistirla). Evita duplicados salvo
  // options.allowDuplicate; genera el consecutivo, arma los items según el tipo
  // (service/product) y crea la factura con issueDate = fecha original.
  // Efecto secundario: guarda invoiceId en la Sale (no en la Appointment).
  static async generateInvoiceFromSale(saleId, options = {}) {
    try {
      logger.info(`Generando factura para ID: ${saleId}`);
      logger.info(`Tipo de saleId: ${typeof saleId}, Longitud: ${saleId.length}`);

      // Validar ObjectId
      const mongoose = await import('mongoose');
      if (!mongoose.default.Types.ObjectId.isValid(saleId)) {
        logger.error(`ObjectId inválido: ${saleId}`);
        throw new AppError('ID inválido', 400);
      }

      // Importar modelos necesarios
      const { Appointment } = await import('../../domain/entities/index.js');

      // Intentar buscar primero como Sale
      let sale = await Sale.findById(saleId);
      let isAppointment = false;

      // Si no se encuentra en Sales, buscar en Appointments
      if (!sale) {
        logger.info(`No encontrado en Sales, buscando en Appointments...`);
        const appointment = await Appointment.findById(saleId)
          .populate({
            path: 'barber',
            populate: {
              path: 'user',
              select: 'name phone'
            }
          })
          .populate('service', 'name price');

        if (appointment && appointment.status === 'completed' && appointment.paymentMethod) {
          logger.info(`Encontrado en Appointments - Convirtiendo a formato de venta`);
          isAppointment = true;
          
          // Convertir Appointment a formato compatible con Sale
          sale = {
            _id: appointment._id,
            type: 'service',
            serviceName: appointment.service?.name || 'Servicio',
            serviceId: appointment.service?._id,
            quantity: 1,
            unitPrice: appointment.price || appointment.service?.price || 0,
            totalAmount: appointment.price || appointment.service?.price || 0,
            barberId: {
              _id: appointment.barber?._id,
              name: appointment.barber?.user?.name || 'Barbero',
              phone: appointment.barber?.user?.phone || null
            },
            barberName: appointment.barber?.user?.name || 'Barbero',
            customerName: 'Cliente',
            paymentMethod: appointment.paymentMethod || 'efectivo',
            saleDate: appointment.date || appointment.createdAt,
            status: 'completed',
            notes: appointment.notes || '',
            createdAt: appointment.createdAt,
            _isAppointment: true, // Flag para identificar que viene de appointment
            save: async function() {
              // No hacer nada, las appointments no se actualizan como sales
              return this;
            },
            toObject: function() { return this; }
          };
          
          logger.info(`Barbero de la cita:`, {
            barberId: sale.barberId._id,
            barberName: sale.barberId.name,
            appointmentBarberId: appointment.barber?._id,
            appointmentBarberName: appointment.barber?.name
          });
        }
      } else {
        // Populate si es una Sale real
        sale = await Sale.findById(saleId).populate('barberId', 'name phone');
      }

      if (!sale) {
        logger.warn(`No encontrado ni en Sales ni en Appointments: ${saleId}`);
        throw new AppError('Venta o cita no encontrada en la base de datos', 404);
      }

      logger.info(`Registro encontrado:`, {
        id: sale._id,
        type: isAppointment ? 'appointment' : sale.type,
        status: sale.status,
        totalAmount: sale.totalAmount,
        barberName: sale.barberId?.name || sale.barberName
      });

      // Verificar si ya existe factura para esta venta
      const existingInvoice = await Invoice.findOne({ saleId });
      if (existingInvoice && !options.allowDuplicate) {
        logger.warn(`Factura ya existe para venta ${saleId}: ${existingInvoice.invoiceNumber}`);
        return existingInvoice;
      }

      // Generar número de factura
      const invoiceNumber = await Invoice.generateInvoiceNumber();

      // Preparar datos del barbero
      const barberData = {
        id: sale.barberId?._id || sale.barberId,
        name: sale.barberId?.name || sale.barberName || 'Barbero',
        phone: sale.barberId?.phone || null
      };

      logger.info('Datos del barbero preparados', { barberData });

      // Preparar datos del cliente
      const clientData = {
        name: sale.customerName || 'Cliente General',
        phone: null,
        email: null
      };

      // Preparar items de la factura
      const items = [];

      // Sale puede ser de tipo SERVICE o PRODUCT (solo uno por venta)
      if (sale.type === 'service') {
        items.push({
          description: sale.serviceName,
          quantity: sale.quantity,
          unitPrice: sale.unitPrice,
          subtotal: sale.totalAmount,
          serviceId: sale.serviceId
        });
      } else if (sale.type === 'product') {
        items.push({
          description: sale.productName,
          quantity: sale.quantity,
          unitPrice: sale.unitPrice,
          subtotal: sale.totalAmount,
          productId: sale.productId
        });
      }

      // Calcular totales (una venta simple solo tiene totalAmount)
      const subtotal = sale.totalAmount;
      const tax = 0; // Sale no tiene campo tax
      const discount = 0; // Sale no tiene campo discount
      const total = subtotal;

      // Crear la factura
      const invoice = new Invoice({
        invoiceNumber,
        saleId: sale._id,
        barber: barberData,
        client: clientData,
        items,
        subtotal,
        tax,
        discount,
        total,
        paymentMethod: sale.paymentMethod || 'efectivo',
        status: 'pending',
        notes: options.notes || sale.notes,
        issueDate: sale.saleDate || sale.createdAt, // Fecha de emisión = fecha de la venta/cita original
        metadata: {
          source: options.source || 'pos',
          device: options.device,
          ipAddress: options.ipAddress,
          location: options.location,
          originalSaleDate: sale.saleDate || sale.createdAt // Guardar fecha original
        }
      });

      await invoice.save();

      // Actualizar el registro con el ID de la factura (solo si NO es appointment)
      if (!sale._isAppointment) {
        sale.invoiceId = invoice._id;
        await sale.save();
        logger.info(`Sale actualizada con invoiceId`);
      } else {
        logger.info(` No se actualiza Appointment con invoiceId (no tiene ese campo)`);
      }

      logger.info(`Factura generada exitosamente: ${invoiceNumber}`, {
        invoiceId: invoice._id.toString(),
        recordId: saleId,
        isAppointment: !!sale._isAppointment
      });
      
      // Retornar la factura recién guardada
      return invoice;

    } catch (error) {
      logger.error('Error generando factura desde venta:', {
        saleId,
        error: error.message
      });
      throw error;
    }
  }

  // Obtener factura por ID
  // Popula la venta asociada, el barbero y el usuario que imprimió; 404 si no existe.
  static async getInvoiceById(invoiceId) {
    try {
      logger.info('Buscando factura por ID', { invoiceId, type: typeof invoiceId });
      
      const invoice = await Invoice.findById(invoiceId)
        .populate('saleId')
        .populate('barber.id', 'name phone email')
        .populate('printInfo.printedBy', 'name email');

      if (!invoice) {
        logger.warn('Factura no encontrada en BD', { invoiceId });
        throw new AppError('Factura no encontrada', 404);
      }

      logger.info('Factura encontrada exitosamente', { 
        invoiceId, 
        invoiceNumber: invoice.invoiceNumber 
      });
      
      return invoice;
    } catch (error) {
      logger.error('Error obteniendo factura:', {
        invoiceId,
        error: error.message
      });
      throw error;
    }
  }

  // Obtener facturas por venta
  // Retorna todas las facturas de una venta, más recientes primero.
  static async getInvoicesBySale(saleId) {
    try {
      const invoices = await Invoice.find({ saleId })
        .sort({ createdAt: -1 });

      return invoices;
    } catch (error) {
      logger.error('Error obteniendo facturas por venta:', {
        saleId,
        error: error.message
      });
      throw error;
    }
  }

  // Listar facturas con filtros
  // Filtros: status, barberId, rango de createdAt y búsqueda parcial por
  // invoiceNumber (regex i). Devuelve { invoices, pagination } con orden y
  // paginación configurables.
  static async listInvoices(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const skip = (page - 1) * limit;

      // Construir query
      const query = {};

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.barberId) {
        query['barber.id'] = filters.barberId;
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      if (filters.invoiceNumber) {
        query.invoiceNumber = new RegExp(filters.invoiceNumber, 'i');
      }

      // Ejecutar query
      const [invoices, total] = await Promise.all([
        Invoice.find(query)
          .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
          .skip(skip)
          .limit(limit)
          .populate('saleId', 'totalAmount createdAt')
          .populate('barber.id', 'name'),
        Invoice.countDocuments(query)
      ]);

      return {
        invoices,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error listando facturas:', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  // Formatear factura para impresión
  // Devuelve un objeto plano con datos del negocio, fecha formateada en zona
  // horaria de Colombia, items, totales, método de pago (etiqueta) y flags de
  // reimpresión (isReprint = printCount > 0).
  static async formatForPrint(invoiceId) {
    try {
      const invoice = await this.getInvoiceById(invoiceId);

      // Información de la barbería (esto debería venir de configuración)
      const businessInfo = {
        name: 'The Brothers Barber Shop',
        address: 'Dirección de la barbería',
        phone: 'Teléfono de contacto',
        nit: 'NIT: 000000000-0',
        email: 'contact@thebrothers.com'
      };

      // Formatear fecha
      const formattedDate = formatInColombiaTime(invoice.issueDate || invoice.createdAt, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return {
        business: businessInfo,
        invoice: {
          number: invoice.invoiceNumber,
          date: formattedDate,
          dateISO: invoice.issueDate || invoice.createdAt
        },
        barber: {
          name: invoice.barber.name,
          phone: invoice.barber.phone
        },
        client: {
          name: invoice.client.name || 'Cliente General',
          phone: invoice.client.phone,
          email: invoice.client.email
        },
        items: invoice.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal
        })),
        totals: {
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          discount: invoice.discount,
          total: invoice.total
        },
        payment: {
          method: invoice.paymentMethod,
          methodLabel: this.getPaymentMethodLabel(invoice.paymentMethod)
        },
        notes: invoice.notes,
        printCount: invoice.printInfo.printCount,
        isReprint: invoice.printInfo.printCount > 0
      };
    } catch (error) {
      logger.error('Error formateando factura para impresión:', {
        invoiceId,
        error: error.message
      });
      throw error;
    }
  }

  // Marcar factura como impresa
  // Delega en invoice.markAsPrinted (actualiza contador/fechas y pasa pending a
  // printed); retorna la factura ya persistida.
  static async markAsPrinted(invoiceId, userId) {
    try {
      const invoice = await Invoice.findById(invoiceId);

      if (!invoice) {
        throw new AppError('Factura no encontrada', 404);
      }

      await invoice.markAsPrinted(userId);

      logger.info(`Factura marcada como impresa: ${invoice.invoiceNumber}`, {
        invoiceId,
        userId,
        printCount: invoice.printInfo.printCount
      });

      return invoice;
    } catch (error) {
      logger.error('Error marcando factura como impresa:', {
        invoiceId,
        error: error.message
      });
      throw error;
    }
  }

  // Cancelar factura
  // Rechaza si ya está cancelada (400); delega en invoice.cancel() y retorna
  // el documento actualizado.
  static async cancelInvoice(invoiceId, reason) {
    try {
      const invoice = await Invoice.findById(invoiceId);

      if (!invoice) {
        throw new AppError('Factura no encontrada', 404);
      }

      if (invoice.status === 'cancelled') {
        throw new AppError('La factura ya está cancelada', 400);
      }

      await invoice.cancel(reason);

      logger.info(`Factura cancelada: ${invoice.invoiceNumber}`, {
        invoiceId,
        reason
      });

      return invoice;
    } catch (error) {
      logger.error('Error cancelando factura:', {
        invoiceId,
        error: error.message
      });
      throw error;
    }
  }

  // Obtener estadísticas de facturas
  // Agrega por barbero/fechas: totales de monto/impuestos/descuento y conteos de
  // impresas (printInfo.printed) y canceladas. Retorna ceros si no hay datos.
  static async getInvoiceStats(filters = {}) {
    try {
      const query = {};

      if (filters.barberId) {
        query['barber.id'] = filters.barberId;
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.createdAt.$lte = new Date(filters.endDate);
        }
      }

      const stats = await Invoice.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            totalAmount: { $sum: '$total' },
            totalTax: { $sum: '$tax' },
            totalDiscount: { $sum: '$discount' },
            printedInvoices: {
              $sum: { $cond: [{ $eq: ['$printInfo.printed', true] }, 1, 0] }
            },
            cancelledInvoices: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalInvoices: 0,
        totalAmount: 0,
        totalTax: 0,
        totalDiscount: 0,
        printedInvoices: 0,
        cancelledInvoices: 0
      };

      return result;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de facturas:', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  // Obtener etiqueta de método de pago
  // Mapea los métodos conocidos a texto legible; si no hay match, retorna el
  // identificador original.
  static getPaymentMethodLabel(method) {
    const labels = {
      efectivo: 'Efectivo',
      tarjeta: 'Tarjeta',
      transferencia: 'Transferencia',
      mixto: 'Pago Mixto'
    };
    return labels[method] || method;
  }
}

export default InvoiceUseCases;
