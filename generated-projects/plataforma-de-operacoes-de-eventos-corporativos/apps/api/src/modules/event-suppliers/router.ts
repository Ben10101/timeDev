import { Router } from 'express';
import type { EventSupplierRequest } from '../../../../../packages/shared/src/contracts/event-suppliers.ts';
import { EventSupplierServiceInstance } from './service';
export const EventSupplierRouter = Router();
EventSupplierRouter.get('/', (_req, res) => {
  res.json(EventSupplierServiceInstance.list());
});
EventSupplierRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: EventSupplierRequest = {
  supplierName: String(payload.supplierName || ''),
  serviceCategory: String(payload.serviceCategory || ''),
  primaryContacts: String(payload.primaryContacts || ''),
    };
    const created = EventSupplierServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});