import { Router } from 'express';
import type { LoginSessionRequest } from '../../../../../packages/shared/src/contracts/auth-login.ts';
import { LoginSessionServiceInstance } from './service';

export const LoginSessionRouter = Router();

LoginSessionRouter.get('/', (_req, res) => {
  res.json(LoginSessionServiceInstance.list());
});

LoginSessionRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: LoginSessionRequest = {
  email: String(payload.email || ''),
  password: String(payload.password || ''),
    };
    const created = LoginSessionServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
