import express from 'express';
import {
  getInventory,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustStock,
  getItemsByCategory,
  getLowStockItems,
  getMovementHistory,
  getInventoryStats,
  getInventoryLogs,
  getInventoryLogStats,
  getDailyInventoryReport,
  debugLogs,
  fixInventoryConsistency
} from '../controllers/inventoryController.js';
import { protect, adminAuth, barberAuth } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';
import { validateIdParam, validateCategoryParam, validateInventoryItem } from '../middleware/validation.js';

const router = express.Router();

// Cache patterns para invalidación (inventario, estadísticas y logs)
const CACHE_PATTERNS = [
  '^/api/v1/inventory'
];

// Rutas protegidas - Barberos y admin pueden ver (auth antes de cache para que la key incluya al usuario)
router.get('/', protect, barberAuth, cacheMiddleware(120), getInventory);
router.get('/low-stock', protect, barberAuth, getLowStockItems);
router.get('/stats/overview', protect, adminAuth, getInventoryStats);
router.get('/daily-report', protect, adminAuth, getDailyInventoryReport);
router.get('/logs', protect, adminAuth, getInventoryLogs);
router.get('/logs/stats', protect, adminAuth, getInventoryLogStats);
router.get('/debug/logs', protect, adminAuth, debugLogs);
router.get('/category/:category', protect, barberAuth, validateCategoryParam, getItemsByCategory);
router.get('/:id', protect, barberAuth, validateIdParam, getInventoryItem);
router.get('/:id/history', protect, barberAuth, validateIdParam, getMovementHistory);

// Rutas protegidas - Barberos pueden crear/editar, admin puede todo
router.post('/', protect, barberAuth, validateInventoryItem, invalidateCacheMiddleware(CACHE_PATTERNS), createInventoryItem);
router.put('/:id', protect, barberAuth, validateIdParam, validateInventoryItem, invalidateCacheMiddleware(CACHE_PATTERNS), updateInventoryItem);
router.post('/:id/stock', protect, barberAuth, validateIdParam, invalidateCacheMiddleware(CACHE_PATTERNS), adjustStock);

// Rutas solo para admin
router.delete('/:id', protect, adminAuth, validateIdParam, invalidateCacheMiddleware(CACHE_PATTERNS), deleteInventoryItem);
router.post('/fix-consistency', protect, adminAuth, invalidateCacheMiddleware(CACHE_PATTERNS), fixInventoryConsistency);

export default router;
