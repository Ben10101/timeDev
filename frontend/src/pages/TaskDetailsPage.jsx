import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import {
  bootstrapGeneratedApp,
  createTaskArtifact,
  createTaskComment,
  getApiErrorMessage,
  getTask,
  getProjectArchitectureStatus,
  getTaskImplementationStatus,
  updateTask,
  runTaskQa,
  runTaskImplementation,
  runTaskRequirements,
} from '../services/api';
import { getAgentLabel } from '../utils/agentLabels';

function formatDate(value) {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleString('pt-BR');
}

function formatElapsed(seconds) {
  if (!seconds) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function hasCurrentArtifact(task, artifactType) {
  return (task?.artifacts || []).some((artifact) => artifact.artifactType === artifactType && artifact.isCurrent);
}

function isTaskAgentRunning(task, agentName = null) {
  const runs = task?.agentRuns || [];
  if (!runs.length) return false;
  return runs.some((run) => run.status === 'running' && (!agentName || run.agentName === agentName));
}

function parseJsonContent(rawContent) {
  if (!rawContent) return null;
  try {
    return JSON.parse(rawContent);
  } catch (_error) {
    return null;
  }
}

const MENTION_PATTERN = /@([A-Za-z0-9._%+-]+)/g;

function extractMentions(text) {
  if (!text) return [];
  return Array.from(new Set((text.match(MENTION_PATTERN) || []).map((match) => match.slice(1))));
}

function renderCommentBody(text) {
  if (!text) return null;

  const parts = [];
  let lastIndex = 0;
  text.replace(MENTION_PATTERN, (match, _mention, offset) => {
    if (offset > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, offset) });
    }
    parts.push({ type: 'mention', value: match });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  if (!parts.length) {
    return text;
  }

  return parts.map((part, index) =>
    part.type === 'mention' ? (
      <span key={`${part.value}-${index}`} className="rounded bg-[#dff0b8] px-1.5 py-0.5 font-semibold text-[#17322b]">
        {part.value}
      </span>
    ) : (
      <span key={`${index}`}>{part.value}</span>
    )
  );
}

function getLatestStatusHistoryNote(task, toStatus = null) {
  const history = task?.statusHistory || [];
  const entry = toStatus ? history.find((item) => item.toStatus === toStatus) : history[0];
  return entry?.note || '';
}

function getFallbackStatusAfterUnblock(task) {
  const history = task?.statusHistory || [];
  const fallback = history.find((item) => item.toStatus && item.toStatus !== 'blocked');
  return fallback?.toStatus || 'todo';
}

const TASK_TYPE_LABELS = {
  epic: 'Épico',
  story: 'Story',
  task: 'Task técnica',
  agent_job: 'Job do agente',
};

const TASK_STATUS_LABELS = {
  todo: 'A fazer',
  in_progress: 'Em andamento',
  blocked: 'Bloqueada',
  in_review: 'Em revisão',
  qa: 'QA',
  done: 'Concluída',
};

function getTaskTypeLabel(taskType) {
  return TASK_TYPE_LABELS[taskType] || taskType || 'Task';
}

function getTaskStatusLabel(status) {
  return TASK_STATUS_LABELS[status] || status || 'Sem status';
}

function getTaskStageHint(task, architectureStatus, hasRequirements, hasTestPlan, isDone, implementationStatus) {
  if (!task) return 'Carregando contexto da task...';
  if (task.status === 'blocked') {
    return getLatestStatusHistoryNote(task, 'blocked') || 'A task está bloqueada e precisa de desbloqueio manual.';
  }
  if (!hasRequirements) {
    return 'Próximo passo: gerar requisitos para transformar o briefing em algo refinado.';
  }
  if (!hasTestPlan) {
    return 'Próximo passo: rodar QA e consolidar o plano de testes.';
  }
  if (!architectureStatus?.canGenerateCode) {
    return architectureStatus?.blockers?.[0] || 'A implementação ainda depende da arquitetura aprovada.';
  }
  if (!isDone) {
    return 'A task está pronta para avançar para implementação técnica.';
  }
  if (implementationStatus) {
    return 'A implementação já foi iniciada. Use a aba Desenvolvimento para acompanhar os artefatos.';
  }
  return 'Use Gerar código para iniciar a implementação técnica.';
}

export default function TaskDetailsPage() {
  const { projectUuid, taskUuid } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [implementationStatus, setImplementationStatus] = useState(null);
  const [architectureStatus, setArchitectureStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [commentBody, setCommentBody] = useState('');
  const [editingArtifactId, setEditingArtifactId] = useState(null);
  const [artifactDraft, setArtifactDraft] = useState('');
  const [taskOwnerUuid, setTaskOwnerUuid] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const bootstrapContext = JSON.parse(localStorage.getItem('factory_bootstrap_context') || 'null');
  const taskHasRequirements = hasCurrentArtifact(task, 'requirements');
  const taskHasTestPlan = hasCurrentArtifact(task, 'test_plan');
  const taskIsDone = task?.status === 'done';
  const taskIsBlocked = task?.status === 'blocked';
  const implementationUnlocked = Boolean(architectureStatus?.canGenerateCode);
  const requirementsRunning = isTaskAgentRunning(task, 'requirements_analyst');
  const qaRunning = isTaskAgentRunning(task, 'qa_engineer');
  const canRunRequirements = !taskIsBlocked && !taskHasRequirements && !requirementsRunning;
  const canRunQa = !taskIsBlocked && taskHasRequirements && !taskHasTestPlan && !qaRunning;
  const taskTypeLabel = getTaskTypeLabel(task?.taskType);
  const taskStatusLabel = getTaskStatusLabel(task?.status);
  const latestComment = task?.comments?.[0] || null;
  const latestHistory = task?.statusHistory?.[0] || null;
  const latestRun = task?.agentRuns?.[0] || null;
  const reviewReport = parseJsonContent(implementationStatus?.reviewArtifact?.content);
  const fixPlanReport = parseJsonContent(implementationStatus?.fixPlanArtifact?.content);
  const buildReport = parseJsonContent(implementationStatus?.buildReportArtifact?.content);
  const testReport = parseJsonContent(implementationStatus?.testReportArtifact?.content);
  const lintReport = parseJsonContent(implementationStatus?.lintReportArtifact?.content);
  const implementationSummary = reviewReport?.summary || null;
  const stageHint = getTaskStageHint(task, architectureStatus, taskHasRequirements, taskHasTestPlan, taskIsDone, implementationStatus);
  const activeArtifactForEdit =
    editingArtifactId != null ? task?.artifacts?.find((artifact) => artifact.id === editingArtifactId) || null : null;

  async function loadTask() {
    setLoading(true);
    setError(null);
    try {
      const result = await getTask(taskUuid);
      setTask(result);
      setTaskOwnerUuid(result?.assigneeUser?.uuid || '');
      setTaskDueDate(result?.dueDate ? String(result.dueDate).slice(0, 10) : '');
      setBlockReason(result?.status === 'blocked' ? getLatestStatusHistoryNote(result, 'blocked') : '');
      const projectArchitecture = await getProjectArchitectureStatus(result.project.uuid);
      setArchitectureStatus(projectArchitecture);

      try {
        const implementation = await getTaskImplementationStatus(taskUuid);
        setImplementationStatus(implementation);
      } catch (implementationError) {
        if (implementationError.response?.status === 404) {
          setImplementationStatus(null);
        } else {
          throw implementationError;
        }
      }
    } catch (loadError) {
      if (loadError.response?.status === 404) {
        navigate(projectUuid ? `/projects?project=${projectUuid}` : '/projects', { replace: true });
        return;
      }
      setError(getApiErrorMessage(loadError, 'Não foi possível carregar a task.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTask();
  }, [taskUuid]);

  useEffect(() => {
    if (!editingArtifactId) return undefined;

    function handleEscape(event) {
      if (event.key === 'Escape') {
        handleCancelArtifactEdit();
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [editingArtifactId]);

  async function handleCommentSubmit(e) {
    e.preventDefault();
    if (!commentBody.trim()) return;

    setSaving(true);
    setActionLoading('comment');
    setError(null);
    try {
      await createTaskComment(taskUuid, {
        body: commentBody,
        authorUserUuid: bootstrapContext?.user?.uuid,
      });
      setCommentBody('');
      await loadTask();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível salvar o comentário.'));

    } finally {
      setSaving(false);
      setActionLoading(null);
    }
  }

  async function handleRunRequirements() {
    setSaving(true);
    setActionLoading('requirements');
    setError(null);
    try {
      await runTaskRequirements(taskUuid, {
        changedByUserUuid: bootstrapContext?.user?.uuid,
      });
      await loadTask();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível executar o Analista de Requisitos.'));

    } finally {
      setSaving(false);
      setActionLoading(null);
    }
  }

  async function handleRunQa() {
    setSaving(true);
    setActionLoading('qa');
    setError(null);
    try {
      await runTaskQa(taskUuid, {
        changedByUserUuid: bootstrapContext?.user?.uuid,
      });
      await loadTask();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível executar o QA Engineer.'));

    } finally {
      setSaving(false);
      setActionLoading(null);
    }
  }

  async function handleGenerateCode() {
    setSaving(true);
    setActionLoading('code');
    setError(null);
    try {
      await bootstrapGeneratedApp(projectUuid);
      await runTaskImplementation(taskUuid);
      await loadTask();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível gerar o código da task.'));

    } finally {
      setSaving(false);
      setActionLoading(null);
    }
  }

  function handleOpenCodeStudio() {
    navigate(`/code-studio?project=${projectUuid}&task=${taskUuid}`);
  }

  function handleStartArtifactEdit(artifact) {
    setEditingArtifactId(artifact.id);
    setArtifactDraft(artifact.content || '');
  }

  function handleCancelArtifactEdit() {
    setEditingArtifactId(null);
    setArtifactDraft('');
  }

  async function handleSaveArtifactEdit(artifact) {
    setSaving(true);
    setActionLoading('artifact');
    setError(null);
    try {
      await createTaskArtifact(taskUuid, {
        artifactType: artifact.artifactType,
        title: artifact.title,
        content: artifactDraft,
        contentFormat: artifact.contentFormat || 'markdown',
        createdByUserUuid: bootstrapContext?.user?.uuid,
      });
      handleCancelArtifactEdit();
      await loadTask();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível salvar a edição do artefato.'));

    } finally {
      setSaving(false);
      setActionLoading(null);
    }
  }

  async function handleSaveTaskMeta() {
    setSaving(true);
    setActionLoading('meta');
    setError(null);
    try {
      await updateTask(taskUuid, {
        assigneeUserUuid: taskOwnerUuid || null,
        dueDate: taskDueDate || null,
        changedByUserUuid: bootstrapContext?.user?.uuid,
      });
      await loadTask();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível salvar os dados da task.'));
    } finally {
      setSaving(false);
      setActionLoading(null);
    }
  }

  async function handleToggleBlockTask() {
    setSaving(true);
    setActionLoading(taskIsBlocked ? 'unblock' : 'block');
    setError(null);
    try {
      if (taskIsBlocked) {
        await updateTask(taskUuid, {
          status: getFallbackStatusAfterUnblock(task),
          statusNote: 'Tarefa desbloqueada manualmente.',
          changedByUserUuid: bootstrapContext?.user?.uuid,
        });
      } else {
        await updateTask(taskUuid, {
          status: 'blocked',
          statusNote: blockReason.trim() || 'Tarefa bloqueada manualmente.',
          changedByUserUuid: bootstrapContext?.user?.uuid,
        });
      }
      await loadTask();
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível atualizar o bloqueio da task.'));
    } finally {
      setSaving(false);
      setActionLoading(null);
    }
  }

  const tabs = [
    { id: 'overview', label: 'Resumo' },
    { id: 'refinement', label: 'Refinamento' },
    { id: 'development', label: 'Desenvolvimento' },
    { id: 'history', label: 'Histórico' },
  ];

  return (
    <AppShell
      eyebrow="Task Detail"
      title={task?.title || 'Detalhe da task'}
      description="Acompanhe contexto, refinamento, desenvolvimento, histórico e execuções da tarefa."
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleRunRequirements}
            disabled={saving || loading || !canRunRequirements}
            className="w-full rounded-2xl bg-[#17322b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#214338] disabled:opacity-50 sm:w-auto"
            title={
              requirementsRunning
                ? 'Ja existe uma execucao de requisitos em andamento para esta task.'
                : !canRunRequirements
                  ? 'A etapa de requisitos ja foi concluida.'
                  : undefined
            }
          >
            {actionLoading === 'requirements'
              ? 'Refinando...'
              : requirementsRunning
                ? 'Requisitos em execucao'
                : 'Refinar com Requisitos'}
          </button>
          <button
            onClick={handleRunQa}
            disabled={saving || loading || !canRunQa}
            className="w-full rounded-2xl bg-[#7b3aa4] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6d3194] disabled:opacity-50 sm:w-auto"
            title={
              qaRunning
                ? 'Ja existe uma execucao de QA em andamento para esta task.'
                : !canRunQa && taskHasTestPlan
                  ? 'A etapa de QA ja foi concluida.'
                  : undefined
            }
          >
            {actionLoading === 'qa'
              ? 'Executando QA...'
              : qaRunning
                ? 'QA em execucao'
                : 'Executar QA'}
          </button>
          {taskIsDone && (
            <button
              onClick={handleOpenCodeStudio}
              disabled={loading}
              className="w-full rounded-2xl bg-[#17322b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#214338] disabled:opacity-50 sm:w-auto"
            >
              Abrir Code Studio
            </button>
          )}
          <button
            onClick={() => navigate(`/projects?project=${projectUuid}`)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Voltar ao board
          </button>
        </div>
      }
      sidebar={
        <>
          <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Visão rápida</p>
            {task ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] border border-slate-200 bg-[#faf8f2] p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                      {taskTypeLabel}
                    </span>
                    <span className="rounded-full bg-[#fff5d9] px-3 py-1 text-xs font-semibold text-[#8a6a1f]">
                      {taskStatusLabel}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      Prioridade {task.priority || 'n/d'}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <p><strong>Projeto:</strong> {task.project?.name}</p>
                    <p><strong>Responsável:</strong> {task.assigneeUser?.name || task.assigneeAgentLabel || getAgentLabel(task.assigneeAgentName, 'Sem responsável')}</p>
                    <p><strong>Prazo:</strong> {formatDate(task.dueDate)}</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-[#faf8f2] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Próxima ação</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{stageHint}</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div className="rounded-2xl bg-white p-3">
                      <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Requisitos</p>
                      <p className="mt-1 font-medium text-slate-700">{taskHasRequirements ? 'Disponível' : 'Pendente'}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">QA</p>
                      <p className="mt-1 font-medium text-slate-700">{taskHasTestPlan ? 'Disponível' : 'Pendente'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-[#faf8f2] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Última atividade</p>
                  <div className="mt-3 space-y-3 text-sm text-slate-700">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Comentário</p>
                      <p className="mt-1 text-slate-700">{latestComment?.body || 'Sem comentários ainda.'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Mudança</p>
                      <p className="mt-1 text-slate-700">
                        {latestHistory
                          ? `${latestHistory.fromStatus || 'novo'} → ${latestHistory.toStatus}`
                          : 'Sem histórico de status ainda.'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Execução</p>
                      <p className="mt-1 text-slate-700">
                        {latestRun ? `${latestRun.agentLabel || getAgentLabel(latestRun.agentName)} • ${latestRun.status}` : 'Nenhuma execução registrada.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Carregando...</p>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-[#faf8f2] p-5 shadow-[0_20px_60px_rgba(23,50,43,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Navegação</p>
            <div className="mt-4 space-y-3">
              <Link to="/projects" className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                Ver todos os projetos
              </Link>
              <Link to={`/projects/${projectUuid}`} className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                Voltar ao overview do projeto
              </Link>
            </div>
          </section>
        </>
      }
    >
      <section className="space-y-6">
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        )}

        {task?.processingError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <strong>Ultima execucao com erro:</strong> {task.processingError.message}
          </div>
        )}

        {loading ? (
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-8 text-center text-slate-500 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
            Carregando detalhes da task...
          </div>
        ) : task ? (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-6">
                <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Resumo da task</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">{taskTypeLabel}</span>
                    <span className="rounded-full bg-[#fff5d9] px-3 py-1 text-xs font-semibold text-[#8a6a1f]">{taskStatusLabel}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{task.priority || 'Sem prioridade'}</span>
                  </div>
                  <h2 className="mt-4 font-serif text-2xl font-semibold text-slate-900 sm:text-3xl">{task.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{task.description || 'Sem descrição cadastrada.'}</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Responsável</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{task.assigneeUser?.name || task.assigneeAgentLabel || getAgentLabel(task.assigneeAgentName, 'Sem responsável')}</p>
                    </article>
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Prazo</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(task.dueDate)}</p>
                    </article>
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Status</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{taskStatusLabel}</p>
                    </article>
                  </div>
                </section>

                <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Gestão da task</p>
                      <p className="mt-2 text-sm text-slate-500">Responsável, prazo e bloqueio em um só lugar.</p>
                    </div>
                    <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                      {taskIsBlocked ? 'Bloqueada' : 'Em fluxo'}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Responsável</span>
                      <select
                        value={taskOwnerUuid}
                        onChange={(event) => setTaskOwnerUuid(event.target.value)}
                        className="dashboard-input"
                      >
                        <option value="">Sem responsável</option>
                        {(task.project?.members || []).map((member) => (
                          <option key={member.user.uuid} value={member.user.uuid}>
                            {member.user.name || member.user.email}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Prazo</span>
                      <input
                        type="date"
                        value={taskDueDate}
                        onChange={(event) => setTaskDueDate(event.target.value)}
                        className="dashboard-input"
                      />
                    </label>
                  </div>
                  <div className="mt-4 rounded-[24px] border border-slate-200 bg-[#faf8f2] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Bloqueio</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {taskIsBlocked
                        ? 'Essa task está bloqueada. Desbloqueie quando a dependência estiver resolvida.'
                        : 'Use o bloqueio para sinalizar dependências externas ou impedimentos reais.'}
                    </p>
                    {!taskIsBlocked && (
                      <label className="mt-4 block">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                          Motivo do bloqueio
                        </span>
                        <textarea
                          value={blockReason}
                          onChange={(event) => setBlockReason(event.target.value)}
                          placeholder="Ex.: aguardando validação do financeiro"
                          rows={3}
                          className="dashboard-input resize-none"
                        />
                      </label>
                    )}
                    {taskIsBlocked && (
                      <div className="mt-4 rounded-2xl bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500">Motivo atual</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {getLatestStatusHistoryNote(task, 'blocked') || 'Bloqueio sem observação registrada.'}
                        </p>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleToggleBlockTask}
                        disabled={saving || loading}
                        className={taskIsBlocked ? 'dashboard-button-secondary' : 'dashboard-button-primary'}
                      >
                        {actionLoading === 'block'
                          ? 'Bloqueando...'
                          : actionLoading === 'unblock'
                            ? 'Desbloqueando...'
                            : taskIsBlocked
                              ? 'Desbloquear tarefa'
                              : 'Bloquear tarefa'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTaskMeta}
                        disabled={saving || loading}
                        className="dashboard-button-primary"
                      >
                        {actionLoading === 'meta' ? 'Salvando...' : 'Salvar gestão da task'}
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-[32px] border border-slate-200 bg-[#faf8f2] p-6 shadow-[0_20px_60px_rgba(23,50,43,0.06)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Direção da task</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{stageHint}</p>
                  <div className="mt-5 grid gap-3 text-sm">
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Requisitos</p>
                      <p className="mt-2 font-medium text-slate-700">{taskHasRequirements ? 'Já gerados' : 'Ainda não gerados'}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">QA</p>
                      <p className="mt-2 font-medium text-slate-700">{taskHasTestPlan ? 'Já gerado' : 'Ainda não gerado'}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Implementação</p>
                      <p className="mt-2 font-medium text-slate-700">{implementationUnlocked ? 'Liberada' : 'Aguardando arquitetura'}</p>
                    </div>
                  </div>
                </section>
              </aside>
            </div>

            <section className="rounded-[32px] border border-slate-200 bg-white/88 p-3 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-[#17322b] text-white shadow-[0_12px_28px_rgba(23,50,43,0.18)]'
                          : 'bg-[#faf8f2] text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {activeTab === 'overview' && (
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Status atual</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{task.status}</p>
                    </article>
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Requisitos</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{taskHasRequirements ? 'Disponível' : 'Pendente'}</p>
                    </article>
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Desenvolvimento</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{implementationStatus?.status || 'Não iniciado'}</p>
                    </article>
                  </div>

                  {!implementationUnlocked && (
                    <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">Gate de arquitetura</p>
                      <p className="mt-3 text-sm leading-7 text-amber-900">
                        {architectureStatus?.blockers?.[0] || 'A implementação continua bloqueada até a arquitetura do projeto ser gerada.'}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 rounded-[24px] border border-slate-200 bg-[#faf8f2] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2f6c58]">Próximo passo recomendado</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {task.status !== 'done'
                        ? 'Finalize refinamento e QA antes de iniciar a implementação.'
                        : implementationStatus
                          ? 'Acompanhe a execução técnica, os relatórios de validação e os arquivos alterados.'
                          : 'Clique em Gerar código para iniciar a integração da task no projeto full stack.'}
                    </p>
                  </div>
                </section>

                <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Comentários</p>
                    <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                      {task.comments?.length || 0}
                    </span>
                  </div>

                  <form className="mt-5 space-y-3" onSubmit={handleCommentSubmit}>
                    <textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      rows="4"
                      placeholder="Registrar contexto, alinhamentos ou feedback sobre a task..."
                      className="w-full rounded-[22px] border border-slate-200 bg-[#faf8f2] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#8aac55] focus:ring-4 focus:ring-[#dff0b8]"
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold uppercase tracking-[0.18em] text-slate-400">Menções detectadas:</span>
                      {extractMentions(commentBody).length ? (
                        extractMentions(commentBody).map((mention) => (
                          <span key={mention} className="rounded-full bg-[#eef5ef] px-2.5 py-1 font-semibold text-[#2f6c58]">
                            @{mention}
                          </span>
                        ))
                      ) : (
                        <span>use @nome ou @email para sinalizar pessoas no comentário</span>
                      )}
                    </div>
                    <button disabled={saving || !commentBody.trim()} className="w-full rounded-2xl bg-[#17322b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#214338] disabled:opacity-50 sm:w-auto">
                      {actionLoading === 'comment' ? 'Adicionando...' : 'Adicionar comentário'}
                    </button>
                  </form>

                  <div className="mt-6 space-y-3">
                    {task.comments?.map((comment) => (
                      <article key={comment.id} className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-semibold text-slate-900">
                            {comment.authorUser?.name || comment.authorAgentName || 'Sistema'}
                          </p>
                          <span className="text-xs text-slate-500">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{renderCommentBody(comment.body)}</p>
                        {extractMentions(comment.body).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {extractMentions(comment.body).map((mention) => (
                              <span key={`${comment.id}-${mention}`} className="rounded-full bg-[#dff0b8] px-2.5 py-1 text-xs font-semibold text-[#17322b]">
                                @{mention}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                    {!task.comments?.length && (
                      <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                        Nenhum comentário ainda.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'refinement' && (
              <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Artefatos</p>
                    <p className="mt-2 text-sm text-slate-500">Aqui ficam apenas os artefatos de refinamento.</p>
                  </div>
                  <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                    {task.artifacts?.length || 0}
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {task.artifacts?.map((artifact) => (
                    <article key={artifact.id} className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{artifact.title}</h3>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                            {artifact.artifactType} • v{artifact.version}
                          </p>
                        </div>
                        <span className={`w-fit rounded-full px-3 py-1 text-[11px] font-semibold ${artifact.isApproved ? 'bg-[#e5f3e8] text-[#2f6c58]' : 'bg-[#fff5d9] text-[#8a6a1f]'}`}>
                          {artifact.isApproved ? 'Aprovado' : 'Pendente'}
                        </span>
                      </div>
                      <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs leading-6 text-slate-600">
                        {artifact.content}
                      </pre>
                      {artifact.isCurrent && (
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs leading-5 text-slate-500">
                            Abra em tela focada para revisar o conteúdo e salvar uma nova versão sem poluir a leitura da aba.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleStartArtifactEdit(artifact)}
                            className="rounded-2xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Editar artefato
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                  {!task.artifacts?.length && (
                    <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                      Nenhum artefato de refinamento associado a esta task.
                    </div>
                  )}
                </div>
              </section>
            )}

            {activeTab === 'development' && (
            <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Desenvolvimento</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">Status técnico e artefatos de implementação</h3>
                </div>
                <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                  {implementationStatus?.status || 'Não iniciado'}
                </span>
              </div>

              {implementationStatus ? (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 lg:grid-cols-4">
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Implementação</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{implementationStatus.status}</p>
                    </article>
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Build</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{buildReport?.status || implementationStatus.buildStatus || 'n/a'}</p>
                    </article>
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Revisão</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {implementationSummary?.status || (implementationStatus.reviewArtifact ? 'disponível' : 'não executado')}
                      </p>
                    </article>
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Testes / Lint</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {testReport?.status || implementationStatus.testStatus || 'n/a'} / {lintReport?.status || 'n/a'}
                      </p>
                    </article>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">App gerado</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{implementationStatus.generatedApp?.name || 'App full stack'}</p>
                      <p className="mt-3 break-all text-xs leading-6 text-slate-600">
                        {implementationStatus.generatedApp?.rootPath || 'Projeto ainda não materializado em disco.'}
                      </p>
                    </article>

                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Review automático</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {implementationStatus.reviewArtifact?.title || 'Nenhum review gerado ainda'}
                      </p>
                      {implementationSummary && (
                        <div className="mt-3 space-y-2 text-sm text-slate-600">
                          <p><strong>Score:</strong> {implementationSummary.score}</p>
                          <p><strong>Status:</strong> {implementationSummary.status}</p>
                          <p><strong>Resumo:</strong> {implementationSummary.verdict}</p>
                        </div>
                      )}
                    </article>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Technical Spec</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {implementationStatus.technicalSpecArtifact?.title || 'Ainda não gerado'}
                      </p>
                      {implementationStatus.technicalSpecArtifact?.content && (
                        <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs leading-6 text-slate-600">
                          {implementationStatus.technicalSpecArtifact.content}
                        </pre>
                      )}
                    </article>

                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Plano de implementação</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {implementationStatus.implementationPlanArtifact?.title || 'Ainda não gerado'}
                      </p>
                      {implementationStatus.implementationPlanArtifact?.content && (
                        <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs leading-6 text-slate-600">
                          {implementationStatus.implementationPlanArtifact.content}
                        </pre>
                      )}
                    </article>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Plano de correção da implementação</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {implementationStatus.fixPlanArtifact?.title || 'Nenhum plano de correção gerado'}
                      </p>
                      {fixPlanReport?.actions?.length ? (
                        <div className="mt-4 space-y-3">
                          {fixPlanReport.actions.map((action, index) => (
                            <div key={`${action.filePath}-${index}`} className="rounded-2xl bg-white p-3">
                              <p className="text-sm font-medium text-slate-900">{action.category} • {action.priority}</p>
                              <p className="mt-1 text-xs text-slate-600">{action.filePath}</p>
                              <p className="mt-2 text-sm text-slate-700">{action.action}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">
                          Nenhuma ação corretiva necessária na versão atual.
                        </div>
                      )}
                    </article>

                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Validação automática</p>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-sm font-medium text-slate-900">Lint</p>
                          <p className="mt-1 text-xs text-slate-600">{lintReport?.status || 'n/a'}</p>
                          {lintReport?.report?.errorMessage && <p className="mt-2 text-xs text-rose-600">{lintReport.report.errorMessage}</p>}
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-sm font-medium text-slate-900">Test</p>
                          <p className="mt-1 text-xs text-slate-600">{testReport?.status || 'n/a'}</p>
                          {testReport?.report?.errorMessage && <p className="mt-2 text-xs text-rose-600">{testReport.report.errorMessage}</p>}
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-sm font-medium text-slate-900">Build</p>
                          <p className="mt-1 text-xs text-slate-600">{buildReport?.status || 'n/a'}</p>
                          {buildReport?.reports?.map((report) => (
                            <div key={report.scriptName} className="mt-3 rounded-xl border border-slate-200 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{report.scriptName}</p>
                              <p className="mt-1 text-xs text-slate-600">{report.status}</p>
                              {report.errorMessage && <p className="mt-2 text-xs text-rose-600">{report.errorMessage}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Plano de correção da implementação</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {implementationStatus.fixPlanArtifact?.title || 'Nenhum plano de correção gerado'}
                      </p>
                      {fixPlanReport?.actions?.length ? (
                        <div className="mt-4 space-y-3">
                          {fixPlanReport.actions.map((action, index) => (
                            <div key={`${action.filePath}-${index}`} className="rounded-2xl bg-white p-3">
                              <p className="text-sm font-medium text-slate-900">{action.category} • {action.priority}</p>
                              <p className="mt-1 text-xs text-slate-600">{action.filePath}</p>
                              <p className="mt-2 text-sm text-slate-700">{action.action}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">
                          Nenhuma ação corretiva necessária na versão atual.
                        </div>
                      )}
                    </article>

                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Validação automática</p>
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-sm font-medium text-slate-900">Lint</p>
                          <p className="mt-1 text-xs text-slate-600">{lintReport?.status || 'n/a'}</p>
                          {lintReport?.report?.errorMessage && <p className="mt-2 text-xs text-rose-600">{lintReport.report.errorMessage}</p>}
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-sm font-medium text-slate-900">Test</p>
                          <p className="mt-1 text-xs text-slate-600">{testReport?.status || 'n/a'}</p>
                          {testReport?.report?.errorMessage && <p className="mt-2 text-xs text-rose-600">{testReport.report.errorMessage}</p>}
                        </div>
                        <div className="rounded-2xl bg-white p-3">
                          <p className="text-sm font-medium text-slate-900">Build</p>
                          <p className="mt-1 text-xs text-slate-600">{buildReport?.status || 'n/a'}</p>
                          {buildReport?.reports?.map((report) => (
                            <div key={report.scriptName} className="mt-3 rounded-xl border border-slate-200 p-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{report.scriptName}</p>
                              <p className="mt-1 text-xs text-slate-600">{report.status}</p>
                              {report.errorMessage && <p className="mt-2 text-xs text-rose-600">{report.errorMessage}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </article>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Arquivos tocados</p>
                        <span className="text-xs text-slate-500">{implementationStatus.generatedFiles?.length || 0}</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {implementationStatus.generatedFiles?.slice(0, 8).map((file) => (
                          <div key={file.id} className="rounded-2xl bg-white p-3">
                            <p className="text-sm font-medium text-slate-900">{file.changeType || 'update'}</p>
                            <p className="mt-1 break-all text-xs text-slate-600">{file.filePath}</p>
                          </div>
                        ))}
                        {!implementationStatus.generatedFiles?.length && (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                            Nenhum arquivo registrado ainda.
                          </div>
                        )}
                      </div>
                    </article>

                    <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Runs técnicos</p>
                        <span className="text-xs text-slate-500">{implementationStatus.runs?.length || 0}</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {implementationStatus.runs?.slice(0, 8).map((run) => (
                          <div key={run.id} className="rounded-2xl bg-white p-3">
                            <p className="text-sm font-medium text-slate-900">{run.runType}</p>
                            <p className="mt-1 text-xs text-slate-600">{run.status}</p>
                            <p className="mt-1 text-xs text-slate-500">{formatDate(run.createdAt || run.startedAt)}</p>
                          </div>
                        ))}
                        {!implementationStatus.runs?.length && (
                          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                            Nenhum run técnico registrado ainda.
                          </div>
                        )}
                      </div>
                    </article>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                  A implementação ainda não foi iniciada para esta task. Quando você clicar em <strong>Gerar código</strong>, o acompanhamento técnico aparecerá aqui.
                </div>
              )}
            </section>
            )}

            {activeTab === 'history' && (
            <>
            <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Atividade recente</p>
                <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                  {((task.comments?.length || 0) + (task.statusHistory?.length || 0) + (task.agentRuns?.length || 0))} registros
                </span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Último comentário</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {task.comments?.[0]?.authorUser?.name || task.comments?.[0]?.authorAgentName || 'Sem comentários'}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                    {task.comments?.[0]?.body || 'Ainda não há comentários registrados.'}
                  </p>
                </article>
                <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Última mudança</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {task.statusHistory?.[0]
                      ? `${task.statusHistory[0].fromStatus || 'novo'} → ${task.statusHistory[0].toStatus}`
                      : 'Sem mudanças registradas'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {task.statusHistory?.[0]?.note || 'Sem observação registrada.'}
                  </p>
                </article>
                <article className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Última execução</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {task.agentRuns?.[0]?.agentLabel || getAgentLabel(task.agentRuns?.[0]?.agentName, 'Sem execuções')}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {task.agentRuns?.[0]
                      ? `${task.agentRuns[0].status} • ${formatDate(task.agentRuns[0].startedAt)}`
                      : 'Nenhum agente executado ainda.'}
                  </p>
                </article>
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Execuções de agentes</p>
                <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                  {task.agentRuns?.length || 0} execuções
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {task.agentRuns?.map((run) => (
                  <article key={run.id} className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{run.agentLabel || getAgentLabel(run.agentName)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {run.status} • {formatElapsed(run.startedAt ? Math.round((new Date(run.finishedAt || Date.now()).getTime() - new Date(run.startedAt).getTime()) / 1000) : 0)}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">{formatDate(run.startedAt)}</span>
                    </div>
                    {run.errorMessage && <p className="mt-3 text-sm text-rose-600">{run.errorMessage}</p>}
                  </article>
                ))}
                {!task.agentRuns?.length && (
                  <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    Nenhuma execução de agente registrada ainda.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Histórico</p>
                <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                  {task.statusHistory?.length || 0} eventos
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {task.statusHistory?.map((item) => (
                  <article key={item.id} className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.fromStatus || 'novo'} → {item.toStatus}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.changedByUser?.name || item.changedByAgentName || 'Sistema'}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">{formatDate(item.changedAt)}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{item.note || 'Sem observação.'}</p>
                  </article>
                ))}
                {!task.statusHistory?.length && (
                  <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    Nenhum histórico disponível.
                  </div>
                )}
              </div>
            </section>
            </>
            )}
          </>
        ) : null}
      </section>
      {activeArtifactForEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Editar artefato</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{activeArtifactForEdit.title}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {activeArtifactForEdit.artifactType} • v{activeArtifactForEdit.version}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelArtifactEdit}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
            <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
              <div className="border-b border-slate-200 bg-[#faf8f2] p-6 lg:border-b-0 lg:border-r">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Versão atual</p>
                <pre className="mt-4 max-h-[58vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs leading-6 text-slate-600">
                  {activeArtifactForEdit.content}
                </pre>
              </div>
              <div className="flex min-h-0 flex-col p-6">
                <div className="mb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Nova versão</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Revise o conteúdo, ajuste o que precisar e salve uma nova versão do artefato.
                  </p>
                </div>
                <textarea
                  value={artifactDraft}
                  onChange={(e) => setArtifactDraft(e.target.value)}
                  rows="20"
                  className="min-h-[360px] flex-1 resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 outline-none transition focus:border-[#8aac55] focus:ring-4 focus:ring-[#dff0b8]"
                />
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    O salvamento cria uma nova versão e mantém o histórico do artefato.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCancelArtifactEdit}
                      className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveArtifactEdit(activeArtifactForEdit)}
                      disabled={saving || !artifactDraft.trim()}
                      className="rounded-2xl bg-[#17322b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#214338] disabled:opacity-50"
                    >
                      {actionLoading === 'artifact' ? 'Salvando...' : 'Salvar nova versão'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
