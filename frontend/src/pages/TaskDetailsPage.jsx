import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { createTaskArtifact, createTaskComment, getTask, runTaskQa, runTaskRequirements } from '../services/api';

function formatDate(value) {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleString('pt-BR');
}

function formatElapsed(seconds) {
  if (!seconds) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function hasCurrentArtifact(task, artifactType) {
  return (task?.artifacts || []).some((artifact) => artifact.artifactType === artifactType && artifact.isCurrent);
}

export default function TaskDetailsPage() {
  const { projectUuid, taskUuid } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [commentBody, setCommentBody] = useState('');
  const [editingArtifactId, setEditingArtifactId] = useState(null);
  const [artifactDraft, setArtifactDraft] = useState('');
  const bootstrapContext = JSON.parse(localStorage.getItem('factory_bootstrap_context') || 'null');
  const taskHasRequirements = hasCurrentArtifact(task, 'requirements');

  async function loadTask() {
    setLoading(true);
    setError(null);
    try {
      const result = await getTask(taskUuid);
      setTask(result);
    } catch (loadError) {
      setError(loadError.response?.data?.error || loadError.message || 'Não foi possível carregar a task.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTask();
  }, [taskUuid]);

  async function handleCommentSubmit(e) {
    e.preventDefault();
    if (!commentBody.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await createTaskComment(taskUuid, {
        body: commentBody,
        authorUserUuid: bootstrapContext?.user?.uuid,
      });
      setCommentBody('');
      await loadTask();
    } catch (submitError) {
      setError(submitError.response?.data?.error || submitError.message || 'Não foi possível salvar o comentário.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRunRequirements() {
    setSaving(true);
    setError(null);
    try {
      await runTaskRequirements(taskUuid, {
        changedByUserUuid: bootstrapContext?.user?.uuid,
      });
      await loadTask();
    } catch (submitError) {
      setError(
        submitError.response?.data?.error ||
          submitError.response?.data?.message ||
          submitError.message ||
          'Não foi possível executar o Analista de Requisitos.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRunQa() {
    setSaving(true);
    setError(null);
    try {
      await runTaskQa(taskUuid, {
        changedByUserUuid: bootstrapContext?.user?.uuid,
      });
      await loadTask();
    } catch (submitError) {
      setError(
        submitError.response?.data?.error ||
          submitError.response?.data?.message ||
          submitError.message ||
          'Não foi possível executar o QA Engineer.'
      );
    } finally {
      setSaving(false);
    }
  }

  function handleStartArtifactEdit(artifact) {
    setEditingArtifactId(artifact.id);
    setArtifactDraft(artifact.content || '');
  }

  function handleCancelArtifactEdit() {
    setEditingArtifactId(null);
    setArtifactDraft('');
  }

  async function handleSaveArtifactEdit(artifact) {
    setSaving(true);
    setError(null);
    try {
      await createTaskArtifact(taskUuid, {
        artifactType: artifact.artifactType,
        title: artifact.title,
        content: artifactDraft,
        contentFormat: artifact.contentFormat || 'markdown',
        createdByUserUuid: bootstrapContext?.user?.uuid,
      });
      handleCancelArtifactEdit();
      await loadTask();
    } catch (submitError) {
      setError(
        submitError.response?.data?.error ||
          submitError.response?.data?.message ||
          submitError.message ||
          'Não foi possível salvar a edição do artefato.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      eyebrow="Task Detail"
      title={task?.title || 'Detalhe da task'}
      description="Acompanhe contexto, artefatos, histórico, execuções de agentes e o tempo consumido em cada etapa da tarefa."
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleRunRequirements}
            disabled={saving || loading}
            className="w-full rounded-2xl bg-[#17322b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#214338] disabled:opacity-50 sm:w-auto"
          >
            Refinar com Requirements
          </button>
          <button
            onClick={handleRunQa}
            disabled={saving || loading || !taskHasRequirements}
            className="w-full rounded-2xl bg-[#7b3aa4] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6d3194] disabled:opacity-50 sm:w-auto"
          >
            Executar QA
          </button>
          <button
            onClick={() => navigate(`/projects?project=${projectUuid}`)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Voltar ao board
          </button>
        </div>
      }
      sidebar={
        <>
          <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Resumo</p>
            {task ? (
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p><strong>Projeto:</strong> {task.project?.name}</p>
                <p><strong>Status:</strong> {task.status}</p>
                <p><strong>Prioridade:</strong> {task.priority}</p>
                <p><strong>Responsável:</strong> {task.assigneeAgentName || task.assigneeUser?.name || 'Sem responsável'}</p>
                <p><strong>Criada em:</strong> {formatDate(task.createdAt)}</p>
                <p><strong>Tempo total:</strong> {formatElapsed(task.timing?.leadTimeSeconds)}</p>
                <p><strong>Tempo em requisitos:</strong> {formatElapsed(task.timing?.requirementsTimeSeconds)}</p>
                <p><strong>Tempo em QA:</strong> {formatElapsed(task.timing?.qaTimeSeconds)}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Carregando...</p>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-[#faf8f2] p-5 shadow-[0_20px_60px_rgba(23,50,43,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Navegação</p>
            <div className="mt-4 space-y-3">
              <Link to="/projects" className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                Ver todos os projetos
              </Link>
              <Link to={`/projects/${projectUuid}`} className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                Voltar ao overview do projeto
              </Link>
            </div>
          </section>
        </>
      }
    >
      <section className="space-y-6">
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        )}

        {loading ? (
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-8 text-center text-slate-500 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
            Carregando detalhes da task...
          </div>
        ) : task ? (
          <>
            <div className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Descrição</p>
              <h2 className="mt-3 font-serif text-2xl font-semibold text-slate-900 sm:text-3xl">{task.title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">{task.description || 'Sem descrição cadastrada.'}</p>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Comentários</p>
                  <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                    {task.comments?.length || 0}
                  </span>
                </div>

                <form className="mt-5 space-y-3" onSubmit={handleCommentSubmit}>
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    rows="4"
                    placeholder="Registrar contexto, alinhamentos ou feedback sobre a task..."
                    className="w-full rounded-[22px] border border-slate-200 bg-[#faf8f2] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#8aac55] focus:ring-4 focus:ring-[#dff0b8]"
                  />
                  <button disabled={saving || !commentBody.trim()} className="w-full rounded-2xl bg-[#17322b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#214338] disabled:opacity-50 sm:w-auto">
                    Adicionar comentário
                  </button>
                </form>

                <div className="mt-6 space-y-3">
                  {task.comments?.map((comment) => (
                    <article key={comment.id} className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          {comment.authorUser?.name || comment.authorAgentName || 'Sistema'}
                        </p>
                        <span className="text-xs text-slate-500">{formatDate(comment.createdAt)}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{comment.body}</p>
                    </article>
                  ))}
                  {!task.comments?.length && (
                    <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                      Nenhum comentário ainda.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Artefatos</p>
                  <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                    {task.artifacts?.length || 0}
                  </span>
                </div>
                <div className="mt-5 space-y-3">
                  {task.artifacts?.map((artifact) => (
                    <article key={artifact.id} className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{artifact.title}</h3>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                            {artifact.artifactType} • v{artifact.version}
                          </p>
                        </div>
                        <span className={`w-fit rounded-full px-3 py-1 text-[11px] font-semibold ${artifact.isApproved ? 'bg-[#e5f3e8] text-[#2f6c58]' : 'bg-[#fff5d9] text-[#8a6a1f]'}`}>
                          {artifact.isApproved ? 'Aprovado' : 'Pendente'}
                        </span>
                      </div>
                      {editingArtifactId === artifact.id ? (
                        <div className="mt-4 space-y-3">
                          <textarea
                            value={artifactDraft}
                            onChange={(e) => setArtifactDraft(e.target.value)}
                            rows="12"
                            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-700 outline-none transition focus:border-[#8aac55] focus:ring-4 focus:ring-[#dff0b8]"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveArtifactEdit(artifact)}
                              disabled={saving || !artifactDraft.trim()}
                              className="rounded-2xl bg-[#17322b] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#214338] disabled:opacity-50"
                            >
                              Salvar nova versão
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelArtifactEdit}
                              className="rounded-2xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs leading-6 text-slate-600">
                            {artifact.content}
                          </pre>
                          {artifact.isCurrent && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => handleStartArtifactEdit(artifact)}
                                className="rounded-2xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Editar artefato
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </article>
                  ))}
                  {!task.artifacts?.length && (
                    <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                      Nenhum artefato associado a esta task.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Execuções de agentes</p>
                <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                  {task.agentRuns?.length || 0} runs
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {task.agentRuns?.map((run) => (
                  <article key={run.id} className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{run.agentName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {run.status} • {formatElapsed(run.startedAt ? Math.round((new Date(run.finishedAt || Date.now()).getTime() - new Date(run.startedAt).getTime()) / 1000) : 0)}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">{formatDate(run.startedAt)}</span>
                    </div>
                    {run.errorMessage && <p className="mt-3 text-sm text-rose-600">{run.errorMessage}</p>}
                  </article>
                ))}
                {!task.agentRuns?.length && (
                  <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    Nenhuma execução de agente registrada ainda.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Histórico</p>
                <span className="rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold text-[#2f6c58]">
                  {task.statusHistory?.length || 0} eventos
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {task.statusHistory?.map((item) => (
                  <article key={item.id} className="rounded-[22px] border border-slate-200 bg-[#faf8f2] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.fromStatus || 'novo'} → {item.toStatus}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.changedByUser?.name || item.changedByAgentName || 'Sistema'}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">{formatDate(item.changedAt)}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{item.note || 'Sem observação.'}</p>
                  </article>
                ))}
                {!task.statusHistory?.length && (
                  <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                    Nenhum histórico disponível.
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
