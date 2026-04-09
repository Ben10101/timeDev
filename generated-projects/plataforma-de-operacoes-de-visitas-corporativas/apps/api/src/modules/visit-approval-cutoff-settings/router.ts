import { Router } from 'express';
import type { VisitApprovalCutoffSettingRequest } from '../../../../../packages/shared/src/contracts/visit-approval-cutoff-settings.ts';
import { VisitApprovalCutoffSettingServiceInstance } from './service';
export const VisitApprovalCutoffSettingRouter = Router();
VisitApprovalCutoffSettingRouter.get('/', (_req, res) => {
  res.json(VisitApprovalCutoffSettingServiceInstance.list());
});
VisitApprovalCutoffSettingRouter.post('/', (req, res) => {
  try {
    const input = (req.body || {}) as VisitApprovalCutoffSettingRequest;
    const created = VisitApprovalCutoffSettingServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});