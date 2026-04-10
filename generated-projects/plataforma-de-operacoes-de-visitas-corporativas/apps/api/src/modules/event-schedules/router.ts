import { Router } from 'express';
import type { EventScheduleRequest } from '../../../../../packages/shared/src/contracts/event-schedules';
import { EventScheduleServiceInstance } from './service';
export const EventScheduleRouter = Router();
EventScheduleRouter.get('/', async (_req, res) => {
  try {
    const data = await EventScheduleServiceInstance.list();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Falha ao buscar registros.' });
  }
});
EventScheduleRouter.post('/', async (req, res) => {
  try {
    const input = (req.body || {}) as EventScheduleRequest;
    const created = await EventScheduleServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});