import type { CourseEnrollmentListResponse, CourseEnrollmentRequest, CourseEnrollmentResponse } from '../../../../../packages/shared/src/contracts/course-enrollment.ts';

export async function fetchCourseEnrollmentItems(): Promise<CourseEnrollmentResponse[]> {
  const response = await fetch('/api/course-enrollments');
  const data: CourseEnrollmentListResponse = await response.json();
  return data.items || [];
}

export async function createCourseEnrollment(input: CourseEnrollmentRequest): Promise<CourseEnrollmentResponse> {
  const response = await fetch('/api/course-enrollments', {
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
