import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { createTaskArtifact, getApiErrorMessage, getTask, repairTaskArtifact, reviewTaskArtifact } from '../services/api';

function diffLines(oldText = '', newText = '') {
  const oldLines = String(oldText).split('\n');
  const newLines = String(newText).split('\n');
  return Array.from({ length: Math.max(oldLines.length, newLines.length) }, (_, index) => ({
    old: oldLines[index] || '', current: newLines[index] || '',
    type: oldLines[index] === newLines[index] ? 'same' : !oldLines[index] ? 'added' : !newLines[index] ? 'removed' : 'changed',
  }));
}

function extractPendingDecisions(content = '') {
  const match = String(content).match(/^##\s+Decisoes pendentes\s*\r?\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/im);
  const planningOnly = /^(definir a prioridade|confirmar dependencias|definir requisitos nao funcionais|definir metricas|avaliar viabilidade|definir quem valida|avaliar o impacto)/i;
  return (match?.[1] || '').split('\n').map((line) => line.replace(/^\s*[-*]\s*/, '').trim()).filter((line) => line && !planningOnly.test(line));
}

function ArtifactMarkdown({ content }) {
  return <div className="max-w-none text-sm leading-7 text-slate-700">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (props) => <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-950" {...props} />,
        h2: (props) => <h2 className="mb-3 mt-8 border-b border-slate-200 pb-2 text-lg font-bold text-slate-900" {...props} />,
        h3: (props) => <h3 className="mb-2 mt-5 text-base font-bold text-slate-800" {...props} />,
        p: (props) => <p className="my-3" {...props} />,
        ul: (props) => <ul className="my-3 list-disc space-y-1 pl-6 marker:text-slate-400" {...props} />,
        ol: (props) => <ol className="my-3 list-decimal space-y-1 pl-6 marker:font-semibold marker:text-slate-500" {...props} />,
        li: (props) => <li className="pl-1" {...props} />,
        strong: (props) => <strong className="font-semibold text-slate-900" {...props} />,
        blockquote: (props) => <blockquote className="my-4 border-l-4 border-[#102a72] bg-blue-50 px-4 py-2" {...props} />,
        code: ({ inline, ...props }) => inline ? <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800" {...props} /> : <code className="font-mono text-xs text-slate-100" {...props} />,
        pre: (props) => <pre className="my-4 overflow-x-auto rounded-xl bg-slate-900 p-4" {...props} />,
        table: (props) => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-left" {...props} /></div>,
        th: (props) => <th className="border border-slate-200 bg-slate-100 px-3 py-2 font-semibold text-slate-800" {...props} />,
        td: (props) => <td className="border border-slate-200 px-3 py-2 align-top" {...props} />,
      }}
    >{content || '*Nenhum conteúdo disponível neste artefato.*'}</ReactMarkdown>
  </div>;
}

export default function TaskArtifactReviewPage() {
  const { taskUuid } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [tab, setTab] = useState('requirements');
  const [error, setError] = useState(null);
  const [comment, setComment] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairModal, setRepairModal] = useState(false);
  const [decisionResponses, setDecisionResponses] = useState({});
  const [editing, setEditing] = useState(false);
  const [compare, setCompare] = useState(null);

  useEffect(() => { getTask(taskUuid).then(setTask).catch((requestError) => setError(getApiErrorMessage(requestError, 'Não foi possível carregar os artefatos.'))); }, [taskUuid]);
  const artifactType = tab === 'requirements' ? 'requirements' : 'test_plan';
  const artifact = useMemo(() => (task?.artifacts || []).find((item) => item.isCurrent && item.artifactType === artifactType), [task, artifactType]);
  const versions = useMemo(() => (task?.artifacts || []).filter((item) => item.artifactType === artifactType).sort((a, b) => Number(b.version || 0) - Number(a.version || 0)), [task, artifactType]);
  const pendingDecisions = useMemo(() => extractPendingDecisions(artifact?.content), [artifact?.content]);
  useEffect(() => { setContent(artifact?.content || ''); setEditing(false); setCompare(null); }, [artifact?.uuid]);

  async function review(approved) {
    if (!artifact) return;
    if (!approved && !comment.trim()) { setError('Informe um comentário ao rejeitar o artefato.'); return; }
    setSaving(true);
    try { await reviewTaskArtifact(taskUuid, artifact.uuid, { approved, comment }); setTask(await getTask(taskUuid)); setComment(''); }
    catch (requestError) {
      try { setTask(await getTask(taskUuid)); } catch { /* preserve the original request error */ }
      setError(getApiErrorMessage(requestError, 'Não foi possível registrar a revisão.'));
    }
    finally { setSaving(false); }
  }
  async function repair() {
    if (!artifact) return;
    if (!repairModal) { setRepairModal(true); return; }
    setRepairing(true);
    const decisionsInstruction = pendingDecisions.map((question, index) => {
      const response = decisionResponses[index] || {};
      return response.ignored ? `Pendencia ignorada: ${question}` : response.answer?.trim() ? `Decisao: ${question}\nResposta: ${response.answer.trim()}` : null;
    }).filter(Boolean).join('\n\n');
    const decisionResponsesPayload = pendingDecisions.map((question, index) => ({ question, answer: decisionResponses[index]?.answer?.trim() || null, ignored: Boolean(decisionResponses[index]?.ignored) })).filter((item) => item.answer || item.ignored);
    try { await repairTaskArtifact(taskUuid, artifact.uuid, { instruction: [comment.trim(), decisionsInstruction].filter(Boolean).join('\n\n'), decisionResponses: decisionResponsesPayload }); setTask(await getTask(taskUuid)); setComment(''); setDecisionResponses({}); }
    catch (requestError) {
      try { setTask(await getTask(taskUuid)); } catch { /* preserve the original request error */ }
      setError(getApiErrorMessage(requestError, 'Não foi possível executar o reparo direcionado.'));
    }
    finally { setRepairing(false); setRepairModal(false); }
  }
  async function saveManualVersion() {
    if (!artifact || !content.trim()) return;
    setSaving(true);
    try { await createTaskArtifact(taskUuid, { artifactType, title: artifact.title, content, contentFormat: artifact.contentFormat || 'markdown' }); setTask(await getTask(taskUuid)); setEditing(false); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Não foi possível salvar a nova versão.')); }
    finally { setSaving(false); }
  }

  return <AppShell eyebrow="Revisão da task" title={task?.title || 'Artefatos da task'} description="Revise, edite manualmente ou peça uma correção ao agente antes da aprovação." actions={<button className="dashboard-button-secondary" onClick={() => navigate(`/projects/${task?.project?.uuid || ''}`)}>Voltar ao projeto</button>}>
    <section className="dashboard-panel w-full">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
        {[['requirements', 'Requisitos refinados'], ['qa', 'Plano de testes']].map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === value ? 'bg-[#102a72] text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}
      </div>
      <div className="p-4">
        {!task && <div className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">Carregando artefatos...</div>}
        {task && !artifact && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">Ainda não existe um artefato de {tab === 'requirements' ? 'requisitos' : 'QA'} para esta task.</div>}
        {artifact && <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{artifact.artifactType} · versão {artifact.version} · ID {artifact.uuid}</p><h2 className="mt-2 text-xl font-bold text-slate-900">{artifact.title}</h2></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${artifact.isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{artifact.isApproved ? 'Aprovado' : 'Pendente de aprovação'}</span></div>
          {editing ? <textarea value={content} onChange={(event) => setContent(event.target.value)} className="dashboard-input mt-5 min-h-[420px] font-mono text-sm leading-6" /> : <div className="mt-5 max-h-[70vh] overflow-auto rounded-xl bg-slate-50 p-5"><ArtifactMarkdown content={artifact.content} /></div>}
          <div className="mt-5 border-t border-slate-200 pt-4"><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} className="dashboard-input" placeholder="Comentário (obrigatório ao rejeitar)" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={saving || repairing || artifact.isApproved} onClick={() => setEditing((value) => !value)} className="dashboard-button-secondary">{editing ? 'Cancelar edição' : 'Editar manualmente'}</button>{editing && <button type="button" disabled={saving || !content.trim()} onClick={saveManualVersion} className="dashboard-button-primary">{saving ? 'Salvando...' : 'Salvar nova versão'}</button>}<button type="button" disabled={saving || repairing || artifact.isApproved} onClick={repair} className="dashboard-button-secondary">{repairing ? 'Corrigindo...' : 'Corrigir com agente'}</button><button type="button" disabled={saving || artifact.isApproved} onClick={() => review(false)} className="dashboard-button-secondary">Rejeitar</button><button type="button" disabled={saving || artifact.isApproved} onClick={() => review(true)} className="dashboard-button-primary">{saving ? 'Salvando...' : 'Aprovar artefato'}</button></div></div>
        </article>}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-bold text-slate-900">Histórico de versões</h2><span className="text-xs text-slate-500">{versions.length} versão(ões)</span></div><div className="mt-3 space-y-2">{versions.map((version) => <div key={version.uuid} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><span>v{version.version} · {version.isCurrent ? 'Atual' : 'Anterior'} · {version.isApproved ? 'Aprovada' : 'Pendente'}</span><button type="button" className="font-semibold text-[#102a72]" onClick={() => setCompare(compare?.uuid === version.uuid ? null : version)}>Comparar</button></div>)}</div>{compare && artifact && <pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-200">{diffLines(compare.content, artifact.content).map((line) => `${line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : line.type === 'changed' ? '~ ' : '  '}${line.type === 'removed' ? line.old : line.type === 'added' ? line.current : line.type === 'changed' ? `${line.old} → ${line.current}` : line.current}`).join('\n')}</pre>}</section>
      </div>
    </section>
    {repairModal && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="repair-title">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#102a72]">Revisão assistida</p>
        <h2 id="repair-title" className="mt-1 text-xl font-bold text-slate-950">Iniciar correção com agente?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">O agente analisará o artefato atual, os achados do Quality Gate e a orientação abaixo. Uma nova versão ficará pendente de aprovação.</p>
        {pendingDecisions.length > 0 && <div className="mt-5 max-h-64 space-y-3 overflow-y-auto"><p className="text-sm font-semibold text-slate-800">Decisões pendentes</p>{pendingDecisions.map((question, index) => <div key={question} className="rounded-xl border border-slate-200 p-3"><p className="text-sm text-slate-700">{question}</p><textarea value={decisionResponses[index]?.answer || ''} disabled={decisionResponses[index]?.ignored} onChange={(event) => setDecisionResponses((current) => ({ ...current, [index]: { ...current[index], answer: event.target.value } }))} rows={2} className="dashboard-input mt-2 text-sm" placeholder="Informe a decisão ou marque para ignorar" /><label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={Boolean(decisionResponses[index]?.ignored)} onChange={(event) => setDecisionResponses((current) => ({ ...current, [index]: { ...current[index], ignored: event.target.checked } }))} />Ignorar esta pergunta</label></div>)}</div>}
        <label className="mt-5 block text-sm font-semibold text-slate-800" htmlFor="repair-instruction">Orientação para o agente <span className="font-normal text-slate-500">(opcional)</span></label>
        <textarea id="repair-instruction" value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="dashboard-input mt-2" placeholder="Ex.: melhorar os cenários de exceção sem criar regras novas." />
        <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" disabled={repairing} onClick={() => setRepairModal(false)} className="dashboard-button-secondary">Cancelar</button><button type="button" disabled={repairing} onClick={repair} className="dashboard-button-primary">{repairing ? 'Iniciando...' : 'Iniciar revisão'}</button></div>
      </div>
    </div>}
    {error && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="quality-error-title"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-lg text-rose-700">!</div><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-rose-700">Ação não concluída</p><h2 id="quality-error-title" className="mt-1 text-lg font-bold text-slate-950">Não foi possível concluir a operação</h2></div></div><div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">{error}</div><p className="mt-4 text-sm text-slate-600">Se houver uma versão mais recente, ela já estará carregada nesta tela.</p><div className="mt-6 flex justify-end"><button type="button" onClick={() => setError(null)} className="dashboard-button-primary">Entendi</button></div></div></div>}
  </AppShell>;
}
