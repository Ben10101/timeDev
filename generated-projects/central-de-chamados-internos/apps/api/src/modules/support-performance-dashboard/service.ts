import pino from 'pino';
import type { SupportPerformanceDashboardListResponse, SupportPerformanceDashboardRequest, SupportPerformanceDashboardResponse } from '../../../../../packages/shared/src/contracts/support-performance-dashboard.ts';
import { supportPerformanceDashboardSchema } from './schema';
import { supportPerformanceDashboardRepository } from './repository';

const logger = pino({ name: 'support-performance-dashboard-service' });

export class SupportPerformanceDashboardService {
  list(): SupportPerformanceDashboardListResponse {
    return { items: supportPerformanceDashboardRepository.list() };
  }

  create(input: SupportPerformanceDashboardRequest): SupportPerformanceDashboardResponse {
    const parsedInput = supportPerformanceDashboardSchema.parse(input);
    const created = supportPerformanceDashboardRepository.create(parsedInput);
    logger.info({ categoryFilter: created.categoryFilter, statusFilter: created.statusFilter }, 'Recorte de performance registrado');
    return created;
  }

  buildSeedRecordsFromTask(): SupportPerformanceDashboardRequest[] {
    return [
      { categoryFilter: 'financeiro', statusFilter: 'aberto', timeRange: 'ultimos_7_dias' },
      { categoryFilter: 'acesso', statusFilter: 'em_atendimento', timeRange: 'mes_atual' },
      { categoryFilter: 'geral', statusFilter: 'resolvido', timeRange: 'ultimos_30_dias' },
    ];
  }
}

export const SupportPerformanceDashboardServiceInstance = new SupportPerformanceDashboardService();
supportPerformanceDashboardRepository.seed(SupportPerformanceDashboardServiceInstance.buildSeedRecordsFromTask());
