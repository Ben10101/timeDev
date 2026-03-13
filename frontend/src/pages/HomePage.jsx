import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateProject } from '../services/api'
import IdeasForm from '../components/IdeasForm'
import LoadingSpinner from '../components/LoadingSpinner'

export default function HomePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleGenerateProject = async (idea) => {
    setLoading(true)
    setError(null)

    try {
      const response = await generateProject(idea)
      // Redireciona para a página de resultados com o ID do projeto
      navigate(`/results/${response.projectId}`, { state: { data: response } })
    } catch (err) {
      setError(err.message || 'Erro ao gerar projeto. Tente novamente.')
      setLoading(false)
    }
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
