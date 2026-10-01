import express from 'express';
import { protect, barberAuth, adminAuth } from '../middleware/auth.js';
import { validateSaleId, validateInvoiceId, validateBarberId } from '../middleware/validation.js';
import * as invoiceController from '../controllers/invoiceController.js';

const router = express.Router();

// ========== RUTAS DE FACTURAS ==========
// IMPORTANTE: Las rutas específicas (con palabras fijas) deben ir ANTES de las rutas con parámetros dinámicos

// Generar factura desde venta (Barber, Admin)
router.post(
  '/generate/:saleId',
  protect,
  barberAuth,
  validateSaleId,
  invoiceController.generateInvoice
);

// Generar y enviar factura de carrito
router.post(
  '/cart',
  protect,
  barberAuth,
  invoiceController.generateCartInvoice
);

// Imprimir factura (Barber, Admin)
router.post(
  '/print/:invoiceId',
  protect,
  barberAuth,
  validateInvoiceId,
  invoiceController.printInvoice
);

// ===== RUTAS GET CON PATHS ESPECÍFICOS (ANTES DE PARÁMETROS DINÁMICOS) =====

// Listar facturas con filtros (Barber: propias, Admin: todas)
router.get(
  '/',
  protect,
  barberAuth,
  invoiceController.listInvoices
);

// Obtener facturas de carrito con datos de cliente
router.get(
  '/cart',
  protect,
  barberAuth,
  invoiceController.getCartInvoices
);

// Obtener información de reembolsos de un carrito
router.get(
  '/cart/:cartId/refunds',
  protect,
  barberAuth,
  invoiceController.getCartRefundInfo
);

// Estadísticas de facturas (Barber: propias, Admin: todas)
router.get(
  '/stats',
  protect,
  barberAuth,
  invoiceController.getInvoiceStats
);

// reporte consolidado por barbero y período (Solo Admin)
router.get(
  '/consolidated/:barberId',
  protect,
  adminAuth,
  validateBarberId,
  invoiceController.generateConsolidatedInvoice
);

// Obtener facturas por venta - /sale/:saleId
router.get(
  '/sale/:saleId',
  protect,
  barberAuth,
  validateSaleId,
  invoiceController.getInvoicesBySale
);

// ===== RUTAS CON PARÁMETROS DINÁMICOS (AL FINAL) =====

// Ver factura en HTML (navegador) - /:invoiceId/view
router.get(
  '/:invoiceId/view',
  protect,
  validateInvoiceId,
  invoiceController.viewInvoiceHTML
);

// Obtener factura por ID - /:invoiceId
router.get(
  '/:invoiceId',
  protect,
  barberAuth,
  validateInvoiceId,
  invoiceController.getInvoice
);

// Cancelar factura (Solo Admin)
router.put(
  '/:invoiceId/cancel',
  protect,
  adminAuth,
  validateInvoiceId,
  invoiceController.cancelInvoice
);

// ========== RUTAS DE IMPRESORA ==========

// Test de impresión (Solo Admin)
router.post(
  '/printer/test',
  protect,
  adminAuth,
  invoiceController.testPrinter
);

// Estado de impresora (Admin)
router.get(
  '/printer/status',
  protect,
  adminAuth,
  invoiceController.getPrinterStatus
);

// Conectar impresora (Admin)
router.post(
  '/printer/connect',
  protect,
  adminAuth,
  invoiceController.connectPrinter
);

// Desconectar impresora (Admin)
router.post(
  '/printer/disconnect',
  protect,
  adminAuth,
  invoiceController.disconnectPrinter
);

export default router;
