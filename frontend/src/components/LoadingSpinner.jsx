export default function LoadingSpinner() {
  const steps = [
    { id: 1, name: 'Processando ideia', icon: 'I' },
    { id: 2, name: 'Gerando backlog', icon: 'B' },
    { id: 3, name: 'Analisando requisitos', icon: 'R' },
    { id: 4, name: 'Criando cenários de QA', icon: 'Q' },
    { id: 5, name: 'Preparando artefatos da task', icon: 'T' },
  ];

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-10">
      <div className="flex flex-col items-center justify-center">
        <div className="relative mb-8 h-24 w-24">
          <div className="absolute inset-0 rounded-full border border-slate-200"></div>
          <div className="absolute inset-[10px] animate-spin rounded-full border-4 border-transparent border-r-[#8aac55] border-t-[#17322b]"></div>
          <div className="absolute inset-[26px] flex items-center justify-center rounded-full bg-[#eef5ef] text-xs font-bold uppercase tracking-[0.24em] text-[#17322b]">
            AI
          </div>
        </div>

        <h2 className="text-center font-serif text-2xl font-semibold text-slate-900">Orquestrando a operação</h2>
        <p className="mb-8 mt-2 text-center text-sm text-slate-600">
          Os agentes estão montando o board, consolidando critérios e preparando os próximos artefatos.
        </p>

        <div className="w-full max-w-md space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className="animate-pulse flex items-center gap-3 rounded-2xl border border-slate-200 bg-[#faf8f2] p-3"
              style={{
                animationDelay: `${(step.id - 1) * 0.12}s`,
                animationDuration: '1.5s',
              }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17322b] text-xs font-bold text-white">
                {step.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-700">{step.name}</p>
              </div>
              <div className="h-2.5 w-2.5 rounded-full bg-[#8aac55]"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
