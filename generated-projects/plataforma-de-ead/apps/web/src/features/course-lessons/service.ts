import type { CourseLessonListResponse, CourseLessonRequest, CourseLessonResponse } from '../../../../../packages/shared/src/contracts/course-lessons.ts';

export async function fetchCourseLessonItems(): Promise<CourseLessonResponse[]> {
  const response = await fetch('/api/course-lessons');
  const data: CourseLessonListResponse = await response.json();
  return data.items || [];
}

export async function createCourseLesson(input: CourseLessonRequest): Promise<CourseLessonResponse> {
  const response = await fetch('/api/course-lessons', {
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
