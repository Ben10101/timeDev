import { randomUUID } from 'crypto';
import type { CourseModuleListResponse, CourseModuleRequest, CourseModuleResponse } from '../../../../../packages/shared/src/contracts/course-modules.ts';

const records: CourseModuleResponse[] = [];

/**
 * - O nome do perfil e obrigatorio e nao pode ficar em branco.
 */
export class CourseModulesService {
  list(): CourseModuleListResponse {
    return { items: records };
  }

  create(input: CourseModuleRequest): CourseModuleResponse {
    const item: CourseModuleResponse = {
      id: randomUUID(),
      moduleName: input.moduleName,
      ...(input.moduleDescription ? { moduleDescription: input.moduleDescription } : {}),
      displayOrder: input.displayOrder,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    records.push(item);
    return item;
  }

  buildSeedFromTask(): CourseModuleRequest {
    return {
      moduleName: 'Fundamentos do curso',
      moduleDescription: 'Introducao aos conceitos essenciais do treinamento.',
      displayOrder: '1',
    };
  }
}

export const CourseModuleServiceInstance = new CourseModulesService();
records.push(CourseModuleServiceInstance.create(CourseModuleServiceInstance.buildSeedFromTask()));
