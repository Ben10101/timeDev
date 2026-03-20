import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  bootstrapController,
  createTaskArtifactController,
  createProjectController,
  createTaskCommentController,
  createTaskController,
  ensurePipelineProjectController,
  generateProjectArchitectureController,
  generateProjectBacklogController,
  getProjectController,
  getProjectArchitectureStatusController,
  getTaskController,
  importBacklogTasksController,
  listProjectsController,
  listProjectTasksController,
  listAllTasksController,
  updateTaskController,
} from '../controllers/projectDataController.js';

const router = Router();

router.post('/bootstrap', bootstrapController);
router.use(requireAuth);
router.post('/pipeline-project', ensurePipelineProjectController);
router.get('/projects', listProjectsController);
router.post('/projects', createProjectController);
router.get('/projects/:projectUuid', getProjectController);
router.get('/projects/:projectUuid/architecture/status', getProjectArchitectureStatusController);
router.get('/projects/:projectUuid/tasks', listProjectTasksController);
router.get('/tasks', listAllTasksController);
router.post('/projects/:projectUuid/generate-backlog', generateProjectBacklogController);
router.post('/projects/:projectUuid/generate-architecture', generateProjectArchitectureController);
router.post('/projects/:projectUuid/import-backlog', importBacklogTasksController);
router.post('/projects/:projectUuid/tasks', createTaskController);
router.get('/tasks/:taskUuid', getTaskController);
router.patch('/tasks/:taskUuid', updateTaskController);
router.patch('/tasks/:taskUuid/status', updateTaskController);
router.post('/tasks/:taskUuid/comments', createTaskCommentController);
router.post('/tasks/:taskUuid/artifacts', createTaskArtifactController);

export default router;
