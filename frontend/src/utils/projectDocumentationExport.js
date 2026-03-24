import { getProjectDocumentationBundle } from '../services/api';

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString('pt-BR');
}

function artifactBlock(title, content) {
  if (!content) return '';
  return `
    <section class="artifact-block">
      <h3>${escapeHtml(title)}</h3>
      <pre>${escapeHtml(content)}</pre>
    </section>
  `;
}

function buildDocumentationHtml(bundle) {
  const epics = bundle.tasks.filter((task) => task.taskType === 'epic');
  const stories = bundle.tasks.filter((task) => task.taskType === 'story');
  const technicalTasks = bundle.tasks.filter((task) => task.taskType === 'task');

  const storySections = stories
    .map((task, index) => {
      const requirements = task.artifacts.find((artifact) => artifact.artifactType === 'requirements');
      const testPlan = task.artifacts.find((artifact) => artifact.artifactType === 'test_plan');

      return `
        <section class="story-card">
          <div class="story-head">
            <div>
              <p class="eyebrow">Story ${index + 1}</p>
              <h2>${escapeHtml(task.title)}</h2>
            </div>
            <div class="story-meta">
              <span>${escapeHtml(task.status || '-')}</span>
              <span>${escapeHtml(task.priority || '-')}</span>
            </div>
          </div>
          ${task.description ? `<p class="story-description">${escapeHtml(task.description)}</p>` : ''}
          ${artifactBlock('Requisitos refinados', requirements?.content || '')}
          ${artifactBlock('Plano de testes', testPlan?.content || '')}
        </section>
      `;
    })
    .join('');

  const simpleList = (items) =>
    items.length
      ? `<ul>${items.map((item) => `<li>${escapeHtml(item.title)}</li>`).join('')}</ul>`
      : '<p class="muted">Nenhum item registrado.</p>';

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(bundle.project.name)} - documentação</title>
      <style>
        @page { size: A4; margin: 18mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; background: white; }
        .container { max-width: 1024px; margin: 0 auto; }
        .hero { border: 1px solid #cbd5e1; border-radius: 16px; padding: 24px; background: #f8fafc; }
        .eyebrow { margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: #1d4ed8; }
        h1 { margin: 0; font-size: 32px; line-height: 1.15; }
        h2 { margin: 0 0 10px; font-size: 22px; }
        h3 { margin: 0 0 8px; font-size: 16px; }
        p { line-height: 1.65; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 20px; }
        .stat { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
        .stat strong { display: block; font-size: 22px; margin-top: 6px; }
        .section { margin-top: 28px; }
        .artifact-block, .story-card, .panel { border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin-top: 14px; }
        .artifact-block pre, .story-card pre { white-space: pre-wrap; word-break: break-word; font-family: Consolas, monospace; font-size: 12px; line-height: 1.55; background: #f8fafc; border-radius: 10px; padding: 14px; overflow: hidden; }
        .story-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
        .story-meta { display: flex; gap: 8px; flex-wrap: wrap; }
        .story-meta span { border: 1px solid #cbd5e1; border-radius: 999px; padding: 4px 10px; font-size: 11px; text-transform: uppercase; }
        .story-description { margin-top: 12px; }
        ul { margin: 8px 0 0; padding-left: 22px; }
        li { margin: 6px 0; line-height: 1.5; }
        .muted { color: #64748b; }
        .footer { margin-top: 30px; font-size: 12px; color: #64748b; }
        @media print { .print-note { display: none; } }
      </style>
      <script>
        window.addEventListener('load', () => {
          setTimeout(() => {
            window.focus();
            window.print();
          }, 500);
        });
      </script>
    </head>
    <body>
      <div class="container">
        <div class="hero">
          <p class="eyebrow">Documentação do projeto</p>
          <h1>${escapeHtml(bundle.project.name)}</h1>
          <p>${escapeHtml(bundle.project.description || 'Sem descrição consolidada.')}</p>
          <p><strong>Visão:</strong> ${escapeHtml(bundle.project.vision || 'Não informada.')}</p>
          <p class="muted">Gerado em ${escapeHtml(formatDateTime(bundle.generatedAt))}</p>
          <div class="grid">
            <div class="stat">Tasks<strong>${bundle.summary.totalTasks}</strong></div>
            <div class="stat">Stories<strong>${bundle.summary.totalStories}</strong></div>
            <div class="stat">Refinadas<strong>${bundle.summary.refinedStories}</strong></div>
            <div class="stat">Com QA<strong>${bundle.summary.storiesWithTestPlan}</strong></div>
          </div>
        </div>

        <section class="section panel">
          <p class="eyebrow">Estrutura</p>
          <h2>Mapa do projeto</h2>
          <div><strong>Epics</strong>${simpleList(epics)}</div>
          <div style="margin-top: 16px;"><strong>Tarefas técnicas</strong>${simpleList(technicalTasks)}</div>
        </section>

        ${bundle.backlogArtifact?.content ? `
          <section class="section">
            <p class="eyebrow">Backlog</p>
            ${artifactBlock(bundle.backlogArtifact.title || 'Backlog consolidado', bundle.backlogArtifact.content)}
          </section>
        ` : ''}

        ${bundle.architectureArtifact?.content ? `
          <section class="section">
            <p class="eyebrow">Arquitetura</p>
            ${artifactBlock(bundle.architectureArtifact.title || 'Arquitetura do projeto', bundle.architectureArtifact.content)}
          </section>
        ` : ''}

        <section class="section">
          <p class="eyebrow">Stories</p>
          <h2>Requisitos e QA por história</h2>
          ${storySections || '<p class="muted">Nenhuma story encontrada.</p>'}
        </section>

        <p class="footer print-note">Use “Salvar como PDF” na janela de impressão do navegador.</p>
      </div>
    </body>
  </html>`;
}

export async function exportProjectDocumentationPdf(projectUuid) {
  const printWindow = window.open('about:blank', '_blank');

  if (!printWindow) {
    throw new Error('Não foi possível abrir a janela de impressão do navegador.');
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Preparando documentação...</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; background: #f8fafc; }
          .box { border: 1px solid #cbd5e1; border-radius: 16px; background: white; padding: 24px 28px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
          h1 { margin: 0 0 8px; font-size: 20px; }
          p { margin: 0; color: #475569; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Preparando documentação</h1>
          <p>Aguarde enquanto o PDF é montado.</p>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  try {
    const bundle = await getProjectDocumentationBundle(projectUuid);
    const html = buildDocumentationHtml(bundle);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    printWindow.location.replace(objectUrl);
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60_000);
  } catch (error) {
    printWindow.close();
    throw error;
  }
}
