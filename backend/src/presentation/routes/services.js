import express from 'express';
import {
  getServices,
  getService,
  createService,
  updateService,
  deleteService,
  assignServiceToBarber,
  removeServiceFromBarber,
  getServicesByBarber,
  getServiceStats,
  toggleShowInHome,
  toggleActiveStatus
} from '../controllers/serviceController.js';
import { protect, adminAuth } from '../middleware/auth.js';
import { validateService, validateIdParam } from '../middleware/validation.js';
import { uploadImage, uploadToCloudinary } from '../middleware/upload.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';

const router = express.Router();

// Cache patterns para invalidación
const CACHE_PATTERNS = [
  '^/api/v1/services',
  '^/api/v1/services/\\w+',
  '^/api/v1/services/barber/\\w+'
];

// Rutas públicas con caché
router.get('/', cacheMiddleware(60 * 5), getServices); // Cache por 5 minutos
router.get('/:id', validateIdParam, cacheMiddleware(60 * 5), getService);
router.get('/barber/:barberId', validateIdParam, cacheMiddleware(60 * 5), getServicesByBarber);

// Rutas protegidas - Solo admin
router.post('/', 
  protect, 
  adminAuth, 
  uploadImage, 
  uploadToCloudinary,
  validateService, 
  invalidateCacheMiddleware(CACHE_PATTERNS),
  createService
);

router.put('/:id', 
  protect, 
  adminAuth, 
  validateIdParam, 
  uploadImage, 
  uploadToCloudinary,
  validateService,
  invalidateCacheMiddleware(CACHE_PATTERNS),
  updateService
);

router.delete('/:id', 
  protect, 
  adminAuth, 
  validateIdParam,
  invalidateCacheMiddleware(CACHE_PATTERNS),
  deleteService
);

// Rutas para manejo de servicios y barberos
router.post('/:serviceId/barbers/:barberId', 
  protect, 
  adminAuth, 
  validateIdParam,
  invalidateCacheMiddleware(CACHE_PATTERNS),
  assignServiceToBarber
);
router.delete('/:serviceId/barbers/:barberId', protect, adminAuth, validateIdParam, invalidateCacheMiddleware(CACHE_PATTERNS), removeServiceFromBarber);

// Ruta de estadísticas
router.get('/stats/overview', protect, adminAuth, getServiceStats);

// Ruta para actualizar showInHome
router.patch('/:id/show-in-home', 
  protect, 
  adminAuth, 
  validateIdParam,
  invalidateCacheMiddleware(CACHE_PATTERNS),
  toggleShowInHome
);

// Ruta para activar/desactivar servicio
router.patch('/:id/active-status', 
  protect, 
  adminAuth, 
  validateIdParam,
  invalidateCacheMiddleware(CACHE_PATTERNS),
  toggleActiveStatus
);

export default router;