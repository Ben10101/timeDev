import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  ListChecks,
  ShieldAlert,
  Sparkles,
  Target,
  TestTube2,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { analyzeAlignment, getApiErrorMessage } from '../services/api';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay, ease: 'easeOut' },
});

const EXAMPLE_PROMPTS = [
  'Como gerente de operações, preciso aprovar reembolsos acima de R$ 500 com dupla validação para reduzir fraude.',
  'Quero permitir que clientes acompanhem o status do pedido por notificações e timeline no portal.',
  'Precisamos de um fluxo para cadastrar fornecedores com documentos obrigatórios, aprovação e bloqueio por pendências.',
];

const SCORE_META = [
  { key: 'overall', label: 'Score geral', icon: Sparkles, hint: 'Visão consolidada da entrada' },
  { key: 'clarity', label: 'Clareza', icon: Target, hint: 'Objetivo e linguagem objetiva' },
  { key: 'completeness', label: 'Completude', icon: FileCheck2, hint: 'Contexto, regra e resultado' },
  { key: 'testability', label: 'Testabilidade', icon: TestTube2, hint: 'Base para QA e aceite' },
  { key: 'ambiguity', label: 'Ambiguidade', icon: ShieldAlert, hint: 'Risco semântico; menor é melhor' },
];

function ScoreCard({ label, value, hint, icon: Icon, inverse = false }) {
  const tone = inverse
    ? value >= 60
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : value >= 30
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : value >= 75
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : value >= 55
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-rose-200 bg-rose-50 text-rose-700';

  return (
    <div className={`rounded-2xl border px-4 py-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70">
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <p className="mt-4 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-90">{hint}</p>
    </div>
  );
}

function OutputBlock({ title, icon: Icon, items, emptyText }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#102a72]/10 text-[#102a72]">
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-3 p-5">
        {items?.length ? (
          items.map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
              {typeof item === 'string' ? item : item.message}
              {typeof item === 'object' && item.recommendation ? (
                <p className="mt-2 text-xs text-slate-500">Próxima ação: {item.recommendation}</p>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const resultRef = useRef(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const scoreCards = useMemo(() => {
    if (!result?.clarity_score) return [];
    return SCORE_META.map((item) => ({
      ...item,
      value: result.clarity_score[item.key] ?? 0,
      inverse: item.key === 'ambiguity',
    }));
  }, [result]);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  async function handleAnalyze(exampleText) {
    const nextInput = typeof exampleText === 'string' ? exampleText : input;

    if (!nextInput.trim()) {
      setError('Descreva uma ideia, feature ou necessidade antes de processar.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      if (typeof exampleText === 'string') {
        setInput(exampleText);
      }
      const analysis = await analyzeAlignment(nextInput);
      setResult(analysis);
    } catch (analysisError) {
      setError(getApiErrorMessage(analysisError, 'Não foi possível analisar a clareza da solicitação.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      eyebrow="Alinhamento antes do desenvolvimento"
      title="Aligna"
      description="Transforme uma ideia inicial em user story, critérios de aceite, regras de negócio, cenários de teste e alertas de ambiguidade."
      actions={
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setInput(EXAMPLE_PROMPTS[0])}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.2} />
            Usar exemplo
          </button>
          <button
            onClick={() => navigate('/projects')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#102a72] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#0c205a] hover:shadow-md"
          >
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            Abrir projetos
          </button>
          <button
            onClick={() => navigate('/agents-lab')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.2} />
            Bancada de agentes
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        <motion.section {...fade(0.05)} className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Fluxo principal</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Descreva a necessidade e valide antes de desenvolver</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              O Aligna ajuda times a eliminar ambiguidades, reduzir retrabalho e chegar ao desenvolvimento com requisitos muito mais claros.
            </p>
          </div>
          <div className="grid gap-6 p-6 xl:grid-cols-[1.5fr_0.9fr]">
            <div className="space-y-4">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Exemplo: Como gerente de operações, preciso aprovar pedidos acima de R$ 500 com dupla validação para reduzir fraude e manter rastreabilidade."
                className="min-h-[220px] w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#102a72]/40 focus:bg-white focus:ring-2 focus:ring-[#102a72]/10"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleAnalyze()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#102a72] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0c205a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4" strokeWidth={2.2} />
                  {loading ? 'Processando...' : 'Gerar alinhamento'}
                </button>
                <button
                  onClick={() => {
                    setInput('');
                    setResult(null);
                    setError('');
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Limpar
                </button>
              </div>
              {loading ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-[#102a72]">
                  O Aligna está analisando a solicitação e montando o pacote de alinhamento.
                </div>
              ) : null}
              {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">O que você recebe</p>
                <div className="mt-4 space-y-3">
                  {[
                    'User story pronta para refinamento',
                    'Critérios de aceite acionáveis',
                    'Regras de negócio para alinhamento',
                    'Cenários de teste para QA',
                    'Score de clareza e alertas de ambiguidade',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.4} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-900">Exemplos rápidos</p>
                <div className="mt-3 space-y-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleAnalyze(prompt)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-xs leading-5 text-slate-600 transition hover:border-[#102a72]/20 hover:text-slate-900"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {result ? (
          <div ref={resultRef} className="space-y-6">
            <motion.section {...fade(0.12)} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#102a72]">Resumo refinado</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Pacote principal do Aligna</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{result.input_summary}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('/projects')}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Abrir projetos
                  </button>
                  <button
                    onClick={() => navigate('/code-studio')}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Abrir implementação
                  </button>
                  <button
                    onClick={() => navigate('/agents-lab')}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Abrir bancada de agentes
                  </button>
                </div>
              </div>
              <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">User Story</p>
                <p className="mt-3 text-base leading-7 text-slate-800">{result.user_story}</p>
              </div>
            </motion.section>

            <motion.section {...fade(0.16)} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {scoreCards.map((card) => (
                <ScoreCard key={card.key} label={card.label} value={card.value} hint={card.hint} icon={card.icon} inverse={card.inverse} />
              ))}
            </motion.section>

            <div className="grid gap-6 xl:grid-cols-2">
              <OutputBlock
                title="Critérios de Aceite"
                icon={ListChecks}
                items={result.acceptance_criteria}
                emptyText="Nenhum critério foi extraído."
              />
              <OutputBlock
                title="Regras de Negócio"
                icon={Target}
                items={result.business_rules}
                emptyText="Nenhuma regra foi extraída."
              />
              <OutputBlock
                title="Cenários de Teste"
                icon={TestTube2}
                items={result.test_scenarios}
                emptyText="Nenhum cenário foi sugerido."
              />
              <OutputBlock
                title="Alertas de Ambiguidade"
                icon={AlertTriangle}
                items={result.ambiguity_alerts}
                emptyText="Nenhum alerta relevante encontrado."
              />
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
