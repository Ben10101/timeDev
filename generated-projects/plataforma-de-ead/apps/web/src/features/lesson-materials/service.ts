import type { LessonMaterialListResponse, LessonMaterialRequest, LessonMaterialResponse } from '../../../../../packages/shared/src/contracts/lesson-materials.ts';

export async function fetchLessonMaterialItems(): Promise<LessonMaterialResponse[]> {
  const response = await fetch('/api/lesson-materials');
  const data: LessonMaterialListResponse = await response.json();
  return data.items || [];
}

export async function createLessonMaterial(input: LessonMaterialRequest): Promise<LessonMaterialResponse> {
  const response = await fetch('/api/lesson-materials', {
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
