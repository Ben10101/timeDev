import { Router } from 'express';
import {
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
} from '../controllers/authController.js';
import {
  getAiRuntimeSummaryController,
  getAiSettingsController,
  testAiProviderController,
  updateAiSettingsController,
} from '../controllers/aiSettingsController.js';
import { requireAuth, requireCsrfForCookieSession } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/auth/register', registerController);
router.post('/auth/login', loginController);
router.post('/auth/refresh', requireCsrfForCookieSession, refreshController);
router.post('/auth/logout', requireCsrfForCookieSession, requireAuth, logoutController);
router.get('/auth/me', requireAuth, meController);
router.get('/auth/ai-settings', requireAuth, getAiSettingsController);
router.put('/auth/ai-settings', requireAuth, updateAiSettingsController);
router.get('/auth/ai-runtime', requireAuth, getAiRuntimeSummaryController);
router.post('/auth/ai-settings/test', requireAuth, testAiProviderController);

export default router;
