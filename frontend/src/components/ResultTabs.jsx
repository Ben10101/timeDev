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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-semibold transition sm:px-6 ${
                activeTab === tab.id
                  ? 'border-[#102a72] bg-white text-[#102a72]'
                  : 'border-transparent text-slate-500 hover:bg-white hover:text-slate-900'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <p className="text-sm text-slate-600">
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
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === 'formatted'
                ? 'bg-[#102a72] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Formatado
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === 'raw'
                ? 'bg-[#102a72] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Bruto
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
          {viewMode === 'formatted' ? (
            <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-a:text-[#102a72]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: ({ inline, ...props }) =>
                    inline ? (
                      <code className="rounded bg-white px-2 py-1 font-mono text-sm text-[#102a72]" {...props} />
                    ) : (
                      <code
                        className="my-3 block overflow-x-auto rounded-xl bg-slate-900 p-3 font-mono text-sm text-slate-100"
                        {...props}
                      />
                    ),
                  pre: ({ ...props }) => (
                    <pre
                      className="my-3 block overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-sm text-slate-100"
                      {...props}
                    />
                  ),
                  blockquote: ({ ...props }) => (
                    <blockquote className="my-3 border-l-4 border-[#102a72] pl-4 italic text-slate-600" {...props} />
                  ),
                  table: ({ ...props }) => (
                    <div className="my-3 overflow-x-auto">
                      <table className="min-w-full border-collapse border border-slate-300" {...props} />
                    </div>
                  ),
                  th: ({ ...props }) => <th className="border border-slate-300 bg-white px-4 py-2 font-semibold" {...props} />,
                  td: ({ ...props }) => <td className="border border-slate-300 px-4 py-2" {...props} />,
                }}
              >
                {activeTabData.content || 'Nenhum conteúdo gerado nesta etapa.'}
              </ReactMarkdown>
            </div>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-xl bg-white p-4 font-mono text-sm text-slate-700">
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
            className="rounded-xl bg-[#102a72] px-6 py-2 font-semibold text-white transition hover:bg-[#0c205a]"
          >
            Baixar {activeTabData.label}
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(activeTabData.content || '');
              alert('Conteúdo copiado para a área de transferência!');
            }}
            className="rounded-xl bg-slate-600 px-6 py-2 font-semibold text-white transition hover:bg-slate-700"
          >
            Copiar
          </button>
        </div>
      </div>
    </div>
  );
}
