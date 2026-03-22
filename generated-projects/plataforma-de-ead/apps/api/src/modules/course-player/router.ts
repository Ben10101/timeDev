import { Router } from 'express';
import type { CoursePlayerRequest } from '../../../../../packages/shared/src/contracts/course-player.ts';
import { CoursePlayerServiceInstance } from './service';

export const CoursePlayerRouter = Router();

CoursePlayerRouter.get('/', (_req, res) => {
  res.json(CoursePlayerServiceInstance.list());
});

CoursePlayerRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: CoursePlayerRequest = {
  fullName: String(payload.fullName || ''),
  profilePhotoUrl: String(payload.profilePhotoUrl || ''),
  email: String(payload.email || ''),
    };
    const created = CoursePlayerServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
