import { Router } from 'express';
import { runAgentController } from '../controllers/agentController.js';

const router = Router();

router.post('/agents/run', runAgentController);

export default router;