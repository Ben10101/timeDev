import type { CourseCatalogListResponse, CourseCatalogRequest, CourseCatalogResponse } from '../../../../../packages/shared/src/contracts/course-catalog.ts';

export async function fetchCourseCatalogItems(): Promise<CourseCatalogResponse[]> {
  const response = await fetch('/api/courses');
  const data: CourseCatalogListResponse = await response.json();
  return data.items || [];
}

export async function createCourseCatalog(input: CourseCatalogRequest): Promise<CourseCatalogResponse> {
  const response = await fetch('/api/courses', {
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
