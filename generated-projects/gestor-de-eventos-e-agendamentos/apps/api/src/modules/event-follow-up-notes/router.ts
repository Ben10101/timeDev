import { Router } from 'express';
import type { EventFollowUpNoteRequest } from '../../../../../packages/shared/src/contracts/event-follow-up-notes';
import { EventFollowUpNoteServiceInstance } from './service';
export const EventFollowUpNoteRouter = Router();
EventFollowUpNoteRouter.get('/', async (_req, res) => {
  try {
    const data = await EventFollowUpNoteServiceInstance.list();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Falha ao buscar registros.' });
  }
});
EventFollowUpNoteRouter.post('/', async (req, res) => {
  try {
    const input = (req.body || {}) as EventFollowUpNoteRequest;
    const created = await EventFollowUpNoteServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});