# -*- coding: utf-8 -*-
"""
Architect Agent
Responsável por definir a arquitetura técnica e stack do projeto
"""


class Architect:
    def __init__(self, project_id):
        self.project_id = project_id

    def generate_architecture(self, idea, requirements):
        """
        Gera a arquitetura técnica do projeto
        
        Args:
            idea: Descrição da ideia
            requirements: Requisitos gerados
            
        Returns:
            String com a arquitetura formatada
        """
        
        architecture = f"""
# ARQUITETURA DO PROJETO
Projeto ID: {self.project_id}

## VISÃO GERAL

Arquitetura de três camadas:
- Frontend: React + Vite
- Backend: Node.js + Express
- Banco de Dados: PostgreSQL

## STACK TECNOLÓGICO

### Frontend
- **Linguagem**: JavaScript (React)
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **HTTP Client**: Axios
- **Roteamento**: React Router
- **Estado**: useState/useContext
- **Ferramentas**: npm, Node 18+

### Backend
- **Linguagem**: JavaScript (Node.js)
- **Framework**: Express
- **Versão Node**: 18.x LTS
- **Package Manager**: npm
- **Protocolo**: REST API (JSON)
- **Autenticação**: JWT
- **Validação**: express-validator

### Banco de Dados
- **SGBD**: PostgreSQL 14+
- **ORM**: Sequelize (ou Prisma)
- **Migrations**: Sequelize CLI
- **Connection Pool**: pg

### DevOps & Deployment
- **Version Control**: Git
- **CI/CD**: GitHub Actions (ou GitLab CI)
- **Container**: Docker
- **Orquestração**: Docker Compose
- **Cloud**: AWS/Azure (opcional)

## ARQUITETURA DE CAMADAS

```
┌─────────────────────────────────┐
│      FRONTEND (React + Vite)    │
│  - Componentes React            │
│  - Páginas                      │
│  - Serviços HTTP                │
└──────────────┬──────────────────┘
               │ API REST (JSON)
               ▼
┌─────────────────────────────────┐
│    BACKEND (Node.js Express)    │
│  - Controllers                  │
│  - Routes                       │
│  - Services                     │
│  - Middleware                   │
│  - Auth (JWT)                   │
└──────────────┬──────────────────┘
               │ SQL
               ▼
┌─────────────────────────────────┐
│   DATABASE (PostgreSQL)         │
│  - Tables                       │
│  - Indexes                      │
│  - Relations                    │
└─────────────────────────────────┘
```

## ESTRUTURA DE DIRETÓRIOS

```
ai-software-factory/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── server.js
│   ├── package.json
│   └── .env
├── agents/
│   ├── project_manager/
│   ├── requirements_analyst/
│   ├── architect/
│   ├── developer/
│   └── qa_engineer/
├── orchestrator/
├── prompts/
├── outputs/
└── docs/
```

## PADRÕES DE DESIGN

### MVC Pattern
- Models: Entidades do banco
- Views: Componentes React
- Controllers: Lógica da API

### Service Layer
- Serviços isolam lógica de negócio
- Controllers chamam serviços
- Serviços usam repositories

### Repository Pattern
- Abstrai acesso aos dados
- Facilita testes e manutenção

## FLUXO DE DADOS

```
1. User Action → Component
2. Component → Service (API Call)
3. Service → Backend Route
4. Route → Controller
5. Controller → Service
6. Service → Database
7. Response → Frontend
8. Frontend → Component State Update
9. Component → Re-render
```

## SEGURANÇA

- JWT para autenticação
- HTTPS em produção
- Validação em frontend e backend
- Sanitização de inputs
- Rate limiting
- CORS configurado
- Senhas com bcrypt

## ESCALABILIDADE

- Frontend: CDN para assets
- Backend: Load balancer ready
- DB: Índices otimizados
- Cache: Redis (opcional)
- Microserviços: Pronto para expandir

## DEPLOYMENT

- Docker: Containerização
- Compose: Ambiente local
- CI/CD: Automação de testes
- Cloud: Suporta AWS/Azure/GCP
"""
        return architecture

    def process(self, idea, requirements):
        """Processa requisitos e retorna arquitetura"""
        return self.generate_architecture(idea, requirements)
