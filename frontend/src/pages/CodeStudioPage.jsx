import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Braces,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FolderGit2,
  Hammer,
  Layers3,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  bootstrapGeneratedApp,
  getApiErrorMessage,
  getGeneratedApp,
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

function normalizeArtifactContent(content) {
  return String(content || '').replace(/\r\n/g, '\n').trim();
}

function getArtifactPreview(content, maxLines = 10) {
  const lines = normalizeArtifactContent(content).split('\n');
  return lines.slice(0, maxLines).join('\n').trim();
}

function slugifyHeading(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function extractArchitectureOutline(content, maxItems = 8) {
  const lines = normalizeArtifactContent(content).split('\n');
  const outline = [];

  lines.forEach((line) => {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (!match) return;
    outline.push({
      level: match[1].length,
      title: match[2].trim(),
      anchor: slugifyHeading(match[2].trim()),
    });
  });

  return outline.slice(0, maxItems);
}

function extractArchitectureHighlights(content, maxItems = 3) {
  const lines = normalizeArtifactContent(content).split('\n');
  const highlights = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,3})\s+(.+)$/);
    if (!match || match[1].length < 2) continue;

    const body = [];
    for (let innerIndex = index + 1; innerIndex < lines.length; innerIndex += 1) {
      const nextLine = lines[innerIndex];
      if (/^#{1,3}\s+/.test(nextLine)) break;
      if (nextLine.trim()) body.push(nextLine.trim());
      if (body.join(' ').length > 220) break;
    }

    highlights.push({
      title: match[2].trim(),
      body: body.join(' ').slice(0, 220),
      anchor: slugifyHeading(match[2].trim()),
    });

    if (highlights.length >= maxItems) break;
  }

  return highlights;
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
      keywords: ['hist?rico', 'comentario', 'filtro', 'buscar', 'busca', 'lembrete', 'notific', 'status', 'acompanhar', 'painel', 'fila'],
    },
    {
      stage: 'Expansão e gestão',
      rank: 5,
      reason: 'Amplia governança, análise, relatórios e funções administrativas depois do fluxo base.',
      keywords: ['relatorio', 'dashboard', 'metric', 'governança', 'auditoria', 'sla', 'admin', 'finance', 'exportar'],
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
  const [isViewingArchitecture, setIsViewingArchitecture] = useState(false);
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

  function handleCloseTechnicalDetails() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('task');
    setSearchParams(nextParams);
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
  const selectedQualitySummary = selectedImplementation?.qualitySummary || null;
  const selectedTraceability = selectedQualitySummary?.traceability || null;
  const selectedBenchmark = selectedQualitySummary?.benchmark || null;
  const selectedFindingsBySeverity = selectedQualitySummary?.findingsBySeverity || null;
  const nextStep = getCodeStudioNextStep({
    selectedProject,
    architectureStatus,
    readyTasks,
    plannedTasks,
    integratedTasks,
    generatedApp,
  });
  const architecturePreview = useMemo(
    () => getArtifactPreview(architectureStatus?.architectureArtifact?.content, 12),
    [architectureStatus?.architectureArtifact?.content]
  );
  const architectureOutline = useMemo(
    () => extractArchitectureOutline(architectureStatus?.architectureArtifact?.content, 10),
    [architectureStatus?.architectureArtifact?.content]
  );
  const architectureHighlights = useMemo(
    () => extractArchitectureHighlights(architectureStatus?.architectureArtifact?.content, 3),
    [architectureStatus?.architectureArtifact?.content]
  );
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
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Contexto tecnico</p>
            </div>
            <div className="grid gap-3 p-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">App base</p>
                <p className="mt-2 font-semibold text-slate-900">{generatedApp?.status || 'Ainda não gerado'}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {generatedApp?.rootPath || 'Será criado quando a arquitetura ou a implementação rodar.'}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em]">Prontas agora</p>
                  <p className="mt-2 text-lg font-semibold">{executionReadyTasks.length}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em]">Com bloqueio</p>
                  <p className="mt-2 text-lg font-semibold">{blockedReadyTasks.length}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <p><strong>Arquitetura:</strong> {architectureStateLabel}</p>
                <p><strong>Stories prontas:</strong> {readyTasks.length}</p>
                <p><strong>Planos técnicos:</strong> {plannedTasks.length}</p>
                <p><strong>Integradas:</strong> {integratedTasks.length}</p>
              </div>
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


        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {generationProgress && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-[#102a72]">{generationProgress}</div>
        )}

        

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
                <h2 className="mt-2 text-2xl font-bold text-slate-900">Liberação para gerar código</h2>
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

          <div className="grid gap-4 p-6 lg:grid-cols-2">
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
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {architectureStatus?.canGenerateCode
                  ?'A base técnica já pode ser gerada para receber as stories prontas.'
                  : architectureStatus?.blockers?.[0] || 'Ainda existe um bloqueio antes da geração.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Prontas</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{readyTasks.length}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]">Entram agora</p>
                  <p className="mt-2 text-lg font-semibold">{executionReadyTasks.length}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em]">Aguardam</p>
                  <p className="mt-2 text-lg font-semibold">{blockedReadyTasks.length}</p>
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
                <button
                  onClick={() => setIsViewingArchitecture(true)}
                  disabled={!architectureStatus?.architectureArtifact?.content}
                  className="dashboard-button-secondary"
                >
                  <ExternalLink className="h-4 w-4" />
                  Visualizar arquitetura
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

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Previa do documento</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Mostramos apenas uma leitura reduzida aqui para nao poluir a superficie principal do studio.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsViewingArchitecture(true)}
                    className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
                  >
                    Visualizar artefato
                  </button>
                </div>
                {architectureHighlights.length ?(
                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    {architectureHighlights.map((item) => (
                      <div key={item.anchor} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f6c58]">Secao chave</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {item.body || 'Abra a visualizacao completa para ler essa secao com o contexto inteiro.'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {architectureOutline.length ?(
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Indice rapido</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {architectureOutline.slice(0, 6).map((item) => (
                        <span key={item.anchor} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                          {item.title}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap px-5 py-4 text-sm leading-7 text-slate-700">
                    {architecturePreview}
                    {architecturePreview && normalizeArtifactContent(architectureStatus.architectureArtifact.content) !== architecturePreview ?'\n\n...' : ''}
                  </pre>
                </div>
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
                      isSelected
                        ?'border-[#102a72]/30 bg-[#102a72]/5'
                        : canStartNow
                          ?'border-emerald-200 bg-emerald-50/40'
                          : 'border-amber-200 bg-amber-50/30'
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
                            {canStartNow ?'Pronta agora' : 'Aguardando dependências'}
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
                      <div className={`rounded-lg px-3 py-2 text-sm sm:col-span-2 ${canStartNow ?'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
                        <strong>{canStartNow ?'Entra agora:' : 'Ainda espera:'}</strong> {order.reason}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102a72]">Detalhe técnico</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    {selectedImplementation.task?.title || 'Implementação selecionada'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Leitura completa da implementação, qualidade e impacto.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseTechnicalDetails}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 p-6">
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
                  <div className="mt-3 flex items-center gap-3">
                    <StatusBadge value={selectedImplementation.status} />
                    <span className="text-sm text-slate-600">{selectedExecutionState?.phaseLabel || 'Sem fase registrada'}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Qualidade</p>
                  <div className="mt-3 flex items-center gap-3">
                    <ScoreBadge value={selectedQualitySummary?.score} />
                    <span className="text-sm text-slate-600">
                      premium {selectedQualitySummary?.premiumScore ?? 'n/a'}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Risco</p>
                  <div className="mt-3 flex items-center gap-3">
                    <RiskBadge value={selectedDiffReview?.summary?.riskLevel} />
                    <span className="text-sm text-slate-600">
                      score {selectedDiffReview?.summary?.riskScore ?? 'n/a'}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Entrega</p>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <p>Build: <strong className="text-slate-900">{selectedImplementation.buildStatus || 'n/a'}</strong></p>
                    <p>Testes: <strong className="text-slate-900">{selectedImplementation.testStatus || 'n/a'}</strong></p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leitura rapida</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Saude da implementacao</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p><strong>Review:</strong> {selectedQualitySummary?.reviewStatus || 'n/a'}</p>
                        <p><strong>Specialist:</strong> {selectedQualitySummary?.specialistReviewStatus || 'n/a'}</p>
                        <p><strong>Validação:</strong> {selectedQualitySummary?.validationScore ?? 'n/a'}</p>
                        <p><strong>Atualizado:</strong> {formatDate(selectedImplementation.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Aderencia</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p><strong>Template:</strong> {selectedQualitySummary?.screenTemplate || 'n/a'}</p>
                        <p><strong>Dominio:</strong> {selectedQualitySummary?.implementedDomain || 'n/a'}</p>
                        <p><strong>Rastreabilidade:</strong> {selectedTraceability?.traceabilityScore ?? 'n/a'}</p>
                        <p><strong>Contrato e docs:</strong> {selectedTraceability?.hasSharedContract && selectedTraceability?.hasDocumentation ?'ok' : 'pendente'}</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Benchmarks</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p><strong>Comparativo:</strong> {selectedBenchmark?.comparativeScore ?? 'n/a'}</p>
                        <p><strong>Projeto:</strong> {selectedBenchmark?.projectSuccessRatePercent ?? 'n/a'}%</p>
                        <p><strong>Dominio:</strong> {selectedBenchmark?.domainSuccessRatePercent ?? 'n/a'}%</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Artefato entregue</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p><strong>Projeto:</strong> {selectedImplementation.generatedApp?.name || 'App full stack'}</p>
                        <p><strong>Pasta:</strong> {selectedImplementation.generatedApp?.rootPath || 'Ainda nao materializado'}</p>
                        <p><strong>Prompt:</strong> {selectedQualitySummary?.versioning?.promptVersion ?? 'v1'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Arquivos e findings</p>
                    <ScoreBadge value={selectedQualitySummary?.score} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                      <strong>Findings:</strong> {selectedQualitySummary?.totalFindings ?? 'n/a'}
                    </div>
                    <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                      <strong>Altas:</strong> {selectedFindingsBySeverity?.high || 0}
                    </div>
                    <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                      <strong>Medias:</strong> {selectedFindingsBySeverity?.medium || 0}
                    </div>
                    <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                      <strong>Baixas:</strong> {selectedFindingsBySeverity?.low || 0}
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {(selectedImplementation.generatedFiles || []).slice(0, 8).map((file) => (
                      <div key={file.id} className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                        {file.filePath}
                      </div>
                    ))}
                    {!selectedImplementation.generatedFiles?.length && (
                      <div className="rounded-xl bg-white px-4 py-4 text-sm text-slate-500">
                        Nenhum arquivo registrado ainda para esta implementação.
                      </div>
                    )}
                  </div>
                </div>
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
                </div>
              </div>
            </div>
        )}
        {selectedTaskUuid && !selectedImplementation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102a72]">Detalhe técnico</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">A implementação ainda não começou</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    A story já está no studio, mas ainda não abriu uma implementação detalhada.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseTechnicalDetails}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
              <div className="p-6">
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-slate-500">
                  Gere um plano técnico ou integre a story para abrir technical spec, estratégia, arquivos e relatórios desta implementação.
                </div>
              </div>
            </div>
          </div>
        )}
        {isViewingArchitecture && architectureStatus?.architectureArtifact ?(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.35)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Visualizar arquitetura</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">{architectureStatus.architectureArtifact.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    architecture • v{architectureStatus.architectureArtifact.version}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsViewingArchitecture(false)}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
              <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="overflow-auto border-b border-slate-200 bg-slate-50 px-6 py-6 lg:border-b-0 lg:border-r">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Navegacao</p>
                  <div className="mt-4 space-y-2">
                    {architectureOutline.length ?(
                      architectureOutline.map((item) => (
                        <button
                          key={item.anchor}
                          type="button"
                          onClick={() => {
                            const element = document.getElementById(item.anchor);
                            element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className={`block w-full rounded-2xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-white ${
                            item.level > 2 ?'pl-6' : ''
                          }`}
                        >
                          {item.title}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-slate-500">
                        O documento nao trouxe headings suficientes para montar um indice.
                      </p>
                    )}
                  </div>
                </aside>
                <div className="overflow-auto px-6 py-6">
                  <div className="prose prose-slate max-w-none text-sm leading-7 prose-headings:font-semibold prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.9em] prose-pre:overflow-auto prose-pre:rounded-2xl prose-pre:bg-slate-950 prose-pre:text-slate-100">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => {
                          const text = Array.isArray(children) ?children.join('') : String(children || '');
                          return <h1 id={slugifyHeading(text)}>{children}</h1>;
                        },
                        h2: ({ children }) => {
                          const text = Array.isArray(children) ?children.join('') : String(children || '');
                          return <h2 id={slugifyHeading(text)}>{children}</h2>;
                        },
                        h3: ({ children }) => {
                          const text = Array.isArray(children) ?children.join('') : String(children || '');
                          return <h3 id={slugifyHeading(text)}>{children}</h3>;
                        },
                      }}
                    >
                      {normalizeArtifactContent(architectureStatus.architectureArtifact.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
