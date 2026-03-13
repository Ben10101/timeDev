import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import ResultTabs from '../components/ResultTabs'

export default function ResultsPage() {
  const { projectId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (location.state?.data) {
      setData(location.state.data)
      
      // Calcular estatísticas
      const backlogLines = (location.state.data.backlog || '').split('\n').length
      const requirementsLines = (location.state.data.requirements || '').split('\n').length
      const architectureLines = (location.state.data.architecture || '').split('\n').length
      const codeLines = (location.state.data.code || '').split('\n').length
      const testsLines = (location.state.data.tests || '').split('\n').length
      
      setStats({
        backlogLines,
        requirementsLines,
        architectureLines,
        codeLines,
        testsLines,
        totalLines: backlogLines + requirementsLines + architectureLines + codeLines + testsLines,
        timestamp: location.state.data.timestamp
      })
    } else {
      // Se não houver dados, redireciona para home
      navigate('/')
    }
  }, [location, navigate])

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-600 text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate('/')}
            className="mb-4 px-4 py-2 bg-blue-400 rounded hover:bg-blue-500 transition font-semibold"
          >
            ← Voltar para Home
          </button>
          
          <div>
            <h1 className="text-4xl font-bold mb-2">✨ Projeto Gerado com Sucesso!</h1>
            <p className="text-blue-100 text-lg mb-4">ID do Projeto: <span className="font-mono bg-blue-600 px-3 py-1 rounded">{projectId}</span></p>
            
            {/* Download Project Button */}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const projectPath = `outputs/generated_projects/${projectId}`
                  alert(`✅ Seu projeto foi gerado com sucesso!\n\n📁 Localização:\n${projectPath}\n\n📋 Instruções:\n\n1. Abra um terminal na raiz do projeto\n\n2. Para o Backend:\ncd ${projectPath}/backend\nnpm install\nnpm start\n\n3. Em outro terminal, para o Frontend:\ncd ${projectPath}/frontend\nnpm install\nnpm run dev\n\nO frontend abrirá em http://localhost:5173`)
                }}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-semibold transition flex items-center gap-2"
              >
                ✅ Projeto Criado com Sucesso!
              </button>
              
              <button
                onClick={() => {
                  alert(`📋 INSTRUÇÕES DE USO\n\n1. Seus arquivos estão em:\noutputs/generated_projects/${projectId}\n\n2. Abra 2 terminais:\n\nTerminal 1 (Backend):\ncd outputs/generated_projects/${projectId}/backend\nnpm install\nnpm start\n\nTerminal 2 (Frontend):\ncd outputs/generated_projects/${projectId}/frontend\nnpm install\nnpm run dev\n\n3. Abra http://localhost:5173 no navegador\n\n✨ Seu projeto estará rodando!`)
                }}
                className="px-6 py-2 bg-blue-400 hover:bg-blue-500 text-white rounded font-semibold transition"
              >
                ℹ️ Como Rodar
              </button>
            </div>
            
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                <div className="bg-blue-600 rounded-lg p-4">
                  <div className="text-blue-200 text-sm font-semibold">Backlog</div>
                  <div className="text-2xl font-bold text-white">{stats.backlogLines}</div>
                  <div className="text-blue-300 text-xs">linhas</div>
                </div>
                <div className="bg-purple-600 rounded-lg p-4">
                  <div className="text-purple-200 text-sm font-semibold">Requisitos</div>
                  <div className="text-2xl font-bold text-white">{stats.requirementsLines}</div>
                  <div className="text-purple-300 text-xs">linhas</div>
                </div>
                <div className="bg-indigo-600 rounded-lg p-4">
                  <div className="text-indigo-200 text-sm font-semibold">Arquitetura</div>
                  <div className="text-2xl font-bold text-white">{stats.architectureLines}</div>
                  <div className="text-indigo-300 text-xs">linhas</div>
                </div>
                <div className="bg-pink-600 rounded-lg p-4">
                  <div className="text-pink-200 text-sm font-semibold">Código</div>
                  <div className="text-2xl font-bold text-white">{stats.codeLines}</div>
                  <div className="text-pink-300 text-xs">linhas</div>
                </div>
                <div className="bg-teal-600 rounded-lg p-4">
                  <div className="text-teal-200 text-sm font-semibold">Testes</div>
                  <div className="text-2xl font-bold text-white">{stats.testsLines}</div>
                  <div className="text-teal-300 text-xs">linhas</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ResultTabs data={data} />
        
        {/* Footer Info */}
        <div className="mt-8 p-6 bg-white rounded-lg shadow text-center text-gray-600">
          <p className="text-sm">
            Projeto gerado em {stats?.timestamp ? new Date(stats.timestamp).toLocaleString('pt-BR') : 'data desconhecida'}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Total de {stats?.totalLines} linhas de documentação geradas
          </p>
        </div>
      </div>
    </div>
  )
}
