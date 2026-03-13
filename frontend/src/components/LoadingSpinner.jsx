export default function LoadingSpinner() {
  const steps = [
    { id: 1, name: 'Processando Ideia', icon: '💡' },
    { id: 2, name: 'Gerando Backlog', icon: '📋' },
    { id: 3, name: 'Analisando Requisitos', icon: '✅' },
    { id: 4, name: 'Definindo Arquitetura', icon: '🏗️' },
    { id: 5, name: 'Gerando Código', icon: '💻' },
    { id: 6, name: 'Criando Testes', icon: '🧪' },
  ]

  return (
    <div className="bg-white rounded-lg shadow-2xl p-12">
      <div className="flex flex-col items-center justify-center">
        <div className="relative w-20 h-20 mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-gray-300"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-purple-500 animate-spin"></div>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Gerando seu projeto...
        </h2>
        <p className="text-gray-600 text-center mb-8">
          Isso pode levar alguns segundos. Nossa fábrica está trabalhando! ⚙️
        </p>

        {/* Steps */}
        <div className="w-full max-w-md space-y-3">
          {steps.map((step) => (
            <div
              key={step.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition animate-pulse"
              style={{
                animationDelay: `${(step.id - 1) * 0.15}s`,
                animationDuration: '1.5s'
              }}
            >
              <div className="text-2xl">{step.icon}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-700">{step.name}</p>
              </div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Processando sua ideia através de 5 agentes especializados...</p>
        </div>
      </div>
    </div>
  )
}
