import { Router } from 'express';
import type { AccountRegistrationRequest } from '../../../../../packages/shared/src/contracts/auth-register.ts';
import { AccountRegistrationServiceInstance } from './service';

export const AccountRegistrationRouter = Router();

AccountRegistrationRouter.get('/', (_req, res) => {
  res.json(AccountRegistrationServiceInstance.list());
});

AccountRegistrationRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: AccountRegistrationRequest = {
  email: String(payload.email || ''),
  password: String(payload.password || ''),
    };
    const created = AccountRegistrationServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
