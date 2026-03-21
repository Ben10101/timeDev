import { prisma } from '../lib/prisma.js';
import { buildBudgetConfig, estimateTokenCount, extractRuntimeMetaFromPayload } from '../utils/aiRunMetrics.js';

function average(values = []) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function asNumber(value) {
  return Number(value || 0);
}

export async function getOperationalHealth() {
  let database = 'degraded';
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    database = 'ok';
  } catch {
    database = 'down';
  }

  return {
    status: database === 'ok' ? 'ok' : 'degraded',
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database,
    environment: process.env.NODE_ENV || 'development',
  };
}

export async function getAiOperationsOverview(userUuid, projectUuid = null) {
  const budgets = buildBudgetConfig();
  const projectFilter = projectUuid ? { project: { uuid: projectUuid } } : {};

  const agentRuns = await prisma.agentRun.findMany({
    where: {
      project: {
        workspace: {
          owner: {
            uuid: userUuid,
          },
        },
      },
      ...projectFilter,
    },
    orderBy: { createdAt: 'desc' },
    take: 120,
    select: {
      uuid: true,
      agentName: true,
      status: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      errorMessage: true,
      tokensInput: true,
      tokensOutput: true,
      costUsd: true,
      inputPayload: true,
      project: { select: { uuid: true, name: true } },
      task: { select: { uuid: true, title: true } },
    },
  });

  const generatedRuns = await prisma.generatedAppRun.findMany({
    where: {
      generatedApp: {
        project: {
          workspace: {
            owner: {
              uuid: userUuid,
            },
          },
          ...(projectUuid ? { uuid: projectUuid } : {}),
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
    select: {
      uuid: true,
      runType: true,
      status: true,
      logSummary: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      generatedApp: { select: { project: { select: { uuid: true, name: true } } } },
      taskImplementation: {
        select: {
          task: { select: { uuid: true, title: true } },
          qualityScore: true,
          reviewStatus: true,
          buildStatus: true,
          testStatus: true,
        },
      },
    },
  });

  const enrichedRuns = agentRuns.map((run) => {
    const runtimeMeta = extractRuntimeMetaFromPayload(run.inputPayload);
    const durationSeconds =
      run.startedAt && run.finishedAt
        ? Math.max(0, Math.round((new Date(run.finishedAt) - new Date(run.startedAt)) / 1000))
        : null;
    const totalTokens = asNumber(run.tokensInput) + asNumber(run.tokensOutput);
    const configuredBudget = budgets[run.agentName] || null;

    return {
      uuid: run.uuid,
      agentName: run.agentName,
      status: run.status,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      durationSeconds,
      errorMessage: run.errorMessage,
      tokensInput: asNumber(run.tokensInput),
      tokensOutput: asNumber(run.tokensOutput),
      totalTokens,
      costUsd: Number(run.costUsd || 0),
      configuredBudget,
      overBudget: configuredBudget ? totalTokens > configuredBudget : false,
      runtimeMeta,
      project: run.project,
      task: run.task,
    };
  });

  const statusCounts = enrichedRuns.reduce((acc, run) => {
    acc[run.status] = (acc[run.status] || 0) + 1;
    return acc;
  }, {});

  const byAgent = Object.values(
    enrichedRuns.reduce((acc, run) => {
      const current = acc[run.agentName] || {
        agentName: run.agentName,
        runs: 0,
        failed: 0,
        completed: 0,
        avgDurationSeconds: [],
        avgTokens: [],
        costUsd: 0,
        overBudgetCount: 0,
      };
      current.runs += 1;
      current.failed += run.status === 'failed' ? 1 : 0;
      current.completed += run.status === 'completed' ? 1 : 0;
      if (run.durationSeconds !== null) current.avgDurationSeconds.push(run.durationSeconds);
      if (run.totalTokens) current.avgTokens.push(run.totalTokens);
      current.costUsd += run.costUsd || 0;
      current.overBudgetCount += run.overBudget ? 1 : 0;
      acc[run.agentName] = current;
      return acc;
    }, {})
  ).map((item) => ({
    agentName: item.agentName,
    runs: item.runs,
    failed: item.failed,
    completed: item.completed,
    failureRate: item.runs ? Math.round((item.failed / item.runs) * 100) : 0,
    averageDurationSeconds: average(item.avgDurationSeconds),
    averageTokens: average(item.avgTokens),
    costUsd: Number(item.costUsd.toFixed(6)),
    overBudgetCount: item.overBudgetCount,
  }));

  const qualityImplementations = generatedRuns
    .map((run) => ({
      uuid: run.uuid,
      runType: run.runType,
      status: run.status,
      project: run.generatedApp.project,
      task: run.taskImplementation?.task || null,
      qualityScore: run.taskImplementation?.qualityScore ?? null,
      reviewStatus: run.taskImplementation?.reviewStatus || null,
      buildStatus: run.taskImplementation?.buildStatus || null,
      testStatus: run.taskImplementation?.testStatus || null,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      logSummary: run.logSummary,
    }))
    .slice(0, 20);

  return {
    summary: {
      totalRuns: enrichedRuns.length,
      completedRuns: statusCounts.completed || 0,
      failedRuns: statusCounts.failed || 0,
      runningRuns: statusCounts.running || 0,
      totalCostUsd: Number(enrichedRuns.reduce((sum, run) => sum + run.costUsd, 0).toFixed(6)),
      totalEstimatedTokens: enrichedRuns.reduce((sum, run) => sum + run.totalTokens, 0),
      averageRunDurationSeconds: average(enrichedRuns.map((run) => run.durationSeconds).filter((value) => value !== null)),
      overBudgetRuns: enrichedRuns.filter((run) => run.overBudget).length,
    },
    byAgent,
    recentRuns: enrichedRuns.slice(0, 20),
    generatedRuns: qualityImplementations,
    alerts: [
      ...(enrichedRuns.some((run) => run.overBudget)
        ? [{ code: 'agent_budget_exceeded', message: 'Existem execucoes recentes acima do budget configurado por agente.' }]
        : []),
      ...(enrichedRuns.some((run) => run.status === 'failed')
        ? [{ code: 'agent_failures_detected', message: 'Foram detectadas falhas recentes em execucoes de agentes.' }]
        : []),
      ...(qualityImplementations.some((run) => run.status === 'failed')
        ? [{ code: 'implementation_validation_failed', message: 'Existem execucoes de implementacao/validacao com falha recente.' }]
        : []),
    ],
  };
}

export function buildBudgetPreview(agentName, payload) {
  const budgets = buildBudgetConfig();
  const estimatedInputTokens = estimateTokenCount(payload);
  const budget = budgets[agentName] || null;
  return {
    budget,
    estimatedInputTokens,
    overBudget: budget ? estimatedInputTokens > budget : false,
  };
}
