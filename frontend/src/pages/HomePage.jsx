import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Briefcase,
  Braces,
  CheckCircle2,
  Clock3,
  Cpu,
  ListChecks,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  getAiOperationsOverview,
  getOperationalHealth,
  listAllTasks,
  listProjects,
} from '../services/api';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay, ease: 'easeOut' },
});

const STATUS_META = {
  completed: {
    badge: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Concluido',
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  running: {
    badge: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-500 animate-pulse',
    label: 'Em execucao',
    iconBg: 'bg-blue-50 text-blue-700',
  },
  failed: {
    badge: 'bg-rose-50 text-rose-700',
    dot: 'bg-rose-500',
    label: 'Falhou',
    iconBg: 'bg-rose-50 text-rose-700',
  },
  pending: {
    badge: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
    label: 'Pendente',
    iconBg: 'bg-slate-100 text-slate-600',
  },
};

const TOOL_LINKS = [
  { label: 'Projetos', to: '/projects', icon: Briefcase },
  { label: 'Backlog', to: '/global-backlog', icon: ListChecks },
  { label: 'Codigo', to: '/code-studio', icon: Braces },
  { label: 'IAs', to: '/settings/ai', icon: Settings },
];

function StatCard({ label, value, hint, icon: Icon, color, bg, delay = 0 }) {
  return (
    <motion.div
      {...fade(delay)}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: bg, color }}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <TrendingUp className="h-4 w-4 text-slate-300" strokeWidth={2} />
      </div>
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{hint}</p>
      </div>
    </motion.div>
  );
}

function QuickAction({ label, description, icon: Icon, to, navigate, delay = 0 }) {
  return (
    <motion.button
      {...fade(delay)}
      onClick={() => navigate(to)}
      className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#102a72]/20 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all group-hover:bg-[#102a72]/10 group-hover:text-[#102a72]">
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </motion.button>
  );
}

function RunRow({ run, delay = 0 }) {
  const statusKey = STATUS_META[run.status] ? run.status : 'pending';
  const meta = STATUS_META[statusKey];

  return (
    <motion.div
      {...fade(delay)}
      className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}>
        <Bot className="h-4.5 w-4.5" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{run.agentName}</p>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${meta.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          {run.runtimeMeta?.providerOrder?.[0] && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              {run.runtimeMeta.providerOrder[0]}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-slate-600">{run.task?.title || run.project?.name || 'Execucao de plataforma'}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>{run.project?.name || 'Sem projeto'}</span>
          <span>{run.totalTokens || 0} tokens</span>
          <span>{run.durationSeconds != null ? `${run.durationSeconds}s` : 'Em andamento'}</span>
          {run.costUsd ? <span>US$ {run.costUsd.toFixed(4)}</span> : null}
        </div>
        {run.errorMessage ? <p className="mt-2 line-clamp-2 text-xs text-rose-600">{run.errorMessage}</p> : null}
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [health, setHealth] = useState(null);
  const [operations, setOperations] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setLoadError('');
        const [projectsData, tasksData, healthData, operationsData] = await Promise.all([
          listProjects(),
          listAllTasks(),
          getOperationalHealth(),
          getAiOperationsOverview(),
        ]);

        if (!active) return;

        setProjects(Array.isArray(projectsData) ? projectsData : []);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
        setHealth(healthData);
        setOperations(operationsData);
      } catch (error) {
        if (!active) return;
        setLoadError(error.response?.data?.message || error.message || 'Nao foi possivel carregar o dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const totalTasks = tasks.length;
    const activeTasks = tasks.filter((task) => ['todo', 'in_progress', 'in_review', 'qa'].includes(task.status)).length;
    const completedTasks = tasks.filter((task) => task.status === 'done').length;
    const failedRuns = operations?.summary?.failedRuns || 0;
    const runningRuns = operations?.summary?.runningRuns || 0;

    return {
      totalProjects,
      totalTasks,
      activeTasks,
      completedTasks,
      failedRuns,
      runningRuns,
    };
  }, [projects, tasks, operations]);

  const topProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => {
        const aTasks = a._count?.tasks || 0;
        const bTasks = b._count?.tasks || 0;
        return bTasks - aTasks;
      })
      .slice(0, 4);
  }, [projects]);

  const recentRuns = operations?.recentRuns || [];
  const alerts = operations?.alerts || [];
  const healthySystem = health?.status === 'ok' && (operations?.summary?.failedRuns || 0) === 0;

  return (
    <AppShell
      eyebrow="Visao Geral"
      title="Factory OS"
      description="Acompanhe a saude da plataforma, o volume de trabalho e a operacao dos agentes em uma visao unica."
      actions={
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-2 rounded-xl bg-[#102a72] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0c205a] hover:shadow-md"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Novo Projeto
        </button>
      }
    >
      <div className="space-y-8">
        {loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{loadError}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Projetos ativos"
            value={stats.totalProjects}
            hint="Workspaces e iniciativas em acompanhamento"
            icon={Briefcase}
            color="#102a72"
            bg="#102a7215"
          />
          <StatCard
            label="Tasks abertas"
            value={stats.activeTasks}
            hint={`${stats.totalTasks} tasks no total`}
            icon={Clock3}
            color="#7c3aed"
            bg="#7c3aed15"
            delay={0.05}
          />
          <StatCard
            label="Tasks concluidas"
            value={stats.completedTasks}
            hint="Historias que ja passaram por todas as etapas"
            icon={CheckCircle2}
            color="#059669"
            bg="#05966915"
            delay={0.1}
          />
          <StatCard
            label="Runs com falha"
            value={stats.failedRuns}
            hint={`${stats.runningRuns} execucoes em andamento agora`}
            icon={AlertCircle}
            color="#dc2626"
            bg="#dc262615"
            delay={0.15}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <motion.section
            {...fade(0.2)}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Operacao de IA</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Execucoes recentes</h2>
                  <p className="mt-1 text-sm text-slate-500">Dados reais da plataforma, sem feed mockado.</p>
                </div>
                <button
                  onClick={() => navigate('/code-studio')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-white"
                >
                  <Cpu className="h-4 w-4" strokeWidth={2} />
                  Abrir Codigo
                </button>
              </div>
            </div>
            <div className="space-y-3 p-6">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  Carregando execucoes...
                </div>
              ) : recentRuns.length ? (
                recentRuns.slice(0, 6).map((run, index) => <RunRow key={run.uuid} run={run} delay={0.24 + index * 0.04} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  Nenhuma execucao recente encontrada para este usuario.
                </div>
              )}
            </div>
          </motion.section>

          <div className="space-y-6">
            <motion.section
              {...fade(0.25)}
              className="rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-900">Acoes rapidas</h2>
                <p className="mt-1 text-xs text-slate-500">Entradas principais do produto</p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {TOOL_LINKS.map((tool, index) => (
                  <QuickAction
                    key={tool.label}
                    label={tool.label}
                    description={
                      tool.label === 'Projetos'
                        ? 'Criar, revisar e governar iniciativas'
                        : tool.label === 'Backlog'
                          ? 'Operar historias e progresso'
                          : tool.label === 'Codigo'
                            ? 'Gerar e validar a aplicacao'
                            : 'Configurar providers e fallback'
                    }
                    icon={tool.icon}
                    to={tool.to}
                    navigate={navigate}
                    delay={0.28 + index * 0.04}
                  />
                ))}
              </div>
            </motion.section>

            <motion.section
              {...fade(0.3)}
              className={`rounded-3xl border px-5 py-5 shadow-sm ${
                healthySystem ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    healthySystem ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <ShieldCheck className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${healthySystem ? 'text-emerald-900' : 'text-amber-900'}`}>
                    {healthySystem ? 'Plataforma saudavel' : 'Atencao operacional'}
                  </p>
                  <p className={`mt-1 text-xs leading-5 ${healthySystem ? 'text-emerald-700' : 'text-amber-700'}`}>
                    Banco: {health?.database || 'desconhecido'} · Ambiente: {health?.environment || 'desconhecido'} · Uptime:{' '}
                    {health?.uptimeSeconds != null ? `${health.uptimeSeconds}s` : 'n/d'}
                  </p>
                </div>
              </div>
            </motion.section>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
          <motion.section {...fade(0.34)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Pipeline</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Saude da operacao</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Runs totais</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{operations?.summary?.totalRuns || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Falhas recentes</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{operations?.summary?.failedRuns || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tokens estimados</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{operations?.summary?.totalEstimatedTokens || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Custo estimado</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">US$ {(operations?.summary?.totalCostUsd || 0).toFixed(4)}</p>
              </div>
            </div>
          </motion.section>

          <motion.section {...fade(0.38)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Projetos</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Maiores workspaces</h2>
            </div>
            <div className="space-y-3 p-6">
              {topProjects.length ? (
                topProjects.map((project, index) => (
                  <motion.button
                    key={project.uuid}
                    {...fade(0.4 + index * 0.04)}
                    onClick={() => navigate(`/projects/${project.uuid}`)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-all hover:border-slate-300 hover:bg-white"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{project.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{project._count?.tasks || 0} tasks registradas</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
                  </motion.button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  Nenhum projeto criado ainda.
                </div>
              )}
            </div>
          </motion.section>

          <motion.section {...fade(0.42)} className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Alertas</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Pontos de atencao</h2>
            </div>
            <div className="space-y-3 p-6">
              {alerts.length ? (
                alerts.map((alert, index) => (
                  <motion.div
                    key={alert.code}
                    {...fade(0.46 + index * 0.04)}
                    className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <AlertCircle className="h-4 w-4" strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-900">{alert.code.replace(/_/g, ' ')}</p>
                        <p className="mt-1 text-xs leading-5 text-amber-700">{alert.message}</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-sm text-emerald-800">
                  Nenhum alerta relevante agora. A operacao esta estavel.
                </div>
              )}
            </div>
          </motion.section>
        </div>

        <motion.section
          {...fade(0.5)}
          className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-[#0A1128] via-[#102a72] to-[#173fa6] text-white shadow-xl"
        >
          <div className="grid gap-6 px-8 py-8 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-200/80">Factory Maturity</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Sua plataforma ja opera como uma fabrica real de software assistida por IA.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-blue-100/90">
                O proximo salto nao e adicionar mais telas: e continuar endurecendo qualidade, confiabilidade e governanca
                da geracao. Hoje voce ja tem backlog, requisitos, QA, arquitetura, codigo e observabilidade em uma mesma esteira.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { label: 'Arquitetura + codigo', value: 'ativo', icon: Sparkles },
                { label: 'Observabilidade', value: operations?.summary?.totalRuns || 0, icon: Activity },
                { label: 'Beta v1.0', value: 'pronto', icon: ShieldCheck },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-blue-100">
                    <item.icon className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-blue-100/70">{item.label}</p>
                  <p className="mt-1 text-2xl font-bold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      </div>
    </AppShell>
  );
}
