import React, { useState, useEffect } from 'react';
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

export default function BacklogKanban({ backlogMarkdown, projectId }) {
  const [stories, setStories] = useState([]);
  const [draggedStory, setDraggedStory] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Analisa o Markdown para extrair User Stories ao carregar
  useEffect(() => {
    let storyLines = [];

    if (backlogMarkdown) {
      // Extrai histórias do markdown fornecido
      storyLines = backlogMarkdown.split('\n').filter(line => line.trim().match(/^(?:-|\d+\.)?\s*Como\s+/i));
    } else {
      // Usa dados mockados se nenhum markdown for fornecido
      storyLines = MOCK_STORIES;
    }
    const extractedStories = storyLines
      .map((text, index) => ({
        id: `story-${index}`,
        text: text.replace(/^(?:-|\d+\.)?\s*/, ''), // Remove marcadores de lista
        status: 'todo', // todo, processing, done
        requirement: null
      }));

    setStories(extractedStories);
  }, [backlogMarkdown, projectId]);

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
      // Chama o Agente de Requisitos apenas para esta história
      // Isso economiza tokens pois não envia o backlog inteiro
      const response = await axios.post('/api/agents/run', {
        agent: 'requirements_analyst',
        payload: {
          project_id: projectId,
          idea: "Foco na análise desta história de usuário específica.",
          backlog: `User Story Única para Análise:\n${draggedStory.text}`
        }
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
        s.id === storyId ? { ...s, status: 'error' } : s
      ));
      alert("Erro ao processar a história com o agente.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">🗂️ Kanban de Histórias</h2>
      <p className="text-sm text-gray-600 mb-6">
        Arraste uma História de Usuário para a área do Agente de Requisitos para gerar requisitos específicos.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[600px]">
        
        {/* Coluna 1: Backlog (Cards) */}
        <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 overflow-y-auto">
          <h3 className="font-bold text-gray-700 mb-4 sticky top-0 bg-gray-100 py-2">
            📝 Histórias ({stories.filter(s => s.status === 'todo').length})
          </h3>
          <div className="space-y-3">
            {stories.filter(s => s.status === 'todo').map(story => (
              <div
                key={story.id}
                draggable={!processing}
                onDragStart={(e) => handleDragStart(e, story)}
                className="bg-white p-4 rounded shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-all active:scale-95 group"
              >
                <div className="flex justify-between items-start">
                  <span className="text-gray-800 text-sm">{story.text}</span>
                  <span className="text-gray-400 group-hover:text-blue-500">⋮⋮</span>
                </div>
              </div>
            ))}
            {stories.filter(s => s.status === 'todo').length === 0 && (
              <p className="text-center text-gray-400 mt-10">Todas as histórias foram processadas!</p>
            )}
          </div>
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
            🤖 Agente de Requisitos 
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
                
                <div className="bg-white p-3 rounded border border-green-100 text-sm prose prose-sm max-w-none">
                  {story.status === 'processing' ? (
                     <div className="flex items-center gap-2 text-blue-600">
                       <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       Gerando requisitos técnicos...
                     </div>
                  ) : (
                    <ReactMarkdown>{story.requirement}</ReactMarkdown>
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
    </div>
  );
}