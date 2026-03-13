# Arquitetura Técnica - AI Software Factory

## 🏗️ Visão Geral da Arquitetura

A AI Software Factory é construída com uma arquitetura de **três camadas** que separa claramente as responsabilidades:

```
┌─────────────────────────────────┐
│   CAMADA DE APRESENTAÇÃO        │
│   Frontend (React + Vite)       │
│   - Componentes reutilizáveis   │
│   - Gerenciamento de estado     │
│   - Roteamento                  │
└─────────────┬───────────────────┘
              │ HTTP/JSON
              ▼
┌─────────────────────────────────┐
│   CAMADA DE APLICAÇÃO           │
│   Backend (Node.js + Express)   │
│   - Controllers                 │
│   - Routes                      │
│   - Services                    │
│   - Middleware                  │
└─────────────┬───────────────────┘
              │ System calls
              ▼
┌─────────────────────────────────┐
│   CAMADA DE PROCESSAMENTO       │
│   Agent Orchestrator (Python)   │
│   - Project Manager             │
│   - Requirements Analyst        │
│   - Architect                   │
│   - Developer                   │
│   - QA Engineer                 │
└─────────────────────────────────┘
```

---

## 📊 Componentes Principais

### 1. Frontend (React + Vite)

#### Estrutura
```
frontend/src/
├── components/          # Componentes reutilizáveis
│   ├── IdeasForm.jsx   # Formulário de entrada
│   ├── LoadingSpinner.jsx
│   └── ResultTabs.jsx  # Exibição de resultados
├── pages/              # Páginas da aplicação
│   ├── HomePage.jsx    # Página inicial
│   └── ResultsPage.jsx # Página de resultados
├── services/           # Serviços de API
│   └── api.js         # Integração com backend
├── App.jsx            # Componente raiz
└── main.jsx           # Ponto de entrada
```

#### Fluxo de Dados
```
User Input → IdeasForm → API Call → Loading State → Results Display → Tabs Navigation
```

#### Tecnologias
- **React 18.2**: Framework de UI
- **Vite**: Build tool com hot module replacement
- **TailwindCSS**: Framework CSS utilitário
- **Axios**: Cliente HTTP
- **React Router**: Gerenciamento de rotas

### 2. Backend (Node.js + Express)

#### Estrutura
```
backend/src/
├── controllers/        # Lógica de negócio da API
│   └── projectController.js
├── routes/            # Definição de rotas
│   └── projectRoutes.js
├── services/          # Serviços de integração
│   └── orchestratorService.js
└── server.js          # Aplicação principal
```

#### Responsabilidades
1. **Receber requisições HTTP** da aplicação frontend
2. **Validar dados** de entrada
3. **Chamar o orchestrator Python** para processar a ideia
4. **Retornar resultados** em formato JSON

#### Fluxo de Requisição
```
Request → Route → Controller → Service → Orchestrator → Response
```

### 3. Agentes Python

Cada agente é responsável por uma etapa específica do processo:

#### Project Manager
```python
ProjectManager
├── Input: Ideia do usuário
├── Processo: Quebra em épicos, histórias, tarefas
└── Output: Backlog estruturado
```

#### Requirements Analyst
```python
RequirementsAnalyst
├── Input: Ideia + Backlog
├── Processo: Define RF, RNF, casos de uso
└── Output: Especificação de requisitos
```

#### Architect
```python
Architect
├── Input: Ideia + Requisitos
├── Processo: Seleciona stack, design arquitetura
└── Output: Arquitetura técnica
```

#### Developer
```python
Developer
├── Input: Ideia + Arquitetura
├── Processo: Gera estrutura e templates
└── Output: Estrutura de código
```

#### QA Engineer
```python
QAEngineer
├── Input: Ideia + Código
├── Processo: Define plano de testes
└── Output: Estratégia de testes
```

---

## 🔄 Fluxo de Dados Completo

### 1. Entrada do Usuário
```javascript
// Frontend: HomePage.jsx
const handleGenerateProject = async (idea) => {
  const response = await generateProject(idea)
  navigate(`/results/${response.projectId}`, { state: { data: response } })
}
```

### 2. Requisição HTTP
```http
POST /api/generate-project
Content-Type: application/json

{
  "idea": "Sistema de controle de clientes..."
}
```

### 3. Processamento no Backend
```javascript
// Backend: projectController.js
export async function generateProjectController(req, res) {
  const { idea } = req.body
  const projectId = uuidv4()
  const result = await orchestrateProject(projectId, idea)
  return res.status(200).json({ projectId, ...result })
}
```

### 4. Chamada do Orchestrator Python
```javascript
// Backend: orchestratorService.js
const pythonProcess = spawn('python', [orchestratorPath, projectId, idea])
```

### 5. Execução dos Agentes
```python
# Python: factory.py
factory = Factory(project_id, idea)
results = factory.run()  # Executa todos os agentes
```

### 6. Retorno de Dados
```json
{
  "projectId": "abc-123",
  "timestamp": "2024-01-01T10:00:00Z",
  "backlog": "...",
  "requirements": "...",
  "architecture": "...",
  "code": "...",
  "tests": "..."
}
```

### 7. Exibição no Frontend
```javascript
// Frontend: ResultsPage.jsx
// Dados mostrados em abas:
// - Backlog
// - Requisitos
// - Arquitetura
// - Código
// - Testes
```

---

## 🗂️ Organização de Arquivos

### Frontend
```
frontend/
├── public/            # Arquivos estáticos
├── src/
│   ├── components/    # Componentes reutilizáveis (60%)
│   ├── pages/         # Páginas inteiras (20%)
│   ├── services/      # Integração com API (15%)
│   ├── App.jsx        # Componente raiz
│   ├── main.jsx       # Entry point
│   └── index.css      # Estilos globais
├── index.html         # HTML raiz
├── package.json       # Dependências
├── vite.config.js     # Configuração Vite
├── tailwind.config.js # Configuração Tailwind
└── postcss.config.js  # Configuração PostCSS
```

### Backend
```
backend/
├── src/
│   ├── controllers/   # Lógica das rotas (40%)
│   ├── routes/        # Definição de rotas (20%)
│   ├── services/      # Serviços reutilizáveis (30%)
│   └── server.js      # Aplicação Express
├── package.json       # Dependências
├── .env              # Variáveis de ambiente
└── Dockerfile        # Containerização
```

### Agentes Python
```
agents/
├── project_manager/agent.py       # PM Agent
├── requirements_analyst/agent.py  # RA Agent
├── architect/agent.py             # Architect Agent
├── developer/agent.py             # Developer Agent
├── qa_engineer/agent.py           # QA Agent
└── __init__.py                    # Package initialization
```

---

## 🔐 Segurança

### Frontend
- ✅ Validação de entrada no cliente
- ✅ Proteção contra XSS via React (auto-escape)
- ✅ HTTPS em produção

### Backend
- ✅ CORS configurado
- ✅ Validação de entrada no servidor
- ✅ Sanitização de dados
- ✅ Rate limiting (implementar em produção)
- ✅ Logs de auditoria

### Agentes Python
- ✅ Isolamento de processo
- ✅ Limites de recursos
- ✅ Validação de entrada

---

## ⚡ Performance

### Frontend Optimization
- Lazy loading de componentes
- Code splitting com Vite
- Memoização de componentes
- Otimização de imagens

### Backend Optimization
- Caching de respostas
- Connection pooling
- Gzip compression
- Load balancing ready

### Python Processing
- Execução assíncrona
- Generators para economia de memória
- Processamento em chunks

---

## 📦 Deployment

### Opções
1. **Docker Compose** (Local/Dev)
2. **Docker Hub** (Container Registry)
3. **Cloud Providers**
   - AWS ECS
   - Azure Container Instances
   - Google Cloud Run
   - Heroku

### Dockerfile Strategy
```
Node.js → Frontend build → Nginx
         → Backend run
Python  → Agentes run
PostgreSQL → Banco de dados
```

---

## 🧪 Testes

### Frontend Testing Strategy
- Unit tests com Jest
- Component tests com React Testing Library
- E2E tests com Cypress/Playwright

### Backend Testing Strategy
- Unit tests com Jest
- Integration tests com Supertest
- Coverage target: 80%+

### Agent Testing Strategy
- Unit tests para cada agente
- Integration tests para o pipeline
- Output validation

---

## 🔍 Monitoramento

### Métricas Importantes
1. **Tempo de Resposta da API**
2. **Taxa de Erro**
3. **Cobertura de Testes**
4. **Performance do Python**
5. **Uso de Memória**

### Logging
- Frontend: Console + erro tracking
- Backend: Winston/Morgan
- Python: Logging padrão + arquivo

---

## 🚀 Escalabilidade

### Curto Prazo
- Melhorar performance dos agentes
- Cache de resultados
- Processamento em fila (Bull/RabbitMQ)

### Médio Prazo
- Microserviços por agente
- API Gateway
- Load balancer

### Longo Prazo
- Kubernetes orchestration
- Auto-scaling
- Disaster recovery
- Multi-region deployment

---

## 📚 Referencias

- [React Documentation](https://react.dev)
- [Express Documentation](https://expressjs.com)
- [Vite Documentation](https://vitejs.dev)
- [TailwindCSS Documentation](https://tailwindcss.com)
- [Python Documentation](https://docs.python.org)

---

**Última atualização**: Janeiro 2024
