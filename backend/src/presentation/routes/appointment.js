import { Router } from 'express';
import {
  getAppointments,
  getBarberAppointments,
  getBarberAvailability,
  createAppointment,
  getAppointment,
  updateAppointment,
  cancelAppointment,
  completeAppointment,
  approveAppointment,
  markNoShow,
  getAppointmentStats,
  deleteAppointment,
  cleanupDeletedAppointments,
  cleanupExpiredAppointments,
  getCancellationReason,
  getBarberAppointmentStats,
  getBarbersAppointmentStats,
  getDailyAppointmentReport,
  getAvailableDates,
  getCompletedDetails,
  getCompletedAppointments
} from '../controllers/appointmentController.js';
import { protect, adminAuth } from '../middleware/auth.js';
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache.js';
import { 
  validateAppointmentCreation, 
  validateAppointmentUpdate, 
  validateId,
  validateBarberId
} from '../middleware/validation.js';

const router = Router();

// Cache patterns para invalidación (citas + estadísticas relacionadas)
const CACHE_PATTERNS = [
  '^/api/v1/appointments'
];

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas públicas (requieren autenticación)
router.get('/', cacheMiddleware(30), getAppointments);
router.get('/barber/:barberId', validateBarberId, getBarberAppointments);
router.get('/availability/:barberId', validateBarberId, getBarberAvailability);
router.post('/', validateAppointmentCreation, invalidateCacheMiddleware(CACHE_PATTERNS), createAppointment);

// Rutas admin (deben ir antes que las rutas con :id)
router.get('/stats', adminAuth, cacheMiddleware(60), getAppointmentStats);
router.get('/barber/:barberId/stats', adminAuth, cacheMiddleware(60), getBarberAppointmentStats);
router.get('/barbers/stats', adminAuth, cacheMiddleware(60), getBarbersAppointmentStats);
router.get('/barber/:barberId/available-dates', adminAuth, getAvailableDates);
router.get('/daily-report', adminAuth, getDailyAppointmentReport);
router.get('/completed-details', adminAuth, getCompletedDetails);
router.get('/completed', adminAuth, getCompletedAppointments);
router.post('/cleanup', adminAuth, invalidateCacheMiddleware(CACHE_PATTERNS), cleanupDeletedAppointments);
router.post('/cleanup-expired', adminAuth, invalidateCacheMiddleware(CACHE_PATTERNS), cleanupExpiredAppointments);

// Rutas específicas por ID (deben ir al final)
router.get('/:id', validateId, getAppointment);
router.get('/:id/cancellation-reason', validateId, getCancellationReason);
router.put('/:id', validateId, validateAppointmentUpdate, invalidateCacheMiddleware(CACHE_PATTERNS), updateAppointment);
router.delete('/:id', validateId, invalidateCacheMiddleware(CACHE_PATTERNS), deleteAppointment);

// Rutas de cambio de estado
router.put('/:id/cancel', validateId, invalidateCacheMiddleware(CACHE_PATTERNS), cancelAppointment);
router.put('/:id/approve', validateId, invalidateCacheMiddleware(CACHE_PATTERNS), approveAppointment);
router.put('/:id/complete', validateId, invalidateCacheMiddleware(CACHE_PATTERNS), completeAppointment);
router.put('/:id/no-show', validateId, invalidateCacheMiddleware(CACHE_PATTERNS), markNoShow);

export default router;