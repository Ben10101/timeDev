import { randomUUID } from 'crypto';
import type { CourseCatalogListResponse, CourseCatalogRequest, CourseCatalogResponse } from '../../../../../packages/shared/src/contracts/course-catalog.ts';

const records: CourseCatalogResponse[] = [];

/**
 * - O nome do perfil e obrigatorio e nao pode ficar em branco.
 * - O sistema nao deve permitir registros com e-mail duplicado.
 */
export class CourseCatalogService {
  list(): CourseCatalogListResponse {
    return { items: records };
  }

  create(input: CourseCatalogRequest): CourseCatalogResponse {
    const item: CourseCatalogResponse = {
      id: randomUUID(),
      courseName: input.courseName,
      description: input.description,
      category: input.category,
      price: input.price,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    records.push(item);
    return item;
  }

  buildSeedFromTask(): CourseCatalogRequest {
    return {
      courseName: 'Dominando React do zero',
      description: 'Curso completo para criar interfaces modernas com React.',
      category: 'Desenvolvimento Web',
      price: '197.00',
    };
  }
}

export const CourseCatalogServiceInstance = new CourseCatalogService();
records.push(CourseCatalogServiceInstance.create(CourseCatalogServiceInstance.buildSeedFromTask()));
