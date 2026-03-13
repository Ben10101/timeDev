import { useState } from 'react'

export default function IdeasForm({ onSubmit }) {
  const [idea, setIdea] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (idea.trim()) {
      onSubmit(idea)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
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
      </div>

      <button
        type="submit"
        disabled={!idea.trim()}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-3 rounded-lg hover:from-blue-600 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Gerar Projeto
      </button>
    </form>
  )
}
