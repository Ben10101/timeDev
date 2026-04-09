import { Router } from 'express';
import type { VisitExtraCompanionRequest } from '../../../../../packages/shared/src/contracts/visit-extra-companions.ts';
import { VisitExtraCompanionServiceInstance } from './service';
export const VisitExtraCompanionRouter = Router();
VisitExtraCompanionRouter.get('/', (_req, res) => {
  res.json(VisitExtraCompanionServiceInstance.list());
});
VisitExtraCompanionRouter.post('/', (req, res) => {
  try {
    const input = (req.body || {}) as VisitExtraCompanionRequest;
    const created = VisitExtraCompanionServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});