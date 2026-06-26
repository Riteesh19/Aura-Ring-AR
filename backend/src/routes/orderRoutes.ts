import { Router } from 'express';
import { createOrder, getOrders } from '../controllers/orderController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/', createOrder);
router.get('/', getOrders);

export default router;
