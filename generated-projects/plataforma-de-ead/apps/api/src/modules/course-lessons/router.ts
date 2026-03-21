import { Router } from 'express';
import type { CourseLessonRequest } from '../../../../../packages/shared/src/contracts/course-lessons.ts';
import { CourseLessonServiceInstance } from './service';

export const CourseLessonRouter = Router();

CourseLessonRouter.get('/', (_req, res) => {
  res.json(CourseLessonServiceInstance.list());
});

CourseLessonRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: CourseLessonRequest = {
  lessonTitle: String(payload.lessonTitle || ''),
  mediaType: String(payload.mediaType || ''),
  moduleReference: String(payload.moduleReference || ''),
    };
    const created = CourseLessonServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
