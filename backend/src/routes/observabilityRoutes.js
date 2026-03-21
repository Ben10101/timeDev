import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { aiOperationsOverviewController, healthController } from '../controllers/observabilityController.js';

const router = Router();

router.get('/health', healthController);
router.get('/observability/ai', requireAuth, aiOperationsOverviewController);

export default router;
