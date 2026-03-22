import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  Braces,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FolderGit2,
  Hammer,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  bootstrapGeneratedApp,
  getAiOperationsOverview,
  getGeneratedApp,
  getOperationalHealth,
  getProjectArchitectureStatus,
  getTaskImplementationStatus,
  listProjects,
  listProjectTasks,
  runTaskImplementation,
} from '../services/api';

function formatDate(value) {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleString('pt-BR');
}

function MetricCard({ label, value, hint, icon: Icon, tone = 'slate' }) {
  const tones = {
    blue: 'bg-blue-50 text-[#102a72] border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
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

function DetailCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function StatusBadge({ value }) {
  const tone =
    value === 'integrated'
      ? 'bg-emerald-50 text-emerald-700'
      : value === 'failed'
        ? 'bg-rose-50 text-rose-700'
        : value === 'in_progress'
          ? 'bg-blue-50 text-[#102a72]'
          : 'bg-slate-100 text-slate-600';

  return <span className={`dashboard-badge ${tone}`}>{value || 'nao iniciado'}</span>;
}

function ScoreBadge({ value }) {
  const numeric = Number(value);
  const tone = numeric >= 90 ? 'bg-emerald-50 text-emerald-700' : numeric >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';
  return <span className={`dashboard-badge ${tone}`}>{Number.isFinite(numeric) ? `${numeric}/100` : 'sem score'}</span>;
}

function downloadMarkdownFile(filename, content) {
  const blob = new Blob([content || ''], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function CodeStudioPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [architectureStatus, setArchitectureStatus] = useState(null);
  const [generatedApp, setGeneratedApp] = useState(null);
  const [implementationMap, setImplementationMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [runningTaskUuid, setRunningTaskUuid] = useState(null);
  const [isGeneratingApplication, setIsGeneratingApplication] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [error, setError] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [operationsOverview, setOperationsOverview] = useState(null);
  const [health, setHealth] = useState(null);

  const selectedProjectUuid = searchParams.get('project');
  const selectedTaskUuid = searchParams.get('task');
  const selectedProject = projects.find((project) => project.uuid === selectedProjectUuid) || null;

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectUuid) {
      loadProjectWorkspace(selectedProjectUuid);
    } else {
      setTasks([]);
      setArchitectureStatus(null);
      setGeneratedApp(null);
      setImplementationMap({});
      setLoading(false);
    }
  }, [selectedProjectUuid]);

  async function loadProjects() {
    setLoading(true);
    setError(null);

    try {
      const nextProjects = await listProjects();
      setProjects(nextProjects);

      const fallbackProjectUuid = selectedProjectUuid || nextProjects[0]?.uuid || null;
      if (fallbackProjectUuid && fallbackProjectUuid !== selectedProjectUuid) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('project', fallbackProjectUuid);
        setSearchParams(nextParams, { replace: true });
      } else {
        setLoading(false);
      }
    } catch (loadError) {
      setError(loadError.response?.data?.message || loadError.message || 'Nao foi possivel carregar os projetos.');
      setLoading(false);
    }
  }

  async function loadProjectWorkspace(projectUuid) {
    setLoading(true);
    setError(null);

    try {
      const [taskList, nextArchitectureStatus] = await Promise.all([
        listProjectTasks(projectUuid),
        getProjectArchitectureStatus(projectUuid),
      ]);

      setTasks(taskList);
      setArchitectureStatus(nextArchitectureStatus);

      const [nextOverview, nextHealth] = await Promise.all([
        getAiOperationsOverview({ projectUuid }),
        getOperationalHealth().catch(() => null),
      ]);
      setOperationsOverview(nextOverview);
      setHealth(nextHealth);

      try {
        const app = await getGeneratedApp(projectUuid);
        setGeneratedApp(app);
      } catch (appError) {
        if (appError.response?.status === 404) {
          setGeneratedApp(null);
        } else {
          throw appError;
        }
      }

      const doneTasks = taskList.filter((task) => task.status === 'done');
      const implementationEntries = await Promise.all(
        doneTasks.map(async (task) => {
          try {
            const implementation = await getTaskImplementationStatus(task.uuid);
            return [task.uuid, implementation];
          } catch (statusError) {
            if (statusError.response?.status === 404) {
              return [task.uuid, null];
            }
            throw statusError;
          }
        })
      );

      setImplementationMap(Object.fromEntries(implementationEntries));
    } catch (loadError) {
      setError(
        loadError.response?.data?.message ||
          loadError.message ||
          'Nao foi possivel carregar o estagio tecnico do projeto.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRunImplementation(taskUuid) {
    if (!selectedProjectUuid) return;

    setRunningTaskUuid(taskUuid);
    setError(null);

    try {
      await bootstrapGeneratedApp(selectedProjectUuid);
      await runTaskImplementation(taskUuid);
      await loadProjectWorkspace(selectedProjectUuid);
    } catch (runError) {
      setError(
        runError.response?.data?.message ||
          runError.message ||
          'Nao foi possivel iniciar a implementacao da task.'
      );
    } finally {
      setRunningTaskUuid(null);
    }
  }

  async function handleGenerateApplication() {
    if (!selectedProjectUuid || !readyTasks.length) return;

    setIsGeneratingApplication(true);
    setGenerationProgress('');
    setError(null);

    try {
      await bootstrapGeneratedApp(selectedProjectUuid);

      const tasksToRun = readyTasks.filter((task) => {
        const implementation = implementationMap[task.uuid];
        return implementation?.status !== 'integrated';
      });

      for (const [index, task] of tasksToRun.entries()) {
        setRunningTaskUuid(task.uuid);
        setGenerationProgress(`Implementando ${index + 1}/${tasksToRun.length}: ${task.title}`);
        await runTaskImplementation(task.uuid);
      }

      if (!tasksToRun.length) {
        setGenerationProgress('A aplicacao ja esta sincronizada com as tasks prontas.');
      } else {
        setGenerationProgress('Geracao da aplicacao concluida.');
      }

      await loadProjectWorkspace(selectedProjectUuid);
    } catch (runError) {
      setError(
        runError.response?.data?.message ||
          runError.message ||
          'Nao foi possivel gerar a aplicacao do projeto.'
      );
    } finally {
      setRunningTaskUuid(null);
      setIsGeneratingApplication(false);
    }
  }

  async function handleCopyArchitecture() {
    if (!architectureStatus?.architectureArtifact?.content) return;

    try {
      await navigator.clipboard.writeText(architectureStatus.architectureArtifact.content);
      setCopyFeedback('Arquitetura copiada.');
      window.setTimeout(() => setCopyFeedback(''), 2500);
    } catch (_error) {
      setCopyFeedback('Nao foi possivel copiar automaticamente.');
      window.setTimeout(() => setCopyFeedback(''), 2500);
    }
  }

  const readyTasks = useMemo(() => tasks.filter((task) => task.status === 'done'), [tasks]);
  const integratedTasks = useMemo(
    () => readyTasks.filter((task) => implementationMap[task.uuid]?.status === 'integrated'),
    [readyTasks, implementationMap]
  );
  const selectedImplementation = selectedTaskUuid ? implementationMap[selectedTaskUuid] : null;

  return (
    <AppShell
      eyebrow="Estudio de Codigo"
      title="Code Studio"
      description="Cockpit tecnico da plataforma: prontidao, arquitetura, qualidade, geracao e observabilidade em uma experiencia unica."
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <button onClick={() => selectedProjectUuid && loadProjectWorkspace(selectedProjectUuid)} className="dashboard-button-secondary">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button onClick={() => navigate('/projects')} className="dashboard-button-primary">
            Voltar ao board
          </button>
        </div>
      }
      sidebar={
        <>
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Prontidao</p>
            </div>
            <div className="space-y-3 p-4 text-sm text-slate-700">
              <p><strong>Projeto:</strong> {selectedProject?.name || 'Selecione um projeto'}</p>
              <p><strong>Historias refinadas:</strong> {architectureStatus?.refinedStories || 0}/{architectureStatus?.totalStories || 0}</p>
              <p><strong>Arquitetura:</strong> {architectureStatus?.hasArchitecture ? (architectureStatus?.architectureNeedsRefresh ? 'Desatualizada' : 'Pronta') : 'Pendente'}</p>
              <p><strong>Implementacao:</strong> {architectureStatus?.canGenerateCode ? 'Liberada' : 'Bloqueada'}</p>
              <p><strong>Saude API:</strong> {health?.status || 'n/a'}</p>
              <p><strong>Banco:</strong> {health?.database || 'n/a'}</p>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">App base</p>
            </div>
            <div className="space-y-3 p-4 text-sm text-slate-700">
              <p><strong>Status:</strong> {generatedApp?.status || 'Ainda nao gerado'}</p>
              <p><strong>Stack:</strong> {generatedApp?.stackPreset || 'Full stack padrao'}</p>
              <p><strong>Local:</strong> {generatedApp?.rootPath || 'Sera criado quando a arquitetura ou a implementacao rodar.'}</p>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Operacao IA</p>
            </div>
            <div className="space-y-3 p-4 text-sm text-slate-700">
              <p><strong>Runs recentes:</strong> {operationsOverview?.summary?.totalRuns || 0}</p>
              <p><strong>Falhas:</strong> {operationsOverview?.summary?.failedRuns || 0}</p>
              <p><strong>Tokens:</strong> {operationsOverview?.summary?.totalEstimatedTokens || 0}</p>
              <p><strong>Custo estimado:</strong> {Number(operationsOverview?.summary?.totalCostUsd || 0).toFixed(4)} USD</p>
              <p><strong>Acima do budget:</strong> {operationsOverview?.summary?.overBudgetRuns || 0}</p>
              {(operationsOverview?.alerts || []).slice(0, 2).map((alert) => (
                <div key={alert.code} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  {alert.message}
                </div>
              ))}
            </div>
          </section>
        </>
      }
    >
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-slate-800 bg-[#0A1128] text-white shadow-xl">
          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-200/90">Entrega assistida por IA</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Gere a aplicacao com arquitetura, validacao e leitura operacional no mesmo lugar.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
                O Code Studio agora funciona como cockpit tecnico: mostra se o projeto esta pronto, quantas historias ja foram integradas e quais riscos ainda restam antes de gerar codigo.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handleGenerateApplication}
                  disabled={isGeneratingApplication || !architectureStatus?.canGenerateCode || !readyTasks.length}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#102a72] transition-all hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGeneratingApplication ? 'Gerando aplicacao...' : 'Gerar aplicacao'}
                </button>
                <button
                  onClick={() => selectedProjectUuid && loadProjectWorkspace(selectedProjectUuid)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/15"
                >
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-4 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100/85">Arquitetura</p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {architectureStatus?.hasArchitecture ? (architectureStatus?.architectureNeedsRefresh ? 'Desatualizada' : 'Pronta') : 'Pendente'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-4 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100/85">Stories prontas</p>
                <p className="mt-2 text-2xl font-bold text-white">{readyTasks.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/55 p-4 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-100/85">Integradas</p>
                <p className="mt-2 text-2xl font-bold text-white">{integratedTasks.length}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Layers3} label="Projeto" value={selectedProject ? 'selecionado' : 'nenhum'} hint={selectedProject?.name || 'Escolha um workspace'} tone="blue" />
          <MetricCard icon={Braces} label="App base" value={generatedApp?.status || 'pendente'} hint={generatedApp?.rootPath || 'Sera materializado na geracao'} tone="emerald" />
          <MetricCard icon={Activity} label="Runs IA" value={operationsOverview?.summary?.totalRuns || 0} hint={`${operationsOverview?.summary?.failedRuns || 0} falhas recentes`} tone="amber" />
          <MetricCard icon={Cpu} label="Custo estimado" value={`US$ ${Number(operationsOverview?.summary?.totalCostUsd || 0).toFixed(4)}`} hint={`${operationsOverview?.summary?.totalEstimatedTokens || 0} tokens`} tone="slate" />
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {generationProgress && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-[#102a72]">{generationProgress}</div>
        )}

        {operationsOverview?.recentRuns?.length ? (
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Observabilidade</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Execucoes recentes de IA</h2>
              </div>
            </div>

            <div className="overflow-x-auto p-6">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-3 pr-4">Agente</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Provider</th>
                    <th className="pb-3 pr-4">Tokens</th>
                    <th className="pb-3 pr-4">Duracao</th>
                    <th className="pb-3 pr-4">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {operationsOverview.recentRuns.slice(0, 8).map((run) => (
                    <tr key={run.uuid} className="border-t border-slate-100">
                      <td className="py-3 pr-4">{run.agentName}</td>
                      <td className="py-3 pr-4"><StatusBadge value={run.status} /></td>
                      <td className="py-3 pr-4">{run.runtimeMeta?.primaryProvider || '-'}</td>
                      <td className="py-3 pr-4">{run.totalTokens || 0}</td>
                      <td className="py-3 pr-4">{run.durationSeconds != null ? `${run.durationSeconds}s` : '-'}</td>
                      <td className="py-3 pr-4">{run.overBudget ? 'acima' : 'ok'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Projetos</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Escolha onde gerar codigo</h2>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <button
                key={project.uuid}
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set('project', project.uuid);
                  nextParams.delete('task');
                  setSearchParams(nextParams);
                }}
                className={`rounded-xl border p-5 text-left transition ${
                  project.uuid === selectedProjectUuid
                    ? 'border-[#102a72]/30 bg-[#102a72]/5'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900">{project.name}</h3>
                  <FolderGit2 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">{project.description || 'Sem descricao consolidada.'}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Gate tecnico</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Arquitetura e liberacao</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <StatusBadge value={architectureStatus?.canGenerateCode ? 'integrated' : 'planned'} />
                <button
                  onClick={handleGenerateApplication}
                  disabled={isGeneratingApplication || !architectureStatus?.canGenerateCode || !readyTasks.length}
                  className="dashboard-button-primary"
                  title={!architectureStatus?.canGenerateCode ? architectureStatus?.blockers?.[0] : undefined}
                >
                  <Sparkles className="h-4 w-4" />
                  {isGeneratingApplication ? 'Gerando aplicacao...' : 'Gerar aplicacao'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#102a72]">
                  <Braces className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Arquitetura</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {architectureStatus?.hasArchitecture
                      ? architectureStatus?.architectureNeedsRefresh
                        ? 'Desatualizada'
                        : 'Pronta'
                      : 'Pendente'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#102a72]">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Historias prontas</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{readyTasks.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#102a72]">
                  <Hammer className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Codigo</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{architectureStatus?.canGenerateCode ? 'Liberado' : 'Bloqueado'}</p>
                </div>
              </div>
            </div>
          </div>

          {!!architectureStatus?.blockers?.length && (
            <div className="px-6 pb-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {architectureStatus.blockers[0]}
              </div>
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Arquitetura gerada</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Documento mestre do projeto</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Aqui fica o artefato completo gerado pelo agente de arquitetura, com stack, modulos, entidades, contratos e sequencia de implementacao.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={handleCopyArchitecture}
                  disabled={!architectureStatus?.architectureArtifact?.content}
                  className="dashboard-button-secondary"
                >
                  <Copy className="h-4 w-4" />
                  Copiar
                </button>
                <button
                  onClick={() =>
                    downloadMarkdownFile(
                      `${selectedProject?.name || 'projeto'}-arquitetura.md`,
                      architectureStatus?.architectureArtifact?.content || ''
                    )
                  }
                  disabled={!architectureStatus?.architectureArtifact?.content}
                  className="dashboard-button-primary"
                >
                  <Download className="h-4 w-4" />
                  Exportar markdown
                </button>
              </div>
            </div>
          </div>

          {architectureStatus?.architectureArtifact ? (
            <div className="space-y-4 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Titulo</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{architectureStatus.architectureArtifact.title}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Versao</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">v{architectureStatus.architectureArtifact.version}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Gerado em</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(architectureStatus.architectureArtifact.createdAt)}</p>
                </div>
              </div>

              {copyFeedback && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  {copyFeedback}
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-950 p-1">
                <pre className="max-h-[780px] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-5 text-sm leading-7 text-slate-100">
                  {architectureStatus.architectureArtifact.content}
                </pre>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                A arquitetura ainda nao foi gerada para este projeto.
              </div>
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Implementacao por historia</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Stories prontas para codigo</h2>
              </div>
              <span className="dashboard-badge bg-slate-100 text-slate-600">{readyTasks.length} tasks prontas</span>
            </div>
          </div>

          <div className="grid gap-4 p-6 xl:grid-cols-2">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Carregando estagio tecnico...</div>
            ) : readyTasks.length ? (
              readyTasks.map((task) => {
                const implementation = implementationMap[task.uuid] || null;
                const isSelected = selectedTaskUuid === task.uuid;

                return (
                  <div
                    key={task.uuid}
                    className={`rounded-xl border p-5 transition ${
                      isSelected ? 'border-[#102a72]/30 bg-[#102a72]/5' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900">{task.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{task.description || 'Sem contexto adicional.'}</p>
                      </div>
                      <StatusBadge value={implementation?.status} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <strong>Ultimo status:</strong> {implementation?.status || 'Nao iniciado'}
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <strong>Atualizado:</strong> {formatDate(implementation?.updatedAt)}
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <strong>Score de qualidade:</strong> {implementation?.qualitySummary?.score ?? 'n/a'}
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <strong>Template:</strong> {implementation?.qualitySummary?.screenTemplate || 'n/a'}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => {
                          const nextParams = new URLSearchParams(searchParams);
                          nextParams.set('project', selectedProjectUuid);
                          nextParams.set('task', task.uuid);
                          setSearchParams(nextParams);
                        }}
                        className="dashboard-button-secondary"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Ver detalhes tecnicos
                      </button>
                      <button
                        onClick={() => navigate(`/projects/${selectedProjectUuid}/tasks/${task.uuid}`)}
                        className="dashboard-button-secondary"
                      >
                        Abrir task
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                Nenhuma task esta pronta para implementacao ainda. Finalize requisitos e QA primeiro.
              </div>
            )}
          </div>
        </section>

        {selectedTaskUuid && selectedImplementation && (
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Detalhe tecnico</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{selectedImplementation.task?.title || 'Implementacao selecionada'}</h2>
            </div>

            <div className="grid gap-4 p-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumo</p>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <p><strong>Status:</strong> {selectedImplementation.status}</p>
                  <p><strong>Review:</strong> {selectedImplementation.qualitySummary?.reviewStatus || 'n/a'}</p>
                  <p><strong>Specialist review:</strong> {selectedImplementation.qualitySummary?.specialistReviewStatus || 'n/a'}</p>
                  <p><strong>Score:</strong> {selectedImplementation.qualitySummary?.score ?? 'n/a'}</p>
                  <p><strong>Specialist score:</strong> {selectedImplementation.qualitySummary?.specialistScore ?? 'n/a'}</p>
                  <p><strong>UX:</strong> {selectedImplementation.qualitySummary?.uxScore ?? 'n/a'}</p>
                  <p><strong>Arquitetura:</strong> {selectedImplementation.qualitySummary?.specialistArchitectureScore ?? 'n/a'}</p>
                  <p><strong>Validacao:</strong> {selectedImplementation.qualitySummary?.validationScore ?? 'n/a'}</p>
                  <p><strong>Build:</strong> {selectedImplementation.buildStatus || 'n/a'}</p>
                  <p><strong>Testes:</strong> {selectedImplementation.testStatus || 'n/a'}</p>
                  <p><strong>Template:</strong> {selectedImplementation.qualitySummary?.screenTemplate || 'n/a'}</p>
                  <p><strong>Projeto:</strong> {selectedImplementation.generatedApp?.name || 'App full stack'}</p>
                  <p><strong>Pasta:</strong> {selectedImplementation.generatedApp?.rootPath || 'Ainda nao materializado'}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Arquivos gerados</p>
                  <ScoreBadge value={selectedImplementation.qualitySummary?.score} />
                </div>
                <div className="mt-4 space-y-2">
                  {(selectedImplementation.generatedFiles || []).slice(0, 8).map((file) => (
                    <div key={file.id} className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
                      {file.filePath}
                    </div>
                  ))}
                  {!selectedImplementation.generatedFiles?.length && (
                    <div className="rounded-lg bg-white px-3 py-4 text-sm text-slate-500">
                      Nenhum arquivo registrado ainda para esta implementacao.
                    </div>
                  )}
                </div>
                {selectedImplementation.qualitySummary && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                      <strong>Findings:</strong> {selectedImplementation.qualitySummary.totalFindings}
                    </div>
                    <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                      <strong>Altas:</strong> {selectedImplementation.qualitySummary.findingsBySeverity?.high || 0}
                    </div>
                    <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                      <strong>Medias:</strong> {selectedImplementation.qualitySummary.findingsBySeverity?.medium || 0}
                    </div>
                    <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                      <strong>Baixas:</strong> {selectedImplementation.qualitySummary.findingsBySeverity?.low || 0}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

