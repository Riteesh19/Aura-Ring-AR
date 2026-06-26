import { Router } from 'express';
import { saveSize, getSizes } from '../controllers/sizeController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/', saveSize);
router.get('/', getSizes);

export default router;
