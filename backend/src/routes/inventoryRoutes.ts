import { Router } from 'express';
import { getInventory, createRing } from '../controllers/inventoryController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Publicly readable inventory
router.get('/', getInventory);

// Admin-only creation
router.post('/', authenticateToken, requireAdmin, createRing);

export default router;
