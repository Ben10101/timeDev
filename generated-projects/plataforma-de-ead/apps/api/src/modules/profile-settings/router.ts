import { Router } from 'express';
import type { ProfileSettingsRequest } from '../../../../../packages/shared/src/contracts/profile-settings.ts';
import { ProfileSettingsServiceInstance } from './service';

export const ProfileSettingsRouter = Router();

ProfileSettingsRouter.get('/', (_req, res) => {
  res.json(ProfileSettingsServiceInstance.list());
});

ProfileSettingsRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: ProfileSettingsRequest = {
  fullName: String(payload.fullName || ''),
  profilePhotoUrl: String(payload.profilePhotoUrl || ''),
  email: String(payload.email || ''),
  password: String(payload.password || ''),
    };
    const created = ProfileSettingsServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
