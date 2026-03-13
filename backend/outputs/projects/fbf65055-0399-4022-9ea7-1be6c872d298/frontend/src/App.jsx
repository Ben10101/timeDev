import { useState } from 'react'
import axios from 'axios'

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await axios.get('/api/health')
      setData(response.data)
    } catch (err) {
      setError('Erro ao conectar com o backend')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Seu Projeto</h1>
        
        <button
          onClick={handleFetchData}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 rounded transition disabled:opacity-50"
        >
          {loading ? 'Testando...' : 'Testar Backend'}
        </button>

        {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
        {data && (
          <div className="mt-4 p-3 bg-green-100 text-green-700 rounded">
            <p>Backend OK! Status: {data.status}</p>
          </div>
        )}
      </div>
    </div>
  )
}
