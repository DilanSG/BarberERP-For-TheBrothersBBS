import { Router } from 'express';
import { protect, adminAuth } from '../middleware/auth.js';
import User from '../../core/domain/entities/User.js';
import Barber from '../../core/domain/entities/Barber.js';

const router = Router();

// Endpoints de debug: requieren autenticación y rol admin
router.get('/check', protect, adminAuth, async (req, res) => {
  try {
    const users = await User.find({ role: 'barber' });
    const barbers = await Barber.find();

    res.json({
      users: users.map(u => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive
      })),
      barberProfiles: barbers.map(b => ({
        _id: b._id,
        userId: b.user,
        isActive: b.isActive,
        specialty: b.specialty
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
