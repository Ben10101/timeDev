# 🏭 AI Software Factory - Gera Projetos Reais e Executáveis

**AI Software Factory** é uma plataforma inteligente que gera **projetos completos e funcionais** a partir de uma simples descrição de ideia.

## ✨ O Que Você Recebe

Ao descrever uma ideia, a factory gera tudo pronto para rodar:

✅ **Frontend React** completo com Vite + TailwindCSS
✅ **Backend Node.js/Express** funcional
✅ **Documentação completa** (Backlog, Requisitos, Arquitetura)
✅ **Estrutura real de arquivos** pronta para desenvolvimento
✅ **Download em ZIP** - Execute localmente em segundos
- 🧪 **Testes** - Plano de testes, cenários e estratégias de QA

Este é um **MVP funcional** pronto para ser expandido em uma solução SaaS completa.

---

## 🏗️ Arquitetura do Projeto

### Estrutura de Pastas

```
ai-software-factory/
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── pages/           # Páginas da aplicação
│   │   ├── services/        # Serviços de API
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/                  # Node.js + Express
│   ├── src/
│   │   ├── controllers/     # Controladores
│   │   ├── routes/          # Rotas da API
│   │   ├── services/        # Serviços
│   │   └── server.js
│   └── package.json
│
├── agents/                   # Agentes Python
│   ├── project_manager/     # Gera backlog
│   ├── requirements_analyst/# Gera requisitos
│   ├── architect/           # Define arquitetura
│   ├── developer/           # Gera código
│   ├── qa_engineer/         # Gera testes
│   └── __init__.py
│
├── orchestrator/            # Orquestrador Python
│   ├── factory.py           # Executa o pipeline
│   ├── workflow.py          # Define as etapas
│   └── __init__.py
│
├── prompts/                 # Instruções para agentes
│   ├── pm_prompt.txt
│   ├── requirements_prompt.txt
│   ├── architect_prompt.txt
│   ├── developer_prompt.txt
│   └── qa_prompt.txt
│
├── outputs/                 # Artefatos gerados
│   └── projects/
│       └── [project-id]/
│           ├── backlog.md
│           ├── requirements.md
│           ├── architecture.md
│           ├── code_structure.md
│           └── tests.md
│
├── scripts/                 # Scripts de automação
│   ├── run_factory.py      # Executa a factory
│   └── start_services.py   # Inicia serviços
│
├── docs/                    # Documentação adicional
│   └── ARCHITECTURE.md
│
└── README.md               # Este arquivo
```

---

## 🛠️ Stack Tecnológico

### Frontend
- **React 18.2** - Biblioteca de UI
- **Vite 5.0** - Build tool rápido
- **TailwindCSS 3.3** - Framework CSS
- **Axios 1.6** - Cliente HTTP
- **React Router 6.20** - Roteamento

### Backend
- **Node.js 18+** - Runtime JavaScript
- **Express 4.18** - Framework web
- **CORS** - Compartilhamento de recurso entre origens
- **UUID** - Gerador de IDs únicos

### Agentes (Python)
- **Python 3.8+** - Linguagem dos agentes
- Agentes modulares para cada responsabilidade
- JSON para formatação de output

---

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+ e npm
- Python 3.8+

### 1. Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/ai-software-factory.git
cd ai-software-factory
```

### 2. Instalar Dependências do Frontend

```bash
cd frontend
npm install
cd ..
```

### 3. Instalar Dependências do Backend

```bash
cd backend
npm install
cd ..
```

### 4. Verificar Python (Agentes)

```bash
python --version  # Deve ser 3.8+
```

### 5. Iniciar os Serviços

#### Terminal 1 - Backend (Node.js)
```bash
cd backend
npm run dev
# Backend rodando em http://localhost:3001
```

#### Terminal 2 - Frontend (React)
```bash
cd frontend
npm run dev
# Frontend rodando em http://localhost:5173
```

### 6. Usar a Aplicação

1. Abra o navegador em `http://localhost:5173`
2. Digite a ideia de um novo projeto
3. Clique em "Gerar Projeto"
4. Aguarde o processamento pelos agentes
5. Veja os resultados nas abas (Backlog, Requisitos, Arquitetura, Código, Testes)

---

## 📋 Fluxo da Aplicação

```
┌─────────────────────────────────────────────────────────┐
│ 1. Usuário descreve ideia no Frontend                  │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Frontend envia POST /api/generate-project            │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Backend Node.js recebe requisição                    │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Backend chama orchestrator.py                        │
└─────────────────────────────┬───────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Project      │      │ Requirements │      │ Architect    │
│ Manager      │      │ Analyst      │      │              │
│              │      │              │      │              │
│ → Backlog    │      │ → Requisitos │      │ → Arquitetura│
└──────────────┘      └──────────────┘      └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Developer    │      │ QA Engineer  │      │ Salva em     │
│              │      │              │      │ outputs/     │
│ → Código     │      │ → Testes     │      │              │
└──────────────┘      └──────────────┘      └──────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Backend retorna JSON com todos os artefatos         │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Frontend mostra resultados em abas                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🤖 Agentes da Fábrica

### 1️⃣ Project Manager
**Responsabilidade**: Gerar backlog e estruturar o projeto

- Recebe: Ideia da aplicação
- Processa: Quebra em épicos e histórias de usuário
- Retorna: Backlog estruturado com tarefas

### 2️⃣ Requirements Analyst
**Responsabilidade**: Analisar e detalhar requisitos

- Recebe: Ideia + Backlog
- Processa: Define RF e RNF, cria casos de uso
- Retorna: Especificação completa de requisitos

### 3️⃣ Architect
**Responsabilidade**: Definir a arquitetura técnica

- Recebe: Ideia + Requisitos
- Processa: Seleciona stack, design de componentes
- Retorna: Arquitetura técnica documentada

### 4️⃣ Developer
**Responsabilidade**: Gerar estrutura de código

- Recebe: Ideia + Arquitetura
- Processa: Cria estrutura de pastas, templates de código
- Retorna: Código inicial e estrutura do projeto

### 5️⃣ QA Engineer
**Responsabilidade**: Criar plano de testes

- Recebe: Ideia + Código
- Processa: Define estratégia de testes e cenários
- Retorna: Plano completo de QA e testes

---

## 📁 Endpoints da API

### Gerar Novo Projeto

```http
POST /api/generate-project
Content-Type: application/json

{
  "idea": "descrição do projeto"
}
```

**Resposta:**
```json
{
  "projectId": "uuid-aqui",
  "timestamp": "2024-01-01T10:00:00Z",
  "backlog": "conteúdo gerado...",
  "requirements": "conteúdo gerado...",
  "architecture": "conteúdo gerado...",
  "code": "conteúdo gerado...",
  "tests": "conteúdo gerado..."
}
```

---

## 🧪 Executar Testes

### Backend

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
npm test
```

### Agentes Python

```bash
python scripts/run_factory.py
```

---

## 📚 Documentação Adicional

- [Arquitetura Detalhada](docs/ARCHITECTURE.md)
- [Guia de Contribuição](docs/CONTRIBUTING.md)
- [API Documentation](docs/API.md)
- [Installation Guide](docs/INSTALL.md)

---

## 🎯 Roadmap Futuro

### MVP 1.0 (Atual)
- [x] Frontend com React
- [x] Backend com Node.js
- [x] 5 Agentes Python
- [x] Geração de artefatos básicos
- [x] Interface de abas

### V2.0 (Próximo)
- [ ] Integração com modelos de IA (OpenAI, Claude)
- [ ] Persistência de projetos em banco de dados
- [ ] Autenticação de usuários
- [ ] Dashboard de projetos anteriores
- [ ] Refinamento iterativo de artefatos

### V3.0
- [ ] Colaboração em tempo real
- [ ] Versions de projetos
- [ ] Exportação de código executável
- [ ] Deploy automático
- [ ] Marketplace de templates

### SaaS
- [ ] Planos de preço
- [ ] Equipes colaborativas
- [ ] Análise de uso
- [ ] Suporte 24/7
- [ ] Integrações (GitHub, GitLab, etc)

---

## 🐛 Troubleshooting

### Erro: "Port 3001 is already in use"
```bash
# Mude a porta no backend/.env
PORT=3002
```

### Erro: "Python not found"
```bash
# Verifique a instalação
python --version

# No Windows, pode ser necessário usar python3
python3 scripts/run_factory.py
```

### Erro de CORS
Certifique-se de que o backend está rodando em `http://localhost:3001` e o frontend pode acessá-lo.

---

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 👥 Contribuições

Contribuições são bem-vindas! Por favor, consulte [CONTRIBUTING.md](docs/CONTRIBUTING.md) para orientações sobre como contribuir.

---

## 📞 Suporte

Para suporte, dúvidas ou feedback:
- abra uma issue no GitHub
- envie um email para: seu-email@example.com

---

## 🙏 Agradecimentos

Desenvolvido como um projeto MVP para demonstrar a integração de múltiplos agentes de IA em uma plataforma de geração automática de software.

---

**Versão**: 1.0.0  
**Data**: Janeiro 2024  
**Autor**: Seu Nome  
