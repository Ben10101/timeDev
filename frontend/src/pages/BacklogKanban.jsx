import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { ListChecks, Rocket, Check, Copy, AlertTriangle, Clock, ChevronRight, X } from 'lucide-react';
import { createTaskArtifact, ensurePipelineProject, importBacklogTasks, listProjectTasks, listAllTasks, listProjects } from '../services/api';

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

  return storyLines.map((text, index) => {
    const cleanText = text.replace(/^[-*]?\s*\d*\.?\s*(?:\*\*)?/, '').replace(/\*\*/g, '').trim();
    
    // Derive priority
    let priority = 'MEDIUM';
    const lowKeywords = ['melhoria', 'low', 'baixa', 'estético', 'non-critical'];
    const highKeywords = ['urgente', 'fix', 'urgency', 'crítico', 'critical', 'erro', 'bug'];
    const textLower = cleanText.toLowerCase();
    if (highKeywords.some(k => textLower.includes(k))) priority = 'HIGH';
    else if (lowKeywords.some(k => textLower.includes(k))) priority = 'LOW';

    return {
      id: `story-${index}`,
      text: cleanText,
      title: cleanText.split(' - ')[0] || cleanText,
      status: 'todo',
      priority,
      requirement: null,
      isReady: true,
    };
  });
}

function mapTasksToStories(tasks, stageName) {
  return tasks
    .map((task) => {
      const requirementsArtifact = task.artifacts?.find((artifact) => artifact.artifactType === 'requirements' && artifact.isCurrent);
      const qaArtifact = task.artifacts?.find((artifact) => artifact.artifactType === 'test_plan' && artifact.isCurrent);

      if (stageName === 'qa' && !requirementsArtifact) {
        return null;
      }

      // Derive priority from title or description
      let priority = 'MEDIUM';
      const lowKeywords = ['melhoria', 'low', 'baixa', 'estético', 'non-critical'];
      const highKeywords = ['urgente', 'fix', 'urgency', 'crítico', 'critical', 'erro', 'bug'];
      const textToSearch = (task.title + ' ' + (task.description || '')).toLowerCase();
      if (highKeywords.some(k => textToSearch.includes(k))) priority = 'HIGH';
      else if (lowKeywords.some(k => textToSearch.includes(k))) priority = 'LOW';

      return {
        id: task.uuid,
        text: task.title,
        title: task.title,
        status: stageName === 'requirements' ? (requirementsArtifact ? 'done' : 'todo') : qaArtifact ? 'done' : 'todo',
        priority: task.priority || priority,
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
  global = false,
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
    if (global) {
      const tasks = await listAllTasks();
      setStories(mapTasksToStories(tasks, stageName));
      return;
    }

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
    setModalContent({ 
      title: story.text, 
      content: story.requirement || story.predecessorRequirement || '',
      priority: story.priority
    });
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
    <div className="mt-12 space-y-12 pb-24">
      {/* Premium Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="glass-card overflow-hidden p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative border-white/10"
      >
        <div className="relative z-10">
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="premium-gradient-text mb-4 text-5xl font-black tracking-tighter"
          >
            {title}
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="max-w-2xl text-xl font-medium text-slate-400/90 leading-relaxed"
          >
            {subtitle}
          </motion.p>
        </div>
        
        {/* Animated Accent Glows */}
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-[hsl(var(--accent-h),var(--accent-s),var(--accent-l),0.15)] blur-[120px] animate-pulse"></div>
        <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-[hsl(var(--accent-secondary-h),var(--accent-secondary-s),var(--accent-secondary-l),0.1)] blur-[100px]"></div>
      </motion.div>

      {syncError && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <div className="mb-8 rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-6 text-sm font-bold text-rose-300 backdrop-blur-2xl ring-1 ring-rose-500/30">
            <div className="flex items-center gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-xl shadow-lg">⚠️</span>
              {syncError}
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid gap-12 lg:grid-cols-2">
        {/* Available Stories Column */}
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 shadow-sm group/col transition-all duration-300 hover:border-[#102a72]/30 hover:shadow-md">
          <div className="mb-8 flex items-center justify-between border-b border-slate-100 pb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#102a72]/10 text-[#102a72] border border-[#102a72]/20 group-hover/col:scale-105 transition-transform">
                <ListChecks className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight text-slate-900">Backlog</h3>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">{todoStories.length} itens pendentes</p>
              </div>
            </div>
          </div>

          <div className="max-h-[700px] overflow-y-auto pr-3 custom-scrollbar">
            {allStoriesProcessed ? (
              <div className="flex flex-col items-center justify-center rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 p-12 text-center backdrop-blur-xl animate-in zoom-in-95">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20 text-5xl shadow-[0_0_50px_rgba(16,185,129,0.3)] premium-glow">
                  ✨
                </div>
                <h4 className="text-2xl font-black text-emerald-400">Fluxo Concluído</h4>
                <p className="mt-3 mb-8 text-slate-400 font-medium">Todas as suas histórias foram processadas com maestria.</p>
                <button 
                  onClick={onAllStoriesDone} 
                  className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-emerald-600 px-8 py-5 font-black text-white transition-all hover:bg-emerald-500 hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] active:scale-[0.98]"
                >
                  Continuar Jornada
                  <span className="text-2xl transition-transform group-hover:translate-x-2">→</span>
                </button>
              </div>
            ) : (
              <div className="grid gap-5">
                <AnimatePresence>
                  {todoStories.map((story) => {
                    const isReadyForDrag = !processing && story.isReady;
                    return (
                      <motion.div
                        key={story.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        draggable={isReadyForDrag}
                        onDragStart={(e) => isReadyForDrag && handleDragStart(e, story)}
                        className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${
                          isReadyForDrag 
                            ? 'cursor-grab border-slate-200 bg-white shadow-sm hover:border-[#102a72]/40 hover:shadow-md active:cursor-grabbing active:scale-[0.98]' 
                            : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-40 grayscale'
                        }`}
                      >
                        <div className="p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`flex h-2 w-2 rounded-full ${
                                  story.priority === 'HIGH' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' :
                                  story.priority === 'LOW' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 
                                  'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                                }`}></span>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${
                                  story.priority === 'HIGH' ? 'text-rose-400' :
                                  story.priority === 'LOW' ? 'text-emerald-400' : 
                                  'text-amber-400'
                                }`}>
                                  Prioridade {story.priority}
                                </span>
                              </div>
                              <h5 className="text-sm font-semibold leading-snug text-slate-800 group-hover:text-[#102a72] transition-colors">{story.title}</h5>
                            </div>
                            {isReadyForDrag && (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition-all group-hover:bg-[#102a72]/10 group-hover:text-[#102a72]">
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                               </div>
                            )}
                          </div>
                          
                          <p className="text-sm leading-relaxed text-slate-500 line-clamp-2 mb-4">{story.text}</p>
                          
                          {story.predecessorRequirement && (
                            <button
                              className="mt-3 flex items-center gap-2 rounded-lg bg-[#102a72]/5 px-3 py-2 text-xs font-semibold text-[#102a72] ring-1 ring-[#102a72]/20 transition-all hover:bg-[#102a72]/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenModal({ ...story, requirement: story.predecessorRequirement });
                              }}
                            >
                              <span className="text-base">💎</span> Requisito Vinculado
                            </button>
                          )}
                        </div>
                        
                        {/* Interactive glow inside the card */}
                        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/0 via-transparent to-purple-500/0 opacity-0 transition-opacity duration-700 group-hover:opacity-20"></div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Drop Zone Column */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`min-h-[500px] flex flex-col rounded-2xl border p-8 transition-all duration-300 group/drop ${
            processing 
              ? 'border-[#102a72]/40 ring-4 ring-[#102a72]/10 bg-[#102a72]/5 shadow-md' 
              : 'border-slate-200 bg-white shadow-sm hover:border-[#102a72]/30 hover:shadow-md'
          }`}
        >
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover/drop:scale-105 transition-transform">
                <Rocket className="h-6 w-6" />
              </div>
              <div className="flex items-center gap-4">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary-h),var(--primary-s),var(--primary-l))] text-2xl shadow-2xl shadow-[hsl(var(--primary-h),var(--primary-s),var(--primary-l),0.4)] ${processing ? 'animate-pulse' : 'group-hover/drop:scale-110 transition-transform duration-500'}`}>
                  🤖
                </span>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-slate-900">{agentColumnTitle}</h3>
                  <p className="text-[11px] font-medium text-slate-400 mt-0.5">Arraste para implantar</p>
                </div>
              </div>
            </div>
          </div>
            {processing && (
              <div className="flex items-center gap-4 rounded-full bg-[hsl(var(--accent-h),var(--accent-s),var(--accent-l),0.1)] px-5 py-2 ring-1 ring-[hsl(var(--accent-h),var(--accent-s),var(--accent-l),0.2)]">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--accent-h),var(--accent-s),var(--accent-l))]" style={{ animationDelay: '0ms' }}></span>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--accent-h),var(--accent-s),var(--accent-l))]" style={{ animationDelay: '150ms' }}></span>
                  <span className="h-2 w-2 animate-bounce rounded-full bg-[hsl(var(--accent-h),var(--accent-s),var(--accent-l))]" style={{ animationDelay: '300ms' }}></span>
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[hsl(var(--accent-h),var(--accent-s),var(--accent-l))]">Processando</span>
              </div>
            )}

          <div className="flex-1 space-y-8">
            <AnimatePresence mode="popLayout">
              {processedStories.map((story) => (
                <motion.div 
                  key={story.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="group relative overflow-hidden rounded-[2rem] border border-emerald-500/10 bg-white/[0.02] p-8 backdrop-blur-3xl shadow-xl"
                >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 rounded-full bg-emerald-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-400 ring-1 ring-emerald-500/20">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] pulse-glow"></span>
                    Artefato Pronto
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest border ${
                    story.priority === 'HIGH' ? 'border-rose-500/20 text-rose-400 bg-rose-500/5' :
                    story.priority === 'LOW' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5' :
                    'border-amber-500/20 text-amber-400 bg-amber-500/5'
                  }`}>
                    {story.priority}
                  </div>
                </div>

                <h4 className="mb-3 text-xl font-black text-white pr-4">{story.title}</h4>

                <p className="mb-8 text-base font-medium text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors italic">"{story.text}"</p>
                
                <div className="rounded-2xl border border-white/5 bg-white/5 p-5 transition-all group-hover:bg-white/10 group-hover:shadow-inner">
                  {story.status === 'processing' ? (
                    <div className="flex items-center gap-5 py-3 text-indigo-400">
                      <div className="relative h-12 w-12">
                        <svg className="h-full w-full animate-rotate" viewBox="0 0 50 50">
                          <circle className="stroke-indigo-500/10" cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
                          <circle className="stroke-indigo-400" cx="25" cy="25" r="20" fill="none" strokeWidth="5" strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round"></circle>
                        </svg>
                      </div>
                      <span className="text-lg font-black tracking-tight pulse-glow">{processingMessage}</span>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <button 
                        onClick={() => handleOpenModal(story)} 
                        className="flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-black text-white transition-all hover:bg-white/10 hover:border-white/20 active:scale-95"
                      >
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                         Visualizar
                      </button>
                      {stageName === 'requirements' && (
                         <button 
                           onClick={() => handleSyncToQA(story)} 
                           className="glass-button-primary flex items-center justify-center gap-3 py-4 text-sm font-black text-white"
                         >
                           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                           Avançar para QA
                         </button>
                      )}
                    </div>
                  )}
                </div>
                </motion.div>
              ))}
            </AnimatePresence>

          </div>

          {/* Animated background lines for processing zone */}
          <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden rounded-[2.5rem]">
             <div className="absolute top-0 left-1/3 h-full w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent"></div>
             <div className="absolute top-0 right-1/3 h-full w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent"></div>
          </div>
        </div>
      </div>

      {/* Modern Glass Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-2xl p-4 sm:p-8" 
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="glass-card relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]" 
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex bg-white/[0.03] p-8 backdrop-blur-2xl border-b border-white/5">
                <div className="flex-1 pr-12">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${
                      modalContent.priority === 'HIGH' ? 'border-rose-500/20 text-rose-400 bg-rose-500/10' :
                      modalContent.priority === 'LOW' ? 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10' :
                      'border-amber-500/20 text-amber-400 bg-amber-500/10'
                    }`}>
                      {modalContent.priority} PRIORITY
                    </span>
                    <span className="h-1 w-1 rounded-full bg-white/20"></span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Documentação Elite</span>
                  </div>
                  <h3 className="text-3xl font-black tracking-tight text-white premium-gradient-text uppercase leading-tight">{modalContent.title}</h3>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(modalContent.content);
                      // In a real app we'd show a toast here
                    }}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400 transition-all hover:bg-white/10 hover:text-white group"
                    title="Copiar Documentação"
                  >
                    <Copy className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-400 transition-all hover:bg-rose-500/20 hover:text-rose-400 hover:rotate-90"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] overflow-hidden">
                <div className="overflow-y-auto p-10 custom-scrollbar bg-slate-900/40">
                  <div className="prose prose-invert prose-indigo max-w-none 
                    prose-h1:text-indigo-400 prose-h2:text-indigo-300 prose-h3:text-slate-200
                    prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-lg
                    prose-strong:text-white prose-strong:font-black
                    prose-code:bg-white/5 prose-code:p-1 prose-code:rounded-lg
                    prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/5 prose-pre:rounded-2xl shadow-inner scroll-smooth">
                    <ReactMarkdown>{modalContent.content || '*Aguardando geração do conteúdo pelo agente...*'}</ReactMarkdown>
                  </div>
                </div>
                
                {/* Modal Sidebar (Metadata) */}
                <div className="hidden lg:flex flex-col border-l border-white/5 bg-white/[0.01] p-8 space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status do Fluxo</h4>
                    <div className="flex items-center gap-3 text-emerald-400">
                      <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                      <span className="text-sm font-bold tracking-tight">Artefato Disponível</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-8 border-t border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inteligência Aplicada</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-white">
                        <Rocket className="h-4 w-4 text-violet-400" />
                        <span className="text-xs font-semibold">Gemini 1.5 Pro</span>
                      </div>
                      <div className="flex items-center gap-3 text-white">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span className="text-xs font-semibold">Análise Multimodal</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-8">
                     <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4">
                        <p className="text-[10px] font-medium text-indigo-300/80 leading-relaxed italic">
                           "Este documento reflete a visão técnica refinada para esta funcionalidade."
                        </p>
                     </div>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-white/5 bg-white/[0.03] p-8 flex items-center justify-between backdrop-blur-2xl">
                <span className="text-xs font-bold text-slate-500">Última atualização: {new Date().toLocaleDateString()}</span>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="rounded-2xl bg-white px-10 py-4 font-black text-slate-950 shadow-2xl transition-all hover:bg-slate-100 hover:scale-[1.02] active:scale-95"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
