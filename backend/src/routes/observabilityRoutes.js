import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  activeAlertsController,
  aiOperationsOverviewController,
  auditTrailController,
  governanceOverviewController,
  healthController,
  operationalHistoryController,
  productionReadinessController,
} from '../controllers/observabilityController.js';

const router = Router();

router.get('/health', healthController);
router.get('/observability/ai', requireAuth, aiOperationsOverviewController);
router.get('/observability/readiness', requireAuth, productionReadinessController);
router.get('/observability/audit', requireAuth, auditTrailController);
router.get('/observability/governance', requireAuth, governanceOverviewController);
router.get('/observability/history', requireAuth, operationalHistoryController);
router.get('/observability/alerts', requireAuth, activeAlertsController);

export default router;
