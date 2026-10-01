import mongoose from 'mongoose';
import Sale from '../../domain/entities/Sale.js';
import Barber from '../../domain/entities/Barber.js';
import Inventory from '../../domain/entities/Inventory.js';
import Appointment from '../../domain/entities/Appointment.js';
import User from '../../domain/entities/User.js';
import PaymentMethod from '../../domain/entities/PaymentMethod.js';
import InventoryLogService from './InventoryLogUseCases.js';
import { reportsCacheService } from './reportsCacheService.js';
import { AppError } from '../../../shared/utils/errors.js';
import { logger } from '../../../shared/utils/logger.js';
import { now, today } from '../../../shared/utils/dateUtils.js';
import { SALE_TYPES, getSaleTypeDisplayName } from '../../../shared/constants/salesConstants.js';
import emailService from '../../../services/emailService.js';

// Casos de uso de ventas.
// Cubre ventas de productos, walk-in (servicios sin cita), carrito con métodos
// de pago por ítem, reportes/estadísticas con caché y el resumen financiero.
// Los descuentos de inventario y las estadísticas del barbero son efectos
// secundarios de las ventas.
class SaleUseCases {
  // Obtener métodos de pago válidos desde la base de datos
  // Devuelve los backendId de los métodos activos; si falla la consulta usa
  // un fallback hardcodeado para no bloquear la venta.
  static async getValidPaymentMethods() {
    try {
      const paymentMethods = await PaymentMethod.find({ isActive: true });
      return paymentMethods.map(method => method.backendId);
    } catch (error) {
      logger.warn('Error obteniendo métodos de pago, usando métodos por defecto:', error);
      // Fallback a métodos hardcodeados si hay error
      return ['efectivo', 'tarjeta', 'transferencia'];
    }
  }

  // Buscar barbero por ID de barbero o ID de usuario
  // Primero intenta por _id de Barber; si no, por el campo user (populado).
  // Lanza 404 si no encuentra ninguno.
  static async findBarberByIdOrUserId(id) {
    // Debug: logger.debug(`?? Buscando barbero con ID: ${id}`);
    
    // Primero intentar buscar por ID de barbero
    let barber = await Barber.findById(id);
    logger.debug(`?? B�squeda por ID de barbero: ${barber ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
    
    // Si no se encuentra, buscar por user ID
    if (!barber) {
      logger.debug(`?? Buscando por user ID: ${id}`);
      barber = await Barber.findOne({ user: id }).populate('user');
      logger.debug(`?? B�squeda por user ID: ${barber ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
    }
    
    if (!barber) {
      // Debug: logger.debug(`? Barbero no encontrado con ID: ${id}`);
      throw new AppError('Barbero no encontrado', 404);
    }
    
    logger.debug(`? Barbero encontrado:`, {
      barberId: barber._id,
      userId: barber.user?._id,
      userName: barber.user?.name,
      specialty: barber.specialty
    });
    
    return barber;
  }

  // Crear una nueva venta (puede ser de m�ltiples productos)
  // Dos caminos: (a) productId único por compatibilidad (valida stock y precio,
  // crea la venta y descuenta stock/realStock/sales), y (b) items[] repitiendo
  // la validación por producto. Al final actualiza stats del barbero y registra
  // UN log de inventario por carrito (un fallo del log no aborta la venta).
  static async createSale(saleData) {
    const { items, barberId, total, notes } = saleData;

    logger.debug('?? Iniciando creaci�n de venta', {
      barberId,
      hasItems: !!items,
      itemsCount: items?.length || 0,
      hasSingleProduct: !!saleData.productId,
      total
    });

    // Verificar que el barbero existe (buscar por ID de barbero o usuario)
    const barber = await SaleUseCases.findBarberByIdOrUserId(barberId);

    // Si es un solo producto (compatibilidad hacia atr�s)
    if (saleData.productId) {
      const { productId, quantity } = saleData;
      
      const product = await Inventory.findById(productId);
      if (!product) {
        throw new AppError('Producto no encontrado', 404);
      }

      const currentStock = product.currentStock || product.stock || 0;
      if (quantity > currentStock) {
        throw new AppError('Stock insuficiente para realizar la venta', 400);
      }

      // Validar método de pago usando métodos dinámicos de la BD
      const validPaymentMethods = await SaleUseCases.getValidPaymentMethods();
      if (saleData.paymentMethod && !validPaymentMethods.includes(saleData.paymentMethod)) {
        throw new AppError(`Método de pago inválido: ${saleData.paymentMethod}. Métodos válidos: ${validPaymentMethods.join(', ')}`, 400);
      }

      // Validar campos requeridos
      if (!quantity || quantity <= 0) {
        logger.error('? Validaci�n fallida: cantidad inv�lida', { quantity, productId });
        throw new AppError('La cantidad debe ser mayor a 0', 400);
      }
      
      if (!product.price || product.price <= 0) {
        logger.error('? Validaci�n fallida: precio inv�lido', { price: product.price, productId, productName: product.name });
        throw new AppError('El precio del producto debe ser mayor a 0', 400);
      }

      logger.debug('? Validaciones pasadas para venta de producto �nico', {
        productId,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        totalAmount: quantity * product.price,
        paymentMethod: saleData.paymentMethod || 'efectivo'
      });

      const sale = new Sale({
        productId,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        totalAmount: quantity * product.price,
        barberId: barber._id, // Usar el ID del barbero encontrado
        barberName: barber.user?.name || barber.specialty || 'Barbero', // Mejor manejo del nombre
        notes,
        type: SALE_TYPES.PRODUCT,
        // Campos obligatorios
        status: 'completed',
        saleDate: now(),
        paymentMethod: saleData.paymentMethod || 'efectivo' // Default a efectivo si no se especifica
      });

      await sale.save();

      logger.debug('? Venta de producto �nico creada exitosamente', {
        saleId: sale._id,
        productId,
        productName: product.name,
        quantity,
        totalAmount: sale.totalAmount,
        barberId: barber._id,
        barberName: barber.user?.name || barber.specialty,
        paymentMethod: sale.paymentMethod
      });

      // Descontar del inventario con logging detallado
      // En la venta de producto único también se ajusta realStock (conteo físico).
      logger.debug(`?? Actualizando inventario - Producto: ${productId}, Cantidad a descontar: ${quantity}`);
      const productBefore = await Inventory.findById(productId);
      logger.debug(`?? Stock antes: currentStock=${productBefore.currentStock}, stock=${productBefore.stock}`);
      
      const updateResult = await Inventory.findByIdAndUpdate(
        productId,
        { 
          $inc: { 
            stock: -quantity, // Campo principal te�rico
            realStock: -quantity, // Campo real - DEBE ACTUALIZARSE TAMBI�N
            sales: quantity   // SOLO registrar ventas
          }
        },
        { new: true } // Devolver documento actualizado
      );
      
      logger.debug(`?? Stock despu�s: currentStock=${updateResult.currentStock}, stock=${updateResult.stock}, realStock=${updateResult.realStock}`);
      logger.debug(`? Inventario actualizado para producto ${product.name}`);

      // Actualizar estad�sticas del barbero
      await SaleUseCases.updateBarberStats(barberId, sale.totalAmount, SALE_TYPES.PRODUCT);

      // Registrar log de venta en inventario (carrito completo)
      try {
        await InventoryLogService.createLog(
          'sale',
          null, // No es un producto espec�fico, es un carrito
          'Venta de productos',
          barber.user?._id || barber._id,
          barber.user ? 'barber' : 'admin',
          {
            message: `Carrito vendido: 1 producto`,
            totalAmount: sale.totalAmount,
            productName: product.name,
            quantity: quantity
          }
        );
        logger.debug(`?? Log de carrito creado - Total: $${sale.totalAmount}`);
      } catch (logError) {
        logger.error('Error al crear log de carrito:', logError);
      }

      return sale;
    }

    // Manejo de m�ltiples productos
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Se requiere al menos un producto', 400);
    }

    const sales = [];
    
    for (const item of items) {
      const { productId, quantity, price } = item;
      
      // Verificar que el producto existe
      const product = await Inventory.findById(productId);
      if (!product) {
        throw new AppError(`Producto ${productId} no encontrado`, 404);
      }

      // Verificar stock disponible
      const currentStock = product.currentStock || product.stock || 0;
      if (quantity > currentStock) {
        throw new AppError(`Stock insuficiente para ${product.name}`, 400);
      }

      // Validar campos requeridos
      if (!quantity || quantity <= 0) {
        throw new AppError('La cantidad debe ser mayor a 0', 400);
      }
      
      const salePrice = price || product.price;
      if (!salePrice || salePrice <= 0) {
        throw new AppError('El precio del producto debe ser mayor a 0', 400);
      }
      
      // Validar método de pago usando métodos dinámicos de la BD
      const validPaymentMethods = await SaleUseCases.getValidPaymentMethods();
      if (saleData.paymentMethod && !validPaymentMethods.includes(saleData.paymentMethod)) {
        throw new AppError(`Método de pago inválido: ${saleData.paymentMethod}. Métodos válidos: ${validPaymentMethods.join(', ')}`, 400);
      }

      // Crear venta individual
      const sale = new Sale({
        productId,
        productName: product.name,
        quantity,
        unitPrice: salePrice,
        totalAmount: quantity * salePrice,
        barberId: barber._id, // Usar el ID del barbero encontrado
        barberName: barber.user?.name || barber.specialty || 'Barbero',
        notes,
        type: SALE_TYPES.PRODUCT,
        // Campos obligatorios
        status: 'completed',
        saleDate: now(),
        paymentMethod: saleData.paymentMethod || 'efectivo' // Default a efectivo si no se especifica
      });

      await sale.save();

      // Descontar del inventario con logging detallado
      logger.debug(`?? Actualizando inventario m�ltiple - Producto: ${productId}, Cantidad: ${quantity}`);
      const productBefore = await Inventory.findById(productId);
      logger.debug(`?? Stock antes: ${product.name} currentStock=${productBefore.currentStock}, stock=${productBefore.stock}`);
      
      const updateResult = await Inventory.findByIdAndUpdate(
        productId,
        { 
          $inc: { 
            stock: -quantity, // Campo principal
            sales: quantity   // SOLO registrar ventas
          },
          $set: {
            currentStock: null // Remover campo obsoleto para evitar confusi�n
          }
        },
        { new: true } // Devolver documento actualizado
      );
      
      logger.debug(`?? Stock despu�s: ${product.name} currentStock=${updateResult.currentStock}, stock=${updateResult.stock}`);
      logger.debug(`? Inventario actualizado para ${product.name}`);

      sales.push(sale);
    }

    // Actualizar estad�sticas del barbero
    const totalAmount = sales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    await SaleUseCases.updateBarberStats(barberId, totalAmount, SALE_TYPES.PRODUCT);

    // Registrar UN SOLO log de venta para todo el carrito
    try {
      const productNames = sales.map(sale => `${sale.productName} (${sale.quantity})`).join(', ');
      const totalItems = sales.reduce((sum, sale) => sum + sale.quantity, 0);
      
      await InventoryLogService.createLog(
        'sale',
        null, // No es un producto espec�fico, es un carrito
        'Carrito de productos',
        barber.user?._id || barber._id,
        barber.user ? 'barber' : 'admin',
        {
          message: `Carrito vendido: ${sales.length} productos diferentes`,
          totalAmount: totalAmount,
          products: productNames,
          totalItems: totalItems
        }
      );
      logger.debug(`?? Log de carrito m�ltiple creado - ${sales.length} productos - Total: $${totalAmount}`);
    } catch (logError) {
      logger.error('Error al crear log de carrito m�ltiple:', logError);
    }

    return sales;
  }

  // Crear una venta walk-in (servicio sin cita previa)
  // Valida precio y total (>0), método de pago activo y crea la venta de tipo
  // SERVICIO con cantidad 1; luego actualiza las estadísticas del barbero.
  static async createWalkInSale(saleData) {
    const { serviceId, serviceName, price, barberId, total, notes } = saleData;

    logger.debug('?? Iniciando creaci�n de venta walk-in', {
      serviceId,
      serviceName,
      price,
      barberId,
      total,
      hasNotes: !!notes
    });

    // Verificar que el barbero existe (buscar por ID de barbero o usuario)
    const barber = await SaleUseCases.findBarberByIdOrUserId(barberId);

    // Validar campos requeridos
    if (!price || price <= 0) {
      throw new AppError('El precio del servicio debe ser mayor a 0', 400);
    }
    
    const totalAmount = total || price;
    if (totalAmount <= 0) {
      throw new AppError('El monto total debe ser mayor a 0', 400);
    }
    
    // Validar método de pago usando métodos dinámicos de la BD
    const validPaymentMethods = await SaleUseCases.getValidPaymentMethods();
    if (saleData.paymentMethod && !validPaymentMethods.includes(saleData.paymentMethod)) {
      throw new AppError(`Método de pago inválido: ${saleData.paymentMethod}. Métodos válidos: ${validPaymentMethods.join(', ')}`, 400);
    }

    // Crear la venta walk-in
    const sale = new Sale({
      serviceId,
      serviceName,
      quantity: 1, // Los servicios siempre son cantidad 1
      unitPrice: price,
      totalAmount: totalAmount,
      barberId: barber._id, // Usar el ID del barbero encontrado
      barberName: barber.user?.name || barber.specialty || 'Barbero',
      type: SALE_TYPES.WALKIN,
      notes,
      // Campos obligatorios
      status: 'completed',
      saleDate: now(),
      paymentMethod: saleData.paymentMethod || 'efectivo' // Default a efectivo si no se especifica
    });

    await sale.save();

    logger.debug('? Venta walk-in creada exitosamente', {
      saleId: sale._id,
      serviceId,
      serviceName,
      price,
      totalAmount: sale.totalAmount,
      barberId: barber._id,
      barberName: barber.user?.name || barber.specialty,
      paymentMethod: sale.paymentMethod
    });
    
    // Actualizar estad�sticas del barbero
    await SaleUseCases.updateBarberStats(barberId, sale.totalAmount, SALE_TYPES.WALKIN);
    
    return sale;
  }

  // Actualizar estadísticas del barbero después de una venta
  // Incrementa totalSales (+1) y totalRevenue (+monto) y setea la fecha de
  // última venta. Si falla solo loguea y retorna null (no interrumpe la venta).
  static async updateBarberStats(barberId, saleAmount, saleType = SALE_TYPES.PRODUCT) {
    try {
      logger.debug(`?? Actualizando stats - BarberId: ${barberId}, Amount: ${saleAmount}, Type: ${saleType}`);
      
      // Buscar el barbero primero para obtener el ID correcto
      const barber = await SaleUseCases.findBarberByIdOrUserId(barberId);
      
      // Debug: logger.debug(`?? Barbero encontrado para stats: ${barber._id}`);
      
      // Obtener estad�sticas actuales antes de la actualizaci�n
      const currentBarber = await Barber.findById(barber._id);
      logger.debug(`?? Stats actuales - Sales: ${currentBarber.totalSales || 0}, Revenue: ${currentBarber.totalRevenue || 0}`);
      
      // Actualizar estad�sticas usando el ID del barbero encontrado
      const updateResult = await Barber.findByIdAndUpdate(
        barber._id,
        {
          $inc: {
            totalSales: 1,
            totalRevenue: saleAmount
          },
          $set: {
            lastSaleDate: now()
          }
        },
        { new: true } // Devolver el documento actualizado
      );
      
      logger.debug(`?? Stats despu�s de actualizar - Sales: ${updateResult.totalSales}, Revenue: ${updateResult.totalRevenue}`);
      // Debug: logger.debug(`? Estad�sticas actualizadas exitosamente para barbero ${barber._id}: +$${saleAmount}`);
      
      return updateResult;
    } catch (error) {
      logger.error('? Error actualizando estad�sticas del barbero:', error);
      logger.error('? Stack:', error.stack);
      // No lanzar error para no interrumpir la venta, pero log detallado
      return null;
    }
  }

  // Obtener reporte por per�odo (diario, semanal, mensual)
  // Para reportes semanales y mensuales, la fecha seleccionada es el punto final
  // y se calcula hacia atr�s desde esa fecha
  // Dos agregaciones: ventas de productos (group por barberId) y citas
  // completadas (lookup a barbers/services); ambas se combinan en un mapa por
  // barbero sumando totalRevenue = productos + cortes.
  static async getReportByPeriod(type, date) {
    let startDate, endDate;
    const selectedDate = new Date(date);

    switch (type) {
      case 'daily':
        // Reporte diario: solo el d�a seleccionado
        startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'weekly':
        // Reporte semanal: 7 d�as hacia atr�s desde la fecha seleccionada (incluyendo el d�a seleccionado)
        endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(selectedDate);
        startDate.setDate(startDate.getDate() - 6); // 6 d�as atr�s + d�a actual = 7 d�as
        startDate.setHours(0, 0, 0, 0);
        break;
        
      case 'monthly':
        // Reporte mensual: 30 d�as hacia atr�s desde la fecha seleccionada (incluyendo el d�a seleccionado)
        endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
        startDate = new Date(selectedDate);
        startDate.setDate(startDate.getDate() - 29); // 29 d�as atr�s + d�a actual = 30 d�as
        startDate.setHours(0, 0, 0, 0);
        break;
        
      default:
        throw new AppError('Tipo de reporte no v�lido', 400);
    }

    // Agregar ventas de productos por barbero
    const productSales = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$barberId',
          barberName: { $first: '$barberName' },
          totalProducts: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalAmount' },
          sales: {
            $push: {
              productName: '$productName',
              quantity: '$quantity',
              unitPrice: '$unitPrice',
              totalAmount: '$totalAmount',
              customerName: '$customerName',
              saleDate: '$saleDate'
            }
          }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]);

    // Obtener citas (cortes) del per�odo por barbero
    const Appointment = (await import('../../domain/entities/Appointment.js')).default;
    const appointments = await Appointment.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
          status: 'completed'
        }
      },
      {
        $lookup: {
          from: 'barbers',
          localField: 'barberId',
          foreignField: '_id',
          as: 'barber'
        }
      },
      {
        $unwind: '$barber'
      },
      {
        $lookup: {
          from: 'services',
          localField: 'serviceId',
          foreignField: '_id',
          as: 'service'
        }
      },
      {
        $unwind: '$service'
      },
      {
        $group: {
          _id: '$barberId',
          barberName: { $first: '$barber.name' },
          totalCuts: { $sum: 1 },
          totalCutsRevenue: { $sum: '$service.price' },
          cuts: {
            $push: {
              serviceName: '$service.name',
              servicePrice: '$service.price',
              customerName: '$customerName',
              appointmentDate: '$date'
            }
          }
        }
      }
    ]);

    // Combinar datos de productos y cortes
    const barberMap = new Map();

    // Agregar ventas de productos
    productSales.forEach(barber => {
      barberMap.set(barber._id.toString(), {
        barberId: barber._id,
        barberName: barber.barberName,
        productSales: barber.sales,
        totalProducts: barber.totalProducts,
        totalProductRevenue: barber.totalRevenue,
        cuts: [],
        totalCuts: 0,
        totalCutsRevenue: 0
      });
    });

    // Agregar datos de cortes
    appointments.forEach(barber => {
      const barberId = barber._id.toString();
      if (barberMap.has(barberId)) {
        const existing = barberMap.get(barberId);
        existing.cuts = barber.cuts;
        existing.totalCuts = barber.totalCuts;
        existing.totalCutsRevenue = barber.totalCutsRevenue;
      } else {
        barberMap.set(barberId, {
          barberId: barber._id,
          barberName: barber.barberName,
          productSales: [],
          totalProducts: 0,
          totalProductRevenue: 0,
          cuts: barber.cuts,
          totalCuts: barber.totalCuts,
          totalCutsRevenue: barber.totalCutsRevenue
        });
      }
    });

    // Convertir a array y calcular totales
    const report = Array.from(barberMap.values()).map(barber => ({
      ...barber,
      totalRevenue: barber.totalProductRevenue + barber.totalCutsRevenue,
      totalServices: barber.totalProducts + barber.totalCuts
    }));

    // Ordenar por ingresos totales
    report.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      period: {
        type,
        startDate,
        endDate,
        label: this.getPeriodLabel(type, startDate, endDate)
      },
      data: report
    };
  }

  // Generar etiqueta del per�odo
  // Formatea start/end en es-CO con zona America/Bogota; mensual muestra solo
  // el mes y anual el año.
  static getPeriodLabel(type, startDate, endDate) {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/Bogota'
    };

    switch (type) {
      case 'daily':
        return startDate.toLocaleDateString('es-CO', options);
      case 'weekly':
        return `Semana del ${startDate.toLocaleDateString('es-CO', options)} al ${endDate.toLocaleDateString('es-CO', options)}`;
      case 'monthly':
        return startDate.toLocaleDateString('es-CO', { 
          year: 'numeric', 
          month: 'long',
          timeZone: 'America/Bogota'
        });
      default:
        return 'Per�odo';
    }
  }

  // Obtener reporte diario (mantener compatibilidad)
  // Obtener reporte diario espec�fico para frontend
  // Toma el día completo en hora Colombia (UTC-5, 00:00 a 23:59), junta ventas
  // completadas y citas completadas, las formatea y suma totales (walk-ins
  // quedan vacío por ahora). Ante error retorna la estructura con ceros.
  static async getDailyReport(date) {
    try {
      // CORREGIDO: Manejar zona horaria correctamente (America/Bogota, UTC-5)
      const dateStr = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().split('T')[0];
      const startDate = new Date(`${dateStr}T00:00:00.000-05:00`);
      const endDate = new Date(`${dateStr}T23:59:59.999-05:00`);

      // Obtener ventas del d�a
      const sales = await Sale.find({
        saleDate: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }).populate('productId barberId');

      // Formatear ventas para el frontend
      const formattedSales = sales.map(sale => ({
        _id: sale._id,
        total: sale.totalAmount,
        products: [{
          product: { name: sale.productName },
          quantity: sale.quantity
        }],
        barber: sale.barberId ? {
          user: { name: sale.barberName }
        } : null,
        saleDate: sale.saleDate
      }));

      // Obtener citas del d�a
      const appointments = await Appointment.find({
        date: { $gte: startDate, $lte: endDate },
        status: 'completed'
      }).populate({
        path: 'user',
        select: 'name'
      }).populate({
        path: 'barber',
        populate: {
          path: 'user',
          select: 'name'
        }
      }).populate({
        path: 'service',
        select: 'name price'
      });

      logger.debug(`Encontradas ${appointments.length} citas completadas en la fecha ${dateStr}`);

      // Formatear citas para el frontend
      const formattedAppointments = appointments.map(apt => {
        logger.debug('?? Cita original:', {
          _id: apt._id,
          price: apt.price,
          service: apt.service ? { name: apt.service.name, price: apt.service.price } : 'Sin servicio',
          barber: apt.barber && apt.barber.user ? apt.barber.user.name : 'Sin barbero',
          user: apt.user ? apt.user.name : 'Sin usuario'
        });
        
        return {
          _id: apt._id,
          total: apt.price || 0,
          service: { name: apt.service ? apt.service.name : 'Servicio' },
          barber: { user: { name: apt.barber && apt.barber.user ? apt.barber.user.name : 'Barbero' } },
          user: { name: apt.user ? apt.user.name : 'Cliente' },
          date: apt.date
        };
      });

      // Calcular totales
      const productTotal = formattedSales.reduce((sum, sale) => sum + sale.total, 0);
      const appointmentTotal = formattedAppointments.reduce((sum, apt) => sum + apt.total, 0);

      return {
        sales: formattedSales,
        appointments: formattedAppointments,
        walkIns: [], // Por ahora vac�o
        totals: {
          productTotal,
          appointmentTotal,
          walkInTotal: 0,
          grandTotal: productTotal + appointmentTotal
        }
      };
    } catch (error) {
      logger.error('Error getting daily report:', error);
      return {
        sales: [],
        appointments: [],
        walkIns: [],
        totals: {
          productTotal: 0,
          appointmentTotal: 0,
          walkInTotal: 0,
          grandTotal: 0
        }
      };
    }
  }

  // Obtener todas las ventas con filtros
  // Solo ventas 'completed' (excluye reembolsadas/canceladas): filtra por
  // barbero (resolviendo barberId o userId), producto, método de pago y rango
  // UTC de saleDate. Además trae citas completadas con método de pago y las
  // unifica en formato de venta, ordenando el resultado por fecha descendente.
  static async getAllSales(filters = {}) {
    const query = {
      status: 'completed' // Solo ventas completadas, no reembolsadas
    };
    
    if (filters.barberId) {
      // Intentar resolver el barberId (podr�a ser userId o barberId real)
      try {
        const resolvedBarber = await SaleUseCases.findBarberByIdOrUserId(filters.barberId);
        if (resolvedBarber) {
          query.barberId = resolvedBarber.barberId || resolvedBarber._id;
          logger.debug(`?? Barbero resuelto - Input: ${filters.barberId}, Resolved: ${query.barberId}`);
        } else {
          query.barberId = filters.barberId; // Usar el ID original si no se pudo resolver
        }
      } catch (error) {
        logger.warn('?? Error resolviendo barberId, usando valor original:', error.message);
        query.barberId = filters.barberId;
      }
    }
    
    if (filters.productId) {
      query.productId = filters.productId;
    }

    if (filters.paymentMethod) {
      // Buscar en paymentMethod directo o en array de paymentMethods
      query.$or = [
        { paymentMethod: { $regex: filters.paymentMethod, $options: 'i' } },
        { 'paymentMethods.method': { $regex: filters.paymentMethod, $options: 'i' } }
      ];
    }
    
    if (filters.startDate && filters.endDate) {
      // CORREGIDO: Usar formato UTC para evitar problemas de zona horaria
      query.saleDate = {
        $gte: new Date(filters.startDate + 'T00:00:00.000Z'),
        $lte: new Date(filters.endDate + 'T23:59:59.999Z')
      };
    }

    logger.debug('?? Consulta de ventas con filtros:', JSON.stringify(query, null, 2));

    // Obtener ventas regulares
    const sales = await Sale.find(query)
      .populate('productId', 'name category')
      .populate('barberId', 'name')
      .sort({ saleDate: -1 });

    logger.debug(`?? Ventas regulares encontradas: ${sales.length}`);
    const completedSales = sales.filter(sale => sale.status === 'completed');
    logger.debug(`? Ventas completed despu�s del filtro: ${completedSales.length}`);
    if (sales.length !== completedSales.length) {
      logger.debug(`?? Se filtraron ${sales.length - completedSales.length} ventas no-completed`);
    }

    // Obtener citas completadas (tambi�n son "ventas")
    const appointmentQuery = {
      status: 'completed',
      paymentMethod: { $exists: true, $nin: [null, ''] }
    };

    // Aplicar filtros similares para citas
    if (filters.barberId) {
      // Usar el barberId ya resuelto de la query anterior
      appointmentQuery.barber = query.barberId || filters.barberId;
    }

    if (filters.paymentMethod) {
      appointmentQuery.paymentMethod = { $regex: filters.paymentMethod, $options: 'i' };
    }

    if (filters.startDate && filters.endDate) {
      appointmentQuery.date = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      };
    }

    logger.debug('?? Consulta de citas completadas con filtros:', JSON.stringify(appointmentQuery, null, 2));

    const appointments = await Appointment.find(appointmentQuery)
      .populate('service', 'name')
      .populate('barber', 'name')
      .populate('user', 'name')
      .sort({ date: -1 });

    logger.debug(`?? Citas completadas encontradas: ${appointments.length}`);

    // Formatear citas como ventas
    const appointmentSales = appointments.map(apt => ({
      _id: apt._id,
      saleType: 'appointment',
      serviceName: apt.service?.name || 'Servicio',
      serviceId: apt.service?._id,
      barberName: apt.barber?.name || 'Barbero',
      barberId: apt.barber?._id,
      customerName: apt.user?.name || 'Cliente',
      totalAmount: apt.totalRevenue || apt.price || 0,
      total: apt.totalRevenue || apt.price || 0,
      amount: apt.totalRevenue || apt.price || 0,
      paymentMethod: apt.paymentMethod,
      saleDate: apt.date,
      createdAt: apt.createdAt,
      updatedAt: apt.updatedAt,
      notes: apt.notes
    }));

    // Combinar ventas regulares y citas
    const allSales = [
      ...completedSales.map(sale => ({
        ...sale.toObject(),
        saleType: sale.productId ? SALE_TYPES.PRODUCT : 'service'
      })),
      ...appointmentSales
    ];

    // Ordenar por fecha
    allSales.sort((a, b) => new Date(b.saleDate || b.createdAt) - new Date(a.saleDate || a.createdAt));

    logger.debug(`?? Total de ventas (regulares + citas): ${allSales.length}`);
    
    return allSales;
  }

  // Obtener facturas de carrito (TODAS las ventas desde carrito, con o sin clientData)
  // @param {String} barberId - ID del barbero (opcional, si es null retorna todas)
  // @returns {Array} Ventas creadas desde el carrito
  // Filtra por notas que contengan "Venta desde carrito" e incluye también las
  // reembolsadas; agrega flags isRefunded/displayQuantity/displayTotal (0 si fue
  // reembolsada) conservando originalQuantity/originalTotal.
  static async getCartInvoices(barberId = null) {
    const query = {
      status: { $in: ['completed', 'refunded'] }, // Incluir ventas reembolsadas
      notes: { $regex: /Venta desde carrito/i }
    };

    // Si es barbero, filtrar solo sus ventas
    if (barberId) {
      query.barberId = barberId;
      logger.debug('🔍 Buscando TODAS las ventas de carrito para barbero:', { barberId });
    } else {
      logger.debug('🔍 Buscando TODAS las ventas de carrito (admin)');
    }

    logger.debug('📊 Query de MongoDB:', JSON.stringify(query));

    const sales = await Sale.find(query)
      .populate('productId', 'name category price')
      .populate('serviceId', 'name price')
      .populate('barberId', 'name specialty')
      .sort({ saleDate: -1 })
      .lean(); // .lean() para objetos planos

    logger.debug(`✅ Ventas de carrito encontradas: ${sales.length}`);

    // Agregar información de reembolso a cada venta
    const salesWithRefundInfo = sales.map(sale => ({
      ...sale,
      isRefunded: sale.status === 'refunded',
      displayQuantity: sale.status === 'refunded' ? 0 : sale.quantity,
      displayTotal: sale.status === 'refunded' ? 0 : sale.totalAmount,
      originalQuantity: sale.quantity,
      originalTotal: sale.totalAmount
    }));

    // Log de las primeras 3 ventas para diagnóstico
    if (salesWithRefundInfo.length > 0) {
      logger.debug('🔍 Muestra de ventas encontradas:', 
        salesWithRefundInfo.slice(0, 3).map(sale => ({
          id: sale._id,
          hasClientData: !!sale.clientData,
          isRefunded: sale.isRefunded,
          status: sale.status,
          clientDataKeys: sale.clientData ? Object.keys(sale.clientData) : [],
          clientName: sale.clientData ? `${sale.clientData.firstName || ''} ${sale.clientData.lastName || ''}`.trim() : 'Venta POS',
          date: sale.saleDate,
          notes: sale.notes ? sale.notes.substring(0, 50) : ''
        }))
      );
    } else {
      // Diagnóstico: Verificar cuántas ventas completed existen en total
      const totalCompleted = await Sale.countDocuments({ status: 'completed' });
      const totalRefunded = await Sale.countDocuments({ status: 'refunded' });
      const withCartNotes = await Sale.countDocuments({ 
        status: { $in: ['completed', 'refunded'] },
        notes: { $regex: /carrito/i }
      });
      
      logger.warn('⚠️ No se encontraron ventas de carrito', {
        totalVentasCompleted: totalCompleted,
        totalVentasRefunded: totalRefunded,
        ventasConNotasCarrito: withCartNotes,
        queryUsado: JSON.stringify(query)
      });
    }

    return salesWithRefundInfo;
  }

  // Obtener venta por ID
  // Popula producto y barbero; lanza 404 si no existe.
  static async getSaleById(id) {
    const sale = await Sale.findById(id)
      .populate('productId', 'name category')
      .populate('barberId', 'name');
    
    if (!sale) {
      throw new AppError('Venta no encontrada', 404);
    }
    
    return sale;
  }

  // Cancelar venta (cambiar estado)
  // Marca status 'cancelled' (NO revierte inventario ni totales; para eso existe
  // el flujo de reembolso).
  static async cancelSale(id) {
    const sale = await Sale.findById(id);
    if (!sale) {
      throw new AppError('Venta no encontrada', 404);
    }

    sale.status = 'cancelled';
    await sale.save();
    
    return sale;
  }

  // Obtener estad�sticas de ventas por barbero
  // Cachea 5 min en reportsCacheService con clave normalizada (fechas Date →
  // string) para reutilizar entre consultas equivalentes. Filtra por barbero y
  // estado completed, con día/rango en UTC; agrupa por tipo: ventas (productos)
  // y cortes (walk-ins). totalQuantity solo suma productos. Ante error, ceros.
  static async getBarberSalesStats(barberId, dateFilter = {}) {
    try {
      logger.debug(`🔍 [SaleUseCases] getBarberSalesStats INICIO - barberId: ${barberId}, dateFilter:`, dateFilter);
      
      //Normalizar fechas para clave consistente
      const normalizedFilter = {};
      if (dateFilter.date) {
        normalizedFilter.date = dateFilter.date instanceof Date 
          ? dateFilter.date.toISOString().split('T')[0]  // Solo la fecha YYYY-MM-DD
          : dateFilter.date;
      }
      if (dateFilter.startDate) {
        normalizedFilter.startDate = dateFilter.startDate instanceof Date 
          ? dateFilter.startDate.toISOString()
          : dateFilter.startDate;
      }
      if (dateFilter.endDate) {
        normalizedFilter.endDate = dateFilter.endDate instanceof Date
          ? dateFilter.endDate.toISOString()
          : dateFilter.endDate;
      }
      
      //Generar clave única basada en parámetros
      const cacheKey = `barber-sales-stats:${barberId}:${JSON.stringify(normalizedFilter)}`;
      logger.debug(`🔍 [SaleUseCases] cacheKey: ${cacheKey}`);
      
      // ✅ CACHE: Intentar obtener del cache primero (TTL: 5 minutos)
      const cached = reportsCacheService.cache.get(cacheKey);
      if (cached) {
        logger.debug(`📦 Cache HIT para stats de barbero ${barberId}`);
        logger.debug(`🔍 [SaleUseCases] Retornando desde CACHE:`, cached);
        return cached;
      }
      
      logger.debug(`🔍 [SaleUseCases] Cache MISS - consultando BD...`);

      // Construir filtros de fecha
      const matchConditions = {
        barberId: new mongoose.Types.ObjectId(barberId),
        status: 'completed'
      };

      // Aplicar filtros de fecha
      if (dateFilter.date) {
        // ✅ FIX: Filtro por fecha específica sin zona horaria (usar UTC)
        const targetDate = new Date(dateFilter.date + 'T00:00:00.000Z'); // UTC para evitar desfases
        const startOfDay = new Date(targetDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        
        logger.debug(`🔍 [SaleUseCases] Filtro por fecha específica:`, {
          dateFilter: dateFilter.date,
          targetDate: targetDate.toISOString(),
          startOfDay: startOfDay.toISOString(),
          endOfDay: endOfDay.toISOString()
        });
        
        matchConditions.saleDate = {
          $gte: startOfDay,
          $lte: endOfDay
        };
      } else if (dateFilter.startDate && dateFilter.endDate) {
        // ✅ FIX: Filtro por rango de fechas sin zona horaria (usar UTC)
        const startDate = new Date(dateFilter.startDate + 'T00:00:00.000Z'); // UTC para evitar desfases
        startDate.setUTCHours(0, 0, 0, 0);
        const endDate = new Date(dateFilter.endDate + 'T23:59:59.999Z'); // UTC para evitar desfases
        endDate.setUTCHours(23, 59, 59, 999);
        
        logger.debug(`🔍 [SaleUseCases] Filtro por rango:`, {
          startDateFilter: dateFilter.startDate,
          endDateFilter: dateFilter.endDate,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        
        matchConditions.saleDate = {
          $gte: startDate,
          $lte: endDate
        };
      }

      logger.debug(`?? Filtros aplicados para barbero ${barberId}:`, {
        matchConditions,
        dateFilter
      });

      logger.debug(`🔍 [SaleUseCases] Ejecutando aggregate con matchConditions:`, matchConditions);

      const stats = await Sale.aggregate([
        {
          $match: matchConditions
        },
        {
          $group: {
            _id: '$type', // Agrupar por tipo (product, walkIn)
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 }, // N�mero de transacciones
            totalQuantity: { $sum: '$quantity' }, // Suma de productos/items
            averageSale: { $avg: '$totalAmount' }
          }
        }
      ]);
      
      logger.debug(`🔍 [SaleUseCases] Stats de aggregate:`, { statsLength: stats.length, stats });

      // Inicializar respuesta con valores por defecto
      const result = {
        ventas: [], // Solo productos
        cortes: [], // Solo walk-ins
        total: 0,
        count: 0,
        totalQuantity: 0, // Nueva suma de quantities
        averageSale: 0
      };

      // Procesar resultados y separar por tipo
      let totalGeneral = 0;
      let countGeneral = 0;
      let totalQuantityGeneral = 0; // Solo productos, NO cortes

      stats.forEach(stat => {
        totalGeneral += stat.total;
        countGeneral += stat.count;

        if (stat._id === SALE_TYPES.PRODUCT) {
          // Ventas de productos
          totalQuantityGeneral += stat.totalQuantity || 0; // Solo sumar productos
          result.ventas = [{
            total: stat.total,
            count: stat.count,
            totalQuantity: stat.totalQuantity,
            average: stat.averageSale
          }];
        } else if (stat._id === SALE_TYPES.SERVICE) {
          // Cortes walk-in - NO se suman a totalQuantityGeneral
          result.cortes = [{
            total: stat.total,
            count: stat.count,
            totalQuantity: stat.totalQuantity,
            average: stat.averageSale
          }];
        }
      });

      // Totales generales
      result.total = totalGeneral;
      result.count = countGeneral;
      result.totalQuantity = totalQuantityGeneral;
      result.averageSale = countGeneral > 0 ? totalGeneral / countGeneral : 0;

      logger.debug(`?? Stats separadas para barbero ${barberId} con filtros:`, {
        productos: result.ventas,
        walkIns: result.cortes,
        total: result.total,
        filteredBy: dateFilter
      });

      // ✅ CACHE: Guardar en cache por 5 minutos (300 segundos)
      reportsCacheService.cache.set(cacheKey, result, 300);
      logger.debug(`💾 Cache SET para stats de barbero ${barberId}`);

      logger.debug(`🔍 [SaleUseCases] Retornando result FINAL:`, result);
      return result;
    } catch (error) {
      logger.error('Error getting barber sales stats:', error);
      return {
        ventas: [],
        cortes: [],
        total: 0,
        count: 0,
        averageSale: 0
      };
    }
  }

  // Obtener estadísticas de ventas para varios barberos en una sola consulta
  // @param {string[]} barberIds
  // @param {Object} dateFilter - { date } | { startDate, endDate }
  // @returns {Promise<Object>} mapa barberId → stats (ventas/cortes/totales)
  // Preinicializa un bucket por barbero y lo rellena con una sola agregación
  // agrupada por { barberId, type }; averageSale se calcula al final por bucket.
  static async getBarbersSalesStats(barberIds = [], dateFilter = {}) {
    const emptyBucket = () => ({ ventas: [], cortes: [], total: 0, count: 0, totalQuantity: 0, averageSale: 0 });
    const result = {};

    try {
      const ids = (barberIds || [])
        .filter(Boolean)
        .map((id) => new mongoose.Types.ObjectId(id));

      ids.forEach((id) => { result[String(id)] = emptyBucket(); });

      if (ids.length === 0) return result;

      const matchConditions = {
        barberId: { $in: ids },
        status: 'completed'
      };

      if (dateFilter.date) {
        const targetDate = new Date(dateFilter.date + 'T00:00:00.000Z');
        const startOfDay = new Date(targetDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        matchConditions.saleDate = { $gte: startOfDay, $lte: endOfDay };
      } else if (dateFilter.startDate && dateFilter.endDate) {
        const startDate = new Date(dateFilter.startDate + 'T00:00:00.000Z');
        startDate.setUTCHours(0, 0, 0, 0);
        const endDate = new Date(dateFilter.endDate + 'T23:59:59.999Z');
        endDate.setUTCHours(23, 59, 59, 999);
        matchConditions.saleDate = { $gte: startDate, $lte: endDate };
      }

      const rows = await Sale.aggregate([
        { $match: matchConditions },
        {
          $group: {
            _id: { barberId: '$barberId', type: '$type' },
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 },
            totalQuantity: { $sum: '$quantity' },
            averageSale: { $avg: '$totalAmount' }
          }
        }
      ]);

      rows.forEach((row) => {
        const key = String(row._id.barberId);
        if (!result[key]) result[key] = emptyBucket();

        const bucket = result[key];
        const summary = {
          total: row.total || 0,
          count: row.count || 0,
          totalQuantity: row.totalQuantity || 0,
          average: row.averageSale || 0
        };

        if (row._id.type === SALE_TYPES.PRODUCT) {
          bucket.ventas.push(summary);
          bucket.totalQuantity += summary.totalQuantity;
        } else if (row._id.type === SALE_TYPES.SERVICE) {
          bucket.cortes.push(summary);
        }

        bucket.total += summary.total;
        bucket.count += summary.count;
      });

      Object.values(result).forEach((bucket) => {
        bucket.averageSale = bucket.count > 0 ? bucket.total / bucket.count : 0;
      });

      return result;
    } catch (error) {
      logger.error('Error obteniendo stats de ventas por barberos', { error: error.message, stack: error.stack });
      return result;
    }
  }

  // Obtener reporte diario de ventas
  // Obtener fechas disponibles con ventas para un barbero o global
  // Agrupa ventas completadas por día (YYYY-MM-DD) y retorna las fechas de más
  // reciente a más antigua; ante error retorna [].
  static async getAvailableDates(barberId = null) {
    try {
      const match = barberId
        ? { barberId: new mongoose.Types.ObjectId(barberId), status: 'completed' }
        : { status: 'completed' };
      const sales = await Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$saleDate"
              }
            }
          }
        },
        { $sort: { "_id": -1 } }
      ]);

      return sales.map(s => s._id);
    } catch (error) {
      logger.error('Error obteniendo fechas disponibles de ventas:', error);
      return [];
    }
  }

  // Obtener reporte detallado de ventas agrupado por d�a con detalle de productos
  // Solo productos (type PRODUCT), ordenadas por fecha; el resultado se cachea
  // vía withCache. Agrupa por día con totalAmount y totalProducts.
  static async getDetailedSalesReport(barberId, startDate, endDate) {
    try {
      // Debug: logger.debug(`?? Obteniendo reporte detallado de ventas - Barbero: ${barberId}, Desde: ${startDate || 'SIN LIMITE'}, Hasta: ${endDate || 'SIN LIMITE'}`);
      
      const barber = await SaleUseCases.findBarberByIdOrUserId(barberId);
      // Debug: logger.debug(`?? Barbero encontrado: ${barber?.user?.name || barber?.name}, ID: ${barber._id}`);
      
      let start, end;
      let dateQuery = {};
      
      if (startDate && endDate) {
        // CORREGIDO: Usar formato UTC para evitar problemas de zona horaria
        start = new Date(startDate + 'T00:00:00.000Z');
        end = new Date(endDate + 'T23:59:59.999Z');
        
        dateQuery = { saleDate: { $gte: start, $lte: end } };
        logger.debug(`?? Rango de fechas procesado con UTC: ${start.toISOString()} - ${end.toISOString()}`);
      } else {
        logger.debug(`?? Sin filtro de fechas - obteniendo todos los registros`);
      }

      // Usar cache inteligente
      return await reportsCacheService.withCache(
        'detailed-sales',
        barber._id.toString(),
        start || new Date(0),
        end || new Date(),
        async () => {
          logger.debug(`?? Generando reporte detallado de ventas desde DB`);
          
          const sales = await Sale.find({
            barberId: barber._id,
            ...dateQuery,
            status: 'completed',
            type: SALE_TYPES.PRODUCT // Solo productos, NO walk-ins
          })
          .populate('productId', 'name price')
          .sort({ saleDate: 1 });
          
          // Debug: logger.debug(`?? Ventas encontradas en DB: ${sales.length} registros para barbero ${barber._id}`);
          logger.debug(`?? Query utilizada: barberId=${barber._id}${dateQuery.saleDate ? `, saleDate entre ${start ? start.toISOString() : 'undefined'} y ${end ? end.toISOString() : 'undefined'}` : ', sin filtro de fecha'}, status=completed`);
          if (sales.length > 0) {
            logger.debug(`?? Primera venta: ${sales[0].saleDate}, Total: ${sales[0].totalAmount}`);
            logger.debug(`?? �ltima venta: ${sales[sales.length - 1].saleDate}, Total: ${sales[sales.length - 1].totalAmount}`);
          } else {
            // Verificar si hay ventas para este barbero sin filtro de fecha
            const allSalesForBarber = await Sale.countDocuments({ barberId: barber._id });
            logger.debug(`?? Total de ventas para este barbero (sin filtro de fecha): ${allSalesForBarber}`);
            
            // Verificar si hay ventas en general
            const totalSales = await Sale.countDocuments();
            logger.debug(`?? Total de ventas en la base de datos: ${totalSales}`);
          }

          // Agrupar por d�a
          const salesByDay = {};
          sales.forEach(sale => {
            const dayKey = sale.saleDate.toISOString().split('T')[0];
            
            if (!salesByDay[dayKey]) {
              salesByDay[dayKey] = {
                date: dayKey,
                sales: [],
                totalAmount: 0,
                totalProducts: 0
              };
            }

            // Crear el detalle de la venta individual (solo productos)
            const saleDetail = {
              _id: sale._id,
              saleDate: sale.saleDate,
              total: sale.totalAmount,
              notes: sale.notes,
              type: sale.type, // Siempre ser� SALE_TYPES.PRODUCT
              quantity: sale.quantity,
              unitPrice: sale.unitPrice,
              customerName: sale.customerName,
              paymentMethod: sale.paymentMethod
            };

            // Agregar informaci�n del producto
            if (sale.productId) {
              saleDetail.product = {
                _id: sale.productId._id,
                name: sale.productId.name || sale.productName,
                price: sale.productId.price || sale.unitPrice
              };
            }

            salesByDay[dayKey].sales.push(saleDetail);
            salesByDay[dayKey].totalAmount += sale.totalAmount;
            salesByDay[dayKey].totalProducts += sale.quantity;
          });

          const result = Object.values(salesByDay).sort((a, b) => new Date(a.date) - new Date(b.date));
          
          logger.debug(`? Reporte detallado generado: ${result.length} d�as con ventas`);
          return result;
        }
      );

    } catch (error) {
      logger.error('Error generando reporte detallado de ventas:', error);
      throw error;
    }
  }

  // Obtener detalles de cortes walk-in agrupados por d�a
  // Ventas de servicios (type SERVICE) con servicio populado, cacheadas vía
  // withCache y agrupadas por día (totalAmount y totalServices).
  static async getWalkInDetails(barberId, startDate, endDate) {
    try {
      // Debug: logger.debug(`?? Obteniendo detalles de cortes walk-in - Barbero: ${barberId}, Desde: ${startDate || 'SIN LIMITE'}, Hasta: ${endDate || 'SIN LIMITE'}`);
      
      const barber = await SaleUseCases.findBarberByIdOrUserId(barberId);
      
      let start, end;
      let dateQuery = {};
      
      if (startDate && endDate) {
        // CORREGIDO: Usar formato UTC para evitar problemas de zona horaria
        start = new Date(startDate + 'T00:00:00.000Z');
        end = new Date(endDate + 'T23:59:59.999Z');
        
        dateQuery = { saleDate: { $gte: start, $lte: end } };
      }

      // Usar cache inteligente
      return await reportsCacheService.withCache(
        'walk-in-details',
        barber._id.toString(),
        start || new Date(0),
        end || new Date(),
        async () => {
          logger.debug(`?? Generando detalles de walk-in desde DB`);
          
          // Buscar ventas walk-in (ventas sin items de productos, solo servicios)
          const walkInSales = await Sale.find({
            barberId: barber._id,
            ...dateQuery,
            status: 'completed',
            type: SALE_TYPES.SERVICE
          })
          .populate('serviceId', 'name price duration')
          .sort({ saleDate: 1 });

          // Agrupar por d�a
          const walkInsByDay = {};
          walkInSales.forEach(sale => {
            const dayKey = sale.saleDate.toISOString().split('T')[0];
            
            if (!walkInsByDay[dayKey]) {
              walkInsByDay[dayKey] = {
                date: dayKey,
                walkIns: [],
                totalAmount: 0,
                totalServices: 0
              };
            }

            const walkInDetail = {
              _id: sale._id,
              saleDate: sale.saleDate,
              total: sale.total,
              notes: sale.notes,
              services: sale.services ? sale.services.map(service => ({
                service: {
                  _id: service.service._id,
                  name: service.service.name,
                  price: service.service.price,
                  duration: service.service.duration
                },
                price: service.price
              })) : []
            };

            walkInsByDay[dayKey].walkIns.push(walkInDetail);
            walkInsByDay[dayKey].totalAmount += sale.total;
            walkInsByDay[dayKey].totalServices += sale.services ? sale.services.length : 0;
          });

          const result = Object.values(walkInsByDay).sort((a, b) => new Date(a.date) - new Date(b.date));
          
          logger.debug(`? Detalles de walk-in generados: ${result.length} d�as con cortes`);
          return result;
        }
      );

    } catch (error) {
      logger.error('Error generando detalles de walk-in:', error);
      throw error;
    }
  }

  // Obtener reporte detallado de cortes (servicios walk-in) agrupado por d�a
  // Igual que el reporte de ventas pero para type SERVICE; cacheado y agrupado
  // por día con totalAmount y totalCuts.
  static async getDetailedCutsReport(barberId, startDate, endDate) {
    try {
      // Debug: logger.debug(`?? Obteniendo reporte detallado de cortes - Barbero: ${barberId}, Desde: ${startDate || 'SIN LIMITE'}, Hasta: ${endDate || 'SIN LIMITE'}`);
      
      const barber = await SaleUseCases.findBarberByIdOrUserId(barberId);
      // Debug: logger.debug(`?? Barbero encontrado: ${barber?.user?.name || barber?.name}, ID: ${barber._id}`);
      
      let start, end;
      let dateQuery = {};
      
      if (startDate && endDate) {
        // CORREGIDO: Usar formato UTC para evitar problemas de zona horaria
        start = new Date(startDate + 'T00:00:00.000Z');
        end = new Date(endDate + 'T23:59:59.999Z');
        dateQuery = { saleDate: { $gte: start, $lte: end } };
        logger.debug(`?? Rango de fechas procesado: ${start.toISOString()} - ${end.toISOString()}`);
      } else {
        logger.debug(`?? Sin filtro de fechas - obteniendo todos los registros`);
      }

      // Usar cache inteligente
      return await reportsCacheService.withCache(
        'detailed-cuts',
        barber._id.toString(),
        start || new Date(0),
        end || new Date(),
        async () => {
          logger.debug(`?? Generando reporte detallado de cortes desde DB`);
          
          const cuts = await Sale.find({
            barberId: barber._id,
            ...dateQuery,
            status: 'completed',
            type: SALE_TYPES.SERVICE
          })
          .populate('serviceId', 'name price duration')
          .sort({ saleDate: 1 });
          
          // Debug: logger.debug(`?? Cortes encontrados en DB: ${cuts.length} registros para barbero ${barber._id}`);
          logger.debug(`?? Query utilizada: barberId=${barber._id}${dateQuery.saleDate ? `, saleDate entre ${start ? start.toISOString() : 'undefined'} y ${end ? end.toISOString() : 'undefined'}` : ', sin filtro de fecha'}, status=completed, type=walkIn`);
          if (cuts.length > 0) {
            logger.debug(`?? Primer corte: ${cuts[0].saleDate}, Total: ${cuts[0].totalAmount}`);
            logger.debug(`?? �ltimo corte: ${cuts[cuts.length - 1].saleDate}, Total: ${cuts[cuts.length - 1].totalAmount}`);
          } else {
            // Verificar si hay cortes para este barbero sin filtro de fecha
            const allCutsForBarber = await Sale.countDocuments({ barberId: barber._id, type: SALE_TYPES.SERVICE });
            logger.debug(`?? Total de cortes para este barbero (sin filtro de fecha): ${allCutsForBarber}`);
            
            // Verificar si hay cortes en general
            const totalCuts = await Sale.countDocuments({ type: SALE_TYPES.SERVICE });
            logger.debug(`?? Total de cortes en la base de datos: ${totalCuts}`);
          }

          // Agrupar por d�a
          const cutsByDay = {};
          cuts.forEach(cut => {
            const dayKey = cut.saleDate.toISOString().split('T')[0];
            
            if (!cutsByDay[dayKey]) {
              cutsByDay[dayKey] = {
                date: dayKey,
                cuts: [],
                totalAmount: 0,
                totalCuts: 0
              };
            }

            // Crear el detalle del corte individual
            const cutDetail = {
              _id: cut._id,
              saleDate: cut.saleDate,
              total: cut.totalAmount,
              notes: cut.notes,
              customerName: cut.customerName,
              paymentMethod: cut.paymentMethod,
              quantity: cut.quantity,
              unitPrice: cut.unitPrice
            };

            // Agregar informaci�n del servicio
            if (cut.serviceId) {
              cutDetail.service = {
                _id: cut.serviceId._id,
                name: cut.serviceId.name || cut.serviceName,
                price: cut.serviceId.price || cut.unitPrice,
                duration: cut.serviceId.duration
              };
            }

            cutsByDay[dayKey].cuts.push(cutDetail);
            cutsByDay[dayKey].totalAmount += cut.totalAmount;
            cutsByDay[dayKey].totalCuts += cut.quantity;
          });

          const result = Object.values(cutsByDay).sort((a, b) => new Date(a.date) - new Date(b.date));
          
          logger.debug(`? Reporte detallado de cortes generado: ${result.length} d�as con cortes`);
          return result;
        }
      );

    } catch (error) {
      logger.error('Error generando reporte detallado de cortes:', error);
      throw error;
    }
  }

  // Obtener resumen financiero completo para reportes
  // Agregación principal con $facet (general, itemsBreakdown por servicio/
  // producto, paymentMethods y dailyData con timezone America/Bogota). Suma
  // aparte el revenue de citas completadas, combina sus métodos de pago y los
  // costos de insumos (colección expenses, categoría 'supplies'). Retorna
  // summary + breakdowns + dailyData.
  static async getFinancialSummary(startDate, endDate) {
    try {
      logger.debug(`?? Generando resumen financiero: ${startDate} - ${endDate}`);

      const start = new Date(startDate + 'T00:00:00.000Z');
      const end = new Date(endDate + 'T23:59:59.999Z');

      // Agregaci�n principal para obtener todos los datos basada en el modelo real
      // $facet ejecuta en paralelo: general, itemsBreakdown, paymentMethods y
      // dailyData; se filtra por saleDate (no createdAt) en el rango UTC.
      const summary = await Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: start, $lte: end }, // ? CORREGIDO: Usar saleDate en lugar de createdAt
            status: 'completed'
          }
        },
        {
          $facet: {
            // Resumen general
            general: [
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: '$totalAmount' },
                  totalSales: { $sum: 1 },
                  totalItems: { $sum: '$quantity' }
                }
              }
            ],
            
            // Breakdown por servicios y productos
            itemsBreakdown: [
              {
                $group: {
                  _id: {
                    type: '$type',
                    itemId: {
                      $cond: [
                        { $eq: ['$type', SALE_TYPES.SERVICE] },
                        '$serviceId',
                        '$productId'
                      ]
                    },
                    name: {
                      $cond: [
                        { $eq: ['$type', SALE_TYPES.SERVICE] },
                        '$serviceName',
                        '$productName'
                      ]
                    }
                  },
                  totalRevenue: { $sum: '$totalAmount' },
                  totalQuantity: { $sum: '$quantity' },
                  count: { $sum: 1 }
                }
              }
            ],

            // Breakdown por m�todos de pago
            paymentMethods: [
              {
                $group: {
                  _id: '$paymentMethod',
                  totalAmount: { $sum: '$totalAmount' },
                  count: { $sum: 1 }
                }
              }
            ],

            // Datos diarios
            dailyData: [
              {
                $group: {
                  _id: {
                    $dateToString: {
                      format: '%Y-%m-%d',
                      date: '$saleDate', // ? CORREGIDO: Usar saleDate para datos diarios
                      timezone: 'America/Bogota'
                    }
                  },
                  totalRevenue: { $sum: '$totalAmount' },
                  totalSales: { $sum: 1 }
                }
              },
              { $sort: { _id: 1 } }
            ]
          }
        }
      ]);

      const result = summary[0];

      // Procesar resultados
      const generalSummary = result.general[0] || {
        totalRevenue: 0,
        totalSales: 0,
        totalItems: 0
      };

      // Separar servicios y productos
      const serviceBreakdown = result.itemsBreakdown
        .filter(item => item._id.type === SALE_TYPES.SERVICE)
        .map(item => ({
          serviceId: item._id.itemId,
          serviceName: item._id.name || 'Servicio sin nombre',
          totalRevenue: item.totalRevenue,
          totalQuantity: item.totalQuantity,
          count: item.count
        }));

      const productBreakdown = result.itemsBreakdown
        .filter(item => item._id.type === SALE_TYPES.PRODUCT)
        .map(item => ({
          productId: item._id.itemId,
          productName: item._id.name || 'Producto sin nombre',
          totalRevenue: item.totalRevenue,
          totalQuantity: item.totalQuantity,
          count: item.count
        }));

      // Procesar m�todos de pago de ventas
      const paymentMethodBreakdown = result.paymentMethods.reduce((acc, pm) => {
        acc[pm._id || 'unknown'] = pm.totalAmount;
        return acc;
      }, {});

      // ? Agregar m�todos de pago de citas completadas
      const appointmentPaymentMethods = await Appointment.aggregate([
        {
          $match: {
            date: { $gte: start, $lte: end },
            status: 'completed',
            paymentMethod: { $exists: true, $nin: [null, ''] }
          }
        },
        {
          $group: {
            _id: '$paymentMethod',
            totalAmount: { $sum: '$price' },
            count: { $sum: 1 }
          }
        }
      ]);

      // ? Combinar m�todos de pago de ventas y citas
      appointmentPaymentMethods.forEach(apm => {
        const method = apm._id;
        if (paymentMethodBreakdown[method]) {
          paymentMethodBreakdown[method] += apm.totalAmount;
        } else {
          paymentMethodBreakdown[method] = apm.totalAmount;
        }
      });

      // Debug: Ver m�todos de pago procesados
      logger.debug('?? Payment methods breakdown from backend:', paymentMethodBreakdown);

      // Datos diarios formateados
      const dailyData = result.dailyData.map(day => ({
        date: day._id,
        totalRevenue: day.totalRevenue,
        totalSales: day.totalSales
      }));

      // Calcular totales por tipo
      const serviceRevenue = serviceBreakdown.reduce((sum, s) => sum + s.totalRevenue, 0);
      const productRevenue = productBreakdown.reduce((sum, p) => sum + p.totalRevenue, 0);
      const totalServices = serviceBreakdown.reduce((sum, s) => sum + s.totalQuantity, 0);
      const totalProducts = productBreakdown.reduce((sum, p) => sum + p.totalQuantity, 0);
      // ? Calcular n�mero de transacciones (no cantidades)
      const totalProductSales = productBreakdown.reduce((sum, p) => sum + p.count, 0);
      const totalServiceSales = serviceBreakdown.reduce((sum, s) => sum + s.count, 0);

      // Obtener total de citas del per�odo y calcular revenue
      const appointmentStats = await Appointment.aggregate([
        {
          $match: {
            date: { $gte: start, $lte: end },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalAppointments: { $sum: 1 },
            appointmentRevenue: { $sum: '$price' }
          }
        }
      ]);

      const totalAppointments = appointmentStats[0]?.totalAppointments || 0;
      const appointmentRevenue = appointmentStats[0]?.appointmentRevenue || 0;

      // ? Calcular costos directos reales (gastos de categor�a 'supplies')
      // Consulta directa a la colección expenses (insumos) dentro del período.
      const suppliesCostsResult = await mongoose.connection.db.collection('expenses').aggregate([
        {
          $match: {
            date: { $gte: start, $lte: end },
            category: 'supplies' // Insumos/materiales
          }
        },
        {
          $group: {
            _id: null,
            suppliesCosts: { $sum: '$amount' }
          }
        }
      ]).toArray();

      const suppliesCosts = suppliesCostsResult[0]?.suppliesCosts || 0;

      // Obtener la fecha m�s antigua de los datos
      const oldestDataDate = dailyData.length > 0 ? dailyData[0].date : null;

      const financialSummary = {
        summary: {
          totalRevenue: generalSummary.totalRevenue + appointmentRevenue, // ? Incluir revenue de citas
          totalServices: totalServiceSales, // ? CORREGIDO: N�mero de ventas walk-in
          totalProducts: totalProductSales, // ? CORREGIDO: N�mero de ventas de productos
          totalServiceQuantity: totalServices, // ? Cantidad total de servicios
          totalProductQuantity: totalProducts, // ? Cantidad total de productos
          totalAppointments,
          appointmentRevenue, // ? Nuevo campo para revenue de citas
          suppliesCosts, // ? NUEVO: Costos directos reales de insumos
          paymentMethods: paymentMethodBreakdown,
          // ? Agregar ingresos por tipo para el frontend
          serviceRevenue: serviceRevenue,
          productRevenue: productRevenue,
          oldestDataDate: oldestDataDate // ? A�ADIDO PARA EL FRONTEND
        },
        serviceBreakdown,
        productBreakdown,
        paymentMethodBreakdown: result.paymentMethods,
        dailyData,
        daysWithData: dailyData.length // ? A�ADIDO PARA EL FRONTEND
      };

      logger.debug(`? Resumen financiero generado:`, {
        totalRevenue: financialSummary.summary.totalRevenue,
        totalServices: totalServiceSales, // ? CORREGIDO: Mostrar n�mero de ventas
        totalProducts: totalProductSales, // ? CORREGIDO: Mostrar n�mero de ventas
        serviceRevenue: serviceRevenue,
        productRevenue: productRevenue,
        daysWithData: dailyData.length,
        oldestDataDate: oldestDataDate, // ? Log para verificar
        paymentMethods: paymentMethodBreakdown
      });

      return financialSummary;

    } catch (error) {
      logger.error('Error generando resumen financiero:', error);
      throw error;
    }
  }

  // Crear venta desde carrito con m�todos de pago m�ltiples
  // Procesa cada ítem: productos validan stock y descuentan stock/sales; los
  // servicios no tocan inventario. Cada ítem usa su propio paymentMethod, se
  // guarda como una Sale individual con clientData opcional y al final se
  // actualiza stats del barbero, se registra el log y se retorna el resumen.
  static async createCartSale(cartData) {
    const { cart, barberId, notes, clientData } = cartData;
    
    logger.debug('🛒 Iniciando creación de venta desde carrito', {
      cartLength: cart?.length || 0,
      barberId,
      notes: notes ? 'Sí' : 'No',
      hasClientData: !!clientData
    });

    // Log detallado del clientData recibido
    if (clientData) {
      logger.debug('📋 Datos del cliente recibidos:', {
        firstName: clientData.firstName || 'N/A',
        lastName: clientData.lastName || 'N/A',
        email: clientData.email || 'N/A',
        phone: clientData.phone || 'N/A',
        address: clientData.address || 'N/A',
        sendEmail: clientData.sendEmail || false
      });
    } else {
      logger.warn('⚠️ No se recibió clientData en el carrito');
    }

    // Verificar que el barbero existe
    const barber = await SaleUseCases.findBarberByIdOrUserId(barberId);

    // Validar que hay items en el carrito
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      logger.error('? Carrito vac�o o inv�lido', { cart });
      throw new AppError('El carrito no puede estar vac�o', 400);
    }

    // Procesar cada item del carrito
    const saleItems = [];
    let totalAmount = 0;

    for (const cartItem of cart) {
      const { 
        id, 
        type, 
        name, 
        price, 
        quantity, 
        paymentMethod = 'efectivo',
        serviceId 
      } = cartItem;

      let saleItem;

      if (type === SALE_TYPES.PRODUCT) {
        // Validar producto y stock
        const product = await Inventory.findById(id);
        if (!product) {
          logger.error('? Producto no encontrado en carrito', { productId: id, productName: name });
          throw new AppError(`Producto ${name} no encontrado`, 404);
        }

        const currentStock = product.stock || 0;
        if (quantity > currentStock) {
          logger.error('? Stock insuficiente en carrito', {
            productId: id,
            productName: product.name,
            requiredQuantity: quantity,
            availableStock: currentStock
          });
          throw new AppError(`Stock insuficiente para ${product.name}. Disponible: ${currentStock}`, 400);
        }

        // Crear item de venta para producto
        saleItem = {
          productId: id,
          productName: name,
          type: SALE_TYPES.PRODUCT,
          quantity,
          unitPrice: price,
          totalAmount: quantity * price,
          paymentMethod
        };

        // Actualizar inventario
        await Inventory.findByIdAndUpdate(
          id,
          { 
            $inc: { 
              stock: -quantity,
              sales: quantity
            }
          }
        );

        logger.debug(`?? Stock actualizado para producto`, {
          productId: id,
          productName: name,
          quantityDeducted: quantity,
          paymentMethod
        });

      } else if (type === SALE_TYPES.SERVICE) {
        // Crear item de venta para servicio walk-in
        saleItem = {
          serviceId: serviceId,
          serviceName: name,
          type: SALE_TYPES.SERVICE,
          quantity: 1,
          unitPrice: price,
          totalAmount: price,
          paymentMethod
        };
      } else {
        throw new AppError(`Tipo de item no v�lido: ${type}`, 400);
      }

      saleItems.push(saleItem);
      totalAmount += saleItem.totalAmount;
    }

    // Crear ventas individuales para cada item del carrito
    const createdSales = [];
    
    for (const saleItem of saleItems) {
      // Validar campos requeridos
      if (!saleItem.quantity || saleItem.quantity <= 0) {
        throw new AppError('La cantidad debe ser mayor a 0', 400);
      }
      
      if (!saleItem.unitPrice || saleItem.unitPrice <= 0) {
        throw new AppError('El precio unitario debe ser mayor a 0', 400);
      }
      
      if (!saleItem.totalAmount || saleItem.totalAmount <= 0) {
        throw new AppError('El monto total debe ser mayor a 0', 400);
      }
      
      // Validar método de pago usando métodos dinámicos de la BD
      const validPaymentMethods = await SaleUseCases.getValidPaymentMethods();
      if (!validPaymentMethods.includes(saleItem.paymentMethod)) {
        throw new AppError(`Método de pago inválido: ${saleItem.paymentMethod}. Métodos válidos: ${validPaymentMethods.join(', ')}`, 400);
      }

      const sale = new Sale({
        // Campos del saleItem
        productId: saleItem.productId,
        productName: saleItem.productName,
        serviceId: saleItem.serviceId,
        serviceName: saleItem.serviceName,
        type: saleItem.type,
        quantity: saleItem.quantity,
        unitPrice: saleItem.unitPrice,
        totalAmount: saleItem.totalAmount,
        paymentMethod: saleItem.paymentMethod,
        // Campos comunes
        barberId: barber._id,
        barberName: barber.user?.name || barber.specialty || 'Barbero',
        notes: `${notes} - Item del carrito`,
        // Datos del cliente (opcional)
        clientData: clientData || undefined,
        // Campos obligatorios
        status: 'completed',
        saleDate: new Date()
      });

      await sale.save();
      createdSales.push(sale);
      
      // Log cada venta guardada con clientData
      if (clientData) {
        logger.debug('💾 Venta guardada con clientData:', {
          saleId: sale._id,
          clientName: `${clientData.firstName} ${clientData.lastName}`,
          clientEmail: clientData.email,
          itemName: saleItem.productName || saleItem.serviceName
        });
      }
    }

    const finalTotalAmount = createdSales.reduce((sum, sale) => sum + sale.totalAmount, 0);

    // Actualizar estad�sticas del barbero
    await SaleUseCases.updateBarberStats(barberId, finalTotalAmount, 'mixed');

    // Registrar log de venta
    try {
      const productNames = saleItems
        .filter(item => item.type === SALE_TYPES.PRODUCT)
        .map(item => item.productName);
      const serviceNames = saleItems
        .filter(item => item.type === SALE_TYPES.SERVICE)
        .map(item => item.serviceName);

      await InventoryLogService.createLog(
        'sale',
        null,
        'Venta desde carrito con m�todos de pago m�ltiples',
        barber.user?._id || barber._id,
        barber.user ? 'barber' : 'admin',
        {
          message: `Carrito vendido: ${saleItems.length} items`,
          totalAmount: finalTotalAmount,
          products: productNames,
          services: serviceNames,
          salesCount: createdSales.length
        }
      );
      logger.debug(`?? Log de carrito creado exitosamente`, {
        totalAmount: finalTotalAmount,
        barberId: barber._id,
        barberName: barber.user?.name || barber.specialty
      });
    } catch (logError) {
      logger.error('? Error al crear log de carrito', {
        error: logError.message,
        totalAmount: finalTotalAmount,
        barberId: barber._id
      });
    }

    logger.debug('? Venta desde carrito creada exitosamente', {
      salesCreated: createdSales.length,
      totalAmount: finalTotalAmount,
      itemsCount: saleItems.length,
      salesIds: createdSales.map(s => s._id)
    });

    return {
      success: true,
      sales: createdSales,
      totalAmount: finalTotalAmount,
      itemsCount: saleItems.length,
      message: `Carrito procesado exitosamente: ${createdSales.length} ventas creadas`
    };
  }
}

export default SaleUseCases;

