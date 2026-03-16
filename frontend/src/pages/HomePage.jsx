import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import IdeasForm from '../components/IdeasForm'
import LoadingSpinner from '../components/LoadingSpinner'

export default function HomePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleGenerateProject = (idea) => {
    setError(null)
    if (!idea.trim()) {
      setError("Por favor, descreva a ideia do seu projeto.");
      return;
    }
    // Navega para a nova página de pipeline, passando a ideia no estado.
    setLoading(true); // Mostra o spinner enquanto a página carrega
    navigate('/pipeline', { state: { idea: idea } });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              AI Software Factory
            </h1>
            <p className="text-xl text-blue-100">
              Descreva um projeto de software e nossa fábrica baseada em IA irá gerar os artefatos do sistema.
            </p>
          </div>

          {/* Form Container */}
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="bg-white rounded-lg shadow-2xl p-8">
              {error && (
                <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}
              <IdeasForm onSubmit={handleGenerateProject} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
