import { randomUUID } from 'crypto';
import type { ProfileSettingsListResponse, ProfileSettingsRequest, ProfileSettingsResponse } from '../../../../../packages/shared/src/contracts/profile-settings.ts';

const records: ProfileSettingsResponse[] = [];

/**
 * - O aluno precisa estar autenticado e com conta ativa para atualizar o perfil.
 * - O nome do perfil e obrigatorio e nao pode ficar em branco.
 * - A foto de perfil deve respeitar o limite maximo de 2MB.
 * - As alteracoes de perfil devem ser registradas em historico para auditoria.
 */
export class ProfileSettingsService {
  list(): ProfileSettingsListResponse {
    return { items: records };
  }

  create(input: ProfileSettingsRequest): ProfileSettingsResponse {
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
    };
  }
}

export const ProfileSettingsServiceInstance = new ProfileSettingsService();
records.push(ProfileSettingsServiceInstance.create(ProfileSettingsServiceInstance.buildSeedFromTask()));
