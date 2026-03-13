import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function ResultTabs({ data }) {
  const [activeTab, setActiveTab] = useState('backlog')
  const [viewMode, setViewMode] = useState('formatted') // 'formatted' ou 'raw'

  const tabsInfo = {
    backlog: {
      id: 'backlog',
      label: 'Backlog',
      content: data.backlog,
      description: 'Histórias de usuários, épicos e tarefas do projeto',
      icon: '📋'
    },
    requirements: {
      id: 'requirements',
      label: 'Requisitos',
      content: data.requirements,
      description: 'Requisitos funcionais e não-funcionais do sistema',
      icon: '✅'
    },
    architecture: {
      id: 'architecture',
      label: 'Arquitetura',
      content: data.architecture,
      description: 'Design da arquitetura técnica e estrutura do projeto',
      icon: '🏗️'
    },
    code: {
      id: 'code',
      label: 'Código',
      content: data.code,
      description: 'Estrutura de código base e exemplos de implementação',
      icon: '💻'
    },
    tests: {
      id: 'tests',
      label: 'Testes',
      content: data.tests,
      description: 'Plano de testes, cenários e estratégia de QA',
      icon: '🧪'
    }
  }

  const tabs = Object.values(tabsInfo)
  const activeTabData = tabsInfo[activeTab]

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-6 text-sm font-semibold whitespace-nowrap transition border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Description */}
      <div className="bg-gray-50 px-8 py-3 border-b border-gray-200">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">{activeTabData.icon} {activeTabData.label}:</span> {activeTabData.description}
        </p>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* View Mode Toggle */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setViewMode('formatted')}
            className={`px-4 py-2 rounded text-sm font-semibold transition ${
              viewMode === 'formatted'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📄 Formatado
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`px-4 py-2 rounded text-sm font-semibold transition ${
              viewMode === 'raw'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📝 Raw
          </button>
        </div>

        {/* Content Display */}
        <div className="border border-gray-300 rounded-lg p-6 bg-white">
          {viewMode === 'formatted' ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-6 mb-4" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-5 mb-3" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                  h4: ({ node, ...props }) => <h4 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-3 text-gray-700 leading-relaxed" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-3 ml-4" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-3 ml-4" {...props} />,
                  li: ({ node, ...props }) => <li className="mb-1 ml-2" {...props} />,
                  code: ({ node, inline, ...props }) =>
                    inline ? (
                      <code className="bg-gray-100 px-2 py-1 rounded text-red-600 font-mono text-sm" {...props} />
                    ) : (
                      <code className="bg-gray-900 text-gray-100 p-3 rounded block overflow-x-auto my-3 font-mono text-sm" {...props} />
                    ),
                  pre: ({ node, ...props }) => <pre className="bg-gray-900 text-gray-100 p-4 rounded block overflow-x-auto my-3 font-mono text-sm" {...props} />,
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-3" {...props} />
                  ),
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="min-w-full border-collapse border border-gray-300" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }) => <th className="border border-gray-300 px-4 py-2 bg-gray-100 font-semibold" {...props} />,
                  td: ({ node, ...props }) => <td className="border border-gray-300 px-4 py-2" {...props} />,
                  a: ({ node, ...props }) => <a className="text-blue-500 hover:underline" {...props} />,
                }}
              >
                {activeTabData.content}
              </ReactMarkdown>
            </div>
          ) : (
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96 text-sm font-mono text-gray-700">
              {activeTabData.content}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              const content = activeTabData.content
              const element = document.createElement('a')
              element.setAttribute('href', `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`)
              element.setAttribute('download', `${activeTab}.md`)
              element.style.display = 'none'
              document.body.appendChild(element)
              element.click()
              document.body.removeChild(element)
            }}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition font-semibold"
          >
            ⬇️ Baixar {activeTabData.label}
          </button>

          <button
            onClick={() => {
              const content = activeTabData.content
              navigator.clipboard.writeText(content)
              alert('Conteúdo copiado para a área de transferência!')
            }}
            className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition font-semibold"
          >
            📋 Copiar
          </button>
        </div>
      </div>
    </div>
  )
}
