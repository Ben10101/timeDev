import { randomUUID } from 'crypto';
import type { CourseSearchListResponse, CourseSearchRequest, CourseSearchResponse } from '../../../../../packages/shared/src/contracts/course-search.ts';

const records: CourseSearchResponse[] = [];

/**
 * - O nome do perfil e obrigatorio e nao pode ficar em branco.
 */
export class CourseSearchService {
  list(): CourseSearchListResponse {
    return { items: records };
  }

  create(input: CourseSearchRequest): CourseSearchResponse {
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

    const item: CourseSearchResponse = {
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

  buildSeedFromTask(): CourseSearchRequest {
    return {
      fullName: 'Joao Silva',
      profilePhotoUrl: 'https://exemplo.com/avatar-joao.png',
      email: 'aluno@exemplo.com',
    };
  }
}

export const CourseSearchServiceInstance = new CourseSearchService();
records.push(CourseSearchServiceInstance.create(CourseSearchServiceInstance.buildSeedFromTask()));
