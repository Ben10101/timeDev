import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  bootstrapGeneratedAppController,
  getGeneratedAppController,
  getTaskImplementationStatusController,
  listGeneratedAppFilesController,
  planTaskImplementationController,
  reviewTaskImplementationController,
  runTaskImplementationController,
} from '../controllers/implementationController.js';

const router = Router();
router.use(requireAuth);

router.post('/projects/:projectUuid/generated-app/bootstrap', bootstrapGeneratedAppController);
router.get('/projects/:projectUuid/generated-app', getGeneratedAppController);
router.get('/projects/:projectUuid/generated-app/files', listGeneratedAppFilesController);
router.post('/tasks/:taskUuid/implementation/plan', planTaskImplementationController);
router.post('/tasks/:taskUuid/implementation/run', runTaskImplementationController);
router.post('/tasks/:taskUuid/implementation/review', reviewTaskImplementationController);
router.get('/tasks/:taskUuid/implementation/status', getTaskImplementationStatusController);

export default router;
