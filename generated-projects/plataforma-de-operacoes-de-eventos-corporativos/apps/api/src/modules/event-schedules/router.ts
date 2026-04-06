import { Router } from 'express';
import type { EventScheduleRequest } from '../../../../../packages/shared/src/contracts/event-schedules.ts';
import { EventScheduleServiceInstance } from './service';
export const EventScheduleRouter = Router();
EventScheduleRouter.get('/', (_req, res) => {
  res.json(EventScheduleServiceInstance.list());
});
EventScheduleRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: EventScheduleRequest = {
  stageName: String(payload.stageName || ''),
  plannedDeadline: payload.plannedDeadline ? new Date(String(payload.plannedDeadline)).toISOString() : '',
  executionNotes: String(payload.executionNotes || ''),
    };
    const created = EventScheduleServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});