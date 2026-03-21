import { Router } from 'express';
import type { CourseCatalogRequest } from '../../../../../packages/shared/src/contracts/course-catalog.ts';
import { CourseCatalogServiceInstance } from './service';

export const CourseCatalogRouter = Router();

CourseCatalogRouter.get('/', (_req, res) => {
  res.json(CourseCatalogServiceInstance.list());
});

CourseCatalogRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: CourseCatalogRequest = {
  courseName: String(payload.courseName || ''),
  description: String(payload.description || ''),
  category: String(payload.category || ''),
  price: String(payload.price || ''),
    };
    const created = CourseCatalogServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});
