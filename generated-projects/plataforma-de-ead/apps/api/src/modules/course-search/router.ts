import { Router } from 'express';
import type { CourseSearchRequest } from '../../../../../packages/shared/src/contracts/course-search.ts';
import { CourseSearchServiceInstance } from './service';

export const CourseSearchRouter = Router();

CourseSearchRouter.get('/', (_req, res) => {
  res.json(CourseSearchServiceInstance.list());
});

CourseSearchRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: CourseSearchRequest = {
  fullName: String(payload.fullName || ''),
  profilePhotoUrl: String(payload.profilePhotoUrl || ''),
  email: String(payload.email || ''),
    };
    const created = CourseSearchServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
