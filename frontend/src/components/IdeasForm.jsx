import { useState } from 'react'

export default function IdeasForm({ onSubmit }) {
  const [idea, setIdea] = useState('')
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState({
    targetUsers: '',
    mainGoal: '',
    coreFeatures: '',
    platforms: '',
    authAndRoles: '',
    dataEntities: '',
    integrations: '',
    nonFunctional: '',
    constraints: '',
    successCriteria: '',
  })

  const QUESTIONS = [
    { key: 'targetUsers', label: '1) Quem vai usar o sistema? (perfil do usuário e contexto)' },
    { key: 'mainGoal', label: '2) Qual é o objetivo principal e o problema que resolve?' },
    { key: 'coreFeatures', label: '3) Quais são as funcionalidades essenciais? (liste as mais importantes)' },
    { key: 'platforms', label: '4) Onde o sistema será usado? (web/mobile/desktop) e em quais dispositivos?' },
    { key: 'authAndRoles', label: '5) Precisa de login? Quais perfis/roles e permissões?' },
    { key: 'dataEntities', label: '6) Quais dados principais o sistema vai cadastrar/gerenciar? (entidades e campos)' },
    { key: 'integrations', label: '7) Precisa integrar com algo? (pagamento, e-mail, WhatsApp, ERP, etc.)' },
    { key: 'nonFunctional', label: '8) Requisitos não-funcionais? (segurança, performance, LGPD, disponibilidade)' },
    { key: 'constraints', label: '9) Restrições e preferências? (prazo, stack, orçamento, time)' },
    { key: 'successCriteria', label: '10) Como saberemos que deu certo? (métricas/critério de sucesso)' },
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!idea.trim()) return
    if (step === 1) {
      setStep(2)
      return
    }
    onSubmit({ idea: idea.trim(), answers })
  }

  const handleBack = () => setStep(1)

  const handleSkipQuestions = () => {
    onSubmit({ idea: idea.trim(), answers: null })
  }

  const updateAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  const isQuestionsComplete = QUESTIONS.every((q) => String(answers[q.key] || '').trim().length > 0)

  return (
    <form onSubmit={handleSubmit}>
      {step === 1 ? (
        <div className="mb-6">
          <label htmlFor="idea" className="block text-gray-700 font-semibold mb-2">
            Descreva sua ideia de software
          </label>
          <textarea
            id="idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Exemplo: sistema de controle de clientes para uma loja com cadastro, histórico de compras e dashboard."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows="6"
            required
          />
          <p className="mt-3 text-sm text-gray-500">
            Próximo passo: faremos 10 perguntas rápidas para detalhar o projeto.
          </p>
        </div>
      ) : (
        <div className="mb-6 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Ideia:</span> {idea}
            </p>
          </div>

          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <label htmlFor={q.key} className="block text-gray-700 font-semibold mb-2">
                {q.label}
              </label>
              <textarea
                id={q.key}
                value={answers[q.key]}
                onChange={(e) => updateAnswer(q.key, e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows="3"
                required
              />
            </div>
          ))}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="w-full sm:w-auto px-5 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleSkipQuestions}
              className="w-full sm:w-auto px-5 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
            >
              Pular perguntas
            </button>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!idea.trim() || (step === 2 && !isQuestionsComplete)}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {step === 1 ? 'Continuar' : 'Iniciar Pipeline'}
      </button>
    </form>
  )
}
