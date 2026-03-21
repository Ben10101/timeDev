import type { CourseModuleListResponse, CourseModuleRequest, CourseModuleResponse } from '../../../../../packages/shared/src/contracts/course-modules.ts';

export async function fetchCourseModuleItems(): Promise<CourseModuleResponse[]> {
  const response = await fetch('/api/course-modules');
  const data: CourseModuleListResponse = await response.json();
  return data.items || [];
}

export async function createCourseModule(input: CourseModuleRequest): Promise<CourseModuleResponse> {
  const response = await fetch('/api/course-modules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Falha ao criar registro.' }));
    throw new Error(error.message || 'Falha ao criar registro.');
  }

  return response.json();
}
