import { randomUUID } from 'crypto';
import type { CoursePricingListResponse, CoursePricingRequest, CoursePricingResponse } from '../../../../../packages/shared/src/contracts/course-pricing.ts';

const records: CoursePricingResponse[] = [];

/**
 * - O nome do perfil e obrigatorio e nao pode ficar em branco.
 */
export class CoursePricingService {
  list(): CoursePricingListResponse {
    return { items: records };
  }

  create(input: CoursePricingRequest): CoursePricingResponse {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new Error('E-mail invalido.');
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

    const item: CoursePricingResponse = {
      id: randomUUID(),
      fullName: input.fullName,
      ...(input.profilePhotoUrl ? { profilePhotoUrl: input.profilePhotoUrl } : {}),
      email: input.email.trim().toLowerCase(),
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    records.push(item);
    return item;
  }

  buildSeedFromTask(): CoursePricingRequest {
    return {
      fullName: 'Joao Silva',
      profilePhotoUrl: 'https://exemplo.com/avatar-joao.png',
      email: 'aluno@exemplo.com',
    };
  }
}

export const CoursePricingServiceInstance = new CoursePricingService();
records.push(CoursePricingServiceInstance.create(CoursePricingServiceInstance.buildSeedFromTask()));
