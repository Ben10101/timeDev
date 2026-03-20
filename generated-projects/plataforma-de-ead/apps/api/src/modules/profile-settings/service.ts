import { randomUUID } from 'crypto';
import type { ProfileSettingsListResponse, ProfileSettingsRequest, ProfileSettingsResponse } from '../../../../../packages/shared/src/contracts/profile-settings.ts';

const records: ProfileSettingsResponse[] = [];

/**
 * - O nome do perfil e obrigatorio e nao pode ficar em branco.
 * - O sistema nao deve permitir registros com e-mail duplicado.
 * - O e-mail deve ser validado antes do envio para persistencia.
 * - A senha precisa atender aos criterios minimos de seguranca antes de criar o registro.
 * - A senha nao deve ser persistida em texto puro no ambiente real.
 */
export class ProfileSettingsService {
  list(): ProfileSettingsListResponse {
    return { items: records };
  }

  create(input: ProfileSettingsRequest): ProfileSettingsResponse {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new Error('E-mail invalido.');
    }

    const password = input.password || '';
    const hasStrongPassword = password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);
    if (!hasStrongPassword) {
      throw new Error('Senha invalida.');
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const duplicated = records.find((record) => record.email === normalizedEmail);
    if (duplicated) {
      throw new Error('E-mail ja cadastrado.');
    }

    const normalizedFullName = String(input.fullName || '').trim();
    if (normalizedFullName.length < 3) {
      throw new Error('Nome obrigatorio.');
    }

    if (input.profilePhotoUrl && !/^https?:\/\//.test(input.profilePhotoUrl)) {
      throw new Error('Foto do perfil precisa ser uma URL valida.');
    }

    const item: ProfileSettingsResponse = {
      id: randomUUID(),
      fullName: input.fullName,
      ...(input.profilePhotoUrl ? { profilePhotoUrl: input.profilePhotoUrl } : {}),
      email: input.email.trim().toLowerCase(),
      passwordHint: 'Senha protegida',
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    records.push(item);
    return item;
  }

  buildSeedFromTask(): ProfileSettingsRequest {
    return {
      fullName: 'Joao Silva',
      profilePhotoUrl: 'https://exemplo.com/avatar-joao.png',
      email: 'aluno@exemplo.com',
      password: 'SenhaForte123',
    };
  }
}

export const ProfileSettingsServiceInstance = new ProfileSettingsService();
records.push(ProfileSettingsServiceInstance.create(ProfileSettingsServiceInstance.buildSeedFromTask()));
