import { Router } from 'express';
import {
  runAgentController,
  runQaForTaskController,
  runRequirementsForTaskController,
} from '../controllers/agentController.js';

const router = Router();

router.post('/agents/run', runAgentController);
router.post('/tasks/:taskUuid/requirements/run', runRequirementsForTaskController);
router.post('/tasks/:taskUuid/qa/run', runQaForTaskController);

export default router;
