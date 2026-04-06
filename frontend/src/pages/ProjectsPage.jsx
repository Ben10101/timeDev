import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Ban,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Layout,
  LayoutDashboard,
  Plus,
  Sparkles,
  TestTube2,
  Users,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  bootstrapGeneratedApp,
  bootstrapWorkspace,
  createProject,
  createTask,
  approveProjectArchitecture,
  generateProjectArchitecture,
  getApiErrorMessage,
  getProjectArchitectureStatus,
  listProjects,
  listProjectTasks,
  runTaskImplementation,
  runTaskQa,
  runTaskRequirements,
} from '../services/api';
import { exportProjectDocumentationPdf } from '../utils/projectDocumentationExport';
import { getAgentLabel } from '../utils/agentLabels';

const BOARD_COLUMNS = [
  { key: 'backlog', label: 'Backlog', icon: Layout },
  { key: 'todo', label: 'A Fazer', icon: Clock },
  { key: 'in_progress', label: 'Em Progresso', icon: Sparkles },
  { key: 'in_review', label: 'Em Revisão', icon: AlertCircle },
  { key: 'blocked', label: 'Bloqueado', icon: Ban },
  { key: 'qa', label: 'Qualidade', icon: TestTube2 },
  { key: 'done', label: 'Concluído', icon: CheckCircle2 },
];

const EMPTY_BOOTSTRAP = { userName: '', email: '', workspaceName: '' };
const EMPTY_PROJECT = { name: '', description: '', vision: '' };
const EMPTY_TASK = {
  title: '',
  description: '',
  status: 'backlog',
  priority: 'medium',
  taskType: 'story',
  assigneeType: 'agent',
  assigneeAgentName: 'requirements_analyst',
};

function getStoredBootstrap() {
  const raw = localStorage.getItem('factory_bootstrap_context');
  return raw ?JSON.parse(raw) : null;
}

function formatElapsed(seconds) {
  if (!seconds) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ?`${hours}h ${minutes}m` : `${minutes}m`;
}

function formatShortDate(value) {
  if (!value) return 'Sem prazo';
  return new Date(value).toLocaleDateString('pt-BR');
}

function getRoadmapPhases(project) {
  return project?.intakeConfig?.roadmap?.phases || [];
}

function getRiskRegister(project) {
  return project?.intakeConfig?.riskRegister || null;
}

function getProjectTimeline(project) {
  return project?.intakeConfig?.timeline || null;
}

function getRoadmapPhaseProgress(index, totalDone, totalTasks) {
  if (!totalTasks) return index === 0 ?15 : 0;

  if (totalDone === 0) {
    return index === 0 ?10 : 0;
  }

  const base = Math.round((totalDone / totalTasks) * 100);
  const offsets = [0, -20, -40];
  return Math.max(0, Math.min(100, base + (offsets[index] || 0)));
}

function hasCurrentArtifact(task, artifactType) {
  return (task?.artifacts || []).some((artifact) => artifact.artifactType === artifactType && artifact.isCurrent);
}

function getLatestStatusHistoryNote(task, toStatus = null) {
  const history = task?.statusHistory || [];
  const entry = toStatus ?history.find((item) => item.toStatus === toStatus) : history[0];
  return entry?.note || '';
}

function isTaskAgentRunning(task, agentName = null) {
  const runs = task?.agentRuns || [];
  if (!runs.length) return false;
  return runs.some((run) => run.status === 'running' && (!agentName || run.agentName === agentName));
}

function TextInput({ label, value, onChange, placeholder, icon: Icon }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />}
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`dashboard-input ${Icon ?'pl-11' : ''}`}
        />
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="dashboard-input resize-none"
      />
    </div>
  );
}

function exportTaskArtifacts(task) {
  const artifacts = (task?.artifacts || []).filter((artifact) => artifact.isCurrent);
  if (!artifacts.length) return;

  const content = [
    `# ${task.title}`,
    task.description ?`\n${task.description}` : '',
    ...artifacts.map(
      (artifact) =>
        `\n\n---\n\n## ${artifact.title}\nTipo: ${artifact.artifactType}\nVersao: ${artifact.version}\n\n${artifact.content}`
    ),
  ].join('');

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${task.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'task'}-artefatos.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function TaskCard({
  task,
  onRequirements,
  onQa,
  onOpenCodeStudio,
  onOpenDetail,
  onExportArtifacts,
  busy,
  implementationUnlocked,
  implementationBlockReason,
}) {
  const hasRequirements = hasCurrentArtifact(task, 'requirements');
  const hasTestPlan = hasCurrentArtifact(task, 'test_plan');
  const isDone = task.status === 'done';
  const isBlocked = task.status === 'blocked';
  const processingError = task.processingError;
  const isStory = task.taskType === 'story';
  const isEpic = task.taskType === 'epic';
  const requirementsRunning = task.status === 'in_progress' && isTaskAgentRunning(task, 'requirements_analyst');
  const qaRunning =
    (task.status === 'qa' || task.status === 'in_progress' || task.status === 'in_review') &&
    isTaskAgentRunning(task, 'qa_engineer');
  const canRunRequirements = isStory && !isBlocked && !hasRequirements && !requirementsRunning;
  const canRunQa = isStory && !isBlocked && hasRequirements && !hasTestPlan && !qaRunning;
  const canRunImplementation = Boolean(implementationUnlocked);

  const priorityColors = {
    high: 'bg-rose-50 text-rose-700',
    medium: 'bg-blue-50 text-[#102a72]',
    low: 'bg-slate-100 text-slate-600',
  };
  const typeLabels = {
    epic: 'Epic',
    story: 'Story',
    task: 'T?cnica',
  };
  const typeGuidance = {
    epic: 'Épico de planejamento. Abra os detalhes para ver o desdobramento em stories.',
    story: 'Story pronta para refinamento e validação.',
    task: 'Tarefa técnica fora da esteira de requisitos/QA.',
  };
  const blockReason = getLatestStatusHistoryNote(task, 'blocked');
  const taskDescription = task.description || typeGuidance[task.taskType] || 'Sem contexto adicional registrado para esta task.';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`dashboard-badge ${priorityColors[task.priority] || priorityColors.medium}`}>
                {task.priority}
              </span>
              <span className="dashboard-badge bg-slate-100 text-slate-600">
                {typeLabels[task.taskType] || task.taskType || 'Task'}
              </span>
              {isBlocked && (
                <span className="dashboard-badge bg-rose-50 text-rose-700">
                  Bloqueada
                </span>
              )}
              <span className="text-[11px] font-semibold text-slate-400">#{task.uuid?.split('-')[0]}</span>
            </div>
            <h3 className="mt-3 text-sm font-semibold leading-6 text-slate-900">{task.title}</h3>
          </div>
          <button
            onClick={() => onOpenDetail(task.uuid)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-[#102a72]/10 hover:text-[#102a72]"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-6 text-slate-500">
          {taskDescription}
        </p>

        <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-500">Responsável:</span> {task.assigneeUser?.name || task.assigneeAgentLabel || getAgentLabel(task.assigneeAgentName, 'Sem responsável')}
          </p>
          <p>
            <span className="font-semibold text-slate-500">Prazo:</span> {formatShortDate(task.dueDate)}
          </p>
        </div>

        {isBlocked && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-rose-500">Motivo do bloqueio</p>
            <p className="mt-1 text-sm font-medium text-rose-700">{blockReason || 'Bloqueio sem observação registrada.'}</p>
          </div>
        )}

        {processingError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-rose-500">Falha na ?ltima execu??o</p>
            <p className="mt-1 text-sm font-medium text-rose-700">{processingError.message}</p>
          </div>
        )}

        {isDone && !canRunImplementation && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-600">Implementação bloqueada</p>
            <p className="mt-1 text-sm font-medium text-amber-800">
              {implementationBlockReason || 'Gere a arquitetura do projeto depois que todas as histórias estiverem refinadas.'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Agente</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{task.assigneeAgentLabel || getAgentLabel(task.assigneeAgentName)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Tempo de ciclo</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{formatElapsed(task.timing?.cycleTimeSeconds)}</p>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
        {!isDone ?(
          <>
            {isStory ?(
              <>
                <button
                  onClick={() => onRequirements(task.uuid)}
                  disabled={busy || !canRunRequirements}
                  className="dashboard-button-primary flex-1"
                  title={
                    requirementsRunning
                      ? 'J? existe uma execu??o de requisitos em andamento para esta task.'
                      : !canRunRequirements
                        ? 'A etapa de requisitos j? foi conclu?da.'
                        : undefined
                  }
                >
                  <FileText className="h-4 w-4" />
                  {requirementsRunning ?'Executando...' : 'Analisar'}
                </button>
                <button
                  onClick={() => onQa(task.uuid)}
                  disabled={busy || !canRunQa}
                  className="dashboard-button-secondary flex-1"
                  title={
                    qaRunning
                      ? 'J? existe uma execu??o de QA em andamento para esta task.'
                      : !canRunQa && hasTestPlan
                        ? 'A etapa de QA j? foi conclu?da.'
                        : undefined
                  }
                >
                  <TestTube2 className="h-4 w-4" />
                  {qaRunning ?'Executando...' : 'Validar'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onOpenDetail(task.uuid)}
                  className="dashboard-button-secondary flex-1"
                >
                  <FileText className="h-4 w-4" />
                  Abrir detalhes
                </button>
                <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-center text-xs font-medium text-slate-500">
                  {isEpic ?'Épico de planejamento' : 'Tarefa técnica fora do fluxo de refinamento'}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => onOpenCodeStudio(task.uuid)}
              disabled={busy}
              className="dashboard-button-primary flex-1"
            >
              <Sparkles className="h-4 w-4" />
              Ir para código
            </button>
            <button
              onClick={() => onExportArtifacts(task)}
              disabled={!task.artifacts?.length}
              className="dashboard-button-secondary px-3"
              title="Export bundle"
            >
              <Download className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bootstrapContext, setBootstrapContext] = useState(getStoredBootstrap());
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [architectureStatus, setArchitectureStatus] = useState(null);
  const [activeProjectUuid, setActiveProjectUuid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingArchitecture, setGeneratingArchitecture] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [bootstrapForm, setBootstrapForm] = useState(EMPTY_BOOTSTRAP);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);

  const activeProject = projects.find((project) => project.uuid === activeProjectUuid) || null;
  const roadmap = activeProject?.intakeConfig?.roadmap || null;
  const roadmapPhases = getRoadmapPhases(activeProject);
  const riskRegister = getRiskRegister(activeProject);
  const projectTimeline = getProjectTimeline(activeProject);
  const storyTasks = tasks.filter((task) => (task.taskType || 'story') === 'story');
  const taskLoadByAssignee = useMemo(() => {
    const loadMap = new Map();

    storyTasks.forEach((task) => {
      const assignee = task.assigneeUser?.name || task.assigneeAgentName || 'Sem responsável';
      const current = loadMap.get(assignee) || { assignee, total: 0, overdue: 0, dueSoon: 0 };
      const dueDate = task.dueDate ?new Date(task.dueDate) : null;
      const isDone = task.status === 'done';
      const today = new Date();
      const sevenDays = new Date();
      sevenDays.setDate(today.getDate() + 7);

      current.total += 1;
      if (!isDone && dueDate && dueDate < today) {
        current.overdue += 1;
      }
      if (!isDone && dueDate && dueDate >= today && dueDate <= sevenDays) {
        current.dueSoon += 1;
      }
      loadMap.set(assignee, current);
    });

    return Array.from(loadMap.values()).sort((a, b) => b.total - a.total);
  }, [storyTasks]);
  const overdueTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.dueDate && task.status !== 'done' && new Date(task.dueDate) < new Date())
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [tasks]
  );
  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.dueDate && task.status !== 'done')
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 4),
    [tasks]
  );
  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => {
      const searchable = `${project.name} ${project.description || ''} ${project.vision || ''}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [projectSearch, projects]);
  const hasActiveAgentRun = useMemo(
    () => tasks.some((task) => (task.agentRuns || []).some((run) => run.status === 'running')),
    [tasks]
  );

  useEffect(() => {
    const preferredProjectUuid = searchParams.get('project');
    loadProjects(preferredProjectUuid);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('openCreate') === '1') {
      setShowProjectForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadProjects(activeProjectUuid, { silent: true });
      if (activeProjectUuid) {
        loadTasks(activeProjectUuid, { silent: true });
        loadArchitectureStatus(activeProjectUuid, { silent: true });
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [activeProjectUuid]);

  useEffect(() => {
    if (activeProjectUuid) {
      loadTasks(activeProjectUuid);
      loadArchitectureStatus(activeProjectUuid, { silent: true });
    } else {
      setTasks([]);
      setArchitectureStatus(null);
    }
  }, [activeProjectUuid]);

  useEffect(() => {
    if (saving && !hasActiveAgentRun) {
      setSaving(false);
    }
  }, [saving, hasActiveAgentRun]);

  async function loadProjects(preferredProjectUuid, options = {}) {
    if (!options.silent) setLoading(true);
    setError(null);

    try {
      const nextProjects = await listProjects();
      setProjects(nextProjects);
      const preferredExists = preferredProjectUuid
        ?nextProjects.some((project) => project.uuid === preferredProjectUuid)
        : false;
      setActiveProjectUuid(preferredExists ?preferredProjectUuid : nextProjects[0]?.uuid || null);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Não foi possível carregar os projetos.'));
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  async function loadTasks(projectUuid, options = {}) {
    try {
      const nextTasks = await listProjectTasks(projectUuid);
      setTasks(nextTasks);
    } catch (loadError) {
      if (!options.silent) {
        setError(getApiErrorMessage(loadError, 'Não foi possível carregar as tasks.'));
      }
    }
  }

  async function loadArchitectureStatus(projectUuid, options = {}) {
    try {
      const nextStatus = await getProjectArchitectureStatus(projectUuid);
      setArchitectureStatus(nextStatus);
    } catch (loadError) {
      if (!options.silent) {
        setError(getApiErrorMessage(loadError, 'Não foi possível carregar o status da arquitetura do projeto.'));
      }
    }
  }

  const groupedColumns = useMemo(
    () =>
      BOARD_COLUMNS.map((column) => ({
        ...column,
        tasks: storyTasks
          .filter((task) => task.status === column.key)
          .slice()
          .sort((a, b) => {
            const priorityRank = { high: 0, medium: 1, low: 2 };
            return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
          }),
      })),
    [storyTasks]
  );

  const canCreateProject = Boolean(bootstrapContext?.workspace?.uuid && bootstrapContext?.user?.uuid);
  const canCreateTask = Boolean(activeProjectUuid && bootstrapContext?.user?.uuid);

  async function handleBootstrapSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await bootstrapWorkspace(bootstrapForm);
      localStorage.setItem('factory_bootstrap_context', JSON.stringify(result));
      setBootstrapContext(result);
      setBootstrapForm(EMPTY_BOOTSTRAP);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível preparar o workspace.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateProject(e) {
    e.preventDefault();
    if (!canCreateProject) return;

    setSaving(true);
    setError(null);
    try {
      const project = await createProject({
        ...projectForm,
        workspaceUuid: bootstrapContext.workspace.uuid,
        createdByUuid: bootstrapContext.user.uuid,
        status: 'active',
      });
      setProjectForm(EMPTY_PROJECT);
      setShowProjectForm(false);
      await loadProjects(project.uuid);
      navigate(`/projects/${project.uuid}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível criar o projeto.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!canCreateTask) return;

    setSaving(true);
    setError(null);
    try {
      await createTask(activeProjectUuid, {
        ...taskForm,
        createdByUuid: bootstrapContext.user.uuid,
      });
      setTaskForm(EMPTY_TASK);
      await loadTasks(activeProjectUuid);
      await loadArchitectureStatus(activeProjectUuid, { silent: true });
      await loadProjects(activeProjectUuid, { silent: true });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível criar a task.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRunRequirements(taskUuid) {
    setSaving(true);
    setError(null);
    try {
      await runTaskRequirements(taskUuid, {
        changedByUserUuid: bootstrapContext?.user?.uuid,
      });
      await loadTasks(activeProjectUuid);
      await loadArchitectureStatus(activeProjectUuid, { silent: true });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'A analise de requisitos falhou.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRunQa(taskUuid) {
    setSaving(true);
    setError(null);
    try {
      await runTaskQa(taskUuid, {
        changedByUserUuid: bootstrapContext?.user?.uuid,
      });
      await loadTasks(activeProjectUuid);
      await loadArchitectureStatus(activeProjectUuid, { silent: true });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'A analise de QA falhou.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateCode(taskUuid) {
    if (!activeProjectUuid) return;

    setSaving(true);
    setError(null);
    try {
      await bootstrapGeneratedApp(activeProjectUuid);
      await runTaskImplementation(taskUuid);
      await loadTasks(activeProjectUuid);
      await loadArchitectureStatus(activeProjectUuid, { silent: true });
      await loadProjects(activeProjectUuid, { silent: true });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'A geração de código falhou.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateArchitecture() {
    if (!activeProjectUuid) return;

    setGeneratingArchitecture(true);
    setError(null);
    try {
      await generateProjectArchitecture(activeProjectUuid);
      await loadArchitectureStatus(activeProjectUuid, { silent: true });
      await loadProjects(activeProjectUuid, { silent: true });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível gerar a arquitetura do projeto.'));
    } finally {
      setGeneratingArchitecture(false);
    }
  }

  async function handleApproveArchitecture() {
    if (!activeProjectUuid) return;

    setSaving(true);
    setError(null);
    try {
      await approveProjectArchitecture(activeProjectUuid);
      await loadArchitectureStatus(activeProjectUuid, { silent: true });
      await loadProjects(activeProjectUuid, { silent: true });
    } catch (approveError) {
      setError(getApiErrorMessage(approveError, 'Não foi possível aprovar a arquitetura atual.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPdf() {
    if (!activeProjectUuid) return;
    setExportingPdf(true);
    setError(null);
    try {
      await exportProjectDocumentationPdf(activeProjectUuid);
    } catch (exportError) {
      setError(getApiErrorMessage(exportError, 'Não foi possível exportar a documentação em PDF.'));
    } finally {
      setExportingPdf(false);
    }
  }

  function handleOpenCodeStudio(taskUuid) {
    if (!activeProjectUuid) return;
    navigate(`/code-studio?project=${activeProjectUuid}&task=${taskUuid}`);
  }

  const qaCount = storyTasks.filter((task) => hasCurrentArtifact(task, 'test_plan')).length;
  const doneCount = storyTasks.filter((task) => task.status === 'done').length;
  const overallProgress = storyTasks.length ?Math.round((doneCount / storyTasks.length) * 100) : 0;
  const implementationUnlocked = Boolean(architectureStatus?.canGenerateCode);
  const implementationBlockReason = architectureStatus?.blockers?.[0] || null;
  const hasAgentGeneratedStories = storyTasks.some((task) => task.assigneeAgentName === 'requirements_analyst' || task.taskType === 'story');

  return (
    <AppShell
      eyebrow="Operação por Projeto"
      title="Board Operacional"
      description="Gerencie briefing, backlog, requisitos, QA e arquitetura dentro do contexto certo de cada projeto."
    >
      <div className="min-w-0 overflow-x-hidden flex flex-col gap-8 pb-16">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
                <button onClick={() => setError(null)} className="dashboard-button-secondary px-3 py-2 text-xs">
                  Fechar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid min-w-0 items-start gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6">
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#102a72] text-white">
                        <LayoutDashboard className="h-4 w-4" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">Catálogo de projetos</h3>
                    </div>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      Projetos disponíveis
                    </p>
                  </div>
                  <button
                    onClick={() => setShowProjectForm(!showProjectForm)}
                    className={showProjectForm ?'dashboard-button-secondary px-4' : 'dashboard-button-primary px-4'}
                  >
                    <Plus className={`h-4 w-4 transition-transform ${showProjectForm ?'rotate-45' : ''}`} />
                    <span>{showProjectForm ?'Fechar' : 'Novo projeto'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="mb-3">
                  <input
                    value={projectSearch}
                    onChange={(event) => setProjectSearch(event.target.value)}
                    placeholder="Buscar projeto..."
                    className="dashboard-input"
                  />
                </div>
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  <AnimatePresence mode="popLayout">
                    {filteredProjects.map((project) => (
                      <motion.button
                        key={project.uuid}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => navigate(`/projects?project=${project.uuid}`)}
                        className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                          project.uuid === activeProjectUuid
                            ?'border-[#102a72]/20 bg-[#102a72]/5 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-slate-900">{project.name}</h4>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                              {project.description || 'Workspace pronto para backlog, refinamento, QA e geração técnica.'}
                            </p>
                          </div>
                          <span className="dashboard-badge bg-slate-100 text-slate-600">
                            {project._count?.tasks || 0}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>

                  {!filteredProjects.length && !loading && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
                      <LayoutDashboard className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Nenhum projeto encontrado
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Clique em <span className="font-semibold text-slate-700">Novo projeto</span> ou ajuste a busca.
                      </p>
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {showProjectForm && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleCreateProject}
                      className="space-y-4 overflow-hidden border-t border-slate-200 pt-4"
                    >
                      <TextInput
                        label="Nome do projeto"
                        value={projectForm.name}
                        onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex.: Plataforma de EAD"
                      />
                      <TextInput
                        label="Resumo curto"
                        value={projectForm.description}
                        onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Uma frase para orientar o time..."
                      />
                      <TextArea
                        label="Visão do produto"
                        value={projectForm.vision}
                        onChange={(e) => setProjectForm((prev) => ({ ...prev, vision: e.target.value }))}
                        placeholder="Objetivo principal, público e resultado esperado..."
                        rows={3}
                      />
                      <button type="submit" disabled={saving || !canCreateProject} className="dashboard-button-primary w-full">
                        Criar projeto
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Conta ativa</h3>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      Autenticação
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {bootstrapContext ?(
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#102a72]">Usuário</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{bootstrapContext.user.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{bootstrapContext.user.email}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#102a72]">Workspace</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{bootstrapContext.workspace.name}</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleBootstrapSubmit} className="space-y-4">
                    <TextInput
                      label="Identidade do diretor"
                      value={bootstrapForm.userName}
                      onChange={(e) => setBootstrapForm((prev) => ({ ...prev, userName: e.target.value }))}
                        placeholder="Seu nome"
                      icon={Users}
                    />
                    <TextInput
                        label="E-mail"
                      value={bootstrapForm.email}
                      onChange={(e) => setBootstrapForm((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="voce@exemplo.com"
                    />
                    <TextInput
                      label="Nome do workspace"
                      value={bootstrapForm.workspaceName}
                      onChange={(e) => setBootstrapForm((prev) => ({ ...prev, workspaceName: e.target.value }))}
                      placeholder="Aligna Workspace"
                      icon={Layout}
                    />
                    <button disabled={saving} className="dashboard-button-primary mt-2 w-full">
                      Criar workspace base
                    </button>
                  </form>
                )}
              </div>
            </section>
          </div>

          <div className="min-w-0 space-y-6">
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <div className="flex min-w-0 flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 max-w-3xl">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#102a72] text-white shadow-sm">
                        <LayoutDashboard className="h-8 w-8" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-4xl font-bold tracking-tight text-slate-900">
                          {activeProject?.name || 'Selecione um projeto'}
                        </h2>
                        <div className="mt-2">
                          {activeProject ?(
                            <span className="dashboard-badge bg-emerald-50 text-emerald-700">Operacional</span>
                          ) : (
                            <span className="dashboard-badge bg-slate-100 text-slate-500">Selecione um projeto</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="mt-6 text-base leading-8 text-slate-500">
                      {activeProject?.vision ||
                        'Selecione um projeto no catálogo para operar backlog, requisitos, QA e liberação técnica no mesmo board.'}
                    </p>
                    {roadmap?.milestone && (
                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#102a72]">Objetivo principal</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{roadmap.milestone}</p>
                        <p className="mt-2 text-xs leading-6 text-slate-500">
                          Este é o objetivo principal que guia a evolução do projeto nesta fase.
                        </p>
                      </div>
                    )}
                      {activeProjectUuid && !hasAgentGeneratedStories && (
                        <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${activeProjectUuid}`)}
                          className="dashboard-button-primary"
                        >
                          <Sparkles className="h-4 w-4" />
                          Criar user stories
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/projects/${activeProjectUuid}`)}
                          className="dashboard-button-secondary"
                        >
                          <FileText className="h-4 w-4" />
                          Abrir briefing do projeto
                        </button>
                      </div>
                    )}
                    {activeProjectUuid && (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleApproveArchitecture}
                          disabled={
                            saving ||
                            !architectureStatus?.hasArchitecture ||
                            architectureStatus?.architectureNeedsRefresh ||
                            architectureStatus?.architectureApproved
                          }
                          className="dashboard-button-primary"
                          title={
                            !architectureStatus?.hasArchitecture
                              ?'Gere a arquitetura antes de aprovar.'
                              : architectureStatus?.architectureNeedsRefresh
                                ?'Regere a arquitetura antes de aprovar.'
                                : architectureStatus?.architectureApproved
                                  ?'A arquitetura atual já foi aprovada.'
                                  : undefined
                          }
                        >
                          {architectureStatus?.architectureApproved ?'Arquitetura aprovada' : 'Aprovar arquitetura'}
                        </button>
                        <button
                          type="button"
                          onClick={handleExportPdf}
                          disabled={exportingPdf}
                          className="dashboard-button-secondary"
                        >
                          <Download className="h-4 w-4" />
                          {exportingPdf ?'Preparando PDF...' : 'Exportar documentação'}
                        </button>
                      </div>
                    )}
                  </div>

                    <div className="grid w-full gap-4 sm:grid-cols-3 xl:w-auto">
                      {[
                        { label: 'Stories', value: storyTasks.length, icon: LayoutDashboard, tone: 'bg-slate-50 text-slate-900' },
                        { label: 'Em QA', value: qaCount, icon: Sparkles, tone: 'bg-blue-50 text-[#102a72]' },
                        { label: 'Concluídas', value: doneCount, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
                    ].map((stat) => (
                      <div key={stat.label} className="min-w-[160px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">{stat.label}</p>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.tone}`}>
                            <stat.icon className="h-4 w-4" />
                          </div>
                        </div>
                        <p className="mt-4 text-4xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {roadmapPhases.length > 0 && (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {roadmapPhases.map((phase, index) => {
                      const phaseLabel = `Fase ${index + 1}`;
                      const phaseStatus = index === 0 ?'Prioridade atual' : index === 1 ?'Próxima etapa' : 'Planejada';
                      const phaseProgress = getRoadmapPhaseProgress(index, doneCount, storyTasks.length);
                      return (
                        <div key={`${phase.order || index}-${phase.title}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{phaseLabel}</p>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                              {phaseStatus}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-900">{phase.title}</p>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full ${index === 0 ?'bg-[#102a72]' : index === 1 ?'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${phaseProgress}%` }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                            <span>Progresso estimado</span>
                            <span className="font-semibold text-slate-700">{phaseProgress}%</span>
                          </div>
                          <p className="mt-2 text-xs leading-6 text-slate-500">
                            {index === 0
                              ?'Base operacional, rastreabilidade e controle do fluxo.'
                              : index === 1
                                ?'Colaboração, relatórios e acompanhamento gerencial.'
                                : 'Escala, integrações e governança avançada.'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Progresso geral</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                         {doneCount} de {storyTasks.length || 0} stories concluídas
                      </p>
                    </div>
                    <span className="text-3xl font-bold tracking-tight text-slate-900">{overallProgress}%</span>
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${overallProgress}%` }} />
                  </div>
                </div>

                {riskRegister && (
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-rose-500">Riscos do projeto</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {riskRegister.impediments?.[0] || riskRegister.risks?.[0] || 'Ainda sem riscos registrados'}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-600">
                        {riskRegister.risks?.length || 0} riscos · {riskRegister.impediments?.length || 0} impedimentos
                      </span>
                    </div>
                    {riskRegister.risks?.length > 1 && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {riskRegister.risks.slice(0, 3).map((risk, index) => (
                          <div key={`risk-${index}`} className="rounded-xl border border-rose-200 bg-white p-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-500">Risco {index + 1}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{risk}</p>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

                {projectTimeline && (
                  <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#102a72]">Linha do tempo</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {projectTimeline.startDate || 'Início não definido'} → {projectTimeline.targetDate || 'meta não definida'}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#102a72]">
                        {projectTimeline.weeklyCapacity ?`${projectTimeline.weeklyCapacity} tasks/semana` : 'Capacidade não definida'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-blue-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Atrasadas</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{overdueTasks.length}</p>
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Próximos prazos</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{upcomingTasks.length}</p>
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-white p-4 xl:col-span-2">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Meta do plano</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {projectTimeline.targetDate
                            ?'Essa data serve como referência para acompanhamento do ritmo do projeto e negociação de prazo.'
                            : 'Defina uma meta de entrega para deixar o plano mais previsível.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {taskLoadByAssignee.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Capacidade</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">Carga por responsável</p>
                      </div>
                      <span className="text-xs text-slate-500">{taskLoadByAssignee.length} pessoas/atores</span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {taskLoadByAssignee.slice(0, 6).map((item) => (
                        <div key={item.assignee} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-900">{item.assignee}</p>
                          <p className="mt-2 text-xs text-slate-500">
                            {item.total} tasks · {item.overdue} atrasadas · {item.dueSoon} vencendo
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 p-6">
                {activeProjectUuid && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Gate de arquitetura</p>
                        <p className="mt-2 text-sm text-slate-700">
                          {architectureStatus?.canGenerateCode
                            ?'Todas as histórias refinadas e a arquitetura estão prontas. A implementação por task foi liberada.'
                            : architectureStatus?.blockers?.[0] || 'Refine todas as histórias para liberar a arquitetura do projeto.'}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <span className="dashboard-badge bg-slate-100 text-slate-600">
                            {architectureStatus?.refinedStories || 0}/{architectureStatus?.totalStories || 0} histórias refinadas
                          </span>
                          <span
                            className={`dashboard-badge ${
                              architectureStatus?.hasArchitecture && !architectureStatus?.architectureNeedsRefresh
                                ?'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {architectureStatus?.hasArchitecture
                              ?architectureStatus?.architectureNeedsRefresh
                                ?'Arquitetura desatualizada'
                                : 'Arquitetura pronta'
                              : 'Arquitetura pendente'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateArchitecture}
                        disabled={saving || generatingArchitecture || !architectureStatus?.canGenerateArchitecture}
                        className="dashboard-button-primary w-full lg:w-auto"
                        title={!architectureStatus?.canGenerateArchitecture ?architectureStatus?.blockers?.[0] : undefined}
                      >
                        {generatingArchitecture ?'Gerando arquitetura...' : 'Gerar arquitetura'}
                      </button>
                    </div>
                  </div>
                )}
                <form onSubmit={handleCreateTask} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_160px]">
                  <div className="relative">
                    <Plus className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      placeholder="Descreva a nova task..."
                      value={taskForm.title}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="dashboard-input pl-11"
                    />
                  </div>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="dashboard-input appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M4%206L8%2010L12%206%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[right_1rem_center] bg-no-repeat pr-10"
                  >
                    {BOARD_COLUMNS.map((col) => (
                      <option key={col.key} value={col.key}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                  <button disabled={saving || !canCreateTask} className="dashboard-button-primary h-[46px]">
                    Criar
                  </button>
                </form>
              </div>
            </section>

            <section className="min-w-0 space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                {groupedColumns.map((column) => (
                  <div key={column.key} className="min-w-0 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <column.icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{column.label}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{column.tasks.length}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="-mx-2 overflow-x-auto px-2 pb-4">
                <div className="flex min-w-max gap-6">
                  {groupedColumns.map((column) => (
                    <div key={column.key} className="w-[340px] flex-none space-y-4 xl:w-[360px]">
                      <div className="dashboard-panel">
                        <div className="dashboard-panel-header">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                              <column.icon className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{column.label}</h4>
                              <p className="mt-1 text-xs text-slate-500">{column.tasks.length} stories</p>
                            </div>
                          </div>
                        </div>

                        <div className="h-[min(68vh,760px)] p-4">
                          <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
                            <AnimatePresence mode="popLayout">
                              {column.tasks.map((task) => (
                                <motion.div
                                  key={task.uuid}
                                  layout
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                >
                                  <TaskCard
                                    task={task}
                                    busy={saving}
                                    onRequirements={handleRunRequirements}
                                    onQa={handleRunQa}
                                    onOpenCodeStudio={handleOpenCodeStudio}
                                    onExportArtifacts={exportTaskArtifacts}
                                    onOpenDetail={(taskUuid) => navigate(`/projects/${activeProjectUuid}/tasks/${taskUuid}`)}
                                    implementationUnlocked={implementationUnlocked}
                                    implementationBlockReason={implementationBlockReason}
                                  />
                                </motion.div>
                              ))}
                            </AnimatePresence>

                            {!column.tasks.length && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-center"
                              >
                                <Plus className="h-8 w-8 text-slate-300" />
                                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                                  Coluna vazia
                                </p>
                                <p className="mt-2 text-sm text-slate-500">Pronta para receber novas stories</p>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
