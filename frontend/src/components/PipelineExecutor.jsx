import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { listProjectTasks } from '../services/api';
import BacklogKanban from '../pages/BacklogKanban';

const PIPELINE_STAGES = [
  { name: 'Project Manager', agent: 'project_manager', outputKey: 'backlog', dependsOn: [] },
  { name: 'Requirements Analyst', agent: 'requirements_analyst', outputKey: 'requirements', dependsOn: ['backlog'] },
  { name: 'QA Engineer', agent: 'qa_engineer', outputKey: 'tests', dependsOn: ['requirements'] },
];

export default function PipelineExecutor({ idea, answers }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [artifacts, setArtifacts] = useState({});
  const [projectId, setProjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [kanbanReady, setKanbanReady] = useState(false);
  const [runMode, setRunMode] = useState(null);
  const [stagePendingCounts, setStagePendingCounts] = useState({ requirements: 0, qa: 0 });
  const [persistedTasks, setPersistedTasks] = useState([]);
  const navigate = useNavigate();

  const getStageName = (agent) => (agent === 'qa_engineer' ? 'qa' : 'requirements');
  const isInteractiveStage = (agent) => agent === 'requirements_analyst' || agent === 'qa_engineer';

  useEffect(() => {
    if (runMode === 'mock_to_req') {
      const mockProjectId = `mock-proj-${crypto.randomUUID().slice(0, 8)}`;
      const mockBacklog =
        '# Backlog do projeto: Mock E-commerce\n\n- Como um cliente, eu quero adicionar um produto ao carrinho de compras, para que possa continuar com a compra.';

      setProjectId(mockProjectId);
      setArtifacts({ backlog: mockBacklog });
      setCurrentStep(1);
      return;
    }

    if (runMode === 'mock_to_qa') {
      const mockProjectId = `mock-proj-${crypto.randomUUID().slice(0, 8)}`;
      const mockBacklog =
        '# Backlog do projeto: Mock E-commerce\n\n- Como um cliente, eu quero adicionar um produto ao carrinho de compras, para que possa continuar com a compra.';

      const stories = mockBacklog
        .split('\n')
        .filter((line) => line.trim().match(/^[-*]?\s*\d*\.?\s*(?:\*\*)?Como\b/i));

      const mockRequirementsStories = stories.map((storyText, index) => ({
        id: `story-${index}`,
        text: storyText.replace(/^[-*]?\s*\d*\.?\s*(?:\*\*)?/, '').replace(/\*\*/g, '').trim(),
        status: 'done',
        requirement: `## Requisitos para "${storyText.replace(/^[-*]?\s*\d*\.?\s*/, '').trim()}"\n\n- **Critério de aceite:** O sistema deve permitir a ação descrita na história.\n- **Regra de negócio:** A ação só é válida para usuários autenticados.\n- **Exceção:** Se o item estiver fora de estoque, o sistema deve informar o impedimento.`,
      }));

      const reqStorageKey = `kanban_stories_${mockProjectId}_requirements`;
      localStorage.setItem(reqStorageKey, JSON.stringify(mockRequirementsStories));

      const combinedRequirements = mockRequirementsStories
        .map((story) => `## Requisitos para "${story.text}"\n\n${story.requirement}`)
        .join('\n\n---\n\n');

      setProjectId(mockProjectId);
      setArtifacts({ backlog: mockBacklog, requirements: combinedRequirements });
      setCurrentStep(2);
      return;
    }

    if (runMode === 'full') {
      setCurrentStep(0);
    }
  }, [runMode]);

  useEffect(() => {
    if (!projectId) {
      setStagePendingCounts({ requirements: 0, qa: 0 });
      setPersistedTasks([]);
      setKanbanReady(false);
      return;
    }

    const readTaskState = async () => {
      try {
        const tasks = await listProjectTasks(projectId);
        setPersistedTasks(tasks);

        const requirementsPending = tasks.filter(
          (task) => !task.artifacts?.some((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent)
        ).length;

        const qaEligibleTasks = tasks.filter((task) =>
          task.artifacts?.some((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent)
        );

        const qaPending = qaEligibleTasks.filter(
          (task) => !task.artifacts?.some((artifact) => artifact.artifactType === 'test_plan' && artifact.isCurrent)
        ).length;

        setStagePendingCounts({ requirements: requirementsPending, qa: qaPending });

        const currentStage = PIPELINE_STAGES[currentStep];
        if (currentStage && isInteractiveStage(currentStage.agent)) {
          const pendingForCurrentStage = currentStage.agent === 'qa_engineer' ? qaPending : requirementsPending;
          const totalForCurrentStage = currentStage.agent === 'qa_engineer' ? qaEligibleTasks.length : tasks.length;
          setKanbanReady(totalForCurrentStage > 0 && pendingForCurrentStage === 0);
          return;
        }

        setKanbanReady(false);
      } catch {
        setKanbanReady(false);
      }
    };

    readTaskState();
    const intervalId = setInterval(readTaskState, 1500);
    return () => clearInterval(intervalId);
  }, [projectId, currentStep]);

  const handleRunStep = async (stepIndex) => {
    if (loading) return;

    const stage = PIPELINE_STAGES[stepIndex];
    setLoading(true);
    setError(null);

    try {
      const payload = {
        project_id: projectId,
        idea,
        answers,
      };

      stage.dependsOn.forEach((depKey) => {
        payload[depKey] = artifacts[depKey];
      });

      if (stage.agent === 'qa_engineer' && !payload.code) {
        payload.code = artifacts.requirements || 'Modo TDD: gerando QA a partir dos requisitos.';
        payload.developer_output = { code: payload.code };
      }

      const response = await axios.post('/api/agents/run', {
        agent: stage.agent,
        payload,
      });

      const { data, project_id: newProjectId } = response.data;

      if (!projectId && newProjectId) {
        setProjectId(newProjectId);
      }

      setArtifacts((prev) => ({ ...prev, [stage.outputKey]: data }));
      setCurrentStep(stepIndex + 1);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Ocorreu um erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteKanbanStep = (stepIndex, bypassValidation = false, selectedStory = null) => {
    const currentStage = PIPELINE_STAGES[stepIndex];
    const stageName = getStageName(currentStage.agent);
    const relevantTasks =
      stageName === 'requirements'
        ? persistedTasks
        : persistedTasks.filter((task) =>
            task.artifacts?.some((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent)
          );

    const completedTasks = relevantTasks.filter((task) =>
      task.artifacts?.some((artifact) =>
        artifact.artifactType === (stageName === 'requirements' ? 'requirements' : 'test_plan') && artifact.isCurrent
      )
    );

    const isReady = relevantTasks.length > 0 && completedTasks.length === relevantTasks.length;

    if (!isReady && !bypassValidation) {
      const pendingCount = relevantTasks.length - completedTasks.length;
      setError(
        `Você ainda tem ${pendingCount > 0 ? pendingCount : 'algumas'} histórias pendentes na coluna "A Fazer". Processe todas antes de avançar.`
      );
      return;
    }

    let tasksToAdvance = completedTasks;
    if (bypassValidation && selectedStory) {
      tasksToAdvance = completedTasks.filter(
        (task) => task.uuid === selectedStory.id || task.title.trim() === selectedStory.text.trim()
      );
    }

    const header = stageName === 'qa' ? '## Plano de testes para:' : '## Requisitos para:';
    const artifactType = stageName === 'qa' ? 'test_plan' : 'requirements';

    const combinedOutput = tasksToAdvance
      .map((task) => {
        const artifact = task.artifacts?.find((item) => item.artifactType === artifactType && item.isCurrent);
        return artifact ? `${header} "${task.title}"\n\n${artifact.content}` : null;
      })
      .filter(Boolean)
      .join('\n\n---\n\n');

    setArtifacts((prev) => ({ ...prev, [currentStage.outputKey]: combinedOutput }));
    if (stepIndex === currentStep) {
      setCurrentStep(stepIndex + 1);
    }
    setError(null);
  };

  const qaPredecessorStories = useMemo(() => {
    if (runMode === 'mock_to_qa') {
      const reqKey = `kanban_stories_${projectId}_requirements`;
      const savedReqsRaw = localStorage.getItem(reqKey);
      return savedReqsRaw ? JSON.parse(savedReqsRaw) : [];
    }

    if (projectId) {
      return persistedTasks.map((task) => ({
        id: task.uuid,
        text: task.title,
        status: task.artifacts?.some((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent)
          ? 'done'
          : 'todo',
        requirement:
          task.artifacts?.find((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent)?.content ||
          null,
      }));
    }

    return [];
  }, [projectId, runMode, persistedTasks]);

  const getKanbanConfig = (agentType) => {
    if (agentType === 'qa_engineer') {
      return {
        stageName: 'qa',
        agent: 'qa_engineer',
        title: 'Kanban de Qualidade (QA)',
        subtitle: 'Arraste as histórias para o Engenheiro de QA gerar cenários de teste, riscos e validações.',
        agentColumnTitle: 'Engenheiro de QA',
        processingMessage: 'Criando cenários de teste...',
        promptInstruction:
          'Atue como um Engenheiro de QA Sênior. Baseado na história de usuário e nos REQUISITOS TÉCNICOS fornecidos, gere uma resposta em Markdown, profissional, crítica e detalhista, usando listas numeradas com títulos em negrito. Inclua obrigatoriamente: 1. Estratégia de Testes, 2. Dados de Teste Sugeridos, 3. Métricas de Qualidade, 4. Cenários de Testes com exatamente 5 cenários de caminho feliz e 5 cenários de caminho de exceção, 5. Casos de Teste Funcionais com Ação e Resultado Esperado, 6. Análise de Usabilidade e Acessibilidade com Heurísticas de Nielsen, Leis de UX (Fitts, Miller e Jakob) e critérios WCAG com contraste mínimo 4.5:1, legibilidade e áreas de toque de 44x44px.',
        predecessorStories: qaPredecessorStories,
      };
    }

    return {
      stageName: 'requirements',
      agent: 'requirements_analyst',
      title: 'Kanban de Histórias',
    };
  };

  const handleFinishPipeline = () => {
    const finalData = {
      ...artifacts,
      timestamp: new Date().toISOString(),
    };
    navigate(`/results/${projectId}`, { state: { data: finalData } });
  };

  const shouldRenderKanban = (stage, index) => {
    if (!isInteractiveStage(stage.agent)) return false;

    const stageName = getStageName(stage.agent);
    return currentStep === index || (currentStep > index && stagePendingCounts[stageName] > 0);
  };

  if (!runMode) {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white/88 p-8 shadow-[0_24px_70px_rgba(23,50,43,0.08)]">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Modo do fluxo</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-slate-900">Escolha como este workspace vai começar</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Você pode iniciar no fluxo completo ou abrir o board já posicionado na etapa de requisitos ou QA.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <button
              onClick={() => setRunMode('full')}
              className="mt-8 flex flex-col items-center justify-center rounded-[28px] bg-[#17322b] p-6 font-semibold text-white transition duration-300 hover:bg-[#214338]"
            >
              <span className="mb-2 text-4xl">PM</span>
              Fluxo completo
            </button>
            <button
              onClick={() => setRunMode('mock_to_req')}
              className="mt-8 flex flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-[#faf8f2] p-6 font-semibold text-slate-800 transition duration-300 hover:bg-[#f3efe4]"
            >
              <span className="mb-2 text-4xl">REQ</span>
              Iniciar em Requisitos
            </button>
            <button
              onClick={() => setRunMode('mock_to_qa')}
              className="mt-8 flex flex-col items-center justify-center rounded-[28px] border border-slate-200 bg-[#eef5ef] p-6 font-semibold text-slate-800 transition duration-300 hover:bg-[#e4f0e5]"
            >
              <span className="mb-2 text-4xl">QA</span>
              Iniciar em Qualidade
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 rounded-[28px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Task context</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-slate-900">Fluxo operacional da task</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          <strong>Ideia:</strong> "{idea}"
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700" role="alert">
          <p className="font-bold">Erro na execução</p>
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {PIPELINE_STAGES.map((stage, index) => (
          <div
            key={stage.agent}
            className="rounded-[28px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-800">
                  {index + 1}. {stage.name}
                </h2>
                <p className="text-sm text-slate-500">
                  Gera o artefato: <strong>{stage.outputKey}</strong>
                </p>
              </div>
              {currentStep === index && (
                <>
                  {isInteractiveStage(stage.agent) ? (
                    <span className="rounded-full bg-[#f4f9e8] px-5 py-2 text-sm font-semibold text-[#56722c]">
                      Ação pendente no board abaixo
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRunStep(index)}
                      disabled={loading}
                      className="rounded-2xl bg-[#17322b] px-6 py-2 text-sm font-semibold text-white transition duration-300 hover:bg-[#214338] disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {loading ? 'Executando...' : `Executar ${stage.name}`}
                    </button>
                  )}
                </>
              )}
              {currentStep > index && isInteractiveStage(stage.agent) && stagePendingCounts[getStageName(stage.agent)] > 0 && (
                <span className="rounded-full bg-[#fff5d9] px-5 py-2 text-sm font-semibold text-[#8a6a1f]">
                  Pendências restantes
                </span>
              )}
              {currentStep > index && (!isInteractiveStage(stage.agent) || stagePendingCounts[getStageName(stage.agent)] === 0) && (
                <span className="rounded-full bg-[#e5f3e8] px-5 py-2 text-sm font-semibold text-[#2f6c58]">
                  Concluído
                </span>
              )}
            </div>

            {shouldRenderKanban(stage, index) && (
              <div className="mt-6 border-t pt-6">
                <BacklogKanban
                  key={`${stage.agent}-${projectId}`}
                  backlogMarkdown={artifacts.backlog || ''}
                  projectId={projectId}
                  onAllStoriesDone={() => handleCompleteKanbanStep(index, false)}
                  onAdvance={(story) => handleCompleteKanbanStep(index, true, story)}
                  {...getKanbanConfig(stage.agent)}
                />
              </div>
            )}

            {artifacts[stage.outputKey] && (
              <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-[#faf8f2] p-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {typeof artifacts[stage.outputKey] === 'string'
                    ? artifacts[stage.outputKey]
                    : `\`\`\`json\n${JSON.stringify(artifacts[stage.outputKey], null, 2)}\n\`\`\``}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>

      {currentStep === PIPELINE_STAGES.length && (
        <div className="mt-8 rounded-[28px] border border-emerald-200 bg-[#e7f4e8] p-8 text-center">
          <h2 className="text-3xl font-bold text-[#2f6c58]">Fluxo concluído</h2>
          <p className="mt-2 text-[#2f6c58]">Backlog, requisitos e QA foram consolidados com sucesso.</p>
          <button
            onClick={handleFinishPipeline}
            className="mt-4 rounded-2xl bg-[#17322b] px-8 py-3 font-bold text-white transition duration-300 hover:bg-[#214338]"
          >
            Ver central de artefatos
          </button>
        </div>
      )}
    </div>
  );
}
