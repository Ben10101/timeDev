import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PencilLine } from 'lucide-react';
import AppShell from '../components/AppShell';
import ConfirmDialog from '../components/ConfirmDialog';
import BacklogKanban from './BacklogKanban';
import {
  approveProjectArchitecture,
  generateProjectArchitecture,
  generateProjectBacklog,
  getApiErrorMessage,
  getProject,
  getProjectArchitectureStatus,
  listProjectTasks,
  updateProjectStatus,
} from '../services/api';
import { exportProjectDocumentationPdf } from '../utils/projectDocumentationExport';
import { getProjectStatusConfirmationMessage, getProjectStatusWorkflow } from '../utils/projectStatus';

const STORY_SHORTCUT_EXAMPLES = [
  {
    label: 'SaaS operacional',
    idea: 'Plataforma para times operacionais registrarem solicitacoes, acompanharem status, anexarem evidencias e aprovarem excecoes com trilha de auditoria.',
    objective: 'Reduzir retrabalho operacional e dar visibilidade do fluxo ponta a ponta.',
    audience: 'Analistas de operacoes, lideres de equipe e gestores.',
    mainFlows: 'Abrir solicitação, priorizar fila, aprovar exceção, acompanhar SLA e consultar histórico.',
    constraints: 'Controle de acesso por perfil, histórico imutável e notificações de atraso.',
  },
  {
    label: 'Portal do cliente',
    idea: 'Portal para clientes acompanharem pedidos, documentos pendentes, mensagens e status de atendimento em uma timeline unica.',
    objective: 'Diminuir volume de suporte e aumentar autonomia do cliente.',
    audience: 'Clientes finais e equipe de atendimento.',
    mainFlows: 'Consultar pedido, enviar documentos, responder pendencias e acompanhar timeline.',
    constraints: 'Experiência mobile, notificações e integração com sistema interno.',
  },
];

function TextAreaField({ label, value, onChange, placeholder, rows = 4, disabled = false }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{label}</span>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`dashboard-input min-h-[120px] resize-none ${disabled ?'cursor-not-allowed bg-slate-100 text-slate-500' : ''}`}
      />
    </label>
  );
}

export default function ProjectOverviewPage() {
  const navigate = useNavigate();
  const { projectUuid } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [architectureStatus, setArchitectureStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingArchitecture, setGeneratingArchitecture] = useState(false);
  const [approvingArchitecture, setApprovingArchitecture] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusDialog, setStatusDialog] = useState({ open: false, nextStatus: null });
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [briefingResult, setBriefingResult] = useState(null);
  const [editingStory, setEditingStory] = useState(null);
  const [storyDraft, setStoryDraft] = useState({ title: '', description: '' });
  const [storySaving, setStorySaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [form, setForm] = useState({
    idea: '',
    objective: '',
    audience: '',
    mainFlows: '',
    constraints: '',
  });
  const groupedStats = useMemo(
    () => ({
      total: tasks.length,
      backlog: tasks.filter((task) => task.status === 'backlog').length,
      qa: tasks.filter((task) => task.status === 'qa').length,
      done: tasks.filter((task) => task.status === 'done').length,
    }),
    [tasks]
  );
  const hasGeneratedStories = useMemo(
    () => tasks.some((task) => task.taskType === 'story') || Boolean(project?.intakeConfig?.backlogContract?.stories?.length),
    [project?.intakeConfig?.backlogContract?.stories?.length, tasks]
  );
  const ideaLength = form.idea.trim().length;
  const shortcutReady = ideaLength >= 40;
  const riskCount = project?.intakeConfig?.riskRegister?.risks?.length || 0;
  const impedimentCount = project?.intakeConfig?.riskRegister?.impediments?.length || 0;
  const projectStatusMeta = useMemo(() => getProjectStatusWorkflow(project?.status || 'draft'), [project?.status]);
  const projectJourney = useMemo(() => {
    if (!tasks.length) {
      return {
        stage: 'Briefing',
        title: 'Consolidar briefing e gerar stories',
        message: 'Descreva o produto com contexto suficiente e deixe o PM Agent abrir o backlog inicial.',
        tone: 'border-slate-200 bg-white text-slate-900',
        ctaLabel: 'Abrir briefing',
        ctaAction: () => setShowBriefingModal(true),
        ctaDisabled: loading,
        ctaType: 'button',
      };
    }

    if (!architectureStatus?.hasArchitecture) {
      return {
        stage: 'Arquitetura',
        title: 'Gerar arquitetura do projeto',
        message: 'O backlog já existe. O próximo passo é materializar a arquitetura para liberar implementação.',
        tone: 'border-slate-200 bg-white text-slate-900',
        ctaLabel: generatingArchitecture ?'Gerando arquitetura...' : 'Gerar arquitetura',
        ctaAction: handleGenerateArchitecture,
        ctaDisabled: loading || generatingArchitecture || !architectureStatus?.canGenerateArchitecture,
        ctaType: 'button',
      };
    }

    if (!architectureStatus?.architectureApproved) {
      return {
        stage: 'Aprovação',
        title: 'Fazer aprovação humana da arquitetura',
        message: 'A arquitetura já foi gerada, mas a implementação ainda depende dessa aprovação.',
        tone: 'border-slate-200 bg-white text-slate-900',
        ctaLabel: approvingArchitecture ?'Aprovando...' : 'Aprovar arquitetura',
        ctaAction: handleApproveArchitecture,
        ctaDisabled: loading || approvingArchitecture || !architectureStatus?.hasArchitecture || architectureStatus?.architectureApproved,
        ctaType: 'button',
      };
    }

    return {
      stage: 'Kanban',
      title: 'Abrir o kanban do projeto refinado',
      message: 'Briefing, backlog e arquitetura já estão prontos. Agora siga pelo kanban dentro do contexto do projeto refinado.',
      tone: 'border-slate-200 bg-white text-slate-900',
      ctaLabel: 'Abrir kanban do projeto',
      ctaAction: scrollToRefinementBoard,
      ctaDisabled: false,
      ctaType: 'button',
    };
  }, [
    tasks.length,
    architectureStatus,
    hasGeneratedStories,
    generating,
    loading,
    generatingArchitecture,
    approvingArchitecture,
    navigate,
    projectUuid,
    project?.name,
    project?.description,
    project?.intakeConfig?.idea,
    project?.intakeConfig?.answers,
    form,
  ]);

  function clampStoryText(value, maxLength = 110) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trimEnd()}...`;
  }

  useEffect(() => {
    loadOverview();
  }, [projectUuid]);

  async function loadOverview() {
    setLoading(true);
    setError(null);

    try {
      const [projectData, taskList, nextArchitectureStatus] = await Promise.all([
        getProject(projectUuid),
        listProjectTasks(projectUuid),
        getProjectArchitectureStatus(projectUuid),
      ]);

      setProject(projectData);
      setTasks(taskList);
      setArchitectureStatus(nextArchitectureStatus);
      setForm({
        idea: projectData?.intakeConfig?.idea || projectData?.description || '',
        objective: projectData?.intakeConfig?.objective || projectData?.intakeConfig?.answers?.objective || '',
        audience: projectData?.intakeConfig?.audience || projectData?.intakeConfig?.answers?.audience || '',
        mainFlows: projectData?.intakeConfig?.answers?.mainFlows || '',
        constraints: projectData?.intakeConfig?.answers?.constraints || '',
      });
    } catch (loadError) {
      if (loadError.response?.status === 404) {
        navigate('/projects', { replace: true });
        return;
      }
      setError(getApiErrorMessage(loadError, 'Não foi possível carregar o overview do projeto.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateBacklog(event) {
    event.preventDefault();

    if (!form.idea.trim()) {
      setError('Descreva a ideia do projeto antes de acionar o PM Agent.');
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccessMessage('');
    setBriefingResult(null);

    try {
      const response = await generateProjectBacklog(projectUuid, {
        idea: form.idea,
        description: form.idea,
        vision: form.objective || project?.vision || '',
        answers: {
          objective: form.objective,
          audience: form.audience,
          mainFlows: form.mainFlows,
          constraints: form.constraints,
        },
      });

      setProject(response.project);
      setTasks(response.tasks || []);
      const nextArchitectureStatus = await getProjectArchitectureStatus(projectUuid);
      setArchitectureStatus(nextArchitectureStatus);
      setForm({
        idea: response.project?.intakeConfig?.idea || form.idea,
        objective: response.project?.intakeConfig?.objective || response.project?.intakeConfig?.answers?.objective || form.objective,
        audience: response.project?.intakeConfig?.audience || response.project?.intakeConfig?.answers?.audience || form.audience,
        mainFlows: response.project?.intakeConfig?.answers?.mainFlows || form.mainFlows,
        constraints: response.project?.intakeConfig?.answers?.constraints || form.constraints,
      });
      const generatedStories = (response.tasks || [])
        .filter((task) => task.taskType !== 'agent_job')
        .slice(0, 3)
        .map((task) => ({
          uuid: task.uuid,
          title: task.title,
          description: task.description || '',
          status: task.status,
        }));
      const taskCount = (response.tasks || []).filter((task) => task.taskType !== 'agent_job').length || (response.tasks || []).length || 0;
      setBriefingResult({
        projectName: response.project?.name || project?.name || 'Projeto',
        totalStories: taskCount,
        generatedStories,
        nextStep: nextArchitectureStatus?.hasArchitecture
          ? 'A próxima etapa é revisar a arquitetura.'
          : 'A próxima etapa é abrir a arquitetura para liberar implementação.',
      });
      setShowBriefingModal(false);
      setSuccessMessage('User stories geradas com sucesso.');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível gerar o backlog do projeto.'));
    } finally {
      setGenerating(false);
    }
  }

  function applyShortcutExample(example) {
    setForm({
      idea: example.idea,
      objective: example.objective,
      audience: example.audience,
      mainFlows: example.mainFlows,
      constraints: example.constraints,
    });
    setError(null);
    setSuccessMessage('');
  }

  function openStoryEditor(task) {
    if (!task) return;
    setEditingStory(task);
    setStoryDraft({
      title: task.title || '',
      description: task.description || '',
    });
  }

  async function handleSaveStoryEdit(event) {
    event.preventDefault();

    if (!editingStory?.uuid) return;

    if (!storyDraft.title.trim()) {
      setError('O título da story é obrigatório.');
      return;
    }

    setStorySaving(true);
    setError(null);

    try {
      const updatedTask = await updateTask(editingStory.uuid, {
        title: storyDraft.title.trim(),
        description: storyDraft.description.trim(),
      });

      setTasks((current) => current.map((task) => (task.uuid === updatedTask.uuid ? updatedTask : task)));
      setBriefingResult((current) => {
        if (!current?.generatedStories?.length) return current;
        return {
          ...current,
          generatedStories: current.generatedStories.map((story) =>
            story.uuid === updatedTask.uuid
              ? {
                  ...story,
                  title: updatedTask.title,
                  description: updatedTask.description || '',
                }
              : story
          ),
        };
      });
      setEditingStory(null);
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, 'Não foi possível atualizar a story.'));
    } finally {
      setStorySaving(false);
    }
  }

  async function handleGenerateArchitecture() {
    setGeneratingArchitecture(true);
    setError(null);
    setSuccessMessage('');

    try {
      await generateProjectArchitecture(projectUuid);
      const nextArchitectureStatus = await getProjectArchitectureStatus(projectUuid);
      setArchitectureStatus(nextArchitectureStatus);
      setSuccessMessage('Arquitetura do projeto gerada e estrutura base preparada para a implementação.');
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível gerar a arquitetura do projeto.'));
    } finally {
      setGeneratingArchitecture(false);
    }
  }

  async function handleApproveArchitecture() {
    setApprovingArchitecture(true);
    setError(null);
    setSuccessMessage('');

    try {
      const response = await approveProjectArchitecture(projectUuid);
      setArchitectureStatus(response.architectureStatus);
      setSuccessMessage('Arquitetura aprovada com sucesso. A implementação e a exportação final foram liberadas.');
    } catch (approveError) {
      setError(getApiErrorMessage(approveError, 'Não foi possível aprovar a arquitetura atual.'));
    } finally {
      setApprovingArchitecture(false);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    setError(null);

    try {
      await exportProjectDocumentationPdf(projectUuid);
    } catch (exportError) {
      setError(getApiErrorMessage(exportError, 'Não foi possível exportar a documentação em PDF.'));
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleProjectStatusChange(nextStatus) {
    if (!project?.uuid) return;

    setUpdatingStatus(true);
    setError(null);
    setSuccessMessage('');

    try {
      const updatedProject = await updateProjectStatus(project.uuid, nextStatus);
      setProject(updatedProject);
      setSuccessMessage(
        nextStatus === 'archived'
          ? 'Projeto arquivado com sucesso.'
          : nextStatus === 'on_hold'
            ? 'Projeto colocado em pausa.'
            : 'Projeto reativado com sucesso.'
      );
    } catch (statusError) {
      setError(getApiErrorMessage(statusError, 'Não foi possível atualizar o status do projeto.'));
    } finally {
      setUpdatingStatus(false);
    }
  }

  function requestProjectStatusChange(nextStatus) {
    setStatusDialog({ open: true, nextStatus });
  }

  function scrollToRefinementBoard() {
    const target = document.getElementById('project-refinement-board');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function openCodeStudio() {
    navigate(`/code-studio?project=${projectUuid}`);
  }

  return (
    <>
      <AppShell
        eyebrow="Visão do Projeto"
        title={project?.name || 'Projeto'}
        description="Descreva a iniciativa, gere user stories com o PM Agent e siga para o kanban com as tasks prontas."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={() => navigate('/projects')} className="dashboard-button-secondary w-full sm:w-auto">
              Voltar para projetos
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || exportingPdf || (architectureStatus?.hasArchitecture && !architectureStatus?.architectureApproved)}
              className="dashboard-button-secondary w-full sm:w-auto"
              title={
                architectureStatus?.hasArchitecture && !architectureStatus?.architectureApproved
                  ? 'A exportação final depende da aprovação humana da arquitetura.'
                  : undefined
              }
            >
              {exportingPdf ? 'Preparando PDF...' : 'Exportar PDF'}
            </button>
            <button
              type={projectJourney.ctaType}
              onClick={projectJourney.ctaType === 'button' ? projectJourney.ctaAction : undefined}
              disabled={projectJourney.ctaDisabled}
              className="dashboard-button-primary w-full sm:w-auto"
            >
              {projectJourney.ctaLabel}
            </button>
            <button
              type="button"
              onClick={() => requestProjectStatusChange(projectStatusMeta.primaryTarget)}
              disabled={loading || updatingStatus}
              className="dashboard-button-secondary w-full sm:w-auto"
            >
              {updatingStatus ? 'Atualizando...' : projectStatusMeta.primaryAction}
            </button>
          </div>
        }
        sidebar={
          <>
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Saude do projeto</p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {[
                  [groupedStats.total, 'Tasks'],
                  [groupedStats.backlog, 'Backlog'],
                  [groupedStats.qa, 'Em QA'],
                  [groupedStats.done, 'Concluídas'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="text-2xl font-semibold text-slate-900">{value}</div>
                    <div className="mt-1 text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className={`rounded-2xl border p-5 shadow-sm ${projectJourney.tone}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Próxima ação</p>
              <p className="mt-3 text-base font-semibold text-slate-900">{projectJourney.title}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{projectJourney.message}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Etapa atual: {projectJourney.stage}
              </p>
              <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${projectStatusMeta.tone}`}>
                Status do projeto: {projectStatusMeta.label}
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type={projectJourney.ctaType}
                  onClick={projectJourney.ctaType === 'button' ? projectJourney.ctaAction : undefined}
                  disabled={projectJourney.ctaDisabled}
                  className="dashboard-button-secondary w-full bg-white/80"
                >
                  {projectJourney.ctaLabel}
                </button>
                <button
                  type="button"
                  onClick={scrollToRefinementBoard}
                  className="dashboard-button-secondary w-full bg-white/70"
                >
                  Abrir kanban do projeto
                </button>
                <button
                  type="button"
                  onClick={openCodeStudio}
                  className="dashboard-button-secondary w-full bg-white/70"
                >
                  Abrir Code Studio
                </button>
                <button
                  type="button"
                  onClick={() => requestProjectStatusChange(projectStatusMeta.primaryTarget)}
                  disabled={loading || updatingStatus}
                  className="dashboard-button-secondary w-full bg-white/70"
                >
                  {updatingStatus ? 'Atualizando...' : projectStatusMeta.primaryAction}
                </button>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {riskCount} riscos · {impedimentCount} impedimentos
              </p>
            </section>
          </>
        }
      >
      <section className="space-y-6">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {successMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{successMessage}</div>}
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-4 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Fluxo do projeto</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{projectJourney.title}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{projectJourney.message}</p>
            </div>
            <div className={`rounded-2xl border px-5 py-4 ${projectJourney.tone}`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Etapa atual</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{projectJourney.stage}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {tasks.length} tasks · {groupedStats.done} concluídas · {architectureStatus?.hasArchitecture ?'arquitetura gerada' : 'arquitetura pendente'}
              </p>
              <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${projectStatusMeta.tone}`}>
                Status do projeto: {projectStatusMeta.label}
              </div>
            </div>
          </div>
        </section>
        <section className="hidden dashboard-panel" id="project-briefing-form">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Contexto inicial</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">Briefing do projeto</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  O resumo do projeto fica visível aqui. Quando quiser detalhar ou gerar novas stories, abra o briefing em modal.
                </p>
              </div>
              <button type="button" onClick={() => setShowBriefingModal(true)} className="dashboard-button-primary">
                {hasGeneratedStories ? 'Revisar briefing' : 'Abrir briefing'}
              </button>
            </div>
          </div>
          <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">{project?.name || 'Carregando projeto...'}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {project?.description || 'Este projeto ainda não tem um briefing consolidado.'}
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {project?.vision || 'Defina o objetivo do projeto e use o PM Agent para abrir o backlog com contexto.'}
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Estado</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{hasGeneratedStories ? 'Briefing consolidado' : 'Pode editar'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Entrada</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{ideaLength} caracteres</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Saída</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">User stories</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leitura rápida</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Onde estamos</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{projectJourney.stage}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Próxima entrega</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{projectJourney.title}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p><strong>Workspace:</strong> {project?.workspace?.name || '-'}</p>
                  <p><strong>Status:</strong> {project?.status || '-'}</p>
                  <p><strong>Template:</strong> {project?.templateKey || 'Sem template'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Etapa 2</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Arquitetura e aprovação</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Gere a arquitetura só quando o backlog estiver maduro. Depois, faça a aprovação humana para liberar implementação e exportação final.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={handleApproveArchitecture}
                  disabled={loading || approvingArchitecture || !architectureStatus?.hasArchitecture || architectureStatus?.architectureApproved}
                  className="dashboard-button-secondary w-full sm:w-auto"
                  title={!architectureStatus?.hasArchitecture ?'Gere a arquitetura antes de aprovar.' : architectureStatus?.architectureApproved ?'A arquitetura atual já foi aprovada.' : undefined}
                >
                  {approvingArchitecture ?'Aprovando...' : architectureStatus?.architectureApproved ?'Arquitetura aprovada' : 'Aprovar arquitetura'}
                </button>
                <button
                  type="button"
                  onClick={handleGenerateArchitecture}
                  disabled={loading || generatingArchitecture || !architectureStatus?.canGenerateArchitecture}
                  className="dashboard-button-primary w-full sm:w-auto"
                  title={!architectureStatus?.canGenerateArchitecture ?architectureStatus?.blockers?.[0] : undefined}
                >
                  {generatingArchitecture ?'Gerando arquitetura...' : 'Gerar arquitetura do projeto'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-6 lg:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Histórias refinadas</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {architectureStatus?.refinedStories || 0}/{architectureStatus?.totalStories || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Arquitetura</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {architectureStatus?.hasArchitecture
                  ?architectureStatus?.architectureApproved
                    ?'Aprovada'
                    : 'Pendente de aprovação'
                  : 'Pendente'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Implementação</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {architectureStatus?.canGenerateCode ?'Liberada' : 'Bloqueada'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Aprovação humana</p>
              <p className="mt-3 text-lg font-bold text-slate-900">
                {architectureStatus?.hasArchitecture
                  ?architectureStatus?.architectureApproved
                    ?'Aprovada'
                    : 'Pendente'
                  : 'Aguardando'}
              </p>
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

        <section className="dashboard-panel" id="project-refinement-board">
          <div className="dashboard-panel-header">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Etapa 3</p>
                <h3 className="mt-2 text-xl font-bold text-slate-900">Kanban do projeto</h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Aqui você refina e acompanha as tasks dentro do contexto deste projeto, sem sair da visão operacional.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                {tasks.length} tasks
              </span>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">Carregando overview...</div>
            ) : (
              <BacklogKanban
                backlogMarkdown=""
                projectId={projectUuid}
                stageName="requirements"
                title="Kanban do projeto"
                subtitle="Use este quadro para refinar as tasks do projeto no contexto correto, sem separar o trabalho da visão do projeto."
                agentColumnTitle="Analista de Requisitos do Projeto"
                contextLabel="projeto"
              />
            )}
          </div>
        </section>
      </section>
      </AppShell>
      <AnimatePresence>
        {briefingResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/15 bg-white shadow-2xl"
            >
              <div className="border-b border-slate-200 px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#102a72]">Resultado do briefing</p>
                <h3 className="mt-2 text-3xl font-bold text-slate-900">Stories prontas para o board</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  O PM Agent terminou a geração e organizou o resultado de forma fácil de revisar.
                </p>
              </div>

              <div className="grid gap-5 px-6 py-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 xl:sticky xl:top-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Resumo</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{briefingResult.totalStories} histórias geradas</p>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {briefingResult.projectName} agora tem um backlog inicial pronto para seguir para arquitetura e execução.
                  </p>
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                    {briefingResult.nextStep}
                  </div>
                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Formato</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Leitura rápida e editável</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Próximo passo</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Abrir arquitetura</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">O que saiu</p>
                      <p className="mt-2 text-sm text-slate-600">
                        A lista abaixo mostra as stories geradas e permite ajustar cada uma sem sair do modal.
                      </p>
                    </div>
                    <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:block">
                      {briefingResult.generatedStories.length} itens
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {briefingResult.generatedStories.length ? (
                      briefingResult.generatedStories.map((story, index) => (
                        <article
                          key={story.uuid || `${story.title}-${index}`}
                          className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#102a72]/25 hover:bg-white"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Story {index + 1}</p>
                              <h4 className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-900">
                                {clampStoryText(story.title, 120)}
                              </h4>
                            </div>
                            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold capitalize text-slate-600">
                              {story.status}
                            </span>
                          </div>
                          {story.description ? (
                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{story.description}</p>
                          ) : (
                            <p className="mt-3 text-sm leading-6 text-slate-500">Sem descrição adicional.</p>
                          )}
                          <div className="mt-auto pt-4">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openStoryEditor(story);
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-[#102a72]/30 hover:bg-[#102a72]/5 hover:text-[#102a72]"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              Ajustar story
                            </button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        O PM Agent concluiu o briefing, mas não retornou stories detalhadas.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setBriefingResult(null);
                    navigate(`/projects/${projectUuid}`);
                  }}
                  className="dashboard-button-primary w-full sm:w-auto"
                >
                  Abrir projeto
                </button>
                <button
                  type="button"
                  onClick={() => setBriefingResult(null)}
                  className="dashboard-button-secondary w-full sm:w-auto"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editingStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-md"
          >
            <motion.form
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleSaveStoryEdit}
              className="w-full max-w-2xl rounded-[30px] border border-white/15 bg-white shadow-2xl"
            >
              <div className="border-b border-slate-200 px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#102a72]">Editar story</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-900">Ajustar story gerada</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Edite o texto da story sem sair do contexto do projeto.
                </p>
              </div>

              <div className="grid gap-4 px-6 py-6">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Título</span>
                  <input
                    value={storyDraft.title}
                    onChange={(event) => setStoryDraft((prev) => ({ ...prev, title: event.target.value }))}
                    className="dashboard-input"
                    placeholder="Título da story"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Descrição</span>
                  <textarea
                    value={storyDraft.description}
                    onChange={(event) => setStoryDraft((prev) => ({ ...prev, description: event.target.value }))}
                    rows={5}
                    className="dashboard-input min-h-[140px] resize-none"
                    placeholder="Descreva a story com mais contexto."
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditingStory(null)}
                  className="dashboard-button-secondary w-full sm:w-auto"
                  disabled={storySaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="dashboard-button-primary w-full sm:w-auto" disabled={storySaving}>
                  {storySaving ? 'Salvando...' : 'Salvar story'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showBriefingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm"
            onClick={() => setShowBriefingModal(false)}
          >
            <motion.form
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleGenerateBacklog}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-[32px] border border-slate-200 bg-white shadow-2xl"
            >
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-3xl">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Briefing do projeto</p>
                    <h3 className="mt-2 text-3xl font-bold text-slate-900">Etapa 1 · Gerar user stories</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Descreva o produto com contexto suficiente e o PM Agent transforma isso em user stories acionáveis para o board.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBriefingModal(false)}
                    className="dashboard-button-secondary px-3 py-2 text-xs"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              {generating && (
                <div className="border-b border-blue-200 bg-blue-50 px-6 py-4 text-[#102a72]">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 animate-pulse rounded-full bg-[#102a72]" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">PM Agent executando o briefing</p>
                      <p className="mt-1 text-sm leading-6 text-blue-900/80">
                        Estamos transformando sua descrição em user stories, critérios e backlog inicial. Isso pode levar alguns segundos.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 px-6 py-6 lg:grid-cols-2">
                <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#102a72]">Antes de gerar</p>
                      <h4 className="mt-2 text-xl font-bold text-slate-900">Dê contexto suficiente para nascer um backlog bom</h4>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        O PM Agent responde melhor quando entende usuário, objetivo, fluxos e restrições logo nesta primeira etapa.
                      </p>
                      {hasGeneratedStories && (
                        <p className="mt-3 text-sm leading-6 text-amber-700">
                          Já existem user stories no projeto. Você pode ajustar o briefing e gerar novamente; o importador evita duplicar títulos iguais.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {STORY_SHORTCUT_EXAMPLES.map((example) => (
                        <button
                          key={example.label}
                          type="button"
                          onClick={() => applyShortcutExample(example)}
                          className="dashboard-button-secondary px-3 py-2 text-xs"
                        >
                          Usar exemplo {example.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Entrada</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{shortcutReady ? 'Boa para gerar' : 'Precisa de mais contexto'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Tamanho da ideia</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{ideaLength} caracteres</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Saída</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Stories prontas para o board</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <TextAreaField
                    label="Problema que resolve"
                    value={form.idea}
                    onChange={(event) => setForm((prev) => ({ ...prev, idea: event.target.value }))}
                    placeholder="Descreva o produto, o problema que ele resolve e o resultado esperado."
                    rows={5}
                    disabled={generating || loading}
                  />
                </div>
                <TextAreaField
                  label="Objetivo"
                  value={form.objective}
                  onChange={(event) => setForm((prev) => ({ ...prev, objective: event.target.value }))}
                  placeholder="Qual transformação esse projeto deve entregar?"
                  rows={3}
                    disabled={generating || loading}
                />
                <TextAreaField
                  label="Quem usa"
                  value={form.audience}
                  onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))}
                  placeholder="Quem usa isso e em qual contexto?"
                  rows={3}
                    disabled={generating || loading}
                />
                <TextAreaField
                  label="Fluxos principais"
                  value={form.mainFlows}
                  onChange={(event) => setForm((prev) => ({ ...prev, mainFlows: event.target.value }))}
                  placeholder="Ex.: cadastrar cliente, consultar histórico, acompanhar dashboard."
                  rows={3}
                    disabled={generating || loading}
                />
                <TextAreaField
                  label="Restrições ou riscos"
                  value={form.constraints}
                  onChange={(event) => setForm((prev) => ({ ...prev, constraints: event.target.value }))}
                  placeholder="Regras, dependências e limitações técnicas ou operacionais."
                  rows={3}
                    disabled={generating || loading}
                />

                <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={loadOverview} disabled={loading || generating} className="dashboard-button-secondary w-full sm:w-auto">
                    Recarregar projeto
                  </button>
                    <button type="button" onClick={() => setShowBriefingModal(false)} className="dashboard-button-secondary w-full sm:w-auto">
                      Cancelar
                    </button>
                  <button disabled={generating || loading} className="dashboard-button-primary w-full sm:w-auto">
                    {hasGeneratedStories
                      ? 'Regerar user stories'
                      : generating
                        ? 'PM Agent gerando...'
                        : 'Gerar user stories agora'}
                  </button>
                </div>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {generating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-xl rounded-[30px] border border-white/15 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#102a72] text-white shadow-lg shadow-[#102a72]/30">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#102a72]">Processando briefing</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">PM Agent executando o briefing</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    Estamos transformando a descrição do projeto em user stories, critérios e backlog inicial. Não feche esta janela até a conclusão.
                  </p>
                  <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-[#102a72]">
                    Gerando stories acionáveis e preparando o board para a próxima etapa.
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={statusDialog.open}
        title="Confirmar alteração de status"
        description={
          statusDialog.nextStatus
            ? getProjectStatusConfirmationMessage(project?.name || 'projeto', statusDialog.nextStatus)
            : ''
        }
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        intent={statusDialog.nextStatus === 'archived' ? 'warning' : 'primary'}
        loading={updatingStatus}
        onConfirm={() => {
          const nextStatus = statusDialog.nextStatus;
          setStatusDialog({ open: false, nextStatus: null });
          if (nextStatus) {
            handleProjectStatusChange(nextStatus);
          }
        }}
        onClose={() => setStatusDialog({ open: false, nextStatus: null })}
      />
    </>
  );
}

