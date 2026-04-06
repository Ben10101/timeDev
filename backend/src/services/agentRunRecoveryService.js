import { prisma } from '../lib/prisma.js';

function resolveRunAgeCutoff(maxAgeSeconds) {
  return new Date(Date.now() - Math.max(30, Number(maxAgeSeconds || 720)) * 1000);
}

function getRecoveryTargetStatus(task) {
  const artifacts = task?.artifacts || [];
  const hasRequirements = artifacts.some(
    (artifact) => artifact.isCurrent && artifact.artifactScope === 'refinement' && artifact.artifactType === 'requirements'
  );
  const hasTestPlan = artifacts.some(
    (artifact) => artifact.isCurrent && artifact.artifactScope === 'refinement' && artifact.artifactType === 'test_plan'
  );

  if (hasTestPlan) {
    return {
      status: 'done',
      assigneeType: 'agent',
      assigneeAgentName: 'qa_engineer',
    };
  }

  if (hasRequirements) {
    return {
      status: 'in_review',
      assigneeType: 'agent',
      assigneeAgentName: 'requirements_analyst',
    };
  }

  return {
    status: 'backlog',
    assigneeType: task?.taskType === 'story' ? 'agent' : 'unassigned',
    assigneeAgentName: task?.taskType === 'story' ? 'requirements_analyst' : null,
  };
}

async function reconcileTaskAfterRecoveredRun(tx, taskId, note) {
  const task = await tx.task.findUnique({
    where: { id: taskId },
    include: {
      artifacts: {
        where: { isCurrent: true, artifactScope: 'refinement' },
        select: { artifactType: true, artifactScope: true, isCurrent: true },
      },
    },
  });

  if (!task) return;

  const target = getRecoveryTargetStatus(task);
  const needsTaskUpdate =
    task.status !== target.status ||
    task.assigneeType !== target.assigneeType ||
    (task.assigneeAgentName || null) !== (target.assigneeAgentName || null);

  if (!needsTaskUpdate) return;

  await tx.task.update({
    where: { id: task.id },
    data: {
      status: target.status,
      assigneeType: target.assigneeType,
      assigneeAgentName: target.assigneeAgentName,
    },
  });

  await tx.taskStatusHistory.create({
    data: {
      taskId: task.id,
      fromStatus: task.status,
      toStatus: target.status,
      changedByUserId: null,
      note,
    },
  });
}

export async function recoverStaleAgentRuns({
  maxAgeSeconds = 720,
  reason = 'Execucao interrompida por reinicio ou encerramento inesperado do backend.',
} = {}) {
  const cutoff = resolveRunAgeCutoff(maxAgeSeconds);
  const staleRuns = await prisma.agentRun.findMany({
    where: {
      status: 'running',
      startedAt: { lt: cutoff },
    },
    select: {
      id: true,
      uuid: true,
      agentName: true,
      taskId: true,
      projectId: true,
      startedAt: true,
    },
    orderBy: { startedAt: 'asc' },
  });

  for (const run of staleRuns) {
    await prisma.$transaction(async (tx) => {
      await tx.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: reason,
        },
      });

      if (run.taskId) {
        await reconcileTaskAfterRecoveredRun(
          tx,
          run.taskId,
          `Execucao antiga recuperada automaticamente. ${reason}`
        );
      }
    });
  }

  return {
    recoveredCount: staleRuns.length,
    runs: staleRuns.map((run) => ({
      uuid: run.uuid,
      agentName: run.agentName,
      startedAt: run.startedAt,
    })),
  };
}

export async function recoverBlockingAgentRunsForStart({
  projectId,
  agentName,
  taskId = null,
  maxAgeSeconds = 720,
  reason = 'Execucao travada recuperada automaticamente antes de iniciar uma nova tentativa.',
} = {}) {
  if (!projectId || !agentName) {
    return {
      recoveredCount: 0,
      runs: [],
    };
  }

  const cutoff = resolveRunAgeCutoff(maxAgeSeconds);
  const staleRuns = await prisma.agentRun.findMany({
    where: {
      projectId,
      agentName,
      taskId,
      status: 'running',
      startedAt: { lt: cutoff },
    },
    select: {
      id: true,
      uuid: true,
      agentName: true,
      taskId: true,
      startedAt: true,
    },
    orderBy: { startedAt: 'asc' },
  });

  for (const run of staleRuns) {
    await prisma.$transaction(async (tx) => {
      await tx.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: reason,
        },
      });

      if (run.taskId) {
        await reconcileTaskAfterRecoveredRun(
          tx,
          run.taskId,
          `Execucao travada liberada automaticamente para nova tentativa. ${reason}`
        );
      }
    });
  }

  return {
    recoveredCount: staleRuns.length,
    runs: staleRuns.map((run) => ({
      uuid: run.uuid,
      agentName: run.agentName,
      startedAt: run.startedAt,
    })),
  };
}
