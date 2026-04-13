import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'src', 'pages');

const contracts = [
  {
    label: 'HomePage',
    file: 'HomePage.jsx',
    includes: ['Aligna', 'Fluxo principal', 'Pacote principal do Aligna', 'Critérios de Aceite', 'Alertas de Ambiguidade'],
  },
  {
    label: 'CodeStudioPage',
    file: 'CodeStudioPage.jsx',
    includes: ['Code Studio', 'Workspace de entrega', 'Acompanhamento no produto', 'Painel operacional da esteira'],
  },
  {
    label: 'ProjectsPage',
    file: 'ProjectsPage.jsx',
    includes: ['Board Operacional', 'Catálogo de projetos', 'Abrir Code Studio'],
  },
];

async function main() {
  for (const contract of contracts) {
    const target = path.join(root, contract.file);
    const content = await readFile(target, 'utf8');
    for (const token of contract.includes) {
      if (!content.includes(token)) {
        throw new Error(`Contrato visual falhou em ${contract.label}: token ausente "${token}".`);
      }
    }
  }

  console.log('Visual contract concluido com sucesso.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
