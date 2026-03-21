import type { CoursePricingListResponse, CoursePricingRequest, CoursePricingResponse } from '../../../../../packages/shared/src/contracts/course-pricing.ts';

export async function fetchCoursePricingItems(): Promise<CoursePricingResponse[]> {
  const response = await fetch('/api/course-pricing');
  const data: CoursePricingListResponse = await response.json();
  return data.items || [];
}

export async function createCoursePricing(input: CoursePricingRequest): Promise<CoursePricingResponse> {
  const response = await fetch('/api/course-pricing', {
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
