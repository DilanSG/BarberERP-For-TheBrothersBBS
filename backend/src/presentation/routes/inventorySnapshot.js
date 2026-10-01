import express from 'express';
import { protect, adminAuth } from '../middleware/auth.js';
import { validateIdParam } from '../middleware/validation.js';
import { 
  createSnapshot,
  getSnapshots,
  getSnapshotById,
  deleteSnapshot,
  getSnapshotStats,
  downloadSnapshotExcel
} from '../controllers/inventorySnapshotController.js';

const router = express.Router();

// Aplicar autenticación a todas las rutas
router.use(protect);

// Rutas que requieren permisos de admin
router.post('/', adminAuth, createSnapshot);
router.get('/', adminAuth, getSnapshots);
router.get('/stats', adminAuth, getSnapshotStats);
router.get('/:id', adminAuth, validateIdParam, getSnapshotById);
router.get('/:id/download', adminAuth, validateIdParam, downloadSnapshotExcel);
router.delete('/:id', adminAuth, validateIdParam, deleteSnapshot);

export default router;
