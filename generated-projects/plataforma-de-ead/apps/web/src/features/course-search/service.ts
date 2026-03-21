import type { CourseSearchListResponse, CourseSearchRequest, CourseSearchResponse } from '../../../../../packages/shared/src/contracts/course-search.ts';

export async function fetchCourseSearchItems(): Promise<CourseSearchResponse[]> {
  const response = await fetch('/api/course-search');
  const data: CourseSearchListResponse = await response.json();
  return data.items || [];
}

export async function createCourseSearch(input: CourseSearchRequest): Promise<CourseSearchResponse> {
  const response = await fetch('/api/course-search', {
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
