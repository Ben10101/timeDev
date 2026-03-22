import type { CoursePlayerListResponse, CoursePlayerRequest, CoursePlayerResponse } from '../../../../../packages/shared/src/contracts/course-player.ts';

export async function fetchCoursePlayerItems(): Promise<CoursePlayerResponse[]> {
  const response = await fetch('/api/course-player');
  const data: CoursePlayerListResponse = await response.json();
  return data.items || [];
}

export async function createCoursePlayer(input: CoursePlayerRequest): Promise<CoursePlayerResponse> {
  const response = await fetch('/api/course-player', {
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
