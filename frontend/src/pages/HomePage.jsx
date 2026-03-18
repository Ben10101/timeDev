import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <AppShell
      eyebrow="Workspace"
      title="Comece pelo workspace, depois pelo projeto"
      description="A nova jornada do produto parte da estrutura certa: crie o workspace, abra um projeto, descreva a iniciativa e só então acione os agentes para montar o board."
      actions={
        <button
          onClick={() => navigate('/projects')}
          className="w-full rounded-2xl bg-[#17322b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#214338] sm:w-auto"
        >
          Abrir workspace
        </button>
      }
      sidebar={
        <>
          <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(23,50,43,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Fluxo recomendado</p>
            <ol className="mt-4 space-y-4 text-sm text-slate-600">
              <li>1. Crie o workspace que vai agrupar projetos, tarefas e histórico.</li>
              <li>2. Abra um projeto com nome, descrição curta e visão inicial.</li>
              <li>3. Use o Project Overview para conversar com o PM Agent e gerar o backlog.</li>
            </ol>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-[#17322b] p-5 text-emerald-50 shadow-[0_20px_60px_rgba(23,50,43,0.14)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-100/60">Agentes em foco</p>
            <div className="mt-4 space-y-3 text-sm text-emerald-50/82">
              <p><strong>PM:</strong> cria o backlog inicial do board.</p>
              <p><strong>Requirements:</strong> detalha critérios e regras por task.</p>
              <p><strong>QA:</strong> valida cenários, riscos e qualidade da entrega.</p>
            </div>
          </section>
        </>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white/85 p-6 shadow-[0_30px_80px_rgba(23,50,43,0.08)] sm:p-8">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Nova operação</p>
            <h3 className="mt-3 font-serif text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
              Estruture primeiro o ambiente de trabalho. Os agentes entram depois, já com contexto.
            </h3>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Em vez de jogar a ideia direto em um pipeline, o sistema agora parte de um workspace com projetos reais.
              Cada projeto ganha um overview próprio, um board persistido e um briefing que pode ser enriquecido pelo PM Agent.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['1', 'Crie o workspace', 'Defina o espaço onde seu time, projetos e dados vão viver.'],
              ['2', 'Abra o projeto', 'Dê nome, visão inicial e contexto básico para a iniciativa.'],
              ['3', 'Gere o backlog', 'Use o PM Agent para transformar a ideia em tasks no board.'],
            ].map(([step, title, text]) => (
              <div key={title} className="rounded-[28px] border border-slate-200 bg-[#faf8f2] p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#17322b] text-sm font-semibold text-white">
                  {step}
                </div>
                <h4 className="mt-4 text-lg font-semibold text-slate-900">{title}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[32px] border border-slate-200 bg-white/88 p-6 shadow-[0_20px_70px_rgba(23,50,43,0.07)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#2f6c58]">Sequência ideal</p>
            <div className="mt-5 space-y-4">
              {[
                ['Workspace', 'Crie a base de colaboração e persistência.'],
                ['Project Overview', 'Descreva o produto ou operação dentro do projeto certo.'],
                ['PM Agent', 'Gere backlog inicial e envie as tasks para o board.'],
                ['Board', 'Refine, priorize e avance cada task com Requirements e QA.'],
              ].map(([title, text], index) => (
                <div
                  key={title}
                  className={`rounded-3xl border p-4 ${
                    index === 1 ? 'border-[#b8d58b] bg-[#f4f9e8]' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <h4 className="font-semibold text-slate-900">{title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] bg-[linear-gradient(135deg,_#214c3f,_#4c7a49)] p-6 text-white shadow-[0_24px_70px_rgba(23,50,43,0.18)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">Resultado esperado</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-white/85">
              <p>Projetos reais como centro da operação.</p>
              <p>Board populado pelo PM Agent a partir do briefing do projeto.</p>
              <p>Requirements e QA atuando depois, por task, sem perder contexto.</p>
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
