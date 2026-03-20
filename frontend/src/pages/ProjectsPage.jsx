import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
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
  bootstrapWorkspace,
  createProject,
  createTask,
  generateProjectArchitecture,
  getProjectArchitectureStatus,
  listProjects,
  listProjectTasks,
  runTaskQa,
  runTaskRequirements,
} from '../services/api';

const BOARD_COLUMNS = [
  { key: 'backlog', label: 'Backlog', icon: Layout },
  { key: 'todo', label: 'A Fazer', icon: Clock },
  { key: 'in_progress', label: 'Em Progresso', icon: Sparkles },
  { key: 'in_review', label: 'Em Revisão', icon: AlertCircle },
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
  taskType: 'task',
  assigneeType: 'agent',
  assigneeAgentName: 'requirements_analyst',
};

function getStoredBootstrap() {
  const raw = localStorage.getItem('factory_bootstrap_context');
  return raw ? JSON.parse(raw) : null;
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
          className={`dashboard-input ${Icon ? 'pl-11' : ''}`}
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
    task.description ? `\n${task.description}` : '',
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
  const processingError = task.processingError;
  const canRunRequirements = !hasRequirements;
  const canRunQa = hasRequirements && !hasTestPlan;
  const canRunImplementation = Boolean(implementationUnlocked);

  const priorityColors = {
    high: 'bg-rose-50 text-rose-700',
    medium: 'bg-blue-50 text-[#102a72]',
    low: 'bg-slate-100 text-slate-600',
  };

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
          {task.description || 'Sem contexto adicional registrado para esta task.'}
        </p>

        {processingError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-rose-500">Falha na ultima execucao</p>
            <p className="mt-1 text-sm font-medium text-rose-700">{processingError.message}</p>
          </div>
        )}

        {isDone && !canRunImplementation && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-600">Implementacao bloqueada</p>
            <p className="mt-1 text-sm font-medium text-amber-800">
              {implementationBlockReason || 'Gere a arquitetura do projeto depois que todas as historias estiverem refinadas.'}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Agente</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{task.assigneeAgentName || 'Agente'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Tempo de ciclo</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{formatElapsed(task.timing?.cycleTimeSeconds)}</p>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
        {!isDone ? (
          <>
            <button
              onClick={() => onRequirements(task.uuid)}
              disabled={busy || !canRunRequirements}
              className="dashboard-button-primary flex-1"
              title={!canRunRequirements ? 'A etapa de requisitos ja foi concluida.' : undefined}
            >
              <FileText className="h-4 w-4" />
              Analisar
            </button>
            <button
              onClick={() => onQa(task.uuid)}
              disabled={busy || !canRunQa}
              className="dashboard-button-secondary flex-1"
              title={!canRunQa && hasTestPlan ? 'A etapa de QA ja foi concluida.' : undefined}
            >
              <TestTube2 className="h-4 w-4" />
              Validar
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onOpenCodeStudio(task.uuid)}
              disabled={busy}
              className="dashboard-button-primary flex-1"
            >
              <Sparkles className="h-4 w-4" />
              Ir para codigo
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
  const [error, setError] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [bootstrapForm, setBootstrapForm] = useState(EMPTY_BOOTSTRAP);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK);

  const activeProject = projects.find((project) => project.uuid === activeProjectUuid) || null;

  useEffect(() => {
    const preferredProjectUuid = searchParams.get('project');
    loadProjects(preferredProjectUuid);
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

  async function loadProjects(preferredProjectUuid, options = {}) {
    if (!options.silent) setLoading(true);
    setError(null);

    try {
      const nextProjects = await listProjects();
      setProjects(nextProjects);
      setActiveProjectUuid(preferredProjectUuid || nextProjects[0]?.uuid || null);
    } catch (loadError) {
      setError(loadError.response?.data?.error || loadError.message || 'Não foi possível carregar os projetos.');
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
        setError(loadError.response?.data?.error || loadError.message || 'Não foi possível carregar as tasks.');
      }
    }
  }

  async function loadArchitectureStatus(projectUuid, options = {}) {
    try {
      const nextStatus = await getProjectArchitectureStatus(projectUuid);
      setArchitectureStatus(nextStatus);
    } catch (loadError) {
      if (!options.silent) {
        setError(
          loadError.response?.data?.message ||
            loadError.message ||
            'Nao foi possivel carregar o status da arquitetura do projeto.'
        );
      }
    }
  }

  const groupedColumns = useMemo(
    () =>
      BOARD_COLUMNS.map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.status === column.key),
      })),
    [tasks]
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
      setError(submitError.response?.data?.error || submitError.message || 'Não foi possível preparar o workspace.');
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
      setError(submitError.response?.data?.error || submitError.message || 'Não foi possível criar o projeto.');
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
      setError(submitError.response?.data?.error || submitError.message || 'Não foi possível criar a task.');
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
      setError(
        submitError.response?.data?.error ||
          submitError.response?.data?.message ||
          submitError.message ||
          'A análise de requisitos falhou.'
      );
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
      setError(
        submitError.response?.data?.error ||
          submitError.response?.data?.message ||
          submitError.message ||
          'A análise de QA falhou.'
      );
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
      setError(
        submitError.response?.data?.error ||
          submitError.response?.data?.message ||
          submitError.message ||
          'A geração de código falhou.'
      );
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
      setError(
        submitError.response?.data?.message ||
          submitError.message ||
          'Nao foi possivel gerar a arquitetura do projeto.'
      );
    } finally {
      setGeneratingArchitecture(false);
    }
  }

  function handleOpenCodeStudio(taskUuid) {
    if (!activeProjectUuid) return;
    navigate(`/code-studio?project=${activeProjectUuid}&task=${taskUuid}`);
  }

  const qaCount = tasks.filter((task) => hasCurrentArtifact(task, 'test_plan')).length;
  const implementationUnlocked = Boolean(architectureStatus?.canGenerateCode);
  const implementationBlockReason = architectureStatus?.blockers?.[0] || null;

  return (
    <AppShell
      eyebrow="Estúdio de Desenvolvimento"
      title="Arquitetura e Implementação"
      description="Gerencie o ciclo do produto da visão até a validação com agentes autônomos."
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
                      <h3 className="text-sm font-bold text-slate-900">Catálogo</h3>
                    </div>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      Inventários ativos
                    </p>
                  </div>
                  <button
                    onClick={() => setShowProjectForm(!showProjectForm)}
                    className={showProjectForm ? 'dashboard-button-secondary px-3' : 'dashboard-button-primary px-3'}
                  >
                    <Plus className={`h-4 w-4 transition-transform ${showProjectForm ? 'rotate-45' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  <AnimatePresence mode="popLayout">
                    {projects.map((project) => (
                      <motion.button
                        key={project.uuid}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => navigate(`/projects/${project.uuid}`)}
                        className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                          project.uuid === activeProjectUuid
                            ? 'border-[#102a72]/20 bg-[#102a72]/5 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-slate-900">{project.name}</h4>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                              {project.description || 'Architecture visualization and task distribution dashboard.'}
                            </p>
                          </div>
                          <span className="dashboard-badge bg-slate-100 text-slate-600">
                            {project._count?.tasks || 0}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </AnimatePresence>

                  {!projects.length && !loading && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
                      <LayoutDashboard className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Nenhum projeto
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
                      label="Codinome"
                        value={projectForm.name}
                        onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Identificador do projeto..."
                      />
                      <TextArea
                        label="Diretriz de visão"
                        value={projectForm.vision}
                        onChange={(e) => setProjectForm((prev) => ({ ...prev, vision: e.target.value }))}
                        placeholder="Objetivos estratégicos..."
                        rows={3}
                      />
                      <button type="submit" disabled={saving || !canCreateProject} className="dashboard-button-primary w-full">
                        Inicializar operações
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
                    <h3 className="text-sm font-bold text-slate-900">Equipe base</h3>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      Autenticação
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {bootstrapContext ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#102a72]">Diretor</p>
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
                      placeholder="Nome do responsável"
                      icon={Users}
                    />
                    <TextInput
                      label="Contato"
                      value={bootstrapForm.email}
                      onChange={(e) => setBootstrapForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="ops@factory.studio"
                    />
                    <TextInput
                      label="Nome do workspace"
                      value={bootstrapForm.workspaceName}
                      onChange={(e) => setBootstrapForm((prev) => ({ ...prev, workspaceName: e.target.value }))}
                      placeholder="Factory Hub"
                      icon={Layout}
                    />
                    <button disabled={saving} className="dashboard-button-primary mt-2 w-full">
                      Estabelecer vínculo
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
                          {activeProject?.name || 'Studio Hub'}
                        </h2>
                        <div className="mt-2">
                          {activeProject ? (
                            <span className="dashboard-badge bg-emerald-50 text-emerald-700">Operacional</span>
                          ) : (
                            <span className="dashboard-badge bg-slate-100 text-slate-500">Aguardando direção</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="mt-6 text-base leading-8 text-slate-500">
                      {activeProject?.vision ||
                        'Dashboard de visualização da arquitetura e distribuição de tasks. Selecione um projeto no catálogo para começar a implementação.'}
                    </p>
                  </div>

                  <div className="grid w-full gap-4 sm:grid-cols-2 xl:w-auto">
                    {[
                      { label: 'Unidades', value: tasks.length, icon: LayoutDashboard, tone: 'bg-slate-50 text-slate-900' },
                      { label: 'Validadas', value: qaCount, icon: Sparkles, tone: 'bg-blue-50 text-[#102a72]' },
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
              </div>

              <div className="border-t border-slate-200 p-6">
                {activeProjectUuid && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Gate de arquitetura</p>
                        <p className="mt-2 text-sm text-slate-700">
                          {architectureStatus?.canGenerateCode
                            ? 'Todas as historias refinadas e arquitetura pronta. A implementacao por task foi liberada.'
                            : architectureStatus?.blockers?.[0] || 'Refine todas as historias para liberar a arquitetura do projeto.'}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <span className="dashboard-badge bg-slate-100 text-slate-600">
                            {architectureStatus?.refinedStories || 0}/{architectureStatus?.totalStories || 0} historias refinadas
                          </span>
                          <span
                            className={`dashboard-badge ${
                              architectureStatus?.hasArchitecture && !architectureStatus?.architectureNeedsRefresh
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {architectureStatus?.hasArchitecture
                              ? architectureStatus?.architectureNeedsRefresh
                                ? 'Arquitetura desatualizada'
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
                        title={!architectureStatus?.canGenerateArchitecture ? architectureStatus?.blockers?.[0] : undefined}
                      >
                        {generatingArchitecture ? 'Gerando arquitetura...' : 'Gerar arquitetura do projeto'}
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
                              <p className="mt-1 text-xs text-slate-500">{column.tasks.length} tasks</p>
                          </div>
                        </div>
                      </div>

                      <div className="h-[min(68vh,760px)] p-4">
                        <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
                          <AnimatePresence mode="popLayout">
                            {column.tasks.map((task) => (
                              <TaskCard
                                key={task.uuid}
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
                              <p className="mt-2 text-sm text-slate-500">Pronta para receber novas tasks</p>
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
