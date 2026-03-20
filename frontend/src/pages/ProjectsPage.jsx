import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Layout, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MoreVertical, 
  FileText, 
  Code2, 
  TestTube2, 
  ExternalLink,
  Download,
  Users,
  LayoutDashboard,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  bootstrapGeneratedApp,
  bootstrapWorkspace,
  createProject,
  createTask,
  listProjects,
  listProjectTasks,
  runTaskImplementation,
  runTaskQa,
  runTaskRequirements,
} from '../services/api';

const BOARD_COLUMNS = [
  { key: 'backlog', label: 'Backlog', icon: Layout },
  { key: 'todo', label: 'To Do', icon: Clock },
  { key: 'in_progress', label: 'In Progress', icon: Sparkles },
  { key: 'in_review', label: 'Review', icon: AlertCircle },
  { key: 'qa', label: 'Quality Assurance', icon: TestTube2 },
  { key: 'done', label: 'Completed', icon: CheckCircle2 },
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
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 ml-1">{label}</label>
      <div className="relative group">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors group-focus-within:text-indigo-400" />}
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full h-12 rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-md shadow-sm transition-all focus:border-indigo-500/50 focus:ring-8 focus:ring-indigo-500/5 placeholder:text-slate-400 text-sm font-medium ${Icon ? 'pl-11 pr-4' : 'px-5'}`}
        />
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 ml-1">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur-md px-5 py-4 text-sm font-medium shadow-sm transition-all focus:border-indigo-500/50 focus:ring-8 focus:ring-indigo-500/5 placeholder:text-slate-400 resize-none"
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

function TaskCard({ task, onRequirements, onQa, onGenerateCode, onOpenDetail, onExportArtifacts, busy }) {
  const hasRequirements = hasCurrentArtifact(task, 'requirements');
  const isDone = task.status === 'done';

  const priorityColors = {
    high: 'text-rose-600 bg-rose-50 border-rose-100',
    medium: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    low: 'text-slate-500 bg-slate-50 border-slate-200',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, shadow: '0 30px 60px -12px rgba(0,0,0,0.12)' }}
      className="group relative flex flex-col rounded-[2.5rem] border border-slate-200/60 bg-white shadow-sm transition-all hover:border-indigo-400/30 overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="p-7 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-black leading-tight text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">
              {task.title}
            </h3>
            <div className="flex items-center gap-2">
              <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] border ${priorityColors[task.priority] || priorityColors.medium}`}>
                {task.priority}
              </span>
              <span className="text-[10px] font-bold text-slate-400">#{task.uuid?.split('-')[0]}</span>
            </div>
          </div>
          <button
            onClick={() => onOpenDetail(task.uuid)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium opacity-80">
          {task.description || 'No specialized context provided for this operation.'}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white text-[11px] font-black shadow-lg shadow-slate-200 group-hover:bg-indigo-600 transition-colors">
              {task.assigneeAgentName?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Expert</p>
              <p className="text-xs font-bold text-slate-800 tracking-tight">{task.assigneeAgentName || 'Agent'}</p>
            </div>
          </div>
          <div className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-100/60 text-right">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400">
              <Clock className="w-3 h-3" />
              <span>TIME CYCLE</span>
            </div>
            <p className="text-[11px] font-bold text-slate-700">{formatElapsed(task.timing?.cycleTimeSeconds)}</p>
          </div>
        </div>
      </div>

      <div className="mt-auto px-7 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center gap-3">
        {!isDone ? (
          <>
            <button
              onClick={() => onRequirements(task.uuid)}
              disabled={busy}
              className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 text-[10px] font-black tracking-widest text-white transition-all hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98] disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              ANALYZE
            </button>
            <button
              onClick={() => onQa(task.uuid)}
              disabled={busy || !hasRequirements}
              className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-[10px] font-black tracking-widest text-slate-700 transition-all hover:border-indigo-400 hover:text-indigo-600 active:scale-[0.98] disabled:opacity-40"
            >
              <TestTube2 className="w-3.5 h-3.5" />
              VERIFY
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onGenerateCode(task.uuid)}
              disabled={busy}
              className="flex-1 h-11 inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-[10px] font-black tracking-widest text-white transition-all hover:opacity-90 hover:shadow-xl hover:shadow-indigo-200 active:scale-[0.98] disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              IMPLEMENT
            </button>
            <button
              onClick={() => onExportArtifacts(task)}
              disabled={!task.artifacts?.length}
              className="h-11 w-11 flex items-center justify-center rounded-2xl border border-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-all"
              title="Export Bundle"
            >
              <Download className="w-4 h-4" />
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
      setError(loadError.response?.data?.error || loadError.message || 'Could not load projects.');
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
        setError(loadError.response?.data?.error || loadError.message || 'Could not load tasks.');
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
      setError(submitError.response?.data?.error || submitError.message || 'Could not bootstrap workspace.');
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
      setError(submitError.response?.data?.error || submitError.message || 'Could not create project.');
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
      setError(submitError.response?.data?.error || submitError.message || 'Could not create task.');
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
          'Requirements Analysis failed.'
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
          'QA Analysis failed.'
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
      await loadProjects(activeProjectUuid, { silent: true });
    } catch (submitError) {
      setError(
        submitError.response?.data?.error ||
          submitError.response?.data?.message ||
          submitError.message ||
          'Code generation failed.'
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <AppShell
      eyebrow="Development Studio"
      title="Architecture & Implementation"
      description="Manage your product lifecycle from vision to verification with autonomous AI agents."
    >
      <div className="flex flex-col gap-10 pb-20">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="rounded-[2.5rem] border border-rose-500/20 bg-rose-500/5 p-8 text-sm text-rose-400 flex items-center gap-6 backdrop-blur-3xl shadow-2xl shadow-rose-500/10"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400/70 mb-1">System Error Encountered</p>
                <p className="text-lg font-bold text-rose-200 leading-tight">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="px-6 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-black transition-all border border-rose-500/20 uppercase tracking-widest"
              >
                DISMISS
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
          {/* Sidebar Navigation */}
          <div className="xl:col-span-3 space-y-10">
            <section className="bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] border border-white/10 p-10 shadow-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[80px] rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/30 transition-colors" />
              
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black text-white flex items-center gap-2.5 tracking-tight uppercase">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    Catalog
                  </h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Active Inventories</p>
                </div>
                <button
                  onClick={() => setShowProjectForm(!showProjectForm)}
                  className={`w-12 h-12 rounded-2xl transition-all flex items-center justify-center border shadow-2xl active:scale-95 ${
                    showProjectForm 
                      ? 'bg-rose-500 border-rose-400 text-white' 
                      : 'bg-white/5 text-white hover:bg-indigo-600 border-white/10 hover:border-indigo-400'
                  }`}
                >
                  <Plus className={`w-6 h-6 transition-transform duration-500 ${showProjectForm ? 'rotate-45' : ''}`} />
                </button>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-3 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {projects.map((project) => (
                    <motion.button
                      key={project.uuid}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => navigate(`/projects/${project.uuid}`)}
                      className={`w-full p-6 rounded-[2rem] text-left transition-all group relative border-2 ${
                        project.uuid === activeProjectUuid
                          ? 'bg-white border-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)]'
                          : 'bg-white/5 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-base font-black tracking-tight leading-tight ${project.uuid === activeProjectUuid ? 'text-slate-900' : 'text-slate-200 group-hover:text-white'}`}>
                          {project.name}
                        </span>
                        <div className={`text-[10px] px-2.5 py-1 rounded-lg font-black border uppercase tracking-widest ${
                          project.uuid === activeProjectUuid 
                            ? 'bg-indigo-600 text-white border-indigo-400' 
                            : 'bg-slate-800 text-slate-500 border-white/5'
                        }`}>
                          {project._count?.tasks || 0} UNI
                        </div>
                      </div>
                      <p className={`text-[11px] leading-relaxed line-clamp-2 font-medium opacity-80 ${project.uuid === activeProjectUuid ? 'text-slate-500' : 'text-slate-500'}`}>
                        {project.description || 'Initialize specialized architectural blueprint for this operation.'}
                      </p>

                      {project.uuid === activeProjectUuid && (
                        <motion.div
                          layoutId="active-indicator"
                          className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                        />
                      )}
                    </motion.button>
                  ))}
                </AnimatePresence>
                
                {!projects.length && !loading && (
                  <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] bg-white/[0.02]">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6 text-slate-700">
                      <LayoutDashboard className="w-7 h-7" />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Deployment Void</p>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {showProjectForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="mt-10 pt-10 border-t border-white/10 space-y-6 overflow-hidden"
                  >
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 ml-1">Codename</label>
                        <input
                          placeholder="Project identifier..."
                          value={projectForm.name}
                          onChange={e => setProjectForm(p => ({ ...p, name: e.target.value }))}
                          className="w-full bg-slate-800/50 border border-white/10 rounded-[1.5rem] px-6 py-4 text-sm text-white focus:ring-8 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition shadow-inner placeholder:text-slate-600 font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500/70 ml-1">Vision Directive</label>
                        <textarea
                          placeholder="Strategic objectives..."
                          value={projectForm.vision}
                          onChange={e => setProjectForm(p => ({ ...p, vision: e.target.value }))}
                          rows={3}
                          className="w-full bg-slate-800/50 border border-white/10 rounded-[1.5rem] px-6 py-4 text-sm text-white focus:ring-8 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition resize-none shadow-inner placeholder:text-slate-600 font-medium"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleCreateProject}
                      disabled={saving || !canCreateProject}
                      className="w-full bg-white text-slate-950 rounded-2xl py-5 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-50 transition shadow-2xl disabled:opacity-30 active:scale-[0.98]"
                    >
                      Initialize Operations
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <section className="bg-white/80 backdrop-blur-3xl rounded-[3rem] border border-slate-200/60 p-10 shadow-2xl relative overflow-hidden">
               <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">Base Staff</h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Authentication</p>
                </div>
              </div>
              
              {bootstrapContext ? (
                <div className="space-y-4">
                  <div className="group p-6 rounded-[2rem] bg-slate-50 border border-slate-100/60 hover:border-indigo-200 transition-all cursor-default relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -mr-16 -mt-16" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-2">Director</p>
                    <p className="text-base font-black text-slate-900 transition-colors group-hover:text-indigo-600">{bootstrapContext.user.name}</p>
                    <p className="text-xs text-slate-500 font-bold opacity-60 tracking-tight">{bootstrapContext.user.email}</p>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-indigo-50/30 border border-indigo-100/40">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Facility</p>
                    <p className="text-sm font-black text-indigo-900 leading-tight">{bootstrapContext.workspace.name}</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleBootstrapSubmit} className="space-y-6">
                  <TextInput label="Director Identity" value={bootstrapForm.userName} onChange={(e) => setBootstrapForm(p => ({ ...p, userName: e.target.value }))} placeholder="Commander Name" icon={Users} />
                  <TextInput label="Communication ID" value={bootstrapForm.email} onChange={(e) => setBootstrapForm(p => ({ ...p, email: e.target.value }))} placeholder="ops@factory.studio" icon={ExternalLink} />
                  <TextInput label="Station Name" value={bootstrapForm.workspaceName} onChange={(e) => setBootstrapForm(p => ({ ...p, workspaceName: e.target.value }))} placeholder="NeoTokyo Hub" icon={Layout} />
                  <button disabled={saving} className="w-full h-16 bg-slate-950 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition shadow-2xl disabled:opacity-30 active:scale-[0.98] mt-4">
                    Establish Link
                  </button>
                </form>
              )}
            </section>
          </div>

          {/* Main Board Area */}
          <div className="xl:col-span-9 space-y-12">
            {/* Project Header Card */}
            <div className="bg-white rounded-[3.5rem] border border-slate-200/60 p-12 shadow-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] -mr-48 -mt-48 rounded-full" />
              
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-12 relative z-10">
                <div className="max-w-2xl space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-[2rem] bg-slate-900 flex items-center justify-center text-white shadow-3xl rotate-3 relative overflow-hidden group/icon">
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/40 to-transparent opacity-0 group-hover/icon:opacity-100 transition-opacity" />
                      <LayoutDashboard className="w-10 h-10 relative z-10" />
                    </div>
                    <div>
                      <h2 className="text-5xl font-black text-slate-900 tracking-tighter leading-none mb-3">
                        {activeProject?.name || 'Studio Hub'}
                      </h2>
                      <div className="flex gap-2">
                        {activeProject ? (
                          <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            Operational
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-xl border border-slate-200">
                            Awaiting Directive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-lg text-slate-500 font-bold leading-relaxed italic opacity-80 max-w-xl">
                    {activeProject?.vision || 'Architecture visualization and task distribution dashboard. Please select a project from the catalog to begin implementation.'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-6 shrink-0">
                  {[
                    { label: 'Units', value: tasks.length, color: 'slate', icon: LayoutDashboard },
                    { label: 'Proven', value: tasks.filter(t => hasCurrentArtifact(t, 'qa')).length, color: 'indigo', icon: Sparkles }
                  ].map((stat, i) => (
                    <div key={i} className={`bg-${stat.color}-50/50 rounded-[2.5rem] px-10 py-8 border border-${stat.color}-100/60 shadow-sm min-w-[180px] group hover:scale-[1.05] transition-all duration-500 hover:shadow-2xl`}>
                      <div className="flex items-center justify-between mb-4">
                        <p className={`text-[10px] font-black uppercase tracking-[0.3em] text-${stat.color}-400`}>{stat.label}</p>
                        <stat.icon className={`w-4 h-4 text-${stat.color}-300`} />
                      </div>
                      <p className={`text-5xl font-black text-${stat.color}-900 tracking-tighter leading-none`}>{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Task Entry Overhaul */}
              <div className="mt-16 pt-12 border-t border-slate-100/60 relative z-10">
                <form onSubmit={handleCreateTask} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 relative group">
                    <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                      <Plus className="w-6 h-6 text-slate-300 group-focus-within:text-indigo-600 transition-all duration-500 group-focus-within:rotate-90" />
                    </div>
                    <input 
                      placeholder="Dispatch new unit directive..." 
                      value={taskForm.title}
                      onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                      className="w-full h-16 bg-slate-50 border border-slate-200/60 rounded-[1.5rem] pl-16 pr-8 text-base font-bold text-slate-900 focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner placeholder:text-slate-400"
                    />
                  </div>
                  <div className="lg:col-span-3">
                    <select 
                      value={taskForm.status}
                      onChange={e => setTaskForm(p => ({ ...p, status: e.target.value }))}
                      className="w-full h-16 bg-slate-50 border border-slate-200/60 rounded-[1.5rem] px-8 text-xs font-black uppercase tracking-[0.2em] text-slate-700 focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-[length:24px_24px] bg-[right_1.5rem_center] bg-no-repeat shadow-inner"
                    >
                      {BOARD_COLUMNS.map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <button 
                      disabled={saving || !canCreateTask}
                      className="w-full h-16 bg-slate-950 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 hover:shadow-3xl hover:shadow-indigo-500/30 transition-all duration-500 disabled:opacity-20 active:scale-95 shrink-0 shadow-2xl"
                    >
                      DEPLOY
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Kanban Studio Overhaul */}
            <div className="relative group/board -mx-4">
              <div className="flex gap-10 overflow-x-auto pb-20 pt-4 px-4 custom-scrollbar scroll-smooth snap-x">
                {groupedColumns.map((column) => (
                  <div key={column.key} className="flex-none w-[400px] space-y-8 snap-start">
                    <div className="flex items-center justify-between px-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-[0_15px_30px_-10px_rgba(0,0,0,0.1)] flex items-center justify-center text-slate-800 transition-transform hover:rotate-6">
                          <column.icon className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] leading-none">{column.label}</h4>
                          <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{column.tasks.length}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-100/40 backdrop-blur-3xl rounded-[3.5rem] border border-slate-200/50 p-6 min-h-[800px] flex flex-col gap-6 shadow-inner relative overflow-hidden">
                      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />
                      
                      <AnimatePresence mode="popLayout">
                        {column.tasks.map((task) => (
                          <TaskCard
                            key={task.uuid}
                            task={task}
                            busy={saving}
                            onRequirements={handleRunRequirements}
                            onQa={handleRunQa}
                            onGenerateCode={handleGenerateCode}
                            onExportArtifacts={exportTaskArtifacts}
                            onOpenDetail={(taskUuid) => navigate(`/projects/${activeProjectUuid}/tasks/${taskUuid}`)}
                          />
                        ))}
                      </AnimatePresence>
                      
                      {column.tasks.length === 0 && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex-1 flex flex-col items-center justify-center border-4 border-dashed border-slate-200/80 rounded-[3rem] p-12 text-center bg-white/20"
                        >
                          <div className="w-20 h-20 rounded-[2rem] bg-white shadow-xl flex items-center justify-center mb-6 border border-slate-100">
                            <Plus className="w-10 h-10 text-slate-200" />
                          </div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Operational Vacuum</p>
                          <p className="text-xs text-slate-500 mt-2 font-medium opacity-60">Ready for directive dispatch</p>
                        </motion.div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Board Decorative elements */}
              <div className="absolute top-0 bottom-20 right-0 w-48 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none opacity-0 group-hover/board:opacity-100 transition-opacity duration-1000" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

