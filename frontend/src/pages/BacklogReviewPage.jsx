import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ProjectStageNav from '../components/ProjectStageNav';
import { getApiErrorMessage, getProject, publishProjectBacklog, updateProjectBacklogStory } from '../services/api';

export default function BacklogReviewPage() {
  const { projectUuid } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [stories, setStories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ title: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const visibleStories = stories.filter((story) => {
    if (filter === 'aligned') return ['confirmed', 'aligned', 'ready'].includes(String(story.status || '').toLowerCase());
    if (filter === 'review') return !['confirmed', 'aligned', 'ready'].includes(String(story.status || '').toLowerCase());
    return true;
  });

  useEffect(() => {
    getProject(projectUuid).then((data) => {
      setProject(data);
      setStories(data?.intakeConfig?.backlogContract?.stories || []);
    }).catch((err) => setError(getApiErrorMessage(err, 'Não foi possível carregar a revisão.')));
  }, [projectUuid]);

  function startEdit(story) {
    setEditing(story.id || story.uuid);
    setDraft({ title: story.title || '', description: story.description || '' });
  }

  async function saveEdit(story) {
    setBusy(true);
    try {
      const updated = await updateProjectBacklogStory(projectUuid, story.id, draft);
      setStories((current) => current.map((item) => item.id === story.id ? { ...item, ...updated } : item));
      setEditing(null);
    } catch (err) { setError(getApiErrorMessage(err, 'Não foi possível salvar a story.')); }
    finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true);
    try { await publishProjectBacklog(projectUuid); navigate(`/projects/${projectUuid}`); }
    catch (err) { setError(getApiErrorMessage(err, 'Não foi possível publicar as tasks.')); }
    finally { setBusy(false); }
  }

  return <AppShell mainClassName="p-4" eyebrow="Revisão do backlog" title="Validação humana das tasks" description="Revise o conteúdo antes de publicar no board." actions={<button className="dashboard-button-secondary" onClick={() => navigate(`/projects/${projectUuid}`)}>Voltar ao projeto</button>}>
    <ProjectStageNav projectUuid={projectUuid} active="review" completed={['briefing', 'requirements', 'backlog']} />
    <section className="w-full rounded-3xl border border-slate-200 bg-white">
      <div>
        <aside className="grid items-center gap-4 border-b border-slate-200 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Resumo</p>
          <div>
            <p className="text-2xl font-bold text-slate-900">{stories.length} histórias geradas</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{project?.name || 'Projeto'} aguarda aprovação.</p>
          </div>
          <button onClick={publish} disabled={busy || !stories.length} className="dashboard-button-primary w-full md:w-auto">{busy ? 'Publicando...' : 'Aprovar e enviar ao board'}</button>
        </aside>
        <div className="p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">O que saiu</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[['all', 'Todas'], ['aligned', 'Alinhadas'], ['review', 'Precisam de revisão']].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === value ? 'border-[#102a72] bg-[#102a72] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}
          </div>
          {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleStories.map((story, index) => {
              const aligned = ['confirmed', 'aligned', 'ready'].includes(String(story.status || '').toLowerCase());
              return <article key={story.id || index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Story {index + 1}</p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${aligned ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {aligned ? 'Alinhada' : 'Precisa de revisão'}
                </span>
              </div>
              {editing === (story.id || story.uuid) ? <>
                <input className="dashboard-input mt-2" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                <textarea className="dashboard-input mt-3 min-h-[110px]" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                <div className="mt-3 flex gap-2"><button className="dashboard-button-primary px-3 py-1.5 text-xs" onClick={() => saveEdit(story)} disabled={busy}>Salvar</button><button className="dashboard-button-secondary px-3 py-1.5 text-xs" onClick={() => setEditing(null)}>Cancelar</button></div>
              </> : <><h3 className="mt-2 font-semibold text-slate-900">{story.title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{story.description || 'Sem descrição adicional.'}</p>
                <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                  <span><strong>Release:</strong> {story.release || 'Não definida'}</span>
                  <span><strong>Prioridade:</strong> {story.priority || 'Não definida'}</span>
                  <span><strong>Evidências:</strong> {Array.isArray(story.source_ids || story.sourceIds) ? (story.source_ids || story.sourceIds).length : 0}</span>
                </div>
                {(story.review_tags?.length || story.reviewTags?.length) ? <p className="mt-2 text-xs text-amber-700"><strong>Revisar:</strong> {(story.review_tags || story.reviewTags).join(' · ')}</p> : null}
                {(story.open_questions?.length || story.openQuestions?.length) ? <p className="mt-2 text-xs text-amber-700"><strong>Perguntas abertas:</strong> {(story.open_questions || story.openQuestions).length}</p> : null}
                <button className="mt-4 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold" onClick={() => startEdit(story)}>Editar no local</button></>}
            </article>;
            })}
          </div>
        </div>
      </div>
    </section>
  </AppShell>;
}
