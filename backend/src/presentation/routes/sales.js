import express from 'express';
import {
  createSale,
  getAllSales,
  getSale,
  getDailyReport,
  getReports,
  cancelSale,
  getBarberSalesStats,
  getBarbersSalesStats,
  getAvailableDates,
  createWalkInSale,
  getDetailedSalesReport,
  getWalkInDetails,
  getDetailedCutsReport,
  getFinancialSummary,
  createCartSale,
  getCartInvoices
} from '../controllers/saleController.js';
import { protect, adminAuth, barberAuth } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';
import { validateSale, validateCartSale } from '../middleware/validation.js';

const router = express.Router();

// Proteger todas las rutas
router.use(protect);

// Cache patterns para invalidación (ventas, reportes y estadísticas de barberos)
const CACHE_PATTERNS = [
  '^/api/v1/sales',
  '^/api/v1/barbers'
];

// Rutas para barberos y administradores (crear ventas)
router.post('/', barberAuth, validateSale, invalidateCacheMiddleware(CACHE_PATTERNS), createSale);
router.post('/walk-in', barberAuth, validateSale, invalidateCacheMiddleware(CACHE_PATTERNS), createWalkInSale);
router.post('/cart', barberAuth, validateCartSale, invalidateCacheMiddleware(CACHE_PATTERNS), createCartSale);

// Facturas de carrito (barberos ven las suyas, admin todas)
router.get('/cart-invoices', barberAuth, getCartInvoices);

// Rutas solo para administradores (reportes y gestión)
router.get('/', adminAuth, getAllSales);
router.get('/reports', adminAuth, getReports);
router.get('/daily-report', adminAuth, getDailyReport);
router.get('/detailed-report', adminAuth, getDetailedSalesReport);
router.get('/detailed-cuts-report', adminAuth, getDetailedCutsReport);
router.get('/financial-summary', adminAuth, cacheMiddleware(60), getFinancialSummary);
router.get('/walk-in-details', adminAuth, getWalkInDetails);

// Rutas de estadísticas (barberos pueden ver sus propias estadísticas)
router.get('/barber/:barberId/stats', barberAuth, getBarberSalesStats);
router.get('/barbers/stats', barberAuth, cacheMiddleware(60), getBarbersSalesStats);
router.get('/barber/:barberId/available-dates', barberAuth, getAvailableDates);
// Endpoint global para fechas disponibles (solo admin)
router.get('/available-dates', adminAuth, cacheMiddleware(30), getAvailableDates);

// Rutas específicas por ID (barberos pueden ver sus ventas, admin todas)
router.get('/:id', barberAuth, getSale);
router.put('/:id/cancel', adminAuth, invalidateCacheMiddleware(CACHE_PATTERNS), cancelSale);

export default router;
