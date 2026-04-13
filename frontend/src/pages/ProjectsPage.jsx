import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Archive,
  Briefcase,
  Clock,
  Filter,
  LayoutDashboard,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import ConfirmDialog from '../components/ConfirmDialog';
import { getProjectStatusConfirmationMessage, getProjectStatusMeta } from '../utils/projectStatus';
import { createProject, deleteProject, getApiErrorMessage, listProjects, updateProjectStatus } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const EMPTY_PROJECT = { name: '', description: '', vision: '' };

const PROJECT_STATUS_FILTERS = [
  { value: 'all', label: 'Todos os projetos' },
  { value: 'draft', label: 'Rascunhos' },
  { value: 'active', label: 'Ativos' },
  { value: 'on_hold', label: 'Em pausa' },
  { value: 'completed', label: 'Concluídos' },
  { value: 'archived', label: 'Arquivados' },
];

function formatShortDate(value) {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleDateString('pt-BR');
}

function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{label}</span>
      <input value={value} onChange={onChange} placeholder={placeholder} className="dashboard-input" />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="dashboard-input resize-none"
      />
    </label>
  );
}

function MetricCard({ label, value, hint, icon: Icon, tone = 'slate' }) {
  const tones = {
    blue: 'bg-blue-50 text-[#102a72] border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${tones[tone]}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ProjectCard({
  project,
  onOpenProject,
  onRequestStatusChange,
  onRequestDelete,
  busyProjectUuid,
}) {
  const statusMeta = getProjectStatusMeta(project?.status);
  const isBusy = busyProjectUuid === project.uuid;
  const canDeleteProject = project.currentUserRole === 'owner';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#102a72]/20 hover:shadow-md"
    >
      <button type="button" onClick={() => onOpenProject(project.uuid)} className="flex flex-1 flex-col text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#102a72] text-white shadow-sm">
              <LayoutDashboard className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Projeto</p>
              <h3 className="mt-2 truncate text-xl font-bold text-slate-900">{project.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 line-clamp-3">
                {project.description || 'Sem descrição consolidada.'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.tone}`}>
              {statusMeta.label}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Atualizado</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {formatShortDate(project.updatedAt || project.createdAt)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Visão</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{project.vision ? 'Presente' : 'Ainda não definida'}</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-500">
          Clique para abrir o contexto do projeto e seguir para overview, planejamento ou equipe.
        </p>
      </button>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">
            {project.vision ? 'Com visão' : 'Sem visão'}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">
            {isBusy ? 'Atualizando...' : 'Clique para abrir'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenProject(project.uuid)}
            className="dashboard-button-secondary px-3 py-2 text-xs"
          >
            Abrir contexto
          </button>
          {statusMeta.nextStatus ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRequestStatusChange(project, statusMeta.nextStatus);
              }}
              disabled={isBusy}
              className="dashboard-button-secondary px-3 py-2 text-xs"
            >
              {isBusy ? 'Atualizando...' : statusMeta.action}
            </button>
          ) : null}
          {canDeleteProject ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRequestDelete(project);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </button>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, workspace } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('all');
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [statusDialog, setStatusDialog] = useState({ open: false, project: null, nextStatus: null });
  const [statusUpdatingProjectUuid, setStatusUpdatingProjectUuid] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, project: null });
  const [deletingProjectUuid, setDeletingProjectUuid] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (searchParams.get('openCreate') === '1') {
      setShowProjectForm(true);
    }
  }, [searchParams]);

  async function loadProjects() {
    setLoading(true);
    setError(null);

    try {
      const nextProjects = await listProjects();
      setProjects(nextProjects);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Nao foi possivel carregar os projetos.'));
    } finally {
      setLoading(false);
    }
  }

  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    return projects.filter((project) => {
      const searchable = `${project.name} ${project.description || ''} ${project.vision || ''}`.toLowerCase();
      const matchesQuery = !query || searchable.includes(query);
      const matchesStatus = projectStatusFilter === 'all' || project.status === projectStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [projectSearch, projectStatusFilter, projects]);

  const projectStats = useMemo(() => {
    return projects.reduce(
      (acc, project) => {
        acc.total += 1;
        if (project.status === 'active') acc.active += 1;
        if (project.status === 'draft') acc.draft += 1;
        if (project.status === 'archived') acc.archived += 1;
        return acc;
      },
      { total: 0, active: 0, draft: 0, archived: 0 }
    );
  }, [projects]);

  const canCreateProject = Boolean(workspace?.uuid && user?.uuid);

  function openProject(projectUuid) {
    navigate(`/projects/${projectUuid}`);
  }

  function openProjectStatusDialog(project, nextStatus) {
    setStatusDialog({ open: true, project, nextStatus });
  }

  function openProjectDeleteDialog(project) {
    setDeleteDialog({ open: true, project });
  }

  async function confirmProjectStatusUpdate() {
    if (!statusDialog.project || !statusDialog.nextStatus) return;

    setStatusUpdatingProjectUuid(statusDialog.project.uuid);
    setError(null);

    try {
      await updateProjectStatus(statusDialog.project.uuid, statusDialog.nextStatus);
      await loadProjects();
      setStatusDialog({ open: false, project: null, nextStatus: null });
    } catch (statusError) {
      setError(getApiErrorMessage(statusError, 'Nao foi possivel atualizar o status do projeto.'));
    } finally {
      setStatusUpdatingProjectUuid(null);
    }
  }

  async function confirmProjectDelete() {
    if (!deleteDialog.project) return;

    const deletedProjectUuid = deleteDialog.project.uuid;
    setDeletingProjectUuid(deletedProjectUuid);
    setError(null);

    try {
      await deleteProject(deletedProjectUuid);
      setDeleteDialog({ open: false, project: null });
      await loadProjects();
    } catch (deleteError) {
      setError(getApiErrorMessage(deleteError, 'Nao foi possivel excluir o projeto.'));
    } finally {
      setDeletingProjectUuid(null);
    }
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    if (!canCreateProject) return;

    setSaving(true);
    setError(null);

    try {
      const project = await createProject({
        ...projectForm,
        workspaceUuid: workspace.uuid,
        createdByUuid: user.uuid,
        status: 'active',
      });
      setProjectForm(EMPTY_PROJECT);
      setShowProjectForm(false);
      await loadProjects();
      navigate(`/projects/${project.uuid}`);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Nao foi possivel criar o projeto.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppShell
        eyebrow="Projetos"
        title="Projetos criados"
        description="Veja seus projetos, abra o contexto de cada um e crie novos espacos de trabalho quando precisar."
        actions={
          <button onClick={() => setShowProjectForm(true)} className="dashboard-button-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Novo projeto
          </button>
        }
      >
        <div className="flex min-w-0 flex-col gap-6 pb-16">
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

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#102a72]">Portfolio</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Escolha um projeto e abra seu contexto</h2>
                <p className="mt-4 text-base leading-8 text-slate-500">
                  A pagina funciona como vitrine de projetos criados. Clique em um card para entrar no contexto operacional.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Projetos" value={projectStats.total} hint="Total no workspace" icon={Briefcase} tone="blue" />
                <MetricCard label="Ativos" value={projectStats.active} hint="Prontos para operar" icon={Sparkles} tone="emerald" />
                <MetricCard label="Rascunhos" value={projectStats.draft} hint="Ainda em briefing" icon={Clock} tone="amber" />
                <MetricCard label="Arquivados" value={projectStats.archived} hint="Historico preservado" icon={Archive} tone="slate" />
              </div>
            </div>

            <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={projectSearch}
                  onChange={(event) => setProjectSearch(event.target.value)}
                  placeholder="Buscar projetos..."
                  className="dashboard-input pl-11"
                />
              </div>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={projectStatusFilter}
                  onChange={(event) => setProjectStatusFilter(event.target.value)}
                  className="dashboard-input appearance-none pl-11 pr-10"
                >
                  {PROJECT_STATUS_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Projetos disponíveis</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">{filteredProjects.length} projeto(s) encontrado(s)</h3>
              </div>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
                Carregando projetos...
              </div>
            ) : filteredProjects.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.uuid}
                      project={project}
                      onOpenProject={openProject}
                      onRequestStatusChange={openProjectStatusDialog}
                      onRequestDelete={openProjectDeleteDialog}
                      busyProjectUuid={statusUpdatingProjectUuid || deletingProjectUuid}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                <LayoutDashboard className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Nenhum projeto encontrado</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ajuste a busca ou crie um novo projeto para começar.
                </p>
                <button
                  type="button"
                  onClick={() => setShowProjectForm(true)}
                  className="dashboard-button-primary mx-auto mt-6"
                >
                  <Plus className="h-4 w-4" />
                  Novo projeto
                </button>
              </div>
            )}
          </section>
        </div>
      </AppShell>

      <AnimatePresence>
        {showProjectForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm"
            onClick={() => setShowProjectForm(false)}
          >
            <motion.form
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleCreateProject}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#102a72]">Novo projeto</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">Criar espaco de trabalho</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Use isso para abrir um novo contexto de operacao sem misturar com projetos ja existentes.
                  </p>
                </div>
                <button type="button" onClick={() => setShowProjectForm(false)} className="dashboard-button-secondary px-3 py-2 text-xs">
                  Fechar
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                <TextInput
                  label="Nome do projeto"
                  value={projectForm.name}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex.: Plataforma de EAD"
                />
                <TextInput
                  label="Resumo curto"
                  value={projectForm.description}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Uma frase para orientar o time..."
                />
                <TextArea
                  label="Visao do produto"
                  value={projectForm.vision}
                  onChange={(event) => setProjectForm((prev) => ({ ...prev, vision: event.target.value }))}
                  placeholder="Objetivo principal, publico e resultado esperado..."
                  rows={4}
                />
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setShowProjectForm(false)} className="dashboard-button-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !canCreateProject} className="dashboard-button-primary">
                  {saving ? 'Criando...' : 'Criar projeto'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={statusDialog.open}
        title={`Atualizar status de ${statusDialog.project?.name || 'projeto'}`}
        description={
          statusDialog.project ? getProjectStatusConfirmationMessage(statusDialog.project.name, statusDialog.nextStatus) : ''
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        intent={statusDialog.nextStatus === 'archived' ? 'warning' : 'primary'}
        loading={Boolean(statusUpdatingProjectUuid)}
        onConfirm={confirmProjectStatusUpdate}
        onClose={() => setStatusDialog({ open: false, project: null, nextStatus: null })}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        title={`Excluir ${deleteDialog.project?.name || 'projeto'}`}
        description={
          deleteDialog.project
            ? `Tem certeza que deseja excluir o projeto "${deleteDialog.project.name}"? Esta acao remove o projeto, tasks, artefatos e historico associados.`
            : ''
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        intent="danger"
        loading={Boolean(deletingProjectUuid)}
        onConfirm={confirmProjectDelete}
        onClose={() => setDeleteDialog({ open: false, project: null })}
      />
    </>
  );
}
