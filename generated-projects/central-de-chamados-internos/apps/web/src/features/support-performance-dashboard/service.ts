import type { SupportPerformanceDashboardListResponse, SupportPerformanceDashboardRequest, SupportPerformanceDashboardResponse } from '../../../../../packages/shared/src/contracts/support-performance-dashboard.ts';

export const supportPerformanceDashboardQueryKey = ['support-performance-dashboard'];

export async function fetchSupportPerformanceDashboardItems(): Promise<SupportPerformanceDashboardResponse[]> {
  const response = await fetch('/api/support-performance/dashboard');
  if (!response.ok) throw new Error('Falha ao carregar indicadores do painel.');
  const data: SupportPerformanceDashboardListResponse = await response.json();
  return data.items || [];
}

export async function createSupportPerformanceDashboard(input: SupportPerformanceDashboardRequest): Promise<SupportPerformanceDashboardResponse> {
  const response = await fetch('/api/support-performance/dashboard', {
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
