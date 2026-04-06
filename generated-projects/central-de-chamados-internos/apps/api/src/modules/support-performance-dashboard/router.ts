import { Router } from 'express';
import { supportPerformanceDashboardController } from './controller';

export const SupportPerformanceDashboardRouter = Router();

SupportPerformanceDashboardRouter.get('/', supportPerformanceDashboardController.list.bind(supportPerformanceDashboardController));
SupportPerformanceDashboardRouter.post('/', supportPerformanceDashboardController.create.bind(supportPerformanceDashboardController));
