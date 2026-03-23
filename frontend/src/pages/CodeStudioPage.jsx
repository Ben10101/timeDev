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
  getApiErrorMessage,
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

function StatusBadge({ value }) {
  const tone =
    value === 'integrated'
      ? 'bg-emerald-50 text-emerald-700'
      : value === 'failed'
        ? 'bg-rose-50 text-rose-700'
        : value === 'in_progress'
          ? 'bg-blue-50 text-[#102a72]'
          : 'bg-slate-100 text-slate-600';

  return <span className={`dashboard-badge ${tone}`}>{value || 'não iniciado'}</span>;
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

      const preferredExists = selectedProjectUuid
        ? nextProjects.some((project) => project.uuid === selectedProjectUuid)
        : false;
      const fallbackProjectUuid = preferredExists ? selectedProjectUuid : nextProjects[0]?.uuid || null;
      if (fallbackProjectUuid && fallbackProjectUuid !== selectedProjectUuid) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('project', fallbackProjectUuid);
        setSearchParams(nextParams, { replace: true });
      } else {
        setLoading(false);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Não foi possível carregar os projetos.'));
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
      setError(getApiErrorMessage(loadError, 'Não foi possível carregar o estágio técnico do projeto.'));
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
      setError(getApiErrorMessage(runError, 'Não foi possível iniciar a implementação da task.'));
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
        setGenerationProgress('A aplicação já está sincronizada com as tasks prontas.');
      } else {
        setGenerationProgress('Geração da aplicação concluída.');
      }

      await loadProjectWorkspace(selectedProjectUuid);
    } catch (runError) {
      setError(getApiErrorMessage(runError, 'Não foi possível gerar a aplicação do projeto.'));
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
      setCopyFeedback('Não foi possível copiar automaticamente.');
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
      eyebrow="Entrega Tecnica"
      title="Code Studio"
      description="Concentre arquitetura, qualidade, rastreabilidade e geração da aplicação em uma área técnica por projeto."
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
              <p><strong>Implementação:</strong> {architectureStatus?.canGenerateCode ? 'Liberada' : 'Bloqueada'}</p>
              <p><strong>Saude API:</strong> {health?.status || 'n/a'}</p>
              <p><strong>Banco:</strong> {health?.database || 'n/a'}</p>
              <p><strong>Policy version:</strong> {operationsOverview?.recentRuns?.[0]?.runtimeMeta?.policyVersion || 'v1'}</p>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">App base</p>
            </div>
            <div className="space-y-3 p-4 text-sm text-slate-700">
              <p><strong>Status:</strong> {generatedApp?.status || 'Ainda não gerado'}</p>
              <p><strong>Stack:</strong> {generatedApp?.stackPreset || 'Full stack padrao'}</p>
              <p><strong>Local:</strong> {generatedApp?.rootPath || 'Será criado quando a arquitetura ou a implementação rodar.'}</p>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Operação IA</p>
            </div>
            <div className="space-y-3 p-4 text-sm text-slate-700">
              <p><strong>Runs recentes:</strong> {operationsOverview?.summary?.totalRuns || 0}</p>
              <p><strong>Falhas:</strong> {operationsOverview?.summary?.failedRuns || 0}</p>
              <p><strong>Sucesso:</strong> {operationsOverview?.summary?.successRatePercent || 0}%</p>
              <p><strong>P95 duração:</strong> {operationsOverview?.summary?.p95RunDurationSeconds || 0}s</p>
              <p><strong>Tokens:</strong> {operationsOverview?.summary?.totalEstimatedTokens || 0}</p>
              <p><strong>Custo estimado:</strong> {Number(operationsOverview?.summary?.totalCostUsd || 0).toFixed(4)} USD</p>
              <p><strong>Acima do budget:</strong> {operationsOverview?.summary?.overBudgetRuns || 0}</p>
              <p><strong>Runs travados:</strong> {operationsOverview?.summary?.staleRunningRuns || 0}</p>
              <p><strong>Prompt version:</strong> {operationsOverview?.recentRuns?.[0]?.runtimeMeta?.promptVersion || 'v1'}</p>
              <button onClick={() => navigate('/governance')} className="dashboard-button-secondary w-full justify-center">
                <ShieldCheck className="h-4 w-4" />
                Abrir Governanca
              </button>
            </div>
          </section>
        </>
      }
    >
      <div className="space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-8 px-8 py-8 lg:grid-cols-[1.3fr_0.7fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Entrega assistida</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Gere a aplicação com arquitetura, validação e leitura técnica no mesmo lugar.</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                O Code Studio mostra se o projeto está pronto, quantas histórias já foram integradas e quais riscos ainda restam antes de gerar código.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handleGenerateApplication}
                  disabled={isGeneratingApplication || !architectureStatus?.canGenerateCode || !readyTasks.length}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#102a72] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#0c205a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGeneratingApplication ? 'Gerando aplicação...' : 'Gerar aplicação'}
                </button>
                <button
                  onClick={() => selectedProjectUuid && loadProjectWorkspace(selectedProjectUuid)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Arquitetura</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {architectureStatus?.hasArchitecture ? (architectureStatus?.architectureNeedsRefresh ? 'Desatualizada' : 'Pronta') : 'Pendente'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Stories prontas</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{readyTasks.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Integradas</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{integratedTasks.length}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Layers3} label="Projeto" value={selectedProject ? 'selecionado' : 'nenhum'} hint={selectedProject?.name || 'Escolha um workspace'} tone="blue" />
          <MetricCard icon={Braces} label="App base" value={generatedApp?.status || 'pendente'} hint={generatedApp?.rootPath || 'Será materializado na geração'} tone="emerald" />
          <MetricCard icon={Activity} label="Confiabilidade" value={`${operationsOverview?.summary?.successRatePercent || 0}%`} hint={`${operationsOverview?.summary?.failedRuns || 0} falhas recentes`} tone="amber" />
          <MetricCard icon={Cpu} label="P95 / custo" value={`${operationsOverview?.summary?.p95RunDurationSeconds || 0}s`} hint={`US$ ${Number(operationsOverview?.summary?.totalCostUsd || 0).toFixed(4)} · ${operationsOverview?.summary?.totalEstimatedTokens || 0} tokens`} tone="slate" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Leitura técnica</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Prontidao para gerar e integrar</h2>
              </div>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Arquitetura</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {architectureStatus?.hasArchitecture
                    ? architectureStatus?.architectureNeedsRefresh
                      ? 'Desatualizada'
                      : 'Pronta'
                    : 'Pendente'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Historias refinadas</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {architectureStatus?.refinedStories || 0}/{architectureStatus?.totalStories || 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">App base</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{generatedApp?.status || 'Pendente'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Integração</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{architectureStatus?.canGenerateCode ? 'Liberada' : 'Bloqueada'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Confiabilidade</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{operationsOverview?.summary?.successRatePercent || 0}% de sucesso</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pipeline</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  P95 {operationsOverview?.summary?.p95RunDurationSeconds || 0}s · {operationsOverview?.summary?.failedRuns || 0} falhas
                </p>
              </div>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Governanca</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Acesso rapido</h2>
              </div>
            </div>
            <div className="p-6">
              <button onClick={() => navigate('/governance')} className="dashboard-button-primary">
                <ShieldCheck className="h-4 w-4" />
                Abrir Governanca
              </button>
            </div>
          </section>
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
                    <th className="pb-3 pr-4">Duração</th>
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
                <p className="mt-3 text-sm leading-6 text-slate-500">{project.description || 'Sem descrição consolidada.'}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Gate técnico</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Arquitetura e liberação</h2>
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
                  {isGeneratingApplication ? 'Gerando aplicação...' : 'Gerar aplicação'}
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
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Entrega</p>
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
                  Aqui fica o artefato completo gerado pelo agente de arquitetura, com stack, módulos, entidades, contratos e sequência de implementação.
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
                A arquitetura ainda não foi gerada para este projeto.
              </div>
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Implementação por história</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Stories prontas para codigo</h2>
              </div>
              <span className="dashboard-badge bg-slate-100 text-slate-600">{readyTasks.length} tasks prontas</span>
            </div>
          </div>

          <div className="grid gap-4 p-6 xl:grid-cols-2">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Carregando estágio técnico...</div>
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
                        <strong>Último status:</strong> {implementation?.status || 'Não iniciado'}
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <strong>Atualizado:</strong> {formatDate(implementation?.updatedAt)}
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <strong>Score premium:</strong> {implementation?.qualitySummary?.premiumScore ?? implementation?.qualitySummary?.score ?? 'n/a'}
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <strong>Score comparativo:</strong> {implementation?.qualitySummary?.benchmark?.comparativeScore ?? 'n/a'}
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
                        Ver detalhes técnicos
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
                Nenhuma task está pronta para implementação ainda. Finalize requisitos e QA primeiro.
              </div>
            )}
          </div>
        </section>

        {selectedTaskUuid && selectedImplementation && (
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Detalhe técnico</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">{selectedImplementation.task?.title || 'Implementação selecionada'}</h2>
            </div>

            <div className="grid gap-4 p-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumo</p>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <p><strong>Status:</strong> {selectedImplementation.status}</p>
                  <p><strong>Review:</strong> {selectedImplementation.qualitySummary?.reviewStatus || 'n/a'}</p>
                  <p><strong>Specialist review:</strong> {selectedImplementation.qualitySummary?.specialistReviewStatus || 'n/a'}</p>
                  <p><strong>Score:</strong> {selectedImplementation.qualitySummary?.score ?? 'n/a'}</p>
                  <p><strong>Score premium:</strong> {selectedImplementation.qualitySummary?.premiumScore ?? 'n/a'}</p>
                  <p><strong>Score comparativo:</strong> {selectedImplementation.qualitySummary?.benchmark?.comparativeScore ?? 'n/a'}</p>
                  <p><strong>Policy version:</strong> {selectedImplementation.qualitySummary?.versioning?.policyVersion ?? 'v1'}</p>
                  <p><strong>Prompt version:</strong> {selectedImplementation.qualitySummary?.versioning?.promptVersion ?? 'v1'}</p>
                  <p><strong>Release version:</strong> {selectedImplementation.qualitySummary?.versioning?.releaseVersion ?? '1.0.0'}</p>
                  <p><strong>Specialist score:</strong> {selectedImplementation.qualitySummary?.specialistScore ?? 'n/a'}</p>
                  <p><strong>Semântica:</strong> {selectedImplementation.qualitySummary?.semanticScore ?? 'n/a'}</p>
                  <p><strong>UX:</strong> {selectedImplementation.qualitySummary?.uxScore ?? 'n/a'}</p>
                  <p><strong>Arquitetura:</strong> {selectedImplementation.qualitySummary?.specialistArchitectureScore ?? 'n/a'}</p>
                  <p><strong>Validação:</strong> {selectedImplementation.qualitySummary?.validationScore ?? 'n/a'}</p>
                  <p><strong>Build:</strong> {selectedImplementation.buildStatus || 'n/a'}</p>
                  <p><strong>Testes:</strong> {selectedImplementation.testStatus || 'n/a'}</p>
                  <p><strong>Template:</strong> {selectedImplementation.qualitySummary?.screenTemplate || 'n/a'}</p>
                  <p><strong>Dominio esperado:</strong> {selectedImplementation.qualitySummary?.expectedDomain || 'n/a'}</p>
                  <p><strong>Dominio implementado:</strong> {selectedImplementation.qualitySummary?.implementedDomain || 'n/a'}</p>
                  <p><strong>Rastreabilidade:</strong> {selectedImplementation.qualitySummary?.traceability?.traceabilityScore ?? 'n/a'}</p>
                  <p><strong>Sucesso no projeto:</strong> {selectedImplementation.qualitySummary?.benchmark?.projectSuccessRatePercent ?? 'n/a'}%</p>
                  <p><strong>Sucesso no dominio:</strong> {selectedImplementation.qualitySummary?.benchmark?.domainSuccessRatePercent ?? 'n/a'}%</p>
                  <p><strong>Projeto:</strong> {selectedImplementation.generatedApp?.name || 'App full stack'}</p>
                  <p><strong>Pasta:</strong> {selectedImplementation.generatedApp?.rootPath || 'Ainda não materializado'}</p>
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
                      Nenhum arquivo registrado ainda para esta implementação.
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
                    <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                      <strong>Frontend:</strong> {selectedImplementation.qualitySummary.traceability?.hasFrontendPage ? 'ok' : 'pendente'}
                    </div>
                    <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                      <strong>Contrato/docs:</strong> {selectedImplementation.qualitySummary.traceability?.hasSharedContract && selectedImplementation.qualitySummary.traceability?.hasDocumentation ? 'ok' : 'pendente'}
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

