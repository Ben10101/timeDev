import { Router } from 'express';
import type { LessonMaterialRequest } from '../../../../../packages/shared/src/contracts/lesson-materials.ts';
import { LessonMaterialServiceInstance } from './service';

export const LessonMaterialRouter = Router();

LessonMaterialRouter.get('/', (_req, res) => {
  res.json(LessonMaterialServiceInstance.list());
});

LessonMaterialRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: LessonMaterialRequest = {
  materialTitle: String(payload.materialTitle || ''),
  fileType: String(payload.fileType || ''),
  fileUrl: String(payload.fileUrl || ''),
    };
    const created = LessonMaterialServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
