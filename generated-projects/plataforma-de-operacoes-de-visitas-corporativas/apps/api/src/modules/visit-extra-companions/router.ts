import { Router } from 'express';
import type { VisitExtraCompanionRequest } from '../../../../../packages/shared/src/contracts/visit-extra-companions';
import { VisitExtraCompanionServiceInstance } from './service';
export const VisitExtraCompanionRouter = Router();
VisitExtraCompanionRouter.get('/', async (_req, res) => {
  try {
    const data = await VisitExtraCompanionServiceInstance.list();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Falha ao buscar registros.' });
  }
});
VisitExtraCompanionRouter.post('/', async (req, res) => {
  try {
    const input = (req.body || {}) as VisitExtraCompanionRequest;
    const created = await VisitExtraCompanionServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});