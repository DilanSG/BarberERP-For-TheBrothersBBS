import ThermalPrinter from 'node-thermal-printer';
import { logger } from '../shared/utils/logger.js';
import { AppError } from '../shared/utils/errors.js';
import { formatInColombiaTime } from '../shared/utils/dateUtils.js';

// Servicio de impresión térmica
// Compatible con impresoras ESC/POS (Epson TM-T20II y similares)
class PrinterService {
  constructor() {
    this.printer = null;
    this.isConnected = false;
    this.config = null;
  }

  // Conectar a la impresora
  // @param {Object} config - Configuración de la impresora
  // @returns {Promise<boolean>}
  async connectPrinter(config) {
    try {
      // Configuración por defecto para Epson TM-T20II
      const defaultConfig = {
        type: ThermalPrinter.types.EPSON, // Tipo de impresora
        interface: config.interface || 'tcp', // tcp, usb, bluetooth
        characterSet: 'SLOVENIA', // Soporte para caracteres especiales español
        width: config.width || 48, // Ancho en caracteres (80mm = 48 chars)
        removeSpecialCharacters: false,
        lineCharacter: '-'
      };

      // Configuración específica según el tipo de interfaz
      if (config.interface === 'tcp' || config.interface === 'network') {
        // Impresora en red (Ethernet)
        defaultConfig.interface = 'tcp';
        defaultConfig.options = {
          host: config.host || config.ip || '192.168.1.100',
          port: config.port || 9100, // Puerto estándar ESC/POS
          timeout: config.timeout || 3000
        };
      } else if (config.interface === 'usb') {
        // Impresora USB
        defaultConfig.interface = 'printer:' + (config.deviceName || 'Epson TM-T20II');
        // En Windows: 'printer:Epson TM-T20II'
        // En Linux: '/dev/usb/lp0' o similar
      } else if (config.interface === 'bluetooth') {
        // Impresora Bluetooth
        defaultConfig.interface = config.address || config.macAddress;
      }

      this.config = defaultConfig;
      this.printer = new ThermalPrinter.printer(defaultConfig);

      // Verificar conexión
      const isConnected = await this.testConnection();
      
      if (isConnected) {
        this.isConnected = true;
        logger.info('Impresora térmica conectada exitosamente', {
          interface: defaultConfig.interface,
          type: config.interface
        });
        return true;
      } else {
        throw new Error('No se pudo establecer conexión con la impresora');
      }

    } catch (error) {
      logger.error('Error conectando a la impresora:', {
        error: error.message,
        config: config
      });
      this.isConnected = false;
      throw new AppError(`Error de conexión con impresora: ${error.message}`, 500);
    }
  }

  // Probar conexión con la impresora
  // Nota: solo limpia el buffer local; no hace una verificación de red real.
  // @returns {Promise<boolean>}
  async testConnection() {
    try {
      if (!this.printer) {
        return false;
      }

      // Intentar enviar comando simple
      this.printer.clear();
      return true;
    } catch (error) {
      logger.warn('Test de conexión falló:', error.message);
      return false;
    }
  }

  // Imprimir factura
  // Espera datos ya formateados (business, invoice, barber, client, items, totals, payment)
  // y emite los comandos ESC/POS en el orden: encabezado, items, totales, pago, pie.
  // @param {Object} invoiceData - Datos formateados de la factura
  // @returns {Promise<boolean>}
  async printInvoice(invoiceData) {
    try {
      if (!this.isConnected || !this.printer) {
        throw new AppError('Impresora no conectada', 500);
      }

      const { business, invoice, barber, client, items, totals, payment, notes, isReprint } = invoiceData;

      // Limpiar buffer
      this.printer.clear();

      // ========== ENCABEZADO ==========
      this.printer.alignCenter();
      this.printer.setTextDoubleHeight();
      this.printer.setTextDoubleWidth();
      this.printer.bold(true);
      this.printer.println(business.name || 'THE BROTHERS BARBER SHOP');
      this.printer.bold(false);
      this.printer.setTextNormal();
      this.printer.newLine();

      // Información del negocio
      this.printer.setTextSize(0, 0);
      if (business.address) {
        this.printer.println(business.address);
      }
      if (business.phone) {
        this.printer.println(`Tel: ${business.phone}`);
      }
      if (business.nit) {
        this.printer.println(business.nit);
      }
      if (business.email) {
        this.printer.println(business.email);
      }

      this.printer.drawLine();

      // ========== INFORMACIÓN DE FACTURA ==========
      this.printer.alignLeft();
      this.printer.bold(true);
      this.printer.println(`FACTURA: ${invoice.number}`);
      this.printer.bold(false);
      this.printer.println(`Fecha: ${invoice.date}`);
      this.printer.println(`Barbero: ${barber.name}`);
      if (client.name && client.name !== 'Cliente General') {
        this.printer.println(`Cliente: ${client.name}`);
        if (client.phone) {
          this.printer.println(`Tel: ${client.phone}`);
        }
      } else {
        this.printer.println('Cliente: General');
      }

      // Reimpresión
      if (isReprint) {
        this.printer.newLine();
        this.printer.alignCenter();
        this.printer.bold(true);
        this.printer.println('*** REIMPRESION ***');
        this.printer.bold(false);
        this.printer.alignLeft();
      }

      this.printer.drawLine();

      // ========== ITEMS ==========
      this.printer.bold(true);
      this.printer.tableCustom([
        { text: 'Descripción', align: 'LEFT', width: 0.5 },
        { text: 'Cant', align: 'CENTER', width: 0.15 },
        { text: 'P.Unit', align: 'RIGHT', width: 0.15 },
        { text: 'Total', align: 'RIGHT', width: 0.2 }
      ]);
      this.printer.bold(false);
      this.printer.drawLine();

      // Imprimir cada item
      for (const item of items) {
        // Descripción (puede ocupar más de una línea)
        this.printer.tableCustom([
          { text: item.description, align: 'LEFT', width: 0.5 },
          { text: item.quantity.toString(), align: 'CENTER', width: 0.15 },
          { text: this.formatMoney(item.unitPrice), align: 'RIGHT', width: 0.15 },
          { text: this.formatMoney(item.subtotal), align: 'RIGHT', width: 0.2 }
        ]);
      }

      this.printer.drawLine();

      // ========== TOTALES ==========
      this.printer.alignRight();
      
      if (totals.discount && totals.discount > 0) {
        this.printer.println(`Subtotal: ${this.formatMoney(totals.subtotal + totals.discount)}`);
        this.printer.println(`Descuento: -${this.formatMoney(totals.discount)}`);
      }

      if (totals.tax && totals.tax > 0) {
        this.printer.println(`Subtotal: ${this.formatMoney(totals.subtotal)}`);
        this.printer.println(`IVA: ${this.formatMoney(totals.tax)}`);
      }

      this.printer.newLine();
      this.printer.setTextDoubleHeight();
      this.printer.bold(true);
      this.printer.println(`TOTAL: ${this.formatMoney(totals.total)}`);
      this.printer.bold(false);
      this.printer.setTextNormal();

      this.printer.drawLine();

      // ========== MÉTODO DE PAGO ==========
      this.printer.alignLeft();
      this.printer.println(`Pago: ${payment.methodLabel || payment.method}`);

      // ========== NOTAS ==========
      if (notes) {
        this.printer.newLine();
        this.printer.println('Notas:');
        this.printer.println(notes);
      }

      // ========== PIE DE PÁGINA ==========
      this.printer.newLine();
      this.printer.alignCenter();
      this.printer.println('Gracias por su preferencia!');
      this.printer.newLine();
      this.printer.setTextSize(0, 0);
      this.printer.println('Este documento es equivalente a');
      this.printer.println('una factura de venta');
      this.printer.newLine();
      
      // Código QR opcional (si se tiene URL de factura)
      if (invoice.qrData) {
        this.printer.printQR(invoice.qrData, {
          cellSize: 6,
          correction: 'M',
          model: 2
        });
        this.printer.newLine();
      }

      // Cortar papel
      this.printer.cut();

      // Ejecutar impresión
      const executed = await this.printer.execute();

      logger.info('Factura impresa exitosamente', {
        invoiceNumber: invoice.number,
        total: totals.total,
        items: items.length
      });

      return executed;

    } catch (error) {
      logger.error('Error imprimiendo factura:', {
        error: error.message,
        stack: error.stack
      });
      throw new AppError(`Error al imprimir: ${error.message}`, 500);
    }
  }

  // Imprimir test
  // @returns {Promise<boolean>}
  async printTest() {
    try {
      if (!this.isConnected || !this.printer) {
        throw new AppError('Impresora no conectada', 500);
      }

      this.printer.clear();
      this.printer.alignCenter();
      this.printer.setTextDoubleHeight();
      this.printer.bold(true);
      this.printer.println('TEST DE IMPRESION');
      this.printer.bold(false);
      this.printer.setTextNormal();
      this.printer.newLine();
      
      this.printer.alignLeft();
      this.printer.println('Impresora: Epson TM-T20II');
      this.printer.println('Protocolo: ESC/POS');
      this.printer.println(`Fecha: ${formatInColombiaTime(new Date(), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`);
      this.printer.newLine();
      
      this.printer.drawLine();
      this.printer.alignCenter();
      this.printer.println('Caracteres especiales:');
      this.printer.println('á é í ó ú ñ Ñ ¿ ? ¡ !');
      this.printer.drawLine();
      this.printer.newLine();
      
      this.printer.println('✓ Impresora configurada correctamente');
      this.printer.newLine();
      this.printer.newLine();
      
      this.printer.cut();

      const executed = await this.printer.execute();

      logger.info('Test de impresión ejecutado');
      return executed;

    } catch (error) {
      logger.error('Error en test de impresión:', error.message);
      throw new AppError(`Error en test: ${error.message}`, 500);
    }
  }

  // Abrir cajón de dinero
  // @returns {Promise<boolean>}
  async openCashDrawer() {
    try {
      if (!this.isConnected || !this.printer) {
        throw new AppError('Impresora no conectada', 500);
      }

      this.printer.openCashDrawer();
      const executed = await this.printer.execute();

      logger.info('Cajón de dinero abierto');
      return executed;

    } catch (error) {
      logger.error('Error abriendo cajón:', error.message);
      throw new AppError(`Error abriendo cajón: ${error.message}`, 500);
    }
  }

  // Desconectar impresora
  async disconnectPrinter() {
    try {
      if (this.printer) {
        // No hay método disconnect explícito en node-thermal-printer
        // Solo limpiamos las referencias
        this.printer = null;
        this.isConnected = false;
        this.config = null;
        
        logger.info('Impresora desconectada');
        return true;
      }
    } catch (error) {
      logger.error('Error desconectando impresora:', error.message);
      return false;
    }
  }

  // Obtener estado de la impresora
  // @returns {Object}
  getStatus() {
    return {
      connected: this.isConnected,
      config: this.config ? {
        interface: this.config.interface,
        type: this.config.type
      } : null
    };
  }

  // Formatear cantidad como dinero (pesos colombianos)
  // @param {number} amount - Monto
  // @returns {string}
  formatMoney(amount) {
    return `$${amount.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  }
}

// Singleton instance
const printerService = new PrinterService();

export default printerService;
