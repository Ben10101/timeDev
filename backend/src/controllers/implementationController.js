import {
  bootstrapGeneratedApp,
  getGeneratedAppByProjectUuid,
  getTaskImplementationStatus,
  listGeneratedAppFiles,
  planTaskImplementation,
  reviewTaskImplementation,
  runTaskImplementation,
} from '../services/implementationService.js';
import { serializeBigInts } from '../utils/serialize.js';

export async function bootstrapGeneratedAppController(req, res, next) {
  try {
    const generatedApp = await bootstrapGeneratedApp(req.params.projectUuid, req.body || {});
    res.status(201).json(serializeBigInts(generatedApp));
  } catch (error) {
    next(error);
  }
}

export async function getGeneratedAppController(req, res, next) {
  try {
    const generatedApp = await getGeneratedAppByProjectUuid(req.params.projectUuid);

    if (!generatedApp) {
      return res.status(404).json({ message: 'Nenhum app full stack foi gerado para este projeto ainda.' });
    }

    res.json(serializeBigInts(generatedApp));
  } catch (error) {
    next(error);
  }
}

export async function listGeneratedAppFilesController(req, res, next) {
  try {
    const files = await listGeneratedAppFiles(req.params.projectUuid);
    res.json(serializeBigInts(files));
  } catch (error) {
    next(error);
  }
}

export async function planTaskImplementationController(req, res, next) {
  try {
    const implementation = await planTaskImplementation(req.params.taskUuid);
    res.status(201).json(serializeBigInts(implementation));
  } catch (error) {
    next(error);
  }
}

export async function runTaskImplementationController(req, res, next) {
  try {
    const implementation = await runTaskImplementation(req.params.taskUuid);
    res.status(200).json(serializeBigInts(implementation));
  } catch (error) {
    next(error);
  }
}

export async function getTaskImplementationStatusController(req, res, next) {
  try {
    const implementation = await getTaskImplementationStatus(req.params.taskUuid);

    if (!implementation) {
      return res.status(404).json({ message: 'Nenhuma implementação foi iniciada para esta task.' });
    }

    res.json(serializeBigInts(implementation));
  } catch (error) {
    next(error);
  }
}

export async function reviewTaskImplementationController(req, res, next) {
  try {
    const result = await reviewTaskImplementation(req.params.taskUuid);
    res.status(200).json(serializeBigInts(result));
  } catch (error) {
    next(error);
  }
}
