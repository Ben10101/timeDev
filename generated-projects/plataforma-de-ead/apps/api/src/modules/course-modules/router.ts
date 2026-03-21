import { Router } from 'express';
import type { CourseModuleRequest } from '../../../../../packages/shared/src/contracts/course-modules.ts';
import { CourseModuleServiceInstance } from './service';

export const CourseModuleRouter = Router();

CourseModuleRouter.get('/', (_req, res) => {
  res.json(CourseModuleServiceInstance.list());
});

CourseModuleRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: CourseModuleRequest = {
  moduleName: String(payload.moduleName || ''),
  moduleDescription: String(payload.moduleDescription || ''),
  displayOrder: String(payload.displayOrder || ''),
    };
    const created = CourseModuleServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
