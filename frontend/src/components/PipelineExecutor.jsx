import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';

// 1. Importa o componente do Kanban
import BacklogKanban from '../pages/BacklogKanban';

// Definição das etapas do pipeline
const PIPELINE_STAGES = [
  { name: 'Project Manager', agent: 'project_manager', outputKey: 'backlog', dependsOn: [] },
  { name: 'Requirements Analyst', agent: 'requirements_analyst', outputKey: 'requirements', dependsOn: ['backlog'] },
  { name: 'QA Engineer', agent: 'qa_engineer', outputKey: 'tests', dependsOn: ['requirements'] },
  { name: 'Architect', agent: 'architect', outputKey: 'architecture', dependsOn: ['requirements'] },
  { name: 'Developer', agent: 'developer', outputKey: 'developer_output', dependsOn: ['architecture'] },
];

export default function PipelineExecutor({ idea, answers }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [artifacts, setArtifacts] = useState({});
  const [projectId, setProjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Estado para verificar se o Kanban (Requisitos ou QA) foi concluído
  const [kanbanReady, setKanbanReady] = useState(false);
  const [runMode, setRunMode] = useState(null); // null, 'full', 'mock_to_req', 'mock_to_qa'

  // Efeito para iniciar o pipeline com mocks quando o modo é selecionado
  useEffect(() => {
    if (runMode === 'mock_to_req') {
      // Mocka a etapa do PM para iniciar no Analista de Requisitos
      console.log("MOCK: Pulando para Analista de Requisitos.");
      const MOCK_PROJECT_ID = `mock-proj-${crypto.randomUUID().slice(0, 8)}`;
      const MOCK_BACKLOG = `# 📋 BACKLOG DO PROJETO: Mock E-commerce\n\n- Como um cliente, eu quero adicionar um produto ao carrinho de compras, para que possa continuar com a compra.`;

      setProjectId(MOCK_PROJECT_ID);
      setArtifacts({ backlog: MOCK_BACKLOG });
      setCurrentStep(1); // Pula para a etapa do Analista de Requisitos (index 1)

    } else if (runMode === 'mock_to_qa') {
      // Mocka as etapas de PM e RA para iniciar no Analista de Qualidade
      console.log("MOCK: Pulando para Analista de Qualidade.");
      const MOCK_PROJECT_ID = `mock-proj-${crypto.randomUUID().slice(0, 8)}`;
      
      const MOCK_BACKLOG = `# 📋 BACKLOG DO PROJETO: Mock E-commerce\n\n- Como um cliente, eu quero adicionar um produto ao carrinho de compras, para que possa continuar com a compra.`;
      
      const stories = MOCK_BACKLOG.split('\n').filter(line => line.trim().match(/^[-*]?\s*\d*\.?\s*(?:\*\*)?Como\b/i));
      const mockReqsStories = stories.map((storyText, index) => ({
          id: `story-${index}`,
          text: storyText.replace(/^[-*]?\s*\d*\.?\s*(?:\*\*)?/, '').replace(/\*\*/g, '').trim(),
          status: 'done',
          requirement: `## Requisito Mockado para: "${storyText.replace(/^[-*]?\s*\d*\.?\s*/, '').trim()}"\n\n- **Critério de Aceite 1:** O sistema deve permitir a ação descrita na história de usuário.\n- **Regra de Negócio:** A ação só é válida para usuários autenticados.\n- **Cenário de Exceção:** Se o item estiver fora de estoque, uma mensagem de erro deve ser exibida.`
      }));

      const reqStorageKey = `kanban_stories_${MOCK_PROJECT_ID}_requirements`;
      localStorage.setItem(reqStorageKey, JSON.stringify(mockReqsStories));

      const combinedReqsArtifact = mockReqsStories
        .map(story => `## Requisitos para: "${story.text}"\n\n${story.requirement}`)
        .join('\n\n---\n\n');

      setProjectId(MOCK_PROJECT_ID);
      setArtifacts({ backlog: MOCK_BACKLOG, requirements: combinedReqsArtifact });
      setCurrentStep(2); // Pula para a etapa de QA (index 2)

    } else if (runMode === 'full') {
      // Inicia o pipeline completo do zero
      setCurrentStep(0);
    }
  }, [runMode]);

  // Efeito para monitorar o estado do Kanban via localStorage
  useEffect(() => {
    const currentStage = PIPELINE_STAGES[currentStep];
    // Executa para etapas interativas (Requisitos ou QA)
    if (projectId && currentStage && (currentStage.agent === 'requirements_analyst' || currentStage.agent === 'qa_engineer')) {
        const stageName = currentStage.agent === 'qa_engineer' ? 'qa' : 'requirements';
        
        const checkKanbanStatus = () => {
            const savedStateRaw = localStorage.getItem(`kanban_stories_${projectId}_${stageName}`);
            if (savedStateRaw) {
                const savedStories = JSON.parse(savedStateRaw);
                const allDone = savedStories.length > 0 && savedStories.every(story => story.status === 'done');
                setKanbanReady(allDone);
            } else {
                setKanbanReady(false);
            }
        };

        checkKanbanStatus(); // Verifica imediatamente
        const intervalId = setInterval(checkKanbanStatus, 2000); // E depois a cada 2 segundos

        return () => clearInterval(intervalId); // Limpa o intervalo ao sair da etapa
    } else {
        setKanbanReady(false);
    }
  }, [projectId, currentStep]);


  const handleRunStep = async (stepIndex) => {
    if (loading) return;

    const stage = PIPELINE_STAGES[stepIndex];
    setLoading(true);
    setError(null);

    try {
      const payload = {
        project_id: projectId,
        idea: idea,
        answers: answers,
      };
      stage.dependsOn.forEach(depKey => {
        if (depKey === 'developer_output') {
            payload['code'] = artifacts[depKey]?.code;
        } else {
            payload[depKey] = artifacts[depKey];
        }
      });

      // FIX: QA Agent em modo TDD (antes do código) precisa satisfazer a validação do backend.
      if (stage.agent === 'qa_engineer' && !payload.code) {
          payload.code = artifacts.requirements || "Modo TDD: Baseando testes em requisitos.";
          payload.developer_output = { code: payload.code };
      }

      const response = await axios.post('/api/agents/run', {
        agent: stage.agent,
        payload: payload,
      });
      
      const { data, project_id: newProjectId } = response.data;

      if (!projectId && newProjectId) {
        setProjectId(newProjectId);
      }

      setArtifacts(prev => ({ ...prev, [stage.outputKey]: data }));
      setCurrentStep(stepIndex + 1);

    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Ocorreu um erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Função para finalizar a etapa do Kanban (Req ou QA) e avançar
  const handleCompleteKanbanStep = (bypassValidation = false) => {
    // 1. Identificar estágio atual e nome para o storage
    const currentStage = PIPELINE_STAGES[currentStep];
    const stageName = currentStage.agent === 'qa_engineer' ? 'qa' : 'requirements';
    
    // 2. Verificar status diretamente do localStorage (mais confiável que o state kanbanReady)
    const savedStateRaw = localStorage.getItem(`kanban_stories_${projectId}_${stageName}`);
    let isReady = false;
    let savedStories = [];

    if (savedStateRaw) {
        savedStories = JSON.parse(savedStateRaw);
        // Verifica se existem histórias e se todas estão 'done'
        isReady = savedStories.length > 0 && savedStories.every(story => story.status === 'done');
    }

    if (!isReady && !bypassValidation) {
        const pendingCount = savedStories.filter(s => s.status !== 'done').length;
        setError(`⚠️ Você ainda tem ${pendingCount > 0 ? pendingCount : 'algumas'} histórias pendentes na coluna "A Fazer". Processe todas antes de avançar.`);
        return;
    }
    
    // Formata o resultado dependendo da etapa
    const header = stageName === 'qa' ? '## Plano de Testes para:' : '## Requisitos para:';
    
    const combinedOutput = savedStories
        .filter(story => story.status === 'done' && story.requirement) // Inclui apenas os processados
        .map(story => `${header} "${story.text}"\n\n${story.requirement}`)
        .join('\n\n---\n\n');

    setArtifacts(prev => ({ ...prev, [currentStage.outputKey]: combinedOutput }));
    setCurrentStep(currentStep + 1);
    setError(null);
  }

  const qaPredecessorStories = useMemo(() => {
    if (runMode === 'mock_to_qa' || (PIPELINE_STAGES[currentStep]?.agent === 'qa_engineer' && projectId)) {
      const reqKey = `kanban_stories_${projectId}_requirements`;
      const savedReqsRaw = localStorage.getItem(reqKey);
      return savedReqsRaw ? JSON.parse(savedReqsRaw) : [];
    }
    return [];
  }, [projectId, currentStep, runMode]);

  // Configurações específicas para cada Kanban
  const getKanbanConfig = (agentType) => {
    if (agentType === 'qa_engineer') {
        return {
            stageName: 'qa',
            agent: 'qa_engineer',
            title: '🧪 Kanban de Qualidade (QA)',
            subtitle: 'Arraste as histórias para o Engenheiro de QA gerar cenários de teste TDD/BDD.',
            agentColumnTitle: '🕵️ Engenheiro de QA',
            processingMessage: 'Criando cenários de teste...',
            promptInstruction: "Atue como um Engenheiro de QA Sênior. Baseado na história de usuário e nos REQUISITOS TÉCNICOS fornecidos, crie um Plano de Testes detalhado (TDD). Inclua: 1. Cenários Gherkin (Dado/Quando/Então), 2. Casos de Teste de Sucesso e Falha, 3. Massa de Dados sugerida.",
            predecessorStories: qaPredecessorStories
        };
    }
    // Default: Requirements
    return {
        stageName: 'requirements',
        agent: 'requirements_analyst',
        title: '🗂️ Kanban de Histórias',
        // Demais props usam o default do componente BacklogKanban
    };
  };

  const handleFinishPipeline = () => {
    const finalData = {
        ...artifacts,
        code: artifacts.developer_output?.code || "Nenhum código gerado.",
        timestamp: new Date().toISOString(),
    };
    navigate(`/results/${projectId}`, { state: { data: finalData } });
  };

  if (!runMode) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center w-full max-w-3xl">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Escolha o Modo de Execução</h1>
          <p className="text-gray-600 mb-8">Como você deseja iniciar a geração do projeto?</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setRunMode('full')}
              className="p-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-300 flex flex-col items-center justify-center"
            >
              <span className="text-4xl mb-2">🚀</span> Pipeline Completo
            </button>
            <button
              onClick={() => setRunMode('mock_to_req')}
              className="p-6 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition duration-300 flex flex-col items-center justify-center"
            >
              <span className="text-4xl mb-2">🗂️</span> Iniciar em Requisitos
            </button>
            <button
              onClick={() => setRunMode('mock_to_qa')}
              className="p-6 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition duration-300 flex flex-col items-center justify-center"
            >
              <span className="text-4xl mb-2">🧪</span> Iniciar em Qualidade (QA)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold text-gray-800 mb-2">Pipeline de Geração</h1>
      <p className="text-lg text-gray-600 mb-8"><strong>Ideia:</strong> "{idea}"</p>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p className="font-bold">Erro na Execução</p>
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {PIPELINE_STAGES.map((stage, index) => (
          <div key={stage.agent} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold text-gray-700">{index + 1}. {stage.name}</h2>
                <p className="text-gray-500">Gera o artefato: <strong>{stage.outputKey}</strong></p>
              </div>
              {currentStep === index && (
                <>
                  {/* 3. Renderização condicional do botão */}
                  {stage.agent === 'requirements_analyst' || stage.agent === 'qa_engineer' ? (
                    <span className="px-6 py-2 bg-yellow-100 text-yellow-800 font-semibold rounded-lg text-sm">👇 Ação necessária no Kanban abaixo</span>
                  ) : (
                    <button onClick={() => handleRunStep(index)} disabled={loading} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed">
                      {loading ? "Executando..." : `Executar ${stage.name}`}
                    </button>
                  )}
                </>
              )}
              {currentStep > index && (<span className="px-6 py-2 bg-green-100 text-green-700 font-semibold rounded-lg">✅ Concluído</span>)}
            </div>

            {/* 4. Renderiza o Kanban se for etapa interativa */}
            {(stage.agent === 'requirements_analyst' || stage.agent === 'qa_engineer') && currentStep === index && (
                <div className="mt-6 border-t pt-6">
                    <BacklogKanban 
                        key={`${stage.agent}-${projectId}`}
                        backlogMarkdown={artifacts.backlog || ''} 
                        projectId={projectId}
                        onAllStoriesDone={() => handleCompleteKanbanStep(false)}
                        onAdvance={() => handleCompleteKanbanStep(true)}
                        {...getKanbanConfig(stage.agent)}
                    />
                </div>
            )}

            {artifacts[stage.outputKey] && (
              <div className="mt-4 p-4 bg-gray-100 rounded max-h-96 overflow-y-auto border">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {typeof artifacts[stage.outputKey] === 'string' ? artifacts[stage.outputKey] : `\`\`\`json\n${JSON.stringify(artifacts[stage.outputKey], null, 2)}\n\`\`\``}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {currentStep === PIPELINE_STAGES.length && (
        <div className="mt-8 text-center p-8 bg-green-100 border border-green-300 rounded-lg">
            <h2 className="text-3xl font-bold text-green-800">🎉 Geração Concluída!</h2>
            <p className="text-green-700 mt-2">Todos os artefatos foram gerados com sucesso.</p>
            <button onClick={handleFinishPipeline} className="mt-4 px-8 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition duration-300">
                Ver Página de Resultados
            </button>
        </div>
      )}
    </div>
  );
}