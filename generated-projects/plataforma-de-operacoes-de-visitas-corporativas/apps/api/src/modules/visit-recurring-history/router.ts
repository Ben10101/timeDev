import { Router } from 'express';
import type { VisitRecurringHistoryRequest } from '../../../../../packages/shared/src/contracts/visit-recurring-history';
import { VisitRecurringHistoryServiceInstance } from './service';
export const VisitRecurringHistoryRouter = Router();
VisitRecurringHistoryRouter.get('/', async (_req, res) => {
  try {
    const data = await VisitRecurringHistoryServiceInstance.list();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Falha ao buscar registros.' });
  }
});
VisitRecurringHistoryRouter.post('/', async (req, res) => {
  try {
    const input = (req.body || {}) as VisitRecurringHistoryRequest;
    const created = await VisitRecurringHistoryServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});