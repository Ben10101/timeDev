import { prisma } from '../lib/prisma.js';
import { logInfo, logWarn } from '../utils/logger.js';
import { recordRuntimeEvent } from './runtimeTelemetryService.js';

function resolveRunAgeCutoff(maxAgeSeconds) {
  return new Date(Date.now() - Math.max(60, Number(maxAgeSeconds || 900)) * 1000);
}

function appendRecoveryNote(summary, note) {
  const previousSummary = String(summary || '').trim();
  return previousSummary ? `${previousSummary}\n\n${note}` : note;
}

async function reconcileImplementationAfterRecoveredRun(tx, run, note) {
  if (!run.taskImplementationId) return;

  const implementation = await tx.taskImplementation.findUnique({
    where: { id: run.taskImplementationId },
    select: {
      id: true,
      status: true,
      summary: true,
      buildStatus: true,
      testStatus: true,
    },
  });

  if (!implementation || implementation.status !== 'in_progress') {
    return;
  }

  await tx.taskImplementation.update({
    where: { id: implementation.id },
    data: {
      status: 'failed',
      buildStatus:
        run.runType === 'validation' && implementation.buildStatus == null ? 'failed' : implementation.buildStatus,
      testStatus:
        run.runType === 'validation' && implementation.testStatus == null ? 'failed' : implementation.testStatus,
      summary: appendRecoveryNote(implementation.summary, note),
    },
  });
}

async function reconcileGeneratedAppAfterRecoveredRun(tx, run) {
  if (run.runType !== 'bootstrap') return;

  const generatedApp = await tx.generatedApp.findUnique({
    where: { id: run.generatedAppId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!generatedApp || generatedApp.status !== 'bootstrapping') {
    return;
  }

  await tx.generatedApp.update({
    where: { id: generatedApp.id },
    data: { status: 'failed' },
  });
}

async function markRunAsRecovered(tx, run, reason) {
  await tx.generatedAppRun.update({
    where: { id: run.id },
    data: {
      status: 'failed',
      finishedAt: new Date(),
      logSummary: appendRecoveryNote(run.logSummary, reason),
    },
  });

  await reconcileGeneratedAppAfterRecoveredRun(tx, run);
  await reconcileImplementationAfterRecoveredRun(tx, run, reason);
}

async function recoverGeneratedAppRunsByFilter(where, { reason, recoveryMode }) {
  const staleRuns = await prisma.generatedAppRun.findMany({
    where,
    select: {
      id: true,
      uuid: true,
      generatedAppId: true,
      taskImplementationId: true,
      runType: true,
      status: true,
      logSummary: true,
      startedAt: true,
      generatedApp: {
        select: {
          projectId: true,
        },
      },
      taskImplementation: {
        select: {
          taskId: true,
        },
      },
    },
    orderBy: { startedAt: 'asc' },
  });

  for (const run of staleRuns) {
    await prisma.$transaction(async (tx) => {
      await markRunAsRecovered(tx, run, reason);
    });

    recordRuntimeEvent('generated_app_run_recovered', {
      runUuid: run.uuid,
      generatedAppId: String(run.generatedAppId),
      projectId: run.generatedApp?.projectId ? String(run.generatedApp.projectId) : null,
      taskImplementationId: run.taskImplementationId ? String(run.taskImplementationId) : null,
      taskId: run.taskImplementation?.taskId ? String(run.taskImplementation.taskId) : null,
      runType: run.runType,
      recoveryMode,
    });
    logWarn('generated_app_run_recovered', {
      runUuid: run.uuid,
      generatedAppId: String(run.generatedAppId),
      projectId: run.generatedApp?.projectId ? String(run.generatedApp.projectId) : null,
      taskImplementationId: run.taskImplementationId ? String(run.taskImplementationId) : null,
      taskId: run.taskImplementation?.taskId ? String(run.taskImplementation.taskId) : null,
      runType: run.runType,
      recoveryMode,
      reason,
    });
  }

  if (staleRuns.length > 0) {
    logInfo('generated_app_run_recovery_batch_completed', {
      recoveryMode,
      recoveredCount: staleRuns.length,
    });
  }

  return {
    recoveredCount: staleRuns.length,
    runs: staleRuns.map((run) => ({
      uuid: run.uuid,
      runType: run.runType,
      startedAt: run.startedAt,
    })),
  };
}

export async function recoverStaleGeneratedAppRuns({
  maxAgeSeconds = 900,
  reason = 'Execucao interrompida por reinicio ou encerramento inesperado do backend.',
} = {}) {
  const cutoff = resolveRunAgeCutoff(maxAgeSeconds);
  return recoverGeneratedAppRunsByFilter(
    {
      status: 'running',
      startedAt: { lt: cutoff },
    },
    {
      reason,
      recoveryMode: 'watchdog',
    }
  );
}

export async function recoverBlockingGeneratedAppRunsForStart({
  generatedAppId,
  taskId = null,
  runType = null,
  maxAgeSeconds = 900,
  reason = 'Execucao travada recuperada automaticamente antes de iniciar uma nova tentativa.',
} = {}) {
  if (!generatedAppId) {
    return {
      recoveredCount: 0,
      runs: [],
    };
  }

  const cutoff = resolveRunAgeCutoff(maxAgeSeconds);
  return recoverGeneratedAppRunsByFilter(
    {
      generatedAppId,
      status: 'running',
      startedAt: { lt: cutoff },
      ...(runType ? { runType } : {}),
      ...(taskId ? { taskImplementation: { taskId } } : {}),
    },
    {
      reason,
      recoveryMode: 'preflight',
    }
  );
}
