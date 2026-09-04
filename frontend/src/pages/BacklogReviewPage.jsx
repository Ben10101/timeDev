import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, Check, CheckCircle2, ChevronRight, FilePenLine, ListChecks, LoaderCircle, MessageSquareText, Plus, RefreshCw, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react'
import AppShell from '../components/AppShell'
import { applyBacklogProposals, applyProjectBacklogStoryReview, decideBacklogProposal, getApiErrorMessage, getProject, publishProjectBacklog, reviewProjectBacklogStory, updateProjectBacklogStory } from '../services/api'

const labels = { approved: 'Aprovada', confirmed: 'Confirmada', proposed: 'Proposta', needs_review: 'Em revisão', rejected: 'Rejeitada' }
const tones = { approved: 'bg-emerald-100 text-emerald-800', confirmed: 'bg-emerald-100 text-emerald-800', proposed: 'bg-blue-100 text-blue-800', needs_review: 'bg-amber-100 text-amber-800', rejected: 'bg-rose-100 text-rose-800' }
const readinessLabels = { READY: 'Pronta para aprovação', HUMAN_REVIEW: 'Revisão humana necessária', REFINE: 'Precisa de refinamento', BLOCKED: 'Bloqueada' }
const readinessTones = { READY: 'bg-emerald-100 text-emerald-800', HUMAN_REVIEW: 'bg-amber-100 text-amber-800', REFINE: 'bg-amber-100 text-amber-800', BLOCKED: 'bg-rose-100 text-rose-800' }
const gateQuestions = {
  acceptance_criteria_missing: 'Quais cenários de sucesso e de exceção comprovam que esta story foi entregue?',
  acceptance_criteria_duplicate: 'Qual dos cenários com o mesmo fluxo deve permanecer e qual comportamento adicional precisa ser especificado?',
  traceability_missing: 'Qual briefing, decisão ou regra aprovada sustenta esta story?',
  scope_not_atomic: 'Qual capacidade deve permanecer nesta story e quais devem ser separadas em outras stories?',
  critical_quality_requirement_undefined: 'Qual regra de segurança ou permissão deve ser aplicada, incluindo limites e comportamento de falha?',
}
const hasUnansweredBlockingAnswers = (answers = []) => answers.some((item) => item.blocking && !String(item.answer || '').trim())
const criterionIsComplete = (criterion = {}) => ['given', 'when', 'then'].every((field) => String(criterion[field] || '').trim())

function MetricCard({ dimension }) {
  const tone = dimension.status === 'pass' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : dimension.status === 'fail' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'
  return <div className={`rounded-xl border p-3 ${tone}`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold leading-4">{dimension.label}</p><strong className="shrink-0 text-sm">{dimension.score}/{dimension.weight}</strong></div>{dimension.evidence?.[0] && <p className="mt-2 text-xs leading-5 opacity-80">{dimension.evidence[0]}</p>}</div>
}

export default function BacklogReviewPage() {
  const { projectUuid } = useParams()
  const [project, setProject] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [assist, setAssist] = useState(null)
  const contract = project?.intakeConfig?.backlogContract || {}
  const qualityReview = contract.qualityReview || contract.quality_review || {}
  const stories = Array.isArray(contract.stories) ? contract.stories : []
  const allStoriesApproved = stories.every((story) => ['approved', 'confirmed'].includes(String(story.reviewStatus || story.status || '').toLowerCase()))
  const pendingProposals = (qualityReview.proposals || []).filter((item) => !['accepted', 'rejected'].includes(String(item?.status || 'proposed').toLowerCase()))
  const acceptedProposals = (qualityReview.proposals || []).filter((item) => String(item?.status || '').toLowerCase() === 'accepted')
  const reload = async () => setProject(await getProject(projectUuid))

  useEffect(() => { reload().catch((requestError) => setError(getApiErrorMessage(requestError, 'Falha ao carregar o backlog.'))) }, [projectUuid])

  const decide = async (story, status) => {
    setBusy(true); setError(null)
    try {
      await updateProjectBacklogStory(projectUuid, story.id, { title: story.title, description: story.description, reviewStatus: status, comment: status === 'rejected' ? 'Rejeitada na revisão humana.' : '' })
      await reload()
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Falha ao salvar a decisão.')) } finally { setBusy(false) }
  }

  const buildAssistState = (story, review = {}, answers = Array.isArray(story.reviewAnswers) ? story.reviewAnswers : [], source = 'agent') => {
    const context = story.refinementContext || story.refinement_context || {}
    const existingCriteria = context.acceptanceCriteria || context.acceptance_criteria || []
    const rawQuestions = Array.isArray(review.questions) ? review.questions : []
    const fallbackQuestions = (review.assessment?.gates || [])
      .map((gate) => ({ id: `RQ-${gate.code}`, question: gateQuestions[gate.code], why: gate.message, blocking: Boolean(gate.blocking) }))
      .filter((question) => question.question)
    const questions = rawQuestions.length ? rawQuestions : fallbackQuestions
    const proposedStory = review.proposed_story || {}
    return {
      story, loading: false, review, source,
      answers: questions.map((question) => ({ ...question, answer: answers.find((item) => item.id === question.id || item.question === question.question)?.answer || '' })),
      proposal: {
        title: proposedStory.title || story.title || story.goal || '', description: proposedStory.description || story.description || '', actor: proposedStory.actor || story.actor || '', benefit: proposedStory.benefit || story.benefit || '',
        acceptance_criteria: Array.isArray(proposedStory.acceptance_criteria) ? proposedStory.acceptance_criteria : existingCriteria,
      },
    }
  }

  const openReview = (story) => {
    const snapshot = story.pendingAgentReview || story.lastAgentReview
    const savedReview = snapshot?.review || (snapshot?.assessment ? { assessment: snapshot.assessment } : null)
    if (savedReview) {
      setError(null)
      setAssist(buildAssistState(story, savedReview, Array.isArray(story.reviewAnswers) ? story.reviewAnswers : [], 'saved'))
      return
    }
    startReview(story)
  }

  const startReview = async (story, answers = Array.isArray(story.reviewAnswers) ? story.reviewAnswers : [], draftProposal = null) => {
    setBusy(true); setError(null); setAssist({ story, loading: true })
    try {
      const result = await reviewProjectBacklogStory(projectUuid, story.id, { answers, ...(draftProposal ? { draftProposal } : {}) })
      const review = result.review || result
      setAssist(buildAssistState(story, review, answers, 'agent'))
    } catch (requestError) { setAssist(null); setError(getApiErrorMessage(requestError, 'Falha ao revisar a story com o agente.')) } finally { setBusy(false) }
  }

  const applyReview = async () => {
    if (hasUnansweredBlockingAnswers(assist.answers)) { setError('Responda as perguntas bloqueantes antes de aplicar a proposta.'); return }
    setBusy(true); setError(null)
    try {
      await applyProjectBacklogStoryReview(projectUuid, assist.story.id, { proposedStory: assist.proposal, answers: assist.answers })
      await reload(); setAssist(null)
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Falha ao aplicar a proposta na story.')) } finally { setBusy(false) }
  }

  const updateProposalField = (field, value) => setAssist((current) => ({ ...current, proposal: { ...current.proposal, [field]: value } }))
  const updateAcceptanceCriterion = (index, field, value) => setAssist((current) => ({ ...current, proposal: { ...current.proposal, acceptance_criteria: (current.proposal.acceptance_criteria || []).map((criterion, criterionIndex) => criterionIndex === index ? { ...criterion, [field]: value } : criterion) } }))
  const addAcceptanceCriterion = () => setAssist((current) => ({ ...current, proposal: { ...current.proposal, acceptance_criteria: [...(current.proposal.acceptance_criteria || []), { given: '', when: '', then: '', status: 'proposed', source_ids: [] }] } }))
  const removeAcceptanceCriterion = (index) => setAssist((current) => ({ ...current, proposal: { ...current.proposal, acceptance_criteria: (current.proposal.acceptance_criteria || []).filter((_, criterionIndex) => criterionIndex !== index) } }))

  const resolveProposal = async (proposal, decision) => {
    setBusy(true); setError(null)
    try {
      const index = (qualityReview.proposals || []).indexOf(proposal)
      await decideBacklogProposal(projectUuid, proposal.id || `PROP-${String(index + 1).padStart(3, '0')}`, { decision, comment: decision === 'rejected' ? 'Capacidade já coberta pelas stories aprovadas.' : 'Incluir esta capacidade no backlog.' })
      await reload()
    } catch (requestError) { setError(getApiErrorMessage(requestError, 'Falha ao registrar a decisão.')) } finally { setBusy(false) }
  }

  const publish = async () => {
    setBusy(true); setError(null)
    try { await publishProjectBacklog(projectUuid); await reload() } catch (requestError) { setError(getApiErrorMessage(requestError, 'Falha ao publicar.')) } finally { setBusy(false) }
  }

  const assessment = assist?.review?.assessment || {}
  const readiness = assessment.decision || 'REFINE'
  const reviewAnswers = assist?.answers || []
  const blockingCount = reviewAnswers.filter((item) => item.blocking && !String(item.answer || '').trim()).length
  const criteria = assist?.proposal?.acceptance_criteria || []
  const completeCriteriaCount = criteria.filter(criterionIsComplete).length
  const canApply = Boolean(assist?.proposal?.title?.trim()) && !blockingCount && !busy

  return <AppShell eyebrow="Revisão do backlog" title="Validação humana das tasks" description="Revise, responda lacunas e aprove o backlog antes da publicação.">
    <section className="dashboard-panel p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{project?.name || 'Projeto'}</h2><p className="text-sm text-slate-600">{stories.length} stories · Quality Gate: {qualityReview.decision || 'pendente'}</p></div><button type="button" disabled={busy || !stories.length || !allStoriesApproved || qualityReview.decision !== 'PASS' || contract.publicationStatus === 'published'} onClick={publish} className="dashboard-button-primary">{contract.publicationStatus === 'published' ? 'Já publicado' : 'Aprovar e enviar ao board'}</button></div>
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!allStoriesApproved && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Aprove apenas stories com prontidão confirmada para liberar a publicação.</p>}
      {qualityReview.decision === 'REVISE' && <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-[10px] font-bold uppercase tracking-widest text-amber-800">Decisões pendentes do Quality Gate</p><h3 className="mt-2 text-lg font-bold">Confirme a cobertura das capacidades</h3><div className="mt-4 space-y-3">{pendingProposals.map((proposal) => <article key={proposal.id || proposal.capability} className="rounded-xl border border-amber-200 bg-white p-4"><p className="font-semibold">{proposal.capability}</p><p className="mt-1 text-sm text-slate-600">{proposal.reason}</p><div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => resolveProposal(proposal, 'rejected')} className="dashboard-button-primary px-3 py-1.5 text-xs">Já está coberta</button><button disabled={busy} onClick={() => resolveProposal(proposal, 'accepted')} className="dashboard-button-secondary px-3 py-1.5 text-xs">Incluir no backlog</button></div></article>)}</div>{acceptedProposals.length > 0 && <button disabled={busy} onClick={() => applyBacklogProposals(projectUuid).then(reload).catch((requestError) => setError(getApiErrorMessage(requestError, 'Falha ao incluir propostas.')))} className="dashboard-button-secondary mt-4">Adicionar propostas aceitas</button>}</section>}
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{stories.map((story, index) => {
        const status = String(story.reviewStatus || story.status || 'proposed').toLowerCase(); const isReady = story.lastAgentReview?.assessment?.decision === 'READY'; const isApproved = ['approved', 'confirmed'].includes(status)
        return <article key={story.id || index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-widest text-slate-500">{story.id || `US-${index + 1}`}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[status] || tones.proposed}`}>{labels[status] || status}</span></div><h3 className="mt-3 font-semibold text-slate-900">{story.title || story.goal || 'Story sem título'}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{story.description || story.benefit || 'Sem descrição.'}</p>{story.lastAgentReview?.assessment && <p className="mt-3 text-xs text-slate-600">Prontidão: {story.lastAgentReview.assessment.score}/100 · {readinessLabels[story.lastAgentReview.assessment.decision] || 'Pendente'}</p>}<div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => startReview(story)} className="dashboard-button-secondary px-3 py-1.5 text-xs">Revisar com agente</button><button disabled={busy || !isReady || isApproved} title={isApproved ? 'Esta story já foi aprovada.' : isReady ? 'Aprovar story pronta' : 'Execute a revisão e resolva os bloqueios antes de aprovar'} onClick={() => decide(story, 'approved')} className="dashboard-button-primary px-3 py-1.5 text-xs">Aprovar</button><button disabled={busy} onClick={() => decide(story, 'rejected')} className="dashboard-button-secondary px-3 py-1.5 text-xs">Rejeitar</button></div></article>
      })}</div>

      {assist && <div className="backlog-review-dialog fixed inset-0 z-50 bg-slate-950/60 p-0 backdrop-blur-[2px] sm:p-5" role="dialog" aria-modal="true" aria-labelledby="story-review-title"><div className="mx-auto flex h-full w-full max-w-[1500px] items-center sm:h-[calc(100vh-2.5rem)] sm:w-[calc(100vw-2.5rem)]"><div className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:rounded-3xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-950 to-[#102a72] px-5 py-5 text-white sm:px-7"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200"><Sparkles size={14} /> Revisão orientada a decisão</div><h2 id="story-review-title" className="mt-2 truncate text-xl font-bold sm:text-2xl">{assist.story.id} · {assist.story.title || assist.story.goal}</h2><p className="mt-1 text-sm text-slate-300">Resolva lacunas concretas, revise a proposta e aplique quando ela estiver pronta.</p></div><button type="button" onClick={() => setAssist(null)} className="rounded-xl border border-white/20 p-2 text-white transition hover:bg-white/10" aria-label="Fechar revisão"><X size={20} /></button></header>
        {assist.loading ? <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"><LoaderCircle className="animate-spin text-[#102a72]" size={32} /><div><h3 className="font-semibold text-slate-900">O agente está revisando o contexto</h3><p className="mt-1 text-sm text-slate-600">Ele verifica critérios, rastreabilidade e lacunas desta story.</p></div></div> : <>
          <div className="min-h-0 flex-1 overflow-y-auto"><div className="grid xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.35fr)]">
            <aside className="border-b border-slate-200 bg-slate-50 p-5 sm:p-7 xl:border-b-0 xl:border-r">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-4"><div className={`flex h-16 w-20 shrink-0 items-center justify-center rounded-2xl px-3 text-lg font-bold leading-none tabular-nums whitespace-nowrap ${readinessTones[readiness] || readinessTones.REFINE}`}>{assessment.score ?? '—'}</div><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Prontidão da story</p><p className="mt-1 font-bold text-slate-900">{readinessLabels[readiness] || 'Precisa de refinamento'}</p><p className="mt-1 text-xs text-slate-500">Nota calculada pelo agente e validada pelo servidor.</p></div></div>{assessment.gates?.length > 0 && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><div className="flex gap-2 font-semibold"><ShieldAlert size={17} className="mt-0.5 shrink-0" /> Antes de aprovar</div><ul className="mt-2 space-y-1 pl-6 text-xs leading-5">{assessment.gates.map((gate, index) => <li key={gate.code || index}>{gate.message}</li>)}</ul></div>}{assessment.gaps?.length > 0 && <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pontos a refinar</p><ul className="mt-2 space-y-2">{assessment.gaps.map((gap, index) => <li key={index} className="flex gap-2 text-xs leading-5 text-slate-600"><ChevronRight size={14} className="mt-0.5 shrink-0 text-amber-600" />{gap}</li>)}</ul></div>}</section>
              {assist.review?.generation_degraded && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><div className="flex gap-2 font-semibold"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> Revisão incompleta do agente</div><p className="mt-1">O conteúdo atual foi preservado. Nenhuma pergunta genérica foi criada automaticamente.</p></div>}
              <section className="mt-6"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-slate-900"><ListChecks size={18} className="text-[#102a72]" /> Diagnóstico</h3><span className="text-xs text-slate-500">{assessment.dimensions?.length || 0} dimensões</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{assessment.dimensions?.map((dimension) => <MetricCard key={dimension.id} dimension={dimension} />)}</div></section>
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4"><h3 className="flex items-center gap-2 font-bold text-slate-900"><MessageSquareText size={18} className="text-[#102a72]" /> Decisões necessárias</h3>{reviewAnswers.length ? <div className="mt-3 space-y-3">{reviewAnswers.map((item, index) => <label key={item.id || index} className="block rounded-xl border border-slate-200 p-3 transition focus-within:border-[#102a72] focus-within:ring-2 focus-within:ring-blue-100"><div className="flex items-start justify-between gap-3"><span className="text-sm font-semibold leading-5 text-slate-900">{item.question}</span>{item.blocking && <span className="shrink-0 rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">Obrigatória</span>}</div>{item.why && <span className="mt-1 block text-xs leading-5 text-slate-500">{item.why}</span>}<textarea value={item.answer} onChange={(event) => setAssist((current) => ({ ...current, answers: current.answers.map((answer, answerIndex) => answerIndex === index ? { ...answer, answer: event.target.value } : answer) }))} className="dashboard-input mt-3 min-h-[96px] text-sm" placeholder="Registre a decisão que deve orientar esta story" /></label>)}</div> : <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><div className="flex gap-2 font-semibold"><CheckCircle2 size={17} /> Nenhuma decisão pendente</div><p className="mt-1 text-xs">A proposta pode ser revisada diretamente à direita.</p></div>}</section>
            </aside>
            <main className="p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#102a72]"><FilePenLine size={15} /> Proposta revisada</p><h3 className="mt-1 text-xl font-bold text-slate-950">Edite o que será aplicado</h3><p className="mt-1 text-sm text-slate-600">Mantenha uma única necessidade por story e cenários observáveis para confirmá-la.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${completeCriteriaCount === criteria.length && criteria.length ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{completeCriteriaCount}/{criteria.length} cenários completos</span></div>
              {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
              <section className="mt-6 rounded-2xl border border-slate-200 p-4 sm:p-5"><label className="block text-sm font-semibold text-slate-800">Título da story<input value={assist.proposal.title || ''} onChange={(event) => updateProposalField('title', event.target.value)} className="dashboard-input mt-2" placeholder="Ex.: Autenticação do professor" /></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-800">Ator<input value={assist.proposal.actor || ''} onChange={(event) => updateProposalField('actor', event.target.value)} className="dashboard-input mt-2" placeholder="Quem usa a capacidade?" /></label><label className="block text-sm font-semibold text-slate-800">Benefício<input value={assist.proposal.benefit || ''} onChange={(event) => updateProposalField('benefit', event.target.value)} className="dashboard-input mt-2" placeholder="Qual valor é obtido?" /></label></div><label className="mt-4 block text-sm font-semibold text-slate-800">Contexto e comportamento esperado<textarea value={assist.proposal.description || ''} onChange={(event) => updateProposalField('description', event.target.value)} className="dashboard-input mt-2 min-h-[140px]" placeholder="Descreva a necessidade, regras já confirmadas e limites relevantes." /></label></section>
              <section className="mt-5 rounded-2xl border border-slate-200 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="flex items-center gap-2 font-bold text-slate-900"><ListChecks size={18} className="text-[#102a72]" /> Critérios de aceite</h4><p className="mt-1 text-sm text-slate-600">Cada cenário precisa informar condição, ação e resultado específico.</p></div><button type="button" onClick={addAcceptanceCriterion} className="dashboard-button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"><Plus size={15} /> Adicionar cenário</button></div>{criteria.length ? <div className="mt-4 space-y-4">{criteria.map((criterion, index) => { const complete = criterionIsComplete(criterion); return <article key={index} className={`rounded-2xl border p-4 ${complete ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-sm">{index + 1}</span><span className={`text-xs font-bold ${complete ? 'text-emerald-700' : 'text-amber-700'}`}>{complete ? 'Cenário completo' : 'Preencha os três campos'}</span></div><button type="button" onClick={() => removeAcceptanceCriterion(index)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"><Trash2 size={14} /> Remover</button></div><div className="mt-4 grid gap-3 lg:grid-cols-3"><label className="text-xs font-bold uppercase tracking-wide text-slate-600">Dado<textarea value={criterion.given || ''} onChange={(event) => updateAcceptanceCriterion(index, 'given', event.target.value)} className="dashboard-input mt-2 min-h-[112px] text-sm normal-case tracking-normal" placeholder="Contexto ou pré-condição" /></label><label className="text-xs font-bold uppercase tracking-wide text-slate-600">Quando<textarea value={criterion.when || ''} onChange={(event) => updateAcceptanceCriterion(index, 'when', event.target.value)} className="dashboard-input mt-2 min-h-[112px] text-sm normal-case tracking-normal" placeholder="Ação ou evento" /></label><label className="text-xs font-bold uppercase tracking-wide text-slate-600">Então<textarea value={criterion.then || ''} onChange={(event) => updateAcceptanceCriterion(index, 'then', event.target.value)} className="dashboard-input mt-2 min-h-[112px] text-sm normal-case tracking-normal" placeholder="Resultado observável" /></label></div></article> })}</div> : <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center"><ListChecks className="mx-auto text-amber-700" size={24} /><p className="mt-2 font-semibold text-amber-900">Ainda não há critérios de aceite</p><p className="mt-1 text-sm text-amber-800">Adicione ao menos um cenário principal para tornar a story verificável.</p><button type="button" onClick={addAcceptanceCriterion} className="dashboard-button-secondary mt-3 text-xs">Criar primeiro cenário</button></div>}</section>
            </main>
          </div></div>
          <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><p className="text-xs leading-5 text-slate-500">{blockingCount ? `${blockingCount} pergunta${blockingCount > 1 ? 's' : ''} obrigatória${blockingCount > 1 ? 's' : ''} pendente${blockingCount > 1 ? 's' : ''}.` : 'Editou a proposta? Revise-a novamente antes de aplicar.'}</p><div className="flex flex-col gap-2 sm:flex-row"><button type="button" disabled={busy || Boolean(blockingCount)} onClick={() => startReview(assist.story, assist.answers, assist.proposal)} className="dashboard-button-secondary inline-flex items-center justify-center gap-2"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Revisar proposta atual</button><button type="button" disabled={!canApply} onClick={applyReview} className="dashboard-button-primary inline-flex items-center justify-center gap-2"><Check size={17} /> Aplicar proposta</button></div></footer>
        </>}
      </div></div></div>}
    </section>
  </AppShell>
}
