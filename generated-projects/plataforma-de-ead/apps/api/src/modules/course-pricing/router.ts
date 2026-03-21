import { Router } from 'express';
import type { CoursePricingRequest } from '../../../../../packages/shared/src/contracts/course-pricing.ts';
import { CoursePricingServiceInstance } from './service';

export const CoursePricingRouter = Router();

CoursePricingRouter.get('/', (_req, res) => {
  res.json(CoursePricingServiceInstance.list());
});

CoursePricingRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: CoursePricingRequest = {
  fullName: String(payload.fullName || ''),
  profilePhotoUrl: String(payload.profilePhotoUrl || ''),
  email: String(payload.email || ''),
    };
    const created = CoursePricingServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
