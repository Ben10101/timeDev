import { analyzeAlignmentInput } from '../services/alignmentService.js';

export async function analyzeAlignmentController(req, res, next) {
  try {
    const input = req.body?.input || req.body?.idea || '';

    if (!String(input || '').trim()) {
      return res.status(400).json({
        message: 'input é obrigatório para analisar clareza e ambiguidade.',
      });
    }

    const result = analyzeAlignmentInput(input);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  analyzeAlignmentController,
};

