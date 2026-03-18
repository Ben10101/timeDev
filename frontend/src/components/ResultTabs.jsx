import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ResultTabs({ data }) {
  const [activeTab, setActiveTab] = useState('backlog');
  const [viewMode, setViewMode] = useState('formatted');

  const tabsInfo = {
    backlog: {
      id: 'backlog',
      label: 'Backlog',
      content: data.backlog,
      description: 'Histórias de usuários, épicos e tarefas do projeto',
      icon: 'BL',
    },
    requirements: {
      id: 'requirements',
      label: 'Requisitos',
      content: data.requirements,
      description: 'Requisitos funcionais, critérios de aceite e regras de negócio',
      icon: 'RQ',
    },
    tests: {
      id: 'tests',
      label: 'Testes',
      content: data.tests,
      description: 'Plano de testes, cenários funcionais e análise de usabilidade',
      icon: 'QA',
    },
  };

  const tabs = Object.values(tabsInfo);
  const activeTabData = tabsInfo[activeTab];

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-lg">
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-semibold transition sm:px-6 ${
                activeTab === tab.id
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-8">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">
            {activeTabData.icon} {activeTabData.label}:
          </span>{' '}
          {activeTabData.description}
        </p>
      </div>

      <div className="p-4 sm:p-8">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode('formatted')}
            className={`rounded px-4 py-2 text-sm font-semibold transition ${
              viewMode === 'formatted' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Formatado
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`rounded px-4 py-2 text-sm font-semibold transition ${
              viewMode === 'raw' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Raw
          </button>
        </div>

        <div className="rounded-lg border border-gray-300 bg-white p-4 sm:p-6">
          {viewMode === 'formatted' ? (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => <h1 className="mb-4 mt-6 text-2xl font-bold sm:text-3xl" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="mb-3 mt-5 text-xl font-bold sm:text-2xl" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="mb-2 mt-4 text-lg font-semibold sm:text-xl" {...props} />,
                  h4: ({ node, ...props }) => <h4 className="mb-2 mt-3 text-base font-semibold sm:text-lg" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-3 leading-relaxed text-gray-700" {...props} />,
                  ul: ({ node, ...props }) => <ul className="mb-3 ml-4 list-inside list-disc" {...props} />,
                  ol: ({ node, ...props }) => <ol className="mb-3 ml-4 list-inside list-decimal" {...props} />,
                  li: ({ node, ...props }) => <li className="mb-1 ml-2" {...props} />,
                  code: ({ node, inline, ...props }) =>
                    inline ? (
                      <code className="rounded bg-gray-100 px-2 py-1 font-mono text-sm text-red-600" {...props} />
                    ) : (
                      <code className="my-3 block overflow-x-auto rounded bg-gray-900 p-3 font-mono text-sm text-gray-100" {...props} />
                    ),
                  pre: ({ node, ...props }) => (
                    <pre className="my-3 block overflow-x-auto rounded bg-gray-900 p-4 font-mono text-sm text-gray-100" {...props} />
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="my-3 border-l-4 border-blue-500 pl-4 italic text-gray-600" {...props} />
                  ),
                  table: ({ node, ...props }) => (
                    <div className="my-3 overflow-x-auto">
                      <table className="min-w-full border-collapse border border-gray-300" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }) => <th className="border border-gray-300 bg-gray-100 px-4 py-2 font-semibold" {...props} />,
                  td: ({ node, ...props }) => <td className="border border-gray-300 px-4 py-2" {...props} />,
                  a: ({ node, ...props }) => <a className="text-blue-500 hover:underline" {...props} />,
                }}
              >
                {activeTabData.content || 'Nenhum conteúdo gerado nesta etapa.'}
              </ReactMarkdown>
            </div>
          ) : (
            <pre className="max-h-96 overflow-auto rounded bg-gray-100 p-4 font-mono text-sm text-gray-700">
              {activeTabData.content || 'Nenhum conteúdo gerado nesta etapa.'}
            </pre>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => {
              const content = activeTabData.content || '';
              const element = document.createElement('a');
              element.setAttribute('href', `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`);
              element.setAttribute('download', `${activeTab}.md`);
              element.style.display = 'none';
              document.body.appendChild(element);
              element.click();
              document.body.removeChild(element);
            }}
            className="rounded bg-blue-500 px-6 py-2 font-semibold text-white transition hover:bg-blue-600"
          >
            Baixar {activeTabData.label}
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(activeTabData.content || '');
              alert('Conteúdo copiado para a área de transferência!');
            }}
            className="rounded bg-gray-500 px-6 py-2 font-semibold text-white transition hover:bg-gray-600"
          >
            Copiar
          </button>
        </div>
      </div>
    </div>
  );
}
