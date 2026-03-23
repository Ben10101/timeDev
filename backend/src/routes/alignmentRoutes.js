import express from 'express';
import { analyzeAlignmentController } from '../controllers/alignmentController.js';

const router = express.Router();

router.post('/alignment/analyze', analyzeAlignmentController);

export default router;
