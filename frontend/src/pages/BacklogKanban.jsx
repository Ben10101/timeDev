import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

const MOCK_STORIES = [
  "Como um cliente, eu quero adicionar um produto ao carrinho de compras, para que possa continuar com a compra.",
  "Como um cliente, eu quero atualizar a quantidade de um produto no carrinho de compras, para que possa fazer alterações caso necessário.",
  "Como um cliente, eu quero remover um produto do carrinho de compras, para que possa excluir itens que não necessito mais.",
  "Como um cliente, eu quero aplicar descontos e promoções, para que possa tirar vantagem de ofertas e promoções disponíveis.",
  "Como um cliente, eu quero receber notificações sobre o status de minha compra, para que possa acompanhar o progresso do pedido.",
  "Como administrador, eu quero gerenciar o catálogo de produtos, adicionando, editando e removendo itens.",
  "Como administrador, eu quero visualizar os pedidos realizados na plataforma para poder processá-los."
];

const EMPTY_ARRAY = [];

export default function BacklogKanban({ 
  backlogMarkdown, 
  projectId: propProjectId,
  // Novas props para customização do agente e textos
  stageName = 'requirements', // 'requirements' ou 'qa'
  agent = 'requirements_analyst',
  title = '🗂️ Kanban de Histórias',
  subtitle = 'Arraste uma História de Usuário para a área do Agente de Requisitos para gerar requisitos específicos.',
  agentColumnTitle = '🤖 Agente de Requisitos',
  processingMessage = 'Gerando requisitos técnicos...',
  promptInstruction = "Atue como um Analista de Requisitos Sênior. Refine esta história de usuário gerando uma especificação técnica detalhada. Inclua: 1. Critérios de Aceite (formato Gherkin: Dado/Quando/Então), 2. Regras de Negócio Importantes, 3. Cenários de Exceção/Erros e 4. Sugestão de Modelo de Dados.",
  predecessorStories = EMPTY_ARRAY, // Dados da etapa anterior (opcional)
  onAllStoriesDone = () => {}, // Callback para avançar quando tudo estiver pronto
  onAdvance = () => {} // Callback para avançar imediatamente (forçado)
}) {
  const { projectId: paramProjectId } = useParams();
  const projectId = propProjectId || paramProjectId; // Aceita ID via props ou URL
  const [stories, setStories] = useState([]);
  const [draggedStory, setDraggedStory] = useState(null);
  const [processing, setProcessing] = useState(false);
  // Estados para o modal de visualização de requisitos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', content: '' });

  // Chave única para salvar no localStorage dependendo do estágio (req ou qa)
  const storageKey = `kanban_stories_${projectId}_${stageName}`;

  // Analisa o Markdown para extrair User Stories ao carregar
  useEffect(() => {
    // 1. Tenta recuperar estado salvo (persistência) para não perder progresso
    if (projectId) {
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        setStories(JSON.parse(savedState));
        return;
      }
    }

    let storyLines = [];

    if (backlogMarkdown) {
      // 2. Extrai histórias do markdown (Melhorado para aceitar **Como**, 1. Como, - Como)
      storyLines = backlogMarkdown.split('\n').filter(line => line.trim().match(/^[-*]?\s*\d*\.?\s*(?:\*\*)?Como\b/i));
    } else {
      // Usa dados mockados se nenhum markdown for fornecido
      storyLines = MOCK_STORIES;
    }
    let extractedStories = storyLines
      .map((text, index) => ({
        id: `story-${index}`,
        text: text.replace(/^[-*]?\s*\d*\.?\s*(?:\*\*)?/, '').replace(/\*\*/g, '').trim(), // Limpa formatação (numeros, bullets, bold)
        status: 'todo', // todo, processing, done
        requirement: null,
        isReady: stageName !== 'qa' // Por padrão, as histórias estão prontas, a menos que seja a etapa de QA
      }));

    // QA: Em vez de filtrar, marca as histórias como prontas ou não para esta etapa.
    if (stageName === 'qa' && predecessorStories && predecessorStories.length > 0) {
        extractedStories.forEach(story => {
            const match = predecessorStories.find(p => (p.id === story.id || p.text.trim() === story.text.trim()));
            // Uma história está pronta para QA se foi marcada como 'done' na etapa anterior.
            story.isReady = !!(match && match.status === 'done' && match.requirement);
        });
    }

    setStories(extractedStories);
  }, [backlogMarkdown, projectId, storageKey, stageName, predecessorStories]);

  // 3. Salva o estado no localStorage sempre que houver mudanças (drag & drop ou requisitos gerados)
  useEffect(() => {
    if (projectId && stories.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(stories));
    }
  }, [stories, projectId, storageKey]);

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
    
    // Atualiza UI para processando
    setStories(prev => prev.map(s => 
      s.id === storyId ? { ...s, status: 'processing' } : s
    ));
    setProcessing(true);
    setDraggedStory(null);

    try {
      // Prepara o payload. Se houver dados da etapa anterior (ex: requisitos para o QA), inclui no contexto.
      let backlogPayload = `História de Usuário:\n${draggedStory.text}`;
      
      if (predecessorStories.length > 0) {
        // Tenta encontrar por ID (mais confiável) ou Texto
        const match = predecessorStories.find(s => s.id === draggedStory.id) || 
                      predecessorStories.find(s => s.text.trim() === draggedStory.text.trim());
                      
        if (match && match.requirement) {
          backlogPayload += `\n\n📋 REQUISITOS TÉCNICOS ESTRUTURADOS:\n${match.requirement}`;
        }
      }

      // Monta o payload dinamicamente
      const payloadData = {
          project_id: projectId,
          idea: promptInstruction, // Prompt dinâmico
          backlog: backlogPayload
      };

      // FIX: Backend valida presença de 'code' para QA.
      // Em TDD, injetamos o contexto (história+requisitos) como 'code' para passar na validação.
      if (agent === 'qa_engineer') {
          payloadData.code = backlogPayload;
          payloadData.developer_output = { code: backlogPayload };
      }

      // Chama o Agente de Requisitos apenas para esta história
      // Isso economiza tokens pois não envia o backlog inteiro
      const response = await axios.post('/api/agents/run', {
        agent: agent, // Agente dinâmico (requirements ou qa)
        payload: payloadData
      });

      const result = response.data.data || response.data;

      // Atualiza o card com o resultado
      setStories(prev => prev.map(s => 
        s.id === storyId ? { 
          ...s, 
          status: 'done', 
          requirement: typeof result === 'string' ? result : JSON.stringify(result) 
        } : s
      ));

    } catch (error) {
      console.error("Erro ao processar história:", error);
      setStories(prev => prev.map(s => 
        s.id === storyId ? { ...s, status: 'todo' } : s // Volta para 'todo' em caso de erro
      ));
      alert("Erro ao processar a história com o agente.");
    } finally {
      setProcessing(false);
    }
  };

  // Funções para controlar o modal
  const handleOpenModal = (story) => {
    setModalContent({ title: story.text, content: story.requirement });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Função manual para garantir o envio para o QA
  const handleSyncToQA = (story) => {
    localStorage.setItem(storageKey, JSON.stringify(stories));
    // Confirmação rápida para o usuário entender que vai pular as outras histórias
    if(window.confirm(`Deseja avançar IMEDIATAMENTE para o QA Engineer com este requisito?\n\n"${story.text.substring(0, 40)}..."\n\n(As outras histórias pendentes ficarão para depois)`)) {
        onAdvance();
    }
  };

  const todoStories = stories.filter(s => s.status === 'todo');
  const allStoriesProcessed = stories.length > 0 && todoStories.length === 0;

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
      <p className="text-sm text-gray-600 mb-6">
        {subtitle}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[600px]">
        
        {/* Coluna 1: Backlog (Cards) */}
        <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 overflow-y-auto">
          <h3 className="font-bold text-gray-700 mb-4 sticky top-0 bg-gray-100 py-2">
            📝 Histórias ({todoStories.length})
          </h3>
          {allStoriesProcessed ? (
            <div className="text-center p-6 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-lg font-bold text-green-800">🎉 Tudo Pronto!</h4>
              <p className="text-green-700 my-2">Todas as histórias foram processadas.</p>
              <button 
                onClick={onAllStoriesDone}
                className="mt-2 w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-300"
              >
                Avançar para a Próxima Etapa
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {todoStories.map(story => {
                const predecessor = predecessorStories.find(p => (p.id === story.id || p.text.trim() === story.text.trim()) && p.requirement);
                const isReadyForDrag = !processing && story.isReady;

                return (
                  <div 
                    key={story.id} 
                    draggable={isReadyForDrag} 
                    onDragStart={(e) => isReadyForDrag && handleDragStart(e, story)} 
                    className={`bg-white p-4 rounded shadow-sm border border-gray-200 transition-all group ${
                      isReadyForDrag 
                        ? 'cursor-move hover:shadow-md active:scale-95' 
                        : 'opacity-50 bg-gray-50 cursor-not-allowed'
                    }`}
                    title={!isReadyForDrag && stageName === 'qa' ? 'Esta história ainda não foi processada na etapa de Requisitos.' : ''}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-gray-800 text-sm">{story.text}</span>
                      {isReadyForDrag && <span className="text-gray-400 group-hover:text-blue-500">⋮⋮</span>}
                    </div>
                    {predecessor && (
                      <div className="mt-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-flex items-center gap-1 border border-indigo-100 cursor-pointer hover:bg-indigo-100 hover:text-indigo-800 transition-colors" onClick={(e) => { e.stopPropagation(); handleOpenModal({ text: `Requisito Anexado: ${story.text}`, requirement: predecessor.requirement }); }} title="Clique para visualizar o requisito herdado da etapa anterior">
                        <span>📎</span> Requisito Anexado
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coluna 2: Área do Agente (Drop Zone + Resultados) */}
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`flex flex-col p-4 rounded-xl border-2 transition-colors overflow-y-auto ${
            processing 
              ? 'bg-blue-50 border-blue-300 border-solid' 
              : 'bg-white border-dashed border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <h3 className="font-bold text-blue-800 mb-4 sticky top-0 bg-inherit py-2 flex items-center gap-2">
            {agentColumnTitle} 
            {processing && <span className="text-xs font-normal animate-pulse">(Processando...)</span>}
          </h3>

          {/* Lista de Processados */}
          <div className="flex-1 space-y-4">
            {stories.filter(s => s.status === 'done' || s.status === 'processing').map(story => (
              <div key={story.id} className="bg-green-50 border border-green-200 rounded p-4">
                <div className="font-semibold text-green-800 text-xs uppercase mb-2">
                  História Processada
                </div>
                <p className="text-gray-700 text-sm mb-3 italic">"{story.text}"</p>
                
                <div className="bg-white p-3 rounded border border-green-100 text-sm">
                  {story.status === 'processing' ? (
                     <div className="flex items-center gap-2 text-blue-600">
                       <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       {processingMessage}
                     </div>
                  ) : (
                    <div>
                      <p className="text-gray-600 text-xs mb-3">Gerado com sucesso.</p>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => handleOpenModal(story)} className="w-full text-center px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded hover:bg-blue-600 transition">
                          Ver Detalhes
                        </button>
                        {stageName === 'requirements' && (
                          <button onClick={() => handleSyncToQA(story)} className="w-full text-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition flex items-center justify-center gap-2" title="Avançar imediatamente para a próxima etapa apenas com este requisito">
                            <span>🚀</span> Salvar e Ir para QA
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {stories.filter(s => s.status === 'done' || s.status === 'processing').length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                <p className="text-4xl mb-2">📥</p>
                <p>Arraste cards aqui para processar</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para visualizar o requisito completo */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={handleCloseModal}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-800">{modalContent.title}</h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-800 text-3xl font-light leading-none">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{modalContent.content}</ReactMarkdown>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 text-right sticky bottom-0">
              <button onClick={handleCloseModal} className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-semibold">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}