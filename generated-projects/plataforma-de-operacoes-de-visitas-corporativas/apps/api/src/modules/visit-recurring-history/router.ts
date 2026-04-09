import { Router } from 'express';
import type { VisitRecurringHistoryRequest } from '../../../../../packages/shared/src/contracts/visit-recurring-history.ts';
import { VisitRecurringHistoryServiceInstance } from './service';
export const VisitRecurringHistoryRouter = Router();
VisitRecurringHistoryRouter.get('/', (_req, res) => {
  res.json(VisitRecurringHistoryServiceInstance.list());
});
VisitRecurringHistoryRouter.post('/', (req, res) => {
  try {
    const input = (req.body || {}) as VisitRecurringHistoryRequest;
    const created = VisitRecurringHistoryServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});