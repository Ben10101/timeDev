import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import {
  bootstrapWorkspace,
  createProject,
  createTask,
  listProjects,
  listProjectTasks,
  runTaskQa,
  runTaskRequirements,
} from '../services/api';

const BOARD_COLUMNS = [
  { key: 'backlog', label: 'Backlog', tone: 'bg-slate-100 text-slate-700' },
  { key: 'todo', label: 'A Fazer', tone: 'bg-[#eef5ef] text-[#2f6c58]' },
  { key: 'in_progress', label: 'Em Progresso', tone: 'bg-[#fff5d9] text-[#8a6a1f]' },
  { key: 'in_review', label: 'Em Revisão', tone: 'bg-[#e7eefc] text-[#3258a8]' },
  { key: 'qa', label: 'QA', tone: 'bg-[#f7e9ff] text-[#7b3aa4]' },
  { key: 'done', label: 'Concluído', tone: 'bg-[#e5f3e8] text-[#2f6c58]' },
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

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#8aac55] focus:ring-4 focus:ring-[#dff0b8]"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#8aac55] focus:ring-4 focus:ring-[#dff0b8]"
      />
    </label>
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
        `\n\n---\n\n## ${artifact.title}\nTipo: ${artifact.artifactType}\nVersão: ${artifact.version}\n\n${artifact.content}`
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

function TaskCard({ task, onRequirements, onQa, onOpenDetail, onExportArtifacts, busy }) {
  const hasRequirements = hasCurrentArtifact(task, 'requirements');
  const hasQa = hasCurrentArtifact(task, 'test_plan');
  const isDone = task.status === 'done';

  return (
    <article className="max-w-[232px] rounded-[18px] border border-slate-200 bg-white/95 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 max-w-[220px] text-sm font-semibold leading-5 text-slate-900">{task.title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
          {task.priority}
        </span>
      </div>

      <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">
        {task.description || 'Sem descrição cadastrada.'}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="truncate">{task.assigneeAgentName || task.assigneeUser?.name || 'Sem dono'}</span>
        <span>{formatElapsed(task.timing?.leadTimeSeconds)}</span>
        <span>REQ {hasRequirements ? 'OK' : '?'}</span>
        <span>QA {hasQa ? 'OK' : '?'}</span>
      </div>

      <div className="mt-3 grid gap-2">
        {isDone ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenDetail(task.uuid)}
              className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Abrir detalhe
            </button>
            <button
              type="button"
              onClick={() => onExportArtifacts(task)}
              disabled={!task.artifacts?.length}
              className="rounded-2xl border border-[#2f6c58] bg-[#eef5ef] px-3 py-2 text-xs font-semibold text-[#2f6c58] transition hover:bg-[#e4f0e5] disabled:opacity-50"
            >
              Exportar artefatos
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onRequirements(task.uuid)}
                disabled={busy}
                className="rounded-2xl border border-[#8aac55] bg-[#eef5ef] px-3 py-2 text-xs font-semibold text-[#2f6c58] transition hover:bg-[#e4f0e5] disabled:opacity-50"
              >
                Requirements
              </button>
              <button
                type="button"
                onClick={() => onQa(task.uuid)}
                disabled={busy || !hasRequirements}
                className="rounded-2xl border border-[#d7c1ef] bg-[#f7e9ff] px-3 py-2 text-xs font-semibold text-[#7b3aa4] transition hover:bg-[#f1deff] disabled:opacity-50"
              >
                QA
              </button>
              <button
                type="button"
                onClick={() => onOpenDetail(task.uuid)}
                className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Abrir detalhe
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bootstrapContext, setBootstrapContext] = useState(getStoredBootstrap());
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeProjectUuid, setActiveProjectUuid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [activeProjectUuid]);

  useEffect(() => {
    if (activeProjectUuid) {
      loadTasks(activeProjectUuid);
    } else {
      setTasks([]);
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
      setError(submitError.response?.data?.error || submitError.message || 'Não foi possível criar o workspace.');
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
    } catch (submitError) {
      setError(
        submitError.response?.data?.error ||
          submitError.response?.data?.message ||
          submitError.message ||
          'Não foi possível executar o Analista de Requisitos.'
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
    } catch (submitError) {
      setError(
        submitError.response?.data?.error ||
          submitError.response?.data?.message ||
          submitError.message ||
          'Não foi possível executar o QA Engineer.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      eyebrow="Projects"
      title="Projects & Tasks Workspace"
      description="Crie workspace, cadastre projetos e opere cada task direto no card, com Requirements e QA no próprio contexto do board."
    >
      <section className="space-y-6">
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Workspace</p>
            {bootstrapContext ? (
              <div className="mt-4 rounded-[22px] bg-[#eef5ef] p-4 text-sm text-slate-700">
                <p><strong>Usuário:</strong> {bootstrapContext.user.name}</p>
                <p className="mt-2"><strong>Workspace:</strong> {bootstrapContext.workspace.name}</p>
              </div>
            ) : (
              <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={handleBootstrapSubmit}>
                <TextInput label="Nome" value={bootstrapForm.userName} onChange={(e) => setBootstrapForm((prev) => ({ ...prev, userName: e.target.value }))} placeholder="Seu nome" />
                <TextInput label="E-mail" value={bootstrapForm.email} onChange={(e) => setBootstrapForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="voce@empresa.com" />
                <div className="grid gap-3 md:col-span-3 md:grid-cols-[minmax(0,1fr)_180px]">
                  <TextInput label="Workspace" value={bootstrapForm.workspaceName} onChange={(e) => setBootstrapForm((prev) => ({ ...prev, workspaceName: e.target.value }))} placeholder="Factory OS" />
                  <div className="flex items-end">
                    <button disabled={saving} className="w-full rounded-2xl bg-[#17322b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#214338] disabled:opacity-50">
                      Criar workspace
                    </button>
                  </div>
                </div>
              </form>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-[#17322b] p-5 text-emerald-50 shadow-[0_20px_60px_rgba(23,50,43,0.14)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/60">Projetos</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-emerald-100/70">{projects.length} projetos</span>
                <button
                  type="button"
                  onClick={() => setShowProjectForm((prev) => !prev)}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
                >
                  {showProjectForm ? 'Fechar' : 'Novo projeto'}
                </button>
              </div>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {projects.map((project) => (
                <button
                  key={project.uuid}
                  onClick={() => navigate(`/projects/${project.uuid}`)}
                  className={`min-w-[240px] rounded-[22px] border px-4 py-4 text-left transition ${
                    project.uuid === activeProjectUuid
                      ? 'border-white/30 bg-white/12'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">{project.name}</span>
                    <span className="text-xs text-emerald-100/70">{project._count?.tasks || 0}</span>
                  </div>
                  <p className="mt-2 text-sm text-emerald-50/75">{project.description || 'Sem descrição.'}</p>
                </button>
              ))}
              {!projects.length && !loading && (
                <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-6 text-sm text-emerald-50/70">
                  Crie seu primeiro projeto para começar.
                </div>
              )}
            </div>

            {showProjectForm && (
              <form
                className="mt-4 grid gap-3 rounded-[22px] border border-white/10 bg-white/5 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                onSubmit={handleCreateProject}
              >
                <TextInput
                  label="Nome"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Factory OS"
                />
                <TextInput
                  label="Visão"
                  value={projectForm.vision}
                  onChange={(e) => setProjectForm((prev) => ({ ...prev, vision: e.target.value }))}
                  placeholder="Objetivo estratégico"
                />
                <div className="lg:col-span-2">
                  <TextArea
                    label="Descrição"
                    value={projectForm.description}
                    onChange={(e) => setProjectForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Resumo do projeto"
                    rows={2}
                  />
                </div>
                <div className="lg:col-span-2 flex justify-end">
                  <button
                    disabled={saving || !canCreateProject}
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[#17322b] transition hover:bg-emerald-50 disabled:opacity-50"
                  >
                    Criar projeto
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Workspace board</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-slate-900 sm:text-3xl">{activeProject?.name || 'Selecione um projeto'}</h2>
              <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">{activeProject?.vision || 'Crie ou selecione um projeto para operar o board.'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tasks</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{tasks.length}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">REQ OK</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{tasks.filter((task) => hasCurrentArtifact(task, 'requirements')).length}</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">QA OK</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{tasks.filter((task) => hasCurrentArtifact(task, 'test_plan')).length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white/88 p-5 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
          <form className="mb-5 grid gap-3 rounded-[24px] border border-slate-200 bg-[#faf8f2] p-4 md:grid-cols-2 2xl:grid-cols-6" onSubmit={handleCreateTask}>
            <div className="2xl:col-span-2">
              <TextInput label="Nova task" value={taskForm.title} onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Ex: Refinar critérios de aceite da task" />
            </div>
            <div className="2xl:col-span-2">
              <TextArea label="Descrição" value={taskForm.description} onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="O que precisa ser feito?" rows={1} />
            </div>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</span>
              <select value={taskForm.status} onChange={(e) => setTaskForm((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none">
                {BOARD_COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Agente</span>
              <input value={taskForm.assigneeAgentName} onChange={(e) => setTaskForm((prev) => ({ ...prev, assigneeAgentName: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none" />
            </label>
            <div className="flex items-end">
              <button disabled={saving || !canCreateTask} className="w-full rounded-2xl bg-[#17322b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#214338] disabled:opacity-50">
                Criar task
              </button>
            </div>
          </form>

          {loading ? (
            <div className="rounded-[24px] bg-[#faf8f2] p-8 text-center text-slate-500">Carregando tasks...</div>
          ) : (
            <div className="-mx-2 overflow-x-auto px-2 pb-2">
              <div className="flex min-w-max gap-4">
                {groupedColumns.map((column) => (
                  <div
                    key={column.key}
                    className="min-h-[420px] shrink-0 rounded-[26px] border border-slate-200 bg-[#faf8f2] p-4"
                    style={{ width: '260px', minWidth: '260px', maxWidth: '260px', flex: '0 0 260px' }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${column.tone}`}>{column.label}</span>
                      <span className="text-xs text-slate-500">{column.tasks.length}</span>
                    </div>
                    <div className="space-y-3">
                      {column.tasks.map((task) => (
                        <TaskCard
                          key={task.uuid}
                          task={task}
                          busy={saving}
                          onRequirements={handleRunRequirements}
                          onQa={handleRunQa}
                          onExportArtifacts={exportTaskArtifacts}
                          onOpenDetail={(taskUuid) => navigate(`/projects/${activeProjectUuid}/tasks/${taskUuid}`)}
                        />
                      ))}
                      {!column.tasks.length && (
                        <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                          Nenhuma task nesta coluna
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
