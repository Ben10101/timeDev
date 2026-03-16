import { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Definição das etapas do pipeline, incluindo o construtor do projeto
const PIPELINE_STAGES = [
  { name: 'Project Manager', agent: 'project_manager', outputKey: 'backlog', dependsOn: [] },
  { name: 'Requirements Analyst', agent: 'requirements_analyst', outputKey: 'requirements', dependsOn: ['backlog'] },
  { name: 'Architect', agent: 'architect', outputKey: 'architecture', dependsOn: ['requirements'] },
  { name: 'Developer', agent: 'developer', outputKey: 'developer_output', dependsOn: ['architecture'] },
  { name: 'QA Engineer', agent: 'qa_engineer', outputKey: 'tests', dependsOn: ['developer_output'] },
  { name: 'Project Builder', agent: 'project_builder', outputKey: 'project_path', dependsOn: ['backlog', 'requirements', 'architecture', 'developer_output', 'tests'] },
];

export default function PipelineExecutor({ idea }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [artifacts, setArtifacts] = useState({});
  const [projectId, setProjectId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRunStep = async (stepIndex) => {
    if (loading) return;

    const stage = PIPELINE_STAGES[stepIndex];
    setLoading(true);
    setError(null);

    try {
      // Monta o payload com as dependências necessárias
      const payload = {
        project_id: projectId,
        idea: idea,
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
      setCurrentStep(stepIndex + 1);

    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Ocorreu um erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

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

      <div className="space-y-6">
        {PIPELINE_STAGES.map((stage, index) => (
          <div key={stage.agent} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-semibold text-gray-700">{index + 1}. {stage.name}</h2>
                <p className="text-gray-500">Gera o artefato: <strong>{stage.outputKey}</strong></p>
              </div>
              {currentStep === index && (
                <button
                  onClick={() => handleRunStep(index)}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Executando...
                    </span>
                  ) : `Executar ${stage.name}`}
                </button>
              )}
              {currentStep > index && (
                 <span className="px-6 py-2 bg-green-100 text-green-700 font-semibold rounded-lg">
                   ✅ Concluído
                 </span>
              )}
            </div>

            {artifacts[stage.outputKey] && (
              <div className="mt-4 p-4 bg-gray-100 rounded max-h-96 overflow-y-auto border">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {typeof artifacts[stage.outputKey] === 'string' 
                    ? artifacts[stage.outputKey] 
                    : `\`\`\`json\n${JSON.stringify(artifacts[stage.outputKey], null, 2)}\n\`\`\``
                  }
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {currentStep === PIPELINE_STAGES.length && (
        <div className="mt-8 text-center p-8 bg-green-100 border border-green-300 rounded-lg">
            <h2 className="text-3xl font-bold text-green-800">🎉 Projeto Gerado com Sucesso!</h2>
            <p className="text-green-700 mt-2">Seu projeto foi criado no seguinte caminho no servidor:</p>
            <pre className="mt-4 p-2 bg-gray-200 text-gray-800 rounded text-left inline-block">{artifacts['project_path']?.project_path}</pre>
        </div>
      )}
    </div>
  );
}