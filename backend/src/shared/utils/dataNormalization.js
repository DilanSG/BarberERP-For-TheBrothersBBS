import Inventory from '../../core/domain/entities/Inventory.js';
import Service from '../../core/domain/entities/Service.js';
import { logger } from './logger.js';
import { SALE_TYPES, getSaleTypeDisplayName } from '../constants/salesConstants.js';

// Utilidades para normalizar datos entre diferentes entidades
// Adapta ventas y citas a una estructura común usada por reportes y frontend.
class DataNormalizationService {
  
  // Obtener categoría de una venta
  // Prioriza la categoría guardada; si falta, la busca en inventario o servicio.
  // @param {Object} sale - Venta a inspeccionar
  // @returns {Promise<string>} Categoría resuelta
  static async getSaleCategory(sale) {
    try {
      // Si ya tiene categoría, devolverla
      if (sale.category && sale.category.trim()) {
        return sale.category.trim();
      }

      // Para productos, obtener categoría del inventario
      if (sale.type === SALE_TYPES.PRODUCT && sale.productId) {
        const product = await Inventory.findById(sale.productId).select('category name').lean();
        if (product?.category) {
          return product.category;
        }
        // Si el producto no tiene categoría, usar una genérica
        return 'Producto';
      }

      // Para servicios walkIn, intentar obtener del servicio si existe
      if (sale.type === SALE_TYPES.WALKIN) {
        if (sale.serviceId) {
          const service = await Service.findById(sale.serviceId).select('category name').lean();
          if (service?.category) {
            return service.category;
          }
        }
        // Categoría genérica para servicios
        return 'Servicio';
      }

      // Fallback
      return 'Sin categoría';
    } catch (error) {
      logger.warn(`Error obteniendo categoría para venta ${sale._id}:`, error);
      return sale.type === SALE_TYPES.PRODUCT ? 'Producto' : 'Servicio';
    }
  }

  // Normalizar datos de venta para frontend
  // @param {Object} sale - Venta cruda
  // @returns {Promise<Object>} Venta con campos homogéneos (name, category, etc.)
  static async normalizeSaleData(sale) {
    try {
      const normalizedSale = {
        _id: sale._id,
        type: sale.type,
        quantity: sale.quantity || 1,
        unitPrice: sale.unitPrice,
        totalAmount: sale.totalAmount,
        barberId: sale.barberId,
        barberName: sale.barberName,
        paymentMethod: sale.paymentMethod,
        customerName: sale.customerName,
        notes: sale.notes,
        saleDate: sale.saleDate,
        status: sale.status || 'completed',
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt
      };

      // Obtener nombre y categoría según tipo
      if (sale.type === SALE_TYPES.PRODUCT) {
        normalizedSale.productId = sale.productId;
        normalizedSale.productName = sale.productName;
        normalizedSale.name = sale.productName;
      } else if (sale.type === SALE_TYPES.WALKIN) {
        normalizedSale.serviceId = sale.serviceId;
        normalizedSale.serviceName = sale.serviceName;
        normalizedSale.name = sale.serviceName;
      }

      // Obtener categoría normalizada
      normalizedSale.category = await this.getSaleCategory(sale);

      return normalizedSale;
    } catch (error) {
      logger.error(`Error normalizando datos de venta ${sale._id}:`, error);
      return sale; // Devolver original si hay error
    }
  }

  // Normalizar datos de appointment como venta
  // Permite listar citas completadas junto a las ventas en reportes.
  // @param {Object} appointment - Cita con service/barber/user poblados
  // @returns {Object|null} Cita adaptada al formato de venta
  static normalizeAppointmentAsSale(appointment) {
    try {
      return {
        _id: appointment._id,
        type: 'appointment',
        name: appointment.service?.name || 'Servicio de cita',
        serviceName: appointment.service?.name || 'Servicio de cita',
        serviceId: appointment.service?._id || appointment.service,
        category: appointment.service?.category || 'Servicio',
        quantity: 1,
        unitPrice: appointment.price,
        totalAmount: appointment.totalRevenue || appointment.price,
        barberId: appointment.barber?._id || appointment.barber,
        barberName: appointment.barber?.user?.name || appointment.barber?.name,
        paymentMethod: appointment.paymentMethod,
        customerName: appointment.user?.name || 'Cliente',
        customerId: appointment.user?._id || appointment.user,
        notes: appointment.notes,
        saleDate: appointment.date,
        appointmentDate: appointment.date,
        status: 'completed',
        isFromAppointment: true,
        originalAppointment: appointment,
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt
      };
    } catch (error) {
      logger.error(`Error normalizando appointment ${appointment._id} como venta:`, error);
      return null;
    }
  }

  // Obtener tipos de venta normalizados
  static getSaleTypes() {
    return {
      PRODUCT: SALE_TYPES.PRODUCT,
      SERVICE: SALE_TYPES.WALKIN,      // Mantener compatibilidad con backend
      APPOINTMENT: SALE_TYPES.APPOINTMENT
    };
  }

  // Obtener nombre de display para tipos
  static getSaleTypeDisplayName(type) {
    return getSaleTypeDisplayName(type);
  }

  // Obtener todas las categorías disponibles de ventas
  // Une las categorías distintas de inventario y servicios más las genéricas.
  // @returns {Promise<string[]>} Categorías ordenadas y sin duplicados
  static async getAvailableCategories() {
    try {
      // Obtener categorías de productos
      const productCategories = await Inventory.distinct('category', { 
        category: { $exists: true, $nin: [null, ''] } 
      });

      // Obtener categorías de servicios
      const serviceCategories = await Service.distinct('category', { 
        category: { $exists: true, $nin: [null, ''] } 
      });

      // Combinar y eliminar duplicados
      const allCategories = [...new Set([
        ...productCategories,
        ...serviceCategories,
        'Producto', // Categoría genérica
        'Servicio'  // Categoría genérica
      ])].filter(Boolean).sort();

      return allCategories;
    } catch (error) {
      logger.error('Error obteniendo categorías disponibles:', error);
      return ['Producto', 'Servicio'];
    }
  }

  // Validar consistencia de datos de venta
  // Verifica campos obligatorios según el tipo y montos positivos.
  // @param {Object} saleData - Datos de la venta
  // @returns {Object} { isValid, errors }
  static validateSaleData(saleData) {
    const errors = [];

    // Validar tipo
    const validTypes = [SALE_TYPES.PRODUCT, SALE_TYPES.WALKIN];
    if (!validTypes.includes(saleData.type)) {
      errors.push(`Tipo inválido: ${saleData.type}. Debe ser: ${validTypes.join(', ')}`);
    }

    // Validar campos según tipo
    if (saleData.type === SALE_TYPES.PRODUCT) {
      if (!saleData.productId) errors.push('productId es requerido para productos');
      if (!saleData.productName) errors.push('productName es requerido para productos');
    }

    if (saleData.type === SALE_TYPES.WALKIN) {
      if (!saleData.serviceName) errors.push('serviceName es requerido para servicios');
    }

    // Validar campos comunes
    if (!saleData.quantity || saleData.quantity <= 0) {
      errors.push('quantity debe ser mayor a 0');
    }
    if (!saleData.unitPrice || saleData.unitPrice < 0) {
      errors.push('unitPrice debe ser mayor o igual a 0');
    }
    if (!saleData.totalAmount || saleData.totalAmount < 0) {
      errors.push('totalAmount debe ser mayor o igual a 0');
    }
    if (!saleData.barberId) {
      errors.push('barberId es requerido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default DataNormalizationService;