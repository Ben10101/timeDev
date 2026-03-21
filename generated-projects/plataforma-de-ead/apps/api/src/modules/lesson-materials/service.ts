import { randomUUID } from 'crypto';
import type { LessonMaterialListResponse, LessonMaterialRequest, LessonMaterialResponse } from '../../../../../packages/shared/src/contracts/lesson-materials.ts';

const records: LessonMaterialResponse[] = [];

/**
 * - O nome do perfil e obrigatorio e nao pode ficar em branco.
 * - A foto de perfil deve respeitar o limite maximo de 2MB.
 */
export class LessonMaterialsService {
  list(): LessonMaterialListResponse {
    return { items: records };
  }

  create(input: LessonMaterialRequest): LessonMaterialResponse {
    const item: LessonMaterialResponse = {
      id: randomUUID(),
      materialTitle: input.materialTitle,
      fileType: input.fileType,
      fileUrl: input.fileUrl,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    records.push(item);
    return item;
  }

  buildSeedFromTask(): LessonMaterialRequest {
    return {
      materialTitle: 'Checklist da aula',
      fileType: 'pdf',
      fileUrl: 'https://cdn.exemplo.com/material.pdf',
    };
  }
}

export const LessonMaterialServiceInstance = new LessonMaterialsService();
records.push(LessonMaterialServiceInstance.create(LessonMaterialServiceInstance.buildSeedFromTask()));
