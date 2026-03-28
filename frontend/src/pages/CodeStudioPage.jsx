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
  Search,
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
  planTaskImplementation,
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
      {hint ?<p className="mt-2 text-sm leading-6 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ value }) {
  const tone =
    value === 'integrated'
      ?'bg-emerald-50 text-emerald-700'
      : value === 'failed'
        ?'bg-rose-50 text-rose-700'
        : value === 'in_progress'
          ?'bg-blue-50 text-[#102a72]'
          : 'bg-slate-100 text-slate-600';

  return <span className={`dashboard-badge ${tone}`}>{value || 'não iniciado'}</span>;
}

function ScoreBadge({ value }) {
  const numeric = Number(value);
  const tone = numeric >= 90 ?'bg-emerald-50 text-emerald-700' : numeric >= 75 ?'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';
  return <span className={`dashboard-badge ${tone}`}>{Number.isFinite(numeric) ?`${numeric}/100` : 'sem score'}</span>;
}

function RiskBadge({ value }) {
  const normalized = String(value || 'unknown');
  const tone =
    normalized === 'high'
      ?'bg-rose-50 text-rose-700'
      : normalized === 'medium'
        ?'bg-amber-50 text-amber-700'
        : normalized === 'low'
          ?'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-600';

  const label =
    normalized === 'high'
      ?'risco alto'
      : normalized === 'medium'
        ?'risco medio'
        : normalized === 'low'
          ?'risco baixo'
          : 'risco n/a';

  return <span className={`dashboard-badge ${tone}`}>{label}</span>;
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

function parseJsonContent(content) {
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getArchitectureStateLabel(architectureStatus) {
  if (!architectureStatus?.hasArchitecture) return 'Pendente';
  if (architectureStatus?.architectureNeedsRefresh) return 'Desatualizada';
  if (architectureStatus?.architectureApproved) return 'Aprovada';
  return 'Pendente de aprovação';
}

function getCodeStudioNextStep({ selectedProject, architectureStatus, readyTasks, plannedTasks, integratedTasks, generatedApp }) {
  if (!selectedProject) {
    return {
      title: 'Escolha um projeto para abrir o handoff técnico',
      message: 'Selecione um projeto na lista para ver arquitetura, stories prontas, geração da aplicação e detalhes de implementação.',
      tone: 'slate',
    };
  }

  if (!architectureStatus?.hasArchitecture) {
    return {
      title: 'A arquitetura ainda não foi gerada',
      message: 'Finalize o refinamento das histórias e gere a arquitetura antes de iniciar a aplicação base.',
      tone: 'amber',
    };
  }

  if (architectureStatus?.architectureNeedsRefresh) {
    return {
      title: 'A arquitetura precisa ser atualizada',
      message: 'Novos refinamentos deixaram o desenho técnico desatualizado. Regere a arquitetura antes de continuar.',
      tone: 'amber',
    };
  }

  if (!architectureStatus?.architectureApproved) {
    return {
      title: 'Falta aprovação humana da arquitetura',
      message: 'A implementação continua bloqueada até que a arquitetura atual seja revisada e aprovada.',
      tone: 'amber',
    };
  }

  if (!readyTasks.length) {
    return {
      title: 'Ainda não existem stories prontas para código',
      message: 'Conclua requisitos e QA das histórias que destravam a implementação antes de gerar a aplicação.',
      tone: 'blue',
    };
  }

  if (!generatedApp?.rootPath) {
    return {
      title: 'A aplicação base está pronta para nascer',
      message: 'O projeto já pode materializar a estrutura técnica e começar a integrar as stories concluídas.',
      tone: 'blue',
    };
  }

  if (plannedTasks.length < readyTasks.length) {
    return {
      title: 'Existem stories prontas aguardando plano técnico',
      message: `${readyTasks.length - plannedTasks.length} histórias ainda podem ganhar technical spec e plano antes da integração.`,
      tone: 'blue',
    };
  }

  if (integratedTasks.length < readyTasks.length) {
    return {
      title: 'Existem stories prontas aguardando integração',
      message: `${readyTasks.length - integratedTasks.length} histórias já podem seguir para implementação técnica.`,
      tone: 'blue',
    };
  }

  return {
    title: 'A entrega técnica está sincronizada',
    message: 'Arquitetura aprovada, aplicação base disponível e stories prontas já integradas.',
    tone: 'emerald',
  };
}

function normalizePlanningText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getImplementationOrder(task, implementation) {
  const source = normalizePlanningText(`${task?.title || ''} ${task?.description || ''}`);
  const rules = [
    {
      stage: 'Fundação',
      rank: 1,
      reason: 'Cria base de acesso, identidade ou configuração central para outras jornadas.',
      keywords: ['login', 'autentic', 'cadastro', 'conta', 'perfil', 'permiss', 'usuario', 'workspace', 'organiz'],
    },
    {
      stage: 'Modelo e dados',
      rank: 2,
      reason: 'Define entidades, disponibilidade, cadastros centrais ou estrutura principal do domínio.',
      keywords: ['paciente', 'cliente', 'medico', 'profissional', 'agenda', 'disponibilidade', 'categoria', 'centro de custo', 'registro', 'cadastro de', 'configur'],
    },
    {
      stage: 'Fluxo principal',
      rank: 3,
      reason: 'Entrega a jornada principal do produto e costuma destravar valor direto para o usuário.',
      keywords: ['agendar', 'abrir chamado', 'abrir', 'solicitar', 'criar', 'remarcar', 'cancelar', 'enviar', 'registrar atendimento', 'checkout', 'matricula'],
    },
    {
      stage: 'Operação e suporte',
      rank: 4,
      reason: 'Melhora acompanhamento, comunicação, filtros, histórico e eficiência operacional.',
      keywords: ['historico', 'comentario', 'filtro', 'buscar', 'busca', 'lembrete', 'notific', 'status', 'acompanhar', 'painel', 'fila'],
    },
    {
      stage: 'Expansão e gestão',
      rank: 5,
      reason: 'Amplia governança, análise, relatórios e funções administrativas depois do fluxo base.',
      keywords: ['relatorio', 'dashboard', 'metric', 'governanÃ§a', 'auditoria', 'sla', 'admin', 'finance', 'exportar'],
    },
  ];

  const matchedRule =
    rules.find((rule) => rule.keywords.some((keyword) => source.includes(keyword))) ||
    rules[2];

  const hasPlan = Boolean(implementation?.technicalSpecArtifact || implementation?.implementationPlanArtifact);
  const statusWeight =
    implementation?.status === 'integrated'
      ?50
      : implementation?.status === 'in_progress'
        ?40
        : implementation?.status === 'planned'
          ?30
          : hasPlan
            ?20
            : 0;

  return {
    stage: matchedRule.stage,
    rank: matchedRule.rank,
    reason: matchedRule.reason,
    sortKey: matchedRule.rank * 100 + statusWeight,
    hasPlan,
  };
}

function getImplementationPrecedence(entries) {
  return entries.map((entry, index) => {
    const blockers = entries
      .slice(0, index)
      .filter((candidate) => candidate.order.rank < entry.order.rank)
      .filter((candidate) => candidate.implementation?.status !== 'integrated')
      .slice(0, 3)
      .map((candidate) => ({
        uuid: candidate.task.uuid,
        title: candidate.task.title,
        stage: candidate.order.stage,
        status: candidate.implementation?.status || 'não iniciado',
      }));

    const unlocks = entries
      .slice(index + 1)
      .filter((candidate) => candidate.order.rank > entry.order.rank).length;

    return {
      ...entry,
      blockers,
      unlocks,
      canStartNow: blockers.length === 0,
    };
  });
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
  const [planningTaskUuid, setPlanningTaskUuid] = useState(null);
  const [isGeneratingApplication, setIsGeneratingApplication] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [error, setError] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [operationsOverview, setOperationsOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [projectQuery, setProjectQuery] = useState('');
  const [readyTaskQuery, setReadyTaskQuery] = useState('');

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
        ?nextProjects.some((project) => project.uuid === selectedProjectUuid)
        : false;
      const fallbackProjectUuid = preferredExists ?selectedProjectUuid : nextProjects[0]?.uuid || null;
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

  async function handleRunImplementation(taskUuid, forceRefresh = false) {
    if (!selectedProjectUuid) return;

    setRunningTaskUuid(taskUuid);
    setError(null);

    try {
      await bootstrapGeneratedApp(selectedProjectUuid);
      await runTaskImplementation(taskUuid, forceRefresh ? { forceRefresh: true } : {});
      await loadProjectWorkspace(selectedProjectUuid);
    } catch (runError) {
      setError(getApiErrorMessage(runError, 'Não foi possível iniciar a implementação da task.'));
    } finally {
      setRunningTaskUuid(null);
    }
  }

  async function handlePlanImplementation(taskUuid, forceRefresh = false) {
    if (!selectedProjectUuid) return;

    setPlanningTaskUuid(taskUuid);
    setError(null);

    try {
      await bootstrapGeneratedApp(selectedProjectUuid);
      await planTaskImplementation(taskUuid, forceRefresh ? { forceRefresh: true } : {});
      await loadProjectWorkspace(selectedProjectUuid);
    } catch (planError) {
      setError(getApiErrorMessage(planError, 'Não foi possível gerar o plano técnico da task.'));
    } finally {
      setPlanningTaskUuid(null);
    }
  }

  async function handleGenerateApplication() {
    if (!selectedProjectUuid || !readyTasks.length) return;

    setIsGeneratingApplication(true);
    setGenerationProgress('');
    setError(null);

    try {
      await bootstrapGeneratedApp(selectedProjectUuid);

      const tasksToRun = orderedReadyTasks.map(({ task }) => task).filter((task) => {
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
  const orderedReadyTasks = useMemo(
    () =>
      getImplementationPrecedence(
        [...readyTasks]
          .map((task) => ({
            task,
            implementation: implementationMap[task.uuid] || null,
            order: getImplementationOrder(task, implementationMap[task.uuid]),
          }))
          .sort((left, right) => left.order.sortKey - right.order.sortKey || left.task.title.localeCompare(right.task.title))
      ),
    [readyTasks, implementationMap]
  );
  const executionReadyTasks = useMemo(
    () =>
      orderedReadyTasks.filter((entry) => entry.canStartNow && entry.implementation?.status !== 'integrated'),
    [orderedReadyTasks]
  );
  const blockedReadyTasks = useMemo(
    () => orderedReadyTasks.filter((entry) => !entry.canStartNow),
    [orderedReadyTasks]
  );
  const integratedTasks = useMemo(
    () => readyTasks.filter((task) => implementationMap[task.uuid]?.status === 'integrated'),
    [readyTasks, implementationMap]
  );
  const plannedTasks = useMemo(
    () =>
      readyTasks.filter((task) => {
        const implementation = implementationMap[task.uuid];
        return Boolean(implementation?.technicalSpecArtifact || implementation?.implementationPlanArtifact);
      }),
    [readyTasks, implementationMap]
  );
  const selectedImplementation = selectedTaskUuid ?implementationMap[selectedTaskUuid] : null;
  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) =>
      `${project.name} ${project.description || ''}`.toLowerCase().includes(query)
    );
  }, [projectQuery, projects]);
  const filteredReadyTasks = useMemo(() => {
    const query = readyTaskQuery.trim().toLowerCase();
    if (!query) return orderedReadyTasks;
    return orderedReadyTasks.filter(({ task, order }) =>
      `${task.title} ${task.description || ''} ${order.stage} ${order.reason}`.toLowerCase().includes(query)
    );
  }, [readyTaskQuery, orderedReadyTasks]);
  const architectureStateLabel = getArchitectureStateLabel(architectureStatus);
  const selectedImplementationPlan = useMemo(
    () => parseJsonContent(selectedImplementation?.implementationPlanArtifact?.content),
    [selectedImplementation]
  );
  const selectedImpactAnalysis = useMemo(
    () => parseJsonContent(selectedImplementation?.impactArtifact?.content),
    [selectedImplementation]
  );
  const selectedReuseHints =
    selectedImplementationPlan?.reuseGuidance || selectedImpactAnalysis?.reuseHints || null;
  const selectedExecutionState = useMemo(
    () => parseJsonContent(selectedImplementation?.executionStateArtifact?.content),
    [selectedImplementation]
  );
  const selectedDiffReview = useMemo(
    () => parseJsonContent(selectedImplementation?.diffReviewArtifact?.content),
    [selectedImplementation]
  );
  const nextStep = getCodeStudioNextStep({
    selectedProject,
    architectureStatus,
    readyTasks,
    plannedTasks,
    integratedTasks,
    generatedApp,
  });
  const nextStepTone =
    nextStep.tone === 'emerald'
      ?'border-emerald-200 bg-emerald-50 text-emerald-800'
      : nextStep.tone === 'amber'
        ?'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-blue-200 bg-blue-50 text-[#102a72]';

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
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Próximo passo</p>
            </div>
            <div className="space-y-3 p-4 text-sm text-slate-700">
              <p className="text-sm font-semibold text-slate-900">{nextStep.title}</p>
              <p className="leading-6 text-slate-600">{nextStep.message}</p>
              <div className={`rounded-2xl border px-4 py-3 ${nextStepTone}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em]">Estado atual</p>
                <p className="mt-2 text-sm font-semibold">
                  {selectedProject?.name || 'Nenhum projeto selecionado'} · Arquitetura {architectureStateLabel}
                </p>
              </div>
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
              <p><strong>Stories prontas:</strong> {readyTasks.length}</p>
              <p><strong>Prontas para iniciar agora:</strong> {executionReadyTasks.length}</p>
              <p><strong>Com bloqueios sugeridos:</strong> {blockedReadyTasks.length}</p>
              <p><strong>Planos tÃ©cnicos:</strong> {plannedTasks.length}</p>
              <p><strong>Integradas:</strong> {integratedTasks.length}</p>
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
              <p><strong>Saude API:</strong> {health?.status || 'n/a'}</p>
              <p><strong>Banco:</strong> {health?.database || 'n/a'}</p>
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
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Workspace de entrega</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                {selectedProject ?`Code Studio de ${selectedProject.name}` : 'Escolha um projeto para entrar no handoff técnico'}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                Centralize arquitetura, stories prontas, aplicação base e observabilidade técnica em uma área pensada para o momento de implementar.
              </p>
              <div className={`mt-6 rounded-2xl border px-5 py-4 ${nextStepTone}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em]">O que fazer agora</p>
                <p className="mt-2 text-base font-semibold">{nextStep.title}</p>
                <p className="mt-2 text-sm leading-6">{nextStep.message}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={handleGenerateApplication}
                  disabled={isGeneratingApplication || !architectureStatus?.canGenerateCode || !readyTasks.length}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#102a72] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#0c205a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGeneratingApplication ?'Gerando aplicação...' : 'Gerar aplicação'}
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

            <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Arquitetura</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {architectureStateLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Stories prontas</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{readyTasks.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Prontas agora</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{executionReadyTasks.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Com bloqueios</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{blockedReadyTasks.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Integradas</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{integratedTasks.length}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Layers3} label="Projeto ativo" value={selectedProject ?'pronto' : 'pendente'} hint={selectedProject?.name || 'Escolha um projeto para começar'} tone="blue" />
          <MetricCard icon={Braces} label="App base" value={generatedApp?.status || 'pendente'} hint={generatedApp?.rootPath || 'Será materializado na geração'} tone="emerald" />
          <MetricCard icon={CheckCircle2} label="Stories prontas" value={readyTasks.length} hint={`${executionReadyTasks.length} prontas agora · ${integratedTasks.length} integradas`} tone="amber" />
          <MetricCard icon={Cpu} label="Pipeline IA" value={`${operationsOverview?.summary?.p95RunDurationSeconds || 0}s`} hint={`${operationsOverview?.summary?.successRatePercent || 0}% de sucesso · ${operationsOverview?.summary?.failedRuns || 0} falhas`} tone="slate" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Checklist técnico</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">O que já destravou a implementação</h2>
              </div>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Arquitetura</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {architectureStatus?.hasArchitecture
                    ?architectureStatus?.architectureNeedsRefresh
                      ?'Desatualizada'
                      : architectureStatus?.architectureApproved
                        ?'Aprovada'
                        : 'Pendente de aprovação'
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Planos tÃ©cnicos</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{plannedTasks.length}/{readyTasks.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Confiabilidade</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{operationsOverview?.summary?.successRatePercent || 0}% de sucesso</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Integração</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{architectureStatus?.canGenerateCode ?'Liberada' : 'Bloqueada'}</p>
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
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Acesso rápido</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Governança e trilha operacional</h2>
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

        {operationsOverview?.recentRuns?.length ?(
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
                      <td className="py-3 pr-4">{run.durationSeconds != null ?`${run.durationSeconds}s` : '-'}</td>
                      <td className="py-3 pr-4">{run.overBudget ?'acima' : 'ok'}</td>
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
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Escolha o projeto para abrir o Code Studio</h2>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={projectQuery}
                  onChange={(event) => setProjectQuery(event.target.value)}
                  placeholder="Buscar projeto..."
                  className="dashboard-input pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => (
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
                    ?'border-[#102a72]/30 bg-[#102a72]/5'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900">{project.name}</h3>
                  <FolderGit2 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">{project.description || 'Sem descrição consolidada.'}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {project.uuid === selectedProjectUuid ?'Projeto aberto no studio' : 'Clique para abrir o contexto técnico'}
                </p>
              </button>
            ))}
            {!filteredProjects.length && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                Nenhum projeto encontrado com esse termo.
              </div>
            )}
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
                <StatusBadge value={architectureStatus?.canGenerateCode ?'integrated' : 'planned'} />
                <button
                  onClick={handleGenerateApplication}
                  disabled={isGeneratingApplication || !architectureStatus?.canGenerateCode || !readyTasks.length}
                  className="dashboard-button-primary"
                  title={!architectureStatus?.canGenerateCode ?architectureStatus?.blockers?.[0] : undefined}
                >
                  <Sparkles className="h-4 w-4" />
                  {isGeneratingApplication ?'Gerando aplicação...' : 'Gerar aplicação'}
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
                      ?architectureStatus?.architectureNeedsRefresh
                        ?'Desatualizada'
                        : architectureStatus?.architectureApproved
                          ?'Aprovada'
                          : 'Pendente de aprovação'
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
                  <p className="mt-1 text-sm font-semibold text-slate-900">{architectureStatus?.canGenerateCode ?'Liberado' : 'Bloqueado'}</p>
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

          {architectureStatus?.architectureArtifact ?(
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
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Stories prontas para código</h2>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative min-w-[260px]">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={readyTaskQuery}
                    onChange={(event) => setReadyTaskQuery(event.target.value)}
                    placeholder="Buscar story pronta..."
                    className="dashboard-input pl-10"
                  />
                </div>
                <span className="dashboard-badge bg-slate-100 text-slate-600">{readyTasks.length} stories prontas</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 xl:grid-cols-2">
            {loading ?(
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Carregando estágio técnico...</div>
            ) : readyTasks.length ?(
              filteredReadyTasks.map(({ task, order, blockers, unlocks, canStartNow }) => {
                const implementation = implementationMap[task.uuid] || null;
                const isSelected = selectedTaskUuid === task.uuid;
                const hasTechnicalPlan = Boolean(implementation?.technicalSpecArtifact || implementation?.implementationPlanArtifact);

                return (
                  <div
                    key={task.uuid}
                    className={`rounded-xl border p-5 transition ${
                      isSelected ?'border-[#102a72]/30 bg-[#102a72]/5' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span className="dashboard-badge bg-blue-50 text-[#102a72]">
                            Ordem sugerida #{order.rank}
                          </span>
                          <span className="dashboard-badge bg-slate-100 text-slate-700">
                            {order.stage}
                          </span>
                          <span className={`dashboard-badge ${canStartNow ?'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {canStartNow ?'Pronta para iniciar' : 'Aguardando dependências'}
                          </span>
                        </div>
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
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <strong>Plano técnico:</strong> {hasTechnicalPlan ?'Disponível' : 'Pendente'}
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 sm:col-span-2">
                        <strong>Por que agora:</strong> {order.reason}
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <strong>Destrava:</strong> {unlocks} story{unlocks === 1 ?'' : 's'}
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <strong>Bloqueios:</strong> {blockers.length ?`${blockers.length} antes desta` : 'Nenhum'}
                      </div>
                    </div>

                    {!!blockers.length && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <strong>Bloqueada por:</strong>{' '}
                        {blockers.map((blocker) => blocker.title).join(' · ')}
                      </div>
                    )}

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
                        onClick={() => handlePlanImplementation(task.uuid, hasTechnicalPlan)}
                        disabled={planningTaskUuid === task.uuid || runningTaskUuid === task.uuid || !architectureStatus?.canGenerateCode || !canStartNow}
                        className="dashboard-button-secondary"
                        title={
                          !architectureStatus?.canGenerateCode
                            ?architectureStatus?.blockers?.[0]
                            : !canStartNow
                              ?'Finalize as stories que destravam esta implementação antes de planejar.'
                              : 'Gera technical spec, plano de implementação e estratégia antes da integração.'
                        }
                      >
                        <Layers3 className="h-4 w-4" />
                        {planningTaskUuid === task.uuid ?'Planejando...' : hasTechnicalPlan ?'Atualizar plano' : 'Gerar plano técnico'}
                      </button>
                      <button
                        onClick={() => handleRunImplementation(
                          task.uuid,
                          implementation?.status === 'integrated'
                            || implementation?.status === 'failed'
                            || implementation?.status === 'planned'
                        )}
                        disabled={runningTaskUuid === task.uuid || planningTaskUuid === task.uuid || !architectureStatus?.canGenerateCode || !canStartNow}
                        className="dashboard-button-primary"
                        title={
                          !canStartNow
                            ?'A ordem sugerida indica stories anteriores que deveriam entrar antes desta.'
                            : !hasTechnicalPlan
                              ?'Se não existir plano técnico, o studio cria um automaticamente antes da integração.'
                              : undefined
                        }
                      >
                        <Hammer className="h-4 w-4" />
                        {runningTaskUuid === task.uuid
                          ?'Integrando...'
                          : implementation?.status === 'integrated'
                            ?'Regerar integração'
                            : implementation?.status === 'planned'
                              ?'Integrar story'
                              : 'Integrar direto'}
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
            {!loading && readyTasks.length > 0 && !filteredReadyTasks.length && (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500 xl:col-span-2">
                Nenhuma story pronta combina com a busca atual.
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
                  <p><strong>Fase atual:</strong> {selectedExecutionState?.phaseLabel || 'n/a'}</p>
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
                  <p><strong>Risco:</strong> {selectedDiffReview?.summary?.riskLevel || 'n/a'}</p>
                  <p><strong>Build:</strong> {selectedImplementation.buildStatus || 'n/a'}</p>
                  <p><strong>Testes:</strong> {selectedImplementation.testStatus || 'n/a'}</p>
                  <p><strong>Template:</strong> {selectedImplementation.qualitySummary?.screenTemplate || 'n/a'}</p>
                  <p><strong>DomÃ­nio esperado:</strong> {selectedImplementation.qualitySummary?.expectedDomain || 'n/a'}</p>
                  <p><strong>DomÃ­nio implementado:</strong> {selectedImplementation.qualitySummary?.implementedDomain || 'n/a'}</p>
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
                      <strong>MÃ©dias:</strong> {selectedImplementation.qualitySummary.findingsBySeverity?.medium || 0}
                    </div>
                    <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                      <strong>Baixas:</strong> {selectedImplementation.qualitySummary.findingsBySeverity?.low || 0}
                    </div>
                    <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                      <strong>Frontend:</strong> {selectedImplementation.qualitySummary.traceability?.hasFrontendPage ?'ok' : 'pendente'}
                    </div>
                    <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                      <strong>Contrato/docs:</strong> {selectedImplementation.qualitySummary.traceability?.hasSharedContract && selectedImplementation.qualitySummary.traceability?.hasDocumentation ?'ok' : 'pendente'}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {selectedExecutionState && (
              <div className="px-6 pb-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Execução incremental</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{selectedExecutionState.phaseLabel || 'Fase atual'}</p>
                    </div>
                    <span className="dashboard-badge bg-slate-100 text-slate-700">
                      {typeof selectedExecutionState.progressPercent === 'number' ?`${selectedExecutionState.progressPercent}%` : 'sem progresso'}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {selectedExecutionState.headline || 'A execução técnica segue a trilha incremental do studio.'}
                  </p>
                  {!!selectedExecutionState.notes?.length && (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {selectedExecutionState.notes.slice(0, 6).map((note, index) => (
                        <div key={`${selectedExecutionState.phase}-${index}`} className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700">
                          {note}
                        </div>
                      ))}
                    </div>
                  )}
                  {(selectedExecutionState.currentWorkstreams?.length || selectedExecutionState.completedWorkstreams?.length) > 0 && (
                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-lg bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workstreams ativos</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          {(selectedExecutionState.currentWorkstreams || []).map((stream) => (
                            <div key={stream.id}>
                              <strong>{stream.label}</strong>
                              {stream.goal ?<span> · {stream.goal}</span> : null}
                            </div>
                          ))}
                          {!selectedExecutionState.currentWorkstreams?.length && <div>Nenhum workstream ativo nesta fase.</div>}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workstreams concluídos</p>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          {(selectedExecutionState.completedWorkstreams || []).slice(-4).map((stream) => (
                            <div key={`${stream.id}-done`}>
                              <strong>{stream.label}</strong>
                              {stream.goal ?<span> · {stream.goal}</span> : null}
                            </div>
                          ))}
                          {!selectedExecutionState.completedWorkstreams?.length && <div>Nenhum workstream concluído ainda.</div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {selectedReuseHints && (
              <div className="px-6 pb-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Memória e padrão do projeto</p>
                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-lg bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Template preferido</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {selectedReuseHints.preferredScreenTemplate || 'Sem preferência consolidada'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-4 xl:col-span-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Referências do mesmo domínio</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        {(selectedReuseHints.domainReferences || []).slice(0, 3).map((item) => (
                          <div key={`${item.featureKey}-${item.route || 'route'}`} className="rounded-lg border border-slate-200 px-3 py-2">
                            <p className="font-semibold text-slate-900">{item.featureKey}</p>
                            <p className="mt-1 text-slate-600">{item.route || 'Sem rota registrada'} · {item.reason || 'Referência útil'}</p>
                          </div>
                        ))}
                        {!selectedReuseHints.domainReferences?.length && <div>Nenhuma referência forte do mesmo domínio ainda.</div>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-lg bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Referências do mesmo template</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        {(selectedReuseHints.templateReferences || []).slice(0, 3).map((item) => (
                          <div key={`${item.featureKey}-${item.route || 'route'}-template`}>
                            {item.featureKey} · {item.route || 'Sem rota'}
                          </div>
                        ))}
                        {!selectedReuseHints.templateReferences?.length && <div>Nenhuma referência forte do mesmo template ainda.</div>}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Anti-padrões recorrentes</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        {(selectedReuseHints.recurringAntiPatterns || []).slice(0, 4).map((item) => (
                          <div key={item.code}>{item.code} · {item.count}x</div>
                        ))}
                        {!selectedReuseHints.recurringAntiPatterns?.length && <div>Nenhum anti-padrão recorrente registrado.</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {selectedDiffReview && (
              <div className="px-6 pb-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Revisão de diff e risco</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {selectedDiffReview.summary?.headline || 'Resumo da mudança não disponível'}
                      </p>
                    </div>
                    <RiskBadge value={selectedDiffReview.summary?.riskLevel} />
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-lg bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Áreas tocadas</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        {(selectedDiffReview.summary?.changedAreas || []).map((item) => (
                          <div key={item}>{item}</div>
                        ))}
                        {!selectedDiffReview.summary?.changedAreas?.length && <div>Nenhuma área consolidada.</div>}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recomendação</p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {selectedDiffReview.summary?.recommendation || 'Sem recomendação registrada.'}
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 text-sm text-slate-700">
                        <div><strong>Score de risco:</strong> {selectedDiffReview.summary?.riskScore ?? 'n/a'}</div>
                        <div><strong>Repair attempts:</strong> {selectedDiffReview.qualitySignals?.repairAttempts ?? 'n/a'}</div>
                        <div><strong>Review:</strong> {selectedDiffReview.qualitySignals?.reviewScore ?? 'n/a'}</div>
                        <div><strong>Traceability:</strong> {selectedDiffReview.qualitySignals?.traceabilityScore ?? 'n/a'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="px-6 pb-6">
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Technical spec</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedImplementation.technicalSpecArtifact?.title || 'Ainda não gerado'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Plano de implementação</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedImplementation.implementationPlanArtifact?.title || 'Ainda não gerado'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estratégia de execução</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedImplementation.strategyArtifact?.title || 'Ainda não gerada'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Análise de impacto</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {selectedImplementation.impactArtifact?.title || 'Ainda não gerada'}
                  </p>
                </div>
              </div>
            </div>
            {(selectedImpactAnalysis || selectedImplementationPlan) && (
              <div className="grid gap-4 px-6 pb-6 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Objetivo e impacto</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <p><strong>Objetivo:</strong> {selectedImpactAnalysis?.executionIntent?.primaryGoal || selectedImplementationPlan?.objective?.primaryGoal || 'n/a'}</p>
                    <p><strong>Resultado esperado:</strong> {selectedImpactAnalysis?.executionIntent?.userOutcome || selectedImplementationPlan?.objective?.userOutcome || 'n/a'}</p>
                    <p><strong>Capacidades afetadas:</strong> {(selectedImpactAnalysis?.affectedCapabilities || []).join(' · ') || 'n/a'}</p>
                    <p><strong>Rota frontend:</strong> {selectedImpactAnalysis?.impactSurface?.frontend?.route || 'n/a'}</p>
                    <p><strong>Rota backend:</strong> {selectedImpactAnalysis?.impactSurface?.backend?.routeBase || 'n/a'}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Subtarefas reais</p>
                  <div className="mt-4 space-y-3">
                    {(selectedImplementationPlan?.workstreams || []).slice(0, 4).map((stream) => (
                      <div key={stream.id} className="rounded-lg bg-white px-4 py-3 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">{stream.label}</p>
                        <p className="mt-1 leading-6 text-slate-600">{stream.goal}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          Entregáveis: {(stream.deliverables || []).join(' · ') || 'n/a'}
                        </p>
                      </div>
                    ))}
                    {!selectedImplementationPlan?.workstreams?.length && (
                      <div className="rounded-lg bg-white px-4 py-3 text-sm text-slate-500">
                        O plano técnico ainda não detalhou workstreams para esta implementação.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
        {selectedTaskUuid && !selectedImplementation && (
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Detalhe técnico</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">A implementação ainda não começou</h2>
            </div>
            <div className="p-6">
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                Gere um plano técnico ou integre a story para abrir technical spec, estratégia, arquivos e relatórios desta implementação.
              </div>
            </div>
          </section>
        )}
        {!selectedTaskUuid && readyTasks.length > 0 && (
          <section className="dashboard-panel">
            <div className="dashboard-panel-header">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Detalhe técnico</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Selecione uma story para aprofundar</h2>
            </div>
            <div className="p-6">
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                Abra uma das stories prontas acima para ver score, arquivos gerados, achados e rastreabilidade da implementação.
              </div>
            </div>
            <div className="px-6 pb-6">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Technical spec</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    Disponível depois do plano técnico
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Plano de implementação</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    Disponível depois do planejamento
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estratégia de execução</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    Disponível quando uma story for planejada
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
