import { Router } from 'express';
import {
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/auth/register', registerController);
router.post('/auth/login', loginController);
router.post('/auth/refresh', refreshController);
router.post('/auth/logout', requireAuth, logoutController);
router.get('/auth/me', requireAuth, meController);

export default router;

