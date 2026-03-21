import { getAiOperationsOverview, getOperationalHealth } from '../services/observabilityService.js';
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
