import { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Definição das etapas do pipeline (sem o agente de desenvolvimento por enquanto)
const PIPELINE_STAGES = [
  { name: 'Project Manager', agent: 'project_manager', outputKey: 'backlog', dependsOn: [] },
  { name: 'Requirements Analyst', agent: 'requirements_analyst', outputKey: 'requirements', dependsOn: ['backlog'] },
  { name: 'Architect', agent: 'architect', outputKey: 'architecture', dependsOn: ['requirements'] },
];

function buildDetailedIdea(idea, answers) {
  if (!answers) return idea;
  const lines = [
    `Ideia inicial: ${idea}`,
    '',
    'Detalhamento (perguntas e respostas):',
    `1) Quem vai usar o sistema? ${answers.targetUsers}`,
    `2) Objetivo principal: ${answers.mainGoal}`,
    `3) Funcionalidades essenciais: ${answers.coreFeatures}`,
    `4) Plataforma/dispositivos: ${answers.platforms}`,
    `5) Login/roles/permissões: ${answers.authAndRoles}`,
    `6) Entidades e dados: ${answers.dataEntities}`,
    `7) Integrações: ${answers.integrations}`,
    `8) Não-funcionais: ${answers.nonFunctional}`,
    `9) Restrições/preferências: ${answers.constraints}`,
    `10) Critérios de sucesso: ${answers.successCriteria}`,
  ];
  return lines.join('\n');
}

export default function PipelineExecutor({ idea, answers }) {
  const [artifacts, setArtifacts] = useState({});
  const [projectId, setProjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const detailedIdea = buildDetailedIdea(idea, answers);

  const handleRunStep = async (stepIndex) => {
    if (loading) return;

    const stage = PIPELINE_STAGES[stepIndex];
    setLoading(true);
    setError(null);

    try {
      // Monta o payload com as dependências necessárias
      const payload = {
        project_id: projectId,
        idea: detailedIdea,
        answers: answers || undefined,
      };
      stage.dependsOn.forEach(depKey => {
        payload[depKey] = artifacts[depKey];
      });

      const response = await axios.post('/api/agents/run', {
        agent: stage.agent,
        payload: payload,
      });
      
      const { data, project_id: newProjectId } = response.data;

      if (!projectId) {
        setProjectId(newProjectId);
      }

      setArtifacts(prev => ({ ...prev, [stage.outputKey]: data }));

    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Ocorreu um erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  const isStageDone = (stage) => artifacts[stage.outputKey] != null;
  const areDependenciesMet = (stage) => stage.dependsOn.every((depKey) => artifacts[depKey] != null);
  const isStageReady = (stage) => !isStageDone(stage) && areDependenciesMet(stage);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold text-gray-800 mb-2">Pipeline de Geração</h1>
      <p className="text-lg text-gray-600 mb-8">
        <strong>Ideia:</strong> "{idea}"
      </p>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p className="font-bold">Erro na Execução</p>
          <p>{error}</p>
        </div>
      )}

      {/* Kanban por Agente (1 coluna por agente) */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {PIPELINE_STAGES.map((stage, index) => {
            const done = isStageDone(stage);
            const depsMet = areDependenciesMet(stage);
            const ready = isStageReady(stage);
            const output = artifacts[stage.outputKey];

            return (
              <div
                key={stage.agent}
                className={[
                  'rounded-lg border bg-white shadow-sm',
                  ready ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200',
                ].join(' ')}
              >
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">{index + 1}. {stage.name}</h2>
                      <p className="text-xs text-gray-500">Saída: <span className="font-semibold">{stage.outputKey}</span></p>
                    </div>
                    <span
                      className={[
                        'text-xs font-semibold px-2 py-1 rounded',
                        done ? 'bg-green-100 text-green-800' : ready ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700',
                      ].join(' ')}
                    >
                      {done ? 'Concluído' : ready ? 'Pronto' : 'Aguardando'}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  {ready && (
                    <button
                      onClick={() => handleRunStep(index)}
                      disabled={loading}
                      className="w-full mb-3 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Executando...' : `Executar ${stage.name}`}
                    </button>
                  )}

                  {!done && !ready && (
                    <p className="text-sm text-gray-500">
                      {depsMet ? 'Aguardando execução.' : 'Aguardando contexto do(s) agente(s) anterior(es).'}
                    </p>
                  )}

                  {done && (
                    <div className="text-xs">
                      {output ? (
                        <div className="p-2 bg-gray-50 rounded max-h-72 overflow-y-auto border">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {typeof output === 'string'
                              ? output
                              : `\`\`\`json\n${JSON.stringify(output, null, 2)}\n\`\`\``
                            }
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-gray-500">Sem artefato.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {artifacts['project_path']?.project_path && (
        <div className="mt-8 text-center p-8 bg-green-100 border border-green-300 rounded-lg">
            <h2 className="text-3xl font-bold text-green-800">🎉 Projeto Gerado com Sucesso!</h2>
            <p className="text-green-700 mt-2">Seu projeto foi criado no seguinte caminho no servidor:</p>
            <pre className="mt-4 p-2 bg-gray-200 text-gray-800 rounded text-left inline-block">{artifacts['project_path']?.project_path}</pre>
        </div>
      )}
    </div>
  );
}