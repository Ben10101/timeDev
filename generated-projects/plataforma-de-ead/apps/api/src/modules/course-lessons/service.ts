import { randomUUID } from 'crypto';
import type { CourseLessonListResponse, CourseLessonRequest, CourseLessonResponse } from '../../../../../packages/shared/src/contracts/course-lessons.ts';

const records: CourseLessonResponse[] = [];

/**
 * - O nome do perfil e obrigatorio e nao pode ficar em branco.
 * - A foto de perfil deve respeitar o limite maximo de 2MB.
 */
export class CourseLessonsService {
  list(): CourseLessonListResponse {
    return { items: records };
  }

  create(input: CourseLessonRequest): CourseLessonResponse {
    const item: CourseLessonResponse = {
      id: randomUUID(),
      lessonTitle: input.lessonTitle,
      mediaType: input.mediaType,
      moduleReference: input.moduleReference,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    records.push(item);
    return item;
  }

  buildSeedFromTask(): CourseLessonRequest {
    return {
      lessonTitle: 'Instalando o ambiente',
      mediaType: 'video',
      moduleReference: 'Fundamentos do curso',
    };
  }
}

export const CourseLessonServiceInstance = new CourseLessonsService();
records.push(CourseLessonServiceInstance.create(CourseLessonServiceInstance.buildSeedFromTask()));
