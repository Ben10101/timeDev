import {
  getAiOperationsOverview,
  getAuditTrail,
  getOperationalHealth,
  getProductionReadiness,
} from '../services/observabilityService.js';
import { serializeBigInts } from '../utils/serialize.js';

export async function healthController(_req, res, next) {
  try {
    const health = await getOperationalHealth();
    res.status(health.status === 'ok' ? 200 : 503).json(health);
  } catch (error) {
    next(error);
  }
}

export async function aiOperationsOverviewController(req, res, next) {
  try {
    const overview = await getAiOperationsOverview(req.authUser.uuid, req.query.projectUuid || null);
    res.json(serializeBigInts(overview));
  } catch (error) {
    next(error);
  }
}

export async function productionReadinessController(req, res, next) {
  try {
    const readiness = await getProductionReadiness(req.authUser.uuid, req.query.projectUuid || null);
    res.json(serializeBigInts(readiness));
  } catch (error) {
    next(error);
  }
}

export async function auditTrailController(req, res, next) {
  try {
    const auditTrail = await getAuditTrail(req.authUser.uuid, {
      projectUuid: req.query.projectUuid || null,
      limit: req.query.limit || 30,
    });
    res.json(serializeBigInts(auditTrail));
  } catch (error) {
    next(error);
  }
}
