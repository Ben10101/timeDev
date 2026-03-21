import { Router } from 'express';
import type { CourseEnrollmentRequest } from '../../../../../packages/shared/src/contracts/course-enrollment.ts';
import { CourseEnrollmentServiceInstance } from './service';

export const CourseEnrollmentRouter = Router();

CourseEnrollmentRouter.get('/', (_req, res) => {
  res.json(CourseEnrollmentServiceInstance.list());
});

CourseEnrollmentRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: CourseEnrollmentRequest = {
  fullName: String(payload.fullName || ''),
  profilePhotoUrl: String(payload.profilePhotoUrl || ''),
  email: String(payload.email || ''),
  password: String(payload.password || ''),
    };
    const created = CourseEnrollmentServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
