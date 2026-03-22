import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  aiOperationsOverviewController,
  auditTrailController,
  healthController,
  productionReadinessController,
} from '../controllers/observabilityController.js';

const router = Router();

router.get('/health', healthController);
router.get('/observability/ai', requireAuth, aiOperationsOverviewController);
router.get('/observability/readiness', requireAuth, productionReadinessController);
router.get('/observability/audit', requireAuth, auditTrailController);

export default router;
