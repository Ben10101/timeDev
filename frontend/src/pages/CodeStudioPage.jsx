import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Braces, CheckCircle2, Copy, Download, ExternalLink, FolderGit2, Hammer, RefreshCw, Sparkles } from 'lucide-react';
import AppShell from '../components/AppShell';
import {
  bootstrapGeneratedApp,
  getGeneratedApp,
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
  const selectedImplementation = selectedTaskUuid ? implementationMap[selectedTaskUuid] : null;

  return (
    <AppShell
      eyebrow="Estudio de Codigo"
      title="Geracao Tecnica"
      description="Centralize arquitetura, app base e implementacao das historias em uma area separada do board."
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
        </>
      }
    >
      <div className="space-y-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {generationProgress && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-[#102a72]">{generationProgress}</div>
        )}

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
                  <p><strong>Build:</strong> {selectedImplementation.buildStatus || 'n/a'}</p>
                  <p><strong>Testes:</strong> {selectedImplementation.testStatus || 'n/a'}</p>
                  <p><strong>Projeto:</strong> {selectedImplementation.generatedApp?.name || 'App full stack'}</p>
                  <p><strong>Pasta:</strong> {selectedImplementation.generatedApp?.rootPath || 'Ainda nao materializado'}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Arquivos gerados</p>
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
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
