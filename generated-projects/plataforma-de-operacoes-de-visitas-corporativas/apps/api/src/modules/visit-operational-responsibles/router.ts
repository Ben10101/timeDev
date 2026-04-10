import { Router } from 'express';
import type { VisitOperationalResponsibleRequest } from '../../../../../packages/shared/src/contracts/visit-operational-responsibles';
import { VisitOperationalResponsibleServiceInstance } from './service';
export const VisitOperationalResponsibleRouter = Router();
VisitOperationalResponsibleRouter.get('/', (_req, res) => {
  res.json(VisitOperationalResponsibleServiceInstance.list());
});
VisitOperationalResponsibleRouter.post('/', (req, res) => {
  try {
    const input = (req.body || {}) as VisitOperationalResponsibleRequest;
    const created = VisitOperationalResponsibleServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});