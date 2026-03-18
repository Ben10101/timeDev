import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { createTaskArtifact, ensurePipelineProject, importBacklogTasks, listProjectTasks } from '../services/api';

const MOCK_STORIES = [
  'Como um cliente, eu quero adicionar um produto ao carrinho de compras, para que possa continuar com a compra.',
  'Como um cliente, eu quero atualizar a quantidade de um produto no carrinho de compras, para que possa fazer alterações caso necessário.',
  'Como um cliente, eu quero remover um produto do carrinho de compras, para que possa excluir itens que não necessito mais.',
];

const EMPTY_ARRAY = [];

function parseBacklogLines(backlogMarkdown) {
  const storyLines = backlogMarkdown
    ? backlogMarkdown.split('\n').filter((line) => line.trim().match(/^[-*]?\s*\d*\.?\s*(?:\*\*)?Como\b/i))
    : MOCK_STORIES;

  return storyLines.map((text, index) => ({
    id: `story-${index}`,
    text: text.replace(/^[-*]?\s*\d*\.?\s*(?:\*\*)?/, '').replace(/\*\*/g, '').trim(),
    status: 'todo',
    requirement: null,
    isReady: true,
  }));
}

function mapTasksToStories(tasks, stageName) {
  return tasks
    .map((task) => {
      const requirementsArtifact = task.artifacts?.find((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent);
      const qaArtifact = task.artifacts?.find((artifact) => artifact.artifactType === 'test_plan' && artifact.isCurrent);

      if (stageName === 'qa' && !requirementsArtifact) {
        return null;
      }

      return {
        id: task.uuid,
        text: task.title,
        status: stageName === 'requirements' ? (requirementsArtifact ? 'done' : 'todo') : qaArtifact ? 'done' : 'todo',
        requirement: stageName === 'requirements' ? requirementsArtifact?.content || null : qaArtifact?.content || null,
        predecessorRequirement: requirementsArtifact?.content || null,
        isReady: stageName !== 'qa' || Boolean(requirementsArtifact),
        task,
      };
    })
    .filter(Boolean);
}

export default function BacklogKanban({
  backlogMarkdown,
  projectId: propProjectId,
  stageName = 'requirements',
  agent = 'requirements_analyst',
  title = 'Kanban de Histórias',
  subtitle = 'Arraste uma História de Usuário para a área do agente para gerar o artefato específico.',
  agentColumnTitle = 'Agente de Requisitos',
  processingMessage = 'Gerando artefato...',
  promptInstruction = 'Atue como um Analista de Requisitos Sênior. Refine esta história de usuário gerando uma especificação técnica detalhada.',
  predecessorStories = EMPTY_ARRAY,
  onAllStoriesDone = () => {},
  onAdvance = () => {},
}) {
  const { projectId: paramProjectId } = useParams();
  const projectId = propProjectId || paramProjectId;
  const [stories, setStories] = useState([]);
  const [draggedStory, setDraggedStory] = useState(null);
  const [processingStoryId, setProcessingStoryId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', content: '' });
  const [syncError, setSyncError] = useState(null);

  const isMockMode = projectId?.startsWith('mock-proj-');
  const isPersistentStage = !isMockMode && (stageName === 'requirements' || stageName === 'qa');

  async function loadStoriesFromApi() {
    if (!projectId) return;

    await ensurePipelineProject({ projectUuid: projectId, idea: backlogMarkdown || title });
    await importBacklogTasks(projectId, backlogMarkdown || '');
    const tasks = await listProjectTasks(projectId);
    setStories(mapTasksToStories(tasks, stageName));
  }

  useEffect(() => {
    let active = true;

    async function initializeStories() {
      setSyncError(null);

      if (!isPersistentStage) {
        let extractedStories = parseBacklogLines(backlogMarkdown);
        if (stageName === 'qa' && predecessorStories?.length > 0) {
          extractedStories = extractedStories
            .map((story) => {
              const match = predecessorStories.find((item) => item.id === story.id || item.text.trim() === story.text.trim());
              return {
                ...story,
                isReady: !!(match && match.status === 'done' && match.requirement),
                predecessorRequirement: match?.requirement || null,
              };
            })
            .filter((story) => story.isReady);
        }
        if (active) setStories(extractedStories);
        return;
      }

      try {
        await loadStoriesFromApi();
      } catch (error) {
        if (!active) return;
        setSyncError(error.response?.data?.error || error.message || 'Não foi possível carregar o kanban do banco.');
        setStories([]);
      }
    }

    initializeStories();

    return () => {
      active = false;
    };
  }, [backlogMarkdown, projectId, stageName, isPersistentStage]);

  const processing = Boolean(processingStoryId);

  const handleDragStart = (e, story) => {
    setDraggedStory(story);
    e.dataTransfer.setData('text/plain', story.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    if (!draggedStory || processing) return;

    const storyId = draggedStory.id;
    setProcessingStoryId(storyId);
    setDraggedStory(null);
    setStories((prev) => prev.map((story) => (story.id === storyId ? { ...story, status: 'processing' } : story)));

    try {
      let backlogPayload = `História de Usuário:\n${draggedStory.text}`;
      const inheritedRequirement = draggedStory.predecessorRequirement;
      if (inheritedRequirement) {
        backlogPayload += `\n\nREQUISITOS TÉCNICOS ESTRUTURADOS:\n${inheritedRequirement}`;
      }

      const payloadData = {
        project_id: projectId,
        idea: promptInstruction,
        backlog: backlogPayload,
      };

      if (isPersistentStage) {
        payloadData.task_uuid = storyId;
      }

      if (agent === 'qa_engineer') {
        payloadData.code = backlogPayload;
        payloadData.developer_output = { code: backlogPayload };
      }

      const response = await axios.post('/api/agents/run', {
        agent,
        payload: payloadData,
      });

      const result = response.data.data || response.data;
      const content = typeof result === 'string' ? result : JSON.stringify(result);

      if (isPersistentStage) {
        await createTaskArtifact(storyId, {
          artifactType: stageName === 'requirements' ? 'requirements' : 'test_plan',
          title: stageName === 'requirements' ? `Requisitos - ${draggedStory.text}` : `Plano de Testes - ${draggedStory.text}`,
          content,
          createdByAgentName: agent,
          contentFormat: 'markdown',
        });
        await loadStoriesFromApi();
      } else {
        setStories((prev) =>
          prev.map((story) =>
            story.id === storyId
              ? { ...story, status: 'done', requirement: content }
              : story
          )
        );
      }
    } catch (error) {
      setStories((prev) => prev.map((story) => (story.id === storyId ? { ...story, status: 'todo' } : story)));
      setSyncError(error.response?.data?.error || error.message || 'Erro ao processar a história com o agente.');
    } finally {
      setProcessingStoryId(null);
    }
  };

  const handleOpenModal = (story) => {
    setModalContent({ title: story.text, content: story.requirement || story.predecessorRequirement || '' });
    setIsModalOpen(true);
  };

  const handleSyncToQA = (story) => {
    if (window.confirm(`Deseja avançar imediatamente para o QA com este requisito?\n\n"${story.text.substring(0, 40)}..."\n\nAs outras histórias pendentes ficarão para depois.`)) {
      onAdvance(story);
    }
  };

  const todoStories = stories.filter((story) => story.status === 'todo');
  const processedStories = stories.filter((story) => story.status === 'done' || story.status === 'processing');
  const allStoriesProcessed = stories.length > 0 && todoStories.length === 0;

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-2xl font-bold text-gray-800">{title}</h2>
      <p className="mb-6 text-sm text-gray-600">{subtitle}</p>

      {syncError && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{syncError}</div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-gray-200 bg-gray-100 p-4 md:max-h-[600px]">
          <h3 className="sticky top-0 mb-4 bg-gray-100 py-2 font-bold text-gray-700">Histórias ({todoStories.length})</h3>
          {allStoriesProcessed ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
              <h4 className="text-lg font-bold text-green-800">Tudo pronto</h4>
              <p className="my-2 text-green-700">Todas as histórias foram processadas.</p>
              <button onClick={onAllStoriesDone} className="mt-2 w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
                Avançar para a próxima etapa
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todoStories.map((story) => {
                const isReadyForDrag = !processing && story.isReady;
                return (
                  <div
                    key={story.id}
                    draggable={isReadyForDrag}
                    onDragStart={(e) => isReadyForDrag && handleDragStart(e, story)}
                    className={`group rounded border border-gray-200 bg-white p-4 shadow-sm transition-all ${
                      isReadyForDrag ? 'cursor-move hover:shadow-md active:scale-95' : 'cursor-not-allowed bg-gray-50 opacity-50'
                    }`}
                    title={!isReadyForDrag && stageName === 'qa' ? 'Esta história ainda não foi processada na etapa de requisitos.' : ''}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm text-gray-800">{story.text}</span>
                      {isReadyForDrag && <span className="text-gray-400 group-hover:text-blue-500">⋮⋮</span>}
                    </div>
                    {story.predecessorRequirement && (
                      <div
                        className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded border border-indigo-100 bg-indigo-50 px-2 py-1 text-xs text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal({ ...story, requirement: story.predecessorRequirement });
                        }}
                      >
                        <span>📎</span> Requisito anexado
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`flex min-h-[320px] max-h-[420px] flex-col overflow-y-auto rounded-xl border-2 p-4 transition-colors md:max-h-[600px] ${
            processing ? 'border-solid border-blue-300 bg-blue-50' : 'border-dashed border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <h3 className="sticky top-0 mb-4 flex items-center gap-2 bg-inherit py-2 font-bold text-blue-800">
            {agentColumnTitle}
            {processing && <span className="animate-pulse text-xs font-normal">(Processando...)</span>}
          </h3>

          <div className="flex-1 space-y-4">
            {processedStories.map((story) => (
              <div key={story.id} className="rounded border border-green-200 bg-green-50 p-4">
                <div className="mb-2 text-xs font-semibold uppercase text-green-800">História processada</div>
                <p className="mb-3 text-sm italic text-gray-700">"{story.text}"</p>
                <div className="rounded border border-green-100 bg-white p-3 text-sm">
                  {story.status === 'processing' ? (
                    <div className="flex items-center gap-2 text-blue-600">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {processingMessage}
                    </div>
                  ) : (
                    <div>
                      <p className="mb-3 text-xs text-gray-600">Gerado com sucesso.</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button onClick={() => handleOpenModal(story)} className="w-full rounded bg-blue-500 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-blue-600">
                          Ver detalhes
                        </button>
                        {stageName === 'requirements' && (
                          <button onClick={() => handleSyncToQA(story)} className="flex w-full items-center justify-center gap-2 rounded bg-indigo-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-indigo-700">
                            <span>🚀</span> Salvar e ir para QA
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {processedStories.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-gray-400 opacity-50">
                <p className="mb-2 text-4xl">📥</p>
                <p>Arraste cards aqui para processar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-3 sm:p-4" onClick={() => setIsModalOpen(false)}>
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b bg-white p-4">
              <h3 className="pr-4 text-base font-semibold text-gray-800 sm:text-lg">{modalContent.title}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-3xl font-light leading-none text-gray-500 hover:text-gray-800">&times;</button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-6">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{modalContent.content}</ReactMarkdown>
              </div>
            </div>
            <div className="sticky bottom-0 border-t bg-gray-50 p-4 text-right">
              <button onClick={() => setIsModalOpen(false)} className="rounded-lg bg-gray-200 px-5 py-2 font-semibold text-gray-800 hover:bg-gray-300">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
