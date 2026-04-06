import { prisma } from '../lib/prisma.js';
import { getAuditLogPath, readRecentAuditEntries } from './auditLogService.js';
import { getRefreshCookieOptions } from './authService.js';
import { getRateLimitConfig } from '../middleware/securityMiddleware.js';
import { buildBudgetConfig, estimateTokenCount, extractRuntimeMetaFromPayload } from '../utils/aiRunMetrics.js';
import { getRuntimeTelemetrySnapshot } from './runtimeTelemetryService.js';

function buildProjectScope(userUuid = null, projectUuid = null) {
  const projectWhere = {};

  if (projectUuid) {
    projectWhere.uuid = projectUuid;
  }

  if (userUuid) {
    projectWhere.workspace = {
      ownerUser: {
        uuid: userUuid,
      },
    };
  }

  return Object.keys(projectWhere).length ? { project: projectWhere } : {};
}

function average(values = []) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values = [], p = 95) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function asNumber(value) {
  return Number(value || 0);
}

function parseJsonContent(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function averageNullable(values = []) {
  const filtered = values.filter((value) => value !== null && value !== undefined && !Number.isNaN(Number(value)));
  if (!filtered.length) return null;
  return Math.round(filtered.reduce((sum, value) => sum + Number(value), 0) / filtered.length);
}

export async function getOperationalHealth() {
  let database = 'degraded';
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    database = 'ok';
  } catch {
    database = 'down';
  }

  let runtimeSnapshot = {
    summary: {
      staleRunningRuns: 0,
      recoveredRunsLast24h: 0,
      failedRunsLast24h: 0,
    },
    inMemory: {
      summary: getRuntimeTelemetrySnapshot().totals,
    },
  };
  if (database === 'ok') {
    try {
      runtimeSnapshot = await getRuntimeOperationsStatus();
    } catch {
      runtimeSnapshot = {
        ...runtimeSnapshot,
        summary: {
          ...runtimeSnapshot.summary,
          staleRunningRuns: 0,
        },
      };
    }
  }

  return {
    status: database === 'ok' && runtimeSnapshot.summary.staleRunningRuns === 0 ? 'ok' : 'degraded',
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database,
    environment: process.env.NODE_ENV || 'development',
    runtime: {
      inMemory: runtimeSnapshot.inMemory.summary,
      staleRunningRuns: runtimeSnapshot.summary.staleRunningRuns,
      recoveredRunsLast24h: runtimeSnapshot.summary.recoveredRunsLast24h,
      failureRunsLast24h: runtimeSnapshot.summary.failedRunsLast24h,
    },
  };
}

export async function getRuntimeOperationsStatus(userUuid = null, { projectUuid = null, lookbackHours = 24 } = {}) {
  const lookbackStart = new Date(Date.now() - Math.max(1, Number(lookbackHours || 24)) * 60 * 60 * 1000);
  const projectScope = buildProjectScope(userUuid, projectUuid);
  const runningThreshold = new Date(Date.now() - 10 * 60 * 1000);
  const inMemory = getRuntimeTelemetrySnapshot();

  const [
    runningRuns,
    staleRunningRunsCount,
    recoveredRunsLast24h,
    failedRunsLast24h,
    startedRunsLast24h,
    backlogTasks,
    inProgressTasks,
    reviewTasks,
    qaTasks,
  ] = await Promise.all([
    prisma.agentRun.findMany({
      where: {
        status: 'running',
        ...projectScope,
      },
      orderBy: { startedAt: 'asc' },
      take: 20,
      select: {
        uuid: true,
        agentName: true,
        startedAt: true,
        project: { select: { uuid: true, name: true } },
        task: { select: { uuid: true, title: true } },
      },
    }),
    prisma.agentRun.count({
      where: {
        status: 'running',
        startedAt: { lt: runningThreshold },
        ...projectScope,
      },
    }),
    prisma.agentRun.count({
      where: {
        status: 'failed',
        finishedAt: { gte: lookbackStart },
        errorMessage: { contains: 'recuper' },
        ...projectScope,
      },
    }),
    prisma.agentRun.count({
      where: {
        status: 'failed',
        finishedAt: { gte: lookbackStart },
        ...projectScope,
      },
    }),
    prisma.agentRun.count({
      where: {
        createdAt: { gte: lookbackStart },
        ...projectScope,
      },
    }),
    prisma.task.count({
      where: {
        status: 'backlog',
        taskType: { not: 'agent_job' },
        ...projectScope,
      },
    }),
    prisma.task.count({
      where: {
        status: 'in_progress',
        taskType: { not: 'agent_job' },
        ...projectScope,
      },
    }),
    prisma.task.count({
      where: {
        status: 'in_review',
        taskType: { not: 'agent_job' },
        ...projectScope,
      },
    }),
    prisma.task.count({
      where: {
        status: 'qa',
        taskType: { not: 'agent_job' },
        ...projectScope,
      },
    }),
  ]);

  const recentAgentHealth = await prisma.agentRun.findMany({
    where: {
      createdAt: { gte: lookbackStart },
      ...projectScope,
    },
    orderBy: { createdAt: 'desc' },
    take: 160,
    select: {
      agentName: true,
      status: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  const byAgent = Object.values(
    recentAgentHealth.reduce((acc, run) => {
      const current = acc[run.agentName] || {
        agentName: run.agentName,
        started: 0,
        failed: 0,
        completed: 0,
        recovered: 0,
        durations: [],
      };
      current.started += 1;
      current.failed += run.status === 'failed' ? 1 : 0;
      current.completed += run.status === 'completed' ? 1 : 0;
      current.recovered += run.status === 'failed' && String(run.errorMessage || '').includes('recuper') ? 1 : 0;
      if (run.startedAt && run.finishedAt) {
        current.durations.push(Math.max(0, Math.round((new Date(run.finishedAt) - new Date(run.startedAt)) / 1000)));
      }
      acc[run.agentName] = current;
      return acc;
    }, {})
  ).map((agent) => ({
    agentName: agent.agentName,
    started: agent.started,
    completed: agent.completed,
    failed: agent.failed,
    recovered: agent.recovered,
    failureRatePercent: agent.started ? Math.round((agent.failed / agent.started) * 100) : 0,
    averageDurationSeconds: average(agent.durations),
  }));

  const alerts = [
    ...(staleRunningRunsCount > 0
      ? [{ code: 'stale_running_runs', message: `Existem ${staleRunningRunsCount} execucoes acima da janela esperada.` }]
      : []),
    ...(failedRunsLast24h > 5
      ? [{ code: 'failure_spike', message: `Foram detectadas ${failedRunsLast24h} falhas de agentes nas ultimas ${lookbackHours}h.` }]
      : []),
    ...(recoveredRunsLast24h > 3
      ? [{ code: 'recovery_spike', message: `O watchdog recuperou ${recoveredRunsLast24h} execucoes nas ultimas ${lookbackHours}h.` }]
      : []),
  ];

  return {
    checkedAt: new Date().toISOString(),
    windowHours: Math.max(1, Number(lookbackHours || 24)),
    summary: {
      startedRunsLast24h,
      failedRunsLast24h,
      recoveredRunsLast24h,
      runningRuns: runningRuns.length,
      staleRunningRuns: staleRunningRunsCount,
      backlogTasks,
      inProgressTasks,
      reviewTasks,
      qaTasks,
    },
    inMemory: {
      summary: inMemory.totals,
      byAgent: inMemory.byAgent,
      recentEvents: inMemory.recentEvents.slice(0, 20),
    },
    runningRuns: runningRuns.map((run) => ({
      ...run,
      runningForSeconds: run.startedAt
        ? Math.max(0, Math.round((Date.now() - new Date(run.startedAt).getTime()) / 1000))
        : null,
    })),
    byAgent,
    alerts,
  };
}

export async function getAiOperationsOverview(userUuid, projectUuid = null) {
  const budgets = buildBudgetConfig();
  const projectFilter = projectUuid ? { project: { uuid: projectUuid } } : {};
  const now = Date.now();

  const agentRuns = await prisma.agentRun.findMany({
    where: {
      project: {
        workspace: {
          ownerUser: {
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
            ownerUser: {
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
          buildStatus: true,
          testStatus: true,
          status: true,
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
    const currentRunningSeconds =
      run.status === 'running' && run.startedAt
        ? Math.max(0, Math.round((now - new Date(run.startedAt).getTime()) / 1000))
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
      currentRunningSeconds,
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

  const completedDurations = enrichedRuns
    .map((run) => run.durationSeconds)
    .filter((value) => value !== null && value !== undefined);
  const recentWindowRuns = enrichedRuns.slice(0, 20);
  const recentFailedRuns = recentWindowRuns.filter((run) => run.status === 'failed');
  const staleRunningRuns = enrichedRuns.filter((run) => run.status === 'running' && (run.currentRunningSeconds || 0) > 600);

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

  const topFailingAgents = [...byAgent]
    .filter((item) => item.failed > 0)
    .sort((a, b) => {
      if (b.failed !== a.failed) return b.failed - a.failed;
      return b.failureRate - a.failureRate;
    })
    .slice(0, 5);

  const qualityImplementations = generatedRuns
    .map((run) => ({
      uuid: run.uuid,
      runType: run.runType,
      status: run.status,
      project: run.generatedApp.project,
      task: run.taskImplementation?.task || null,
      qualityScore: null,
      reviewStatus: run.taskImplementation?.status || null,
      buildStatus: run.taskImplementation?.buildStatus || null,
      testStatus: run.taskImplementation?.testStatus || null,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      logSummary: run.logSummary,
    }))
    .slice(0, 20);

  const implementationFailures = qualityImplementations.filter((run) => run.status === 'failed');

  const taskImplementations = await prisma.taskImplementation.findMany({
    where: {
      task: {
        project: {
          workspace: {
            ownerUser: {
              uuid: userUuid,
            },
          },
          ...(projectUuid ? { uuid: projectUuid } : {}),
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 40,
    select: {
      id: true,
      status: true,
      buildStatus: true,
      testStatus: true,
      updatedAt: true,
      task: {
        select: {
          uuid: true,
          title: true,
          project: { select: { uuid: true, name: true } },
        },
      },
    },
  });

  const implementationIds = taskImplementations.map((item) => item.id);
  const implementationArtifacts = implementationIds.length
    ? await prisma.taskArtifact.findMany({
        where: {
          taskImplementationId: { in: implementationIds },
          artifactScope: 'implementation',
          isCurrent: true,
          OR: [
            { title: { startsWith: 'Implementation Diff Review - ' } },
            { title: { startsWith: 'Implementation Execution State - ' } },
          ],
        },
        select: {
          taskImplementationId: true,
          title: true,
          content: true,
        },
      })
    : [];

  const implementationArtifactsById = implementationArtifacts.reduce((acc, artifact) => {
    const current = acc.get(artifact.taskImplementationId) || {};
    if (artifact.title.startsWith('Implementation Diff Review - ')) {
      current.diffReview = parseJsonContent(artifact.content);
    }
    if (artifact.title.startsWith('Implementation Execution State - ')) {
      current.executionState = parseJsonContent(artifact.content);
    }
    acc.set(artifact.taskImplementationId, current);
    return acc;
  }, new Map());

  const laneNames = ['backend', 'frontend', 'shared'];
  const implementationByLane = laneNames.map((lane) => {
    const implementationsForLane = taskImplementations
      .map((implementation) => {
        const artifacts = implementationArtifactsById.get(implementation.id) || {};
        const diffReview = artifacts.diffReview || null;
        const executionState = artifacts.executionState || null;
        const laneRisk = diffReview?.qualitySignals?.laneRisks?.find((item) => item.lane === lane) || null;
        const laneRecommendation =
          diffReview?.qualitySignals?.laneRecommendations?.find((item) => item.lane === lane) || null;
        const currentLaneWorkstreams = executionState?.currentWorkstreamsByLane?.[lane] || [];
        const completedLaneWorkstreams = executionState?.completedWorkstreamsByLane?.[lane] || [];
        const repairingLane =
          executionState?.phase === 'repair' &&
          Array.isArray(executionState?.repairScope?.workstreamIds) &&
          executionState.repairScope.workstreamIds.some((id) =>
            lane === 'backend'
              ? id === 'backend_module'
              : lane === 'frontend'
                ? id === 'frontend_feature'
                : id === 'shared_contracts' || id === 'persistence_and_docs'
          );

        const touchedLane =
          Boolean(laneRisk) ||
          currentLaneWorkstreams.length > 0 ||
          completedLaneWorkstreams.length > 0;

        if (!touchedLane) return null;

        return {
          implementationId: implementation.id,
          status: implementation.status,
          buildStatus: implementation.buildStatus,
          testStatus: implementation.testStatus,
          updatedAt: implementation.updatedAt,
          project: implementation.task.project,
          task: { uuid: implementation.task.uuid, title: implementation.task.title },
          laneRisk,
          laneRecommendation,
          activeWorkstreams: currentLaneWorkstreams.length,
          completedWorkstreams: completedLaneWorkstreams.length,
          repairingLane,
        };
      })
      .filter(Boolean);

    return {
      lane,
      implementations: implementationsForLane.length,
      integrated: implementationsForLane.filter((item) => item.status === 'integrated').length,
      failed: implementationsForLane.filter((item) => item.status === 'failed').length,
      blocked: implementationsForLane.filter((item) => item.laneRisk?.level === 'high').length,
      active: implementationsForLane.filter((item) => item.activeWorkstreams > 0).length,
      repairing: implementationsForLane.filter((item) => item.repairingLane).length,
      averageReviewScore: averageNullable(implementationsForLane.map((item) => item.laneRisk?.reviewScore)),
      averageSpecialistScore: averageNullable(implementationsForLane.map((item) => item.laneRisk?.specialistScore)),
      averageRiskScore: averageNullable(implementationsForLane.map((item) => item.laneRisk?.score)),
      highRiskCount: implementationsForLane.filter((item) => item.laneRisk?.level === 'high').length,
      recommendations: implementationsForLane
        .map((item) => item.laneRecommendation?.recommendation)
        .filter(Boolean)
        .slice(0, 3),
    };
  });

  return {
    summary: {
      totalRuns: enrichedRuns.length,
      completedRuns: statusCounts.completed || 0,
      failedRuns: statusCounts.failed || 0,
      runningRuns: statusCounts.running || 0,
      successRatePercent: enrichedRuns.length ? Math.round(((statusCounts.completed || 0) / enrichedRuns.length) * 100) : 0,
      recentFailureRatePercent: recentWindowRuns.length ? Math.round((recentFailedRuns.length / recentWindowRuns.length) * 100) : 0,
      totalCostUsd: Number(enrichedRuns.reduce((sum, run) => sum + run.costUsd, 0).toFixed(6)),
      totalEstimatedTokens: enrichedRuns.reduce((sum, run) => sum + run.totalTokens, 0),
      averageRunDurationSeconds: average(completedDurations),
      p95RunDurationSeconds: percentile(completedDurations, 95),
      overBudgetRuns: enrichedRuns.filter((run) => run.overBudget).length,
      staleRunningRuns: staleRunningRuns.length,
      implementationFailures: implementationFailures.length,
    },
    reliability: {
      topFailingAgents,
      recentFailures: recentFailedRuns.slice(0, 8).map((run) => ({
        uuid: run.uuid,
        agentName: run.agentName,
        project: run.project,
        task: run.task,
        createdAt: run.createdAt,
        errorMessage: run.errorMessage,
      })),
      staleRunningRuns: staleRunningRuns.map((run) => ({
        uuid: run.uuid,
        agentName: run.agentName,
        project: run.project,
        task: run.task,
        startedAt: run.startedAt,
        currentRunningSeconds: run.currentRunningSeconds,
      })),
    },
    byAgent,
    implementationByLane,
    recentRuns: enrichedRuns.slice(0, 20),
    generatedRuns: qualityImplementations,
    alerts: [
      ...(enrichedRuns.some((run) => run.overBudget)
        ? [{ code: 'agent_budget_exceeded', message: 'Existem execuções recentes acima do budget configurado por agente.' }]
        : []),
      ...(enrichedRuns.some((run) => run.status === 'failed')
        ? [{ code: 'agent_failures_detected', message: 'Foram detectadas falhas recentes em execuções de agentes.' }]
        : []),
      ...(qualityImplementations.some((run) => run.status === 'failed')
        ? [{ code: 'implementation_validation_failed', message: 'Existem execuções de implementação/validação com falha recente.' }]
        : []),
    ],
  };
}

export async function getProductionReadiness(userUuid, projectUuid = null) {
  const health = await getOperationalHealth();
  const aiOverview = await getAiOperationsOverview(userUuid, projectUuid);
  const recentAudit = await readRecentAuditEntries({ limit: 30, userUuid, projectUuid });
  const refreshCookie = getRefreshCookieOptions();
  const defaultRateLimit = getRateLimitConfig(false);
  const sensitiveRateLimit = getRateLimitConfig(true);
  const providersConfigured = {
    openai: Boolean(process.env.OPENAI_API_KEY),
    deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
    nvidia: Boolean(process.env.NVIDIA_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
  };

  const readinessChecks = [
    { code: 'database', label: 'Banco operacional', status: health.database === 'ok' ? 'ok' : 'failed' },
    { code: 'auth_secret', label: 'Segredo de autenticação configurado', status: process.env.AUTH_ACCESS_SECRET || process.env.JWT_SECRET ? 'ok' : 'warning' },
    { code: 'ai_settings_secret', label: 'Segredo de criptografia das credenciais de IA configurado', status: process.env.AI_SETTINGS_SECRET || process.env.AUTH_ACCESS_SECRET || process.env.JWT_SECRET ? 'ok' : 'warning' },
    { code: 'cors', label: 'Origem de frontend definida', status: process.env.FRONTEND_ORIGIN || process.env.VITE_FRONTEND_URL ? 'ok' : 'warning' },
    { code: 'provider_api', label: 'Pelo menos uma API remota configurada', status: Object.values(providersConfigured).some(Boolean) ? 'ok' : 'warning' },
    { code: 'audit_log', label: 'Auditoria operacional ativa', status: recentAudit.length ? 'ok' : 'warning' },
    { code: 'success_rate', label: 'Taxa de sucesso acima de 70%', status: (aiOverview.summary.successRatePercent || 0) >= 70 ? 'ok' : 'warning' },
    { code: 'stale_runs', label: 'Sem runs travados', status: (aiOverview.summary.staleRunningRuns || 0) === 0 ? 'ok' : 'warning' },
  ];

  const warningCount = readinessChecks.filter((check) => check.status === 'warning').length;
  const failedCount = readinessChecks.filter((check) => check.status === 'failed').length;
  const releaseVersion = process.env.PLATFORM_VERSION || '1.0.0';
  const releaseChannel = process.env.PLATFORM_RELEASE_CHANNEL || 'internal';
  const releaseSha = process.env.PLATFORM_RELEASE_SHA || null;
  const frontendOrigin = process.env.FRONTEND_ORIGIN || process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
  const readinessAlerts = [
    ...(warningCount
      ? [{ code: 'readiness_attention', message: `Existem ${warningCount} checks de readiness exigindo atencao.` }]
      : []),
    ...(failedCount
      ? [{ code: 'readiness_failed', message: `Existem ${failedCount} checks críticos falhando na plataforma.` }]
      : []),
    ...((aiOverview.reliability.topFailingAgents || []).slice(0, 2).map((agent) => ({
      code: `agent_instability_${agent.agentName}`,
      message: `${agent.agentName} concentra ${agent.failed} falhas recentes (${agent.failureRate}% de falha).`,
    }))),
  ];

  return {
    status: failedCount ? 'degraded' : warningCount ? 'attention' : 'ok',
    checkedAt: new Date().toISOString(),
    release: {
      version: releaseVersion,
      channel: releaseChannel,
      sha: releaseSha,
      nodeVersion: process.version,
      frontendOrigin,
      apiBasePath: '/api',
    },
    checks: readinessChecks,
    security: {
      environment: process.env.NODE_ENV || 'development',
      secureRefreshCookie: Boolean(refreshCookie.secure),
      strictSameSite: refreshCookie.sameSite === 'strict',
      corsRestricted: Boolean(process.env.NODE_ENV === 'production' && (process.env.FRONTEND_ORIGIN || process.env.VITE_FRONTEND_URL)),
      authSecretConfigured: Boolean(process.env.AUTH_ACCESS_SECRET || process.env.JWT_SECRET),
      aiSettingsSecretConfigured: Boolean(process.env.AI_SETTINGS_SECRET || process.env.AUTH_ACCESS_SECRET || process.env.JWT_SECRET),
      csrfProtectionEnabled: true,
      accessTokenTtlMinutes: 15,
      refreshTokenTtlDays: 7,
      rateLimitDefault: defaultRateLimit,
      rateLimitSensitive: sensitiveRateLimit,
    },
    governance: {
      auditLogPath: getAuditLogPath(),
      recentAuditEntries: recentAudit.length,
      recentAuditFailures: recentAudit.filter((entry) => entry.success === false).length,
      requestTracingEnabled: true,
      rateLimitEnabled: true,
      auditEnabled: true,
      implementationRemoteOnly: process.env.AI_DISABLE_OLLAMA_FALLBACK === '1',
      sensitiveActionsTracked: [
        'auth_login',
        'auth_register',
        'project_create',
        'project_generate_backlog',
        'project_generate_architecture',
        'task_generate_requirements',
        'task_generate_qa',
        'task_generate_implementation',
      ],
    },
    providersConfigured,
    ai: {
      successRatePercent: aiOverview.summary.successRatePercent || 0,
      recentFailureRatePercent: aiOverview.summary.recentFailureRatePercent || 0,
      staleRunningRuns: aiOverview.summary.staleRunningRuns || 0,
      overBudgetRuns: aiOverview.summary.overBudgetRuns || 0,
      topFailingAgents: aiOverview.reliability.topFailingAgents || [],
    },
    alerts: readinessAlerts,
  };
}

export async function getAuditTrail(userUuid, { projectUuid = null, limit = 40 } = {}) {
  return readRecentAuditEntries({
    userUuid,
    projectUuid,
    limit: Math.min(100, Math.max(1, Number(limit || 40))),
  });
}

export async function getGovernanceOverview(userUuid, { projectUuid = null } = {}) {
  const auditTrail = await readRecentAuditEntries({
    userUuid,
    projectUuid,
    limit: 120,
  });

  const byAction = Object.values(
    auditTrail.reduce((acc, entry) => {
      const current = acc[entry.actionType] || {
        actionType: entry.actionType,
        total: 0,
        failures: 0,
        averageDurationMsValues: [],
      };
      current.total += 1;
      current.failures += entry.success ? 0 : 1;
      current.averageDurationMsValues.push(Number(entry.durationMs || 0));
      acc[entry.actionType] = current;
      return acc;
    }, {})
  ).map((entry) => ({
    actionType: entry.actionType,
    total: entry.total,
    failures: entry.failures,
    failureRatePercent: entry.total ? Math.round((entry.failures / entry.total) * 100) : 0,
    averageDurationMs: average(entry.averageDurationMsValues),
  }));

  const topActionTypes = [...byAction].sort((a, b) => b.total - a.total).slice(0, 5);
  const failureHotspots = [...byAction]
    .filter((entry) => entry.failures > 0)
    .sort((a, b) => {
      if (b.failures !== a.failures) return b.failures - a.failures;
      return b.failureRatePercent - a.failureRatePercent;
    })
    .slice(0, 5);
  const latencyHotspots = [...byAction]
    .filter((entry) => entry.averageDurationMs > 0)
    .sort((a, b) => b.averageDurationMs - a.averageDurationMs)
    .slice(0, 5);

  const uniqueUsers = new Set(auditTrail.map((entry) => entry.userUuid).filter(Boolean)).size;

  return {
    summary: {
      totalEvents: auditTrail.length,
      failureEvents: auditTrail.filter((entry) => entry.success === false).length,
      uniqueActors: uniqueUsers,
      coveredActionTypes: byAction.length,
    },
    topActionTypes,
    failureHotspots,
    latencyHotspots,
    recentEvents: auditTrail.slice(0, 10),
  };
}

export async function getOperationalHistory(userUuid, { projectUuid = null, days = 7 } = {}) {
  const lookbackDays = Math.min(30, Math.max(1, Number(days || 7)));
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - (lookbackDays - 1));
  fromDate.setHours(0, 0, 0, 0);

  const projectFilter = projectUuid ? { project: { uuid: projectUuid } } : {};
  const runs = await prisma.agentRun.findMany({
    where: {
      createdAt: { gte: fromDate },
      project: {
        workspace: {
          ownerUser: {
            uuid: userUuid,
          },
        },
      },
      ...projectFilter,
    },
    select: {
      status: true,
      createdAt: true,
      tokensInput: true,
      tokensOutput: true,
      costUsd: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const buckets = new Map();
  for (let offset = 0; offset < lookbackDays; offset += 1) {
    const current = new Date(fromDate);
    current.setDate(fromDate.getDate() + offset);
    const key = current.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      totalRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
      estimatedTokens: 0,
      costUsd: 0,
    });
  }

  for (const run of runs) {
    const key = new Date(run.createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.totalRuns += 1;
    bucket.completedRuns += run.status === 'completed' ? 1 : 0;
    bucket.failedRuns += run.status === 'failed' ? 1 : 0;
    bucket.estimatedTokens += Number(run.tokensInput || 0) + Number(run.tokensOutput || 0);
    bucket.costUsd = Number((bucket.costUsd + Number(run.costUsd || 0)).toFixed(6));
  }

  return {
    days: lookbackDays,
    series: Array.from(buckets.values()).map((bucket) => ({
      ...bucket,
      successRatePercent: bucket.totalRuns ? Math.round((bucket.completedRuns / bucket.totalRuns) * 100) : 0,
    })),
  };
}

export async function getActiveAlerts(userUuid, { projectUuid = null } = {}) {
  const [readiness, governance, aiOverview] = await Promise.all([
    getProductionReadiness(userUuid, projectUuid),
    getGovernanceOverview(userUuid, { projectUuid }),
    getAiOperationsOverview(userUuid, projectUuid),
  ]);

  const alerts = [];

  for (const alert of readiness.alerts || []) {
    alerts.push({
      severity: alert.code === 'readiness_failed' ? 'high' : 'medium',
      source: 'readiness',
      code: alert.code,
      message: alert.message,
      recommendedAction:
        alert.code === 'readiness_failed'
          ? 'Corrigir os checks críticos antes de ampliar a operação.'
          : 'Revisar os checks de readiness e estabilizar a operação antes da próxima release.',
    });
  }

  for (const hotspot of (governance.failureHotspots || []).slice(0, 3)) {
    alerts.push({
      severity: hotspot.failureRatePercent >= 50 ? 'high' : 'medium',
      source: 'governance',
      code: `hotspot_${hotspot.actionType}`,
      message: `${hotspot.actionType} concentra ${hotspot.failures} falhas recentes (${hotspot.failureRatePercent}%).`,
      recommendedAction: `Revisar o fluxo ${hotspot.actionType} e adicionar remediação automática ou validação preventiva.`,
    });
  }

  if ((aiOverview.summary.staleRunningRuns || 0) > 0) {
    alerts.push({
      severity: 'high',
      source: 'runtime',
      code: 'stale_running_runs',
      message: `Existem ${aiOverview.summary.staleRunningRuns} runs travados ha mais de 10 minutos.`,
      recommendedAction: 'Cancelar execuções travadas, revisar timeout e criar playbook automático de recuperação.',
    });
  }

  if ((aiOverview.summary.overBudgetRuns || 0) > 0) {
    alerts.push({
      severity: 'medium',
      source: 'cost',
      code: 'over_budget_runs',
      message: `Foram detectadas ${aiOverview.summary.overBudgetRuns} execuções acima do budget configurado.`,
      recommendedAction: 'Reduzir contexto, revisar provider/modelo e reforcar budgets por agente.',
    });
  }

  return alerts.slice(0, 10);
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
