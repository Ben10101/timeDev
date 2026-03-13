# -*- coding: utf-8 -*-
"""
Developer Agent
Gera código real, estrutura funcional e implementação técnica específica
"""

class Developer:
    def __init__(self, project_id):
        self.project_id = project_id
    
    def extract_domain_entities(self, idea):
        """Extrai entidades de negócio da ideia"""
        lower_idea = idea.lower()
        
        entities = []
        
        # Detectar entidades comuns
        if any(w in lower_idea for w in ['usuário', 'user', 'conta', 'account']):
            entities.append('User')
        if any(w in lower_idea for w in ['tarefa', 'task', 'todo', 'item']):
            entities.append('Task')
        if any(w in lower_idea for w in ['projeto', 'project']):
            entities.append('Project')
        if any(w in lower_idea for w in ['equipe', 'team', 'grupo']):
            entities.append('Team')
        if any(w in lower_idea for w in ['comentário', 'comment', 'nota', 'note']):
            entities.append('Comment')
        if any(w in lower_idea for w in ['notificação', 'notification', 'alerta']):
            entities.append('Notification')
        if any(w in lower_idea for w in ['arquivo', 'file', 'documento', 'document']):
            entities.append('File')
        if any(w in lower_idea for w in ['relatório', 'report', 'análise', 'analytics']):
            entities.append('Report')
        
        return entities if entities else ['User', 'Task']

    def generate_code_structure(self, idea, architecture):
        """
        Gera estrutura de código funcional e específica
        """
        entities = self.extract_domain_entities(idea)
        entity_list = ', '.join(entities)
        primary_entity = entities[0] if entities else 'Item'
        
        # Variáveis auxiliares para uso nos templates f-string
        primary_entity_lower = primary_entity.lower()
        primary_entity_lower_plural = f"{primary_entity_lower}s"
        
        code = f"""# 💻 PROJETO E ESTRUTURA DE CÓDIGO
**Projeto ID:** {self.project_id}

---

## 📂 ESTRUTURA DE PASTAS

```
projeto-{self.project_id}/
│
├── frontend/                      # React + Vite
│   ├── src/
│   │   ├── components/           # Componentes reutilizáveis
│   │   │   ├── ui/              # Buttons, modals, inputs
│   │   │   ├── forms/           # Form fields, validators
│   │   │   └── layout/          # Header, sidebar, footer
│   │   ├── pages/               # Páginas/rotas
│   │   │   ├── HomePage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── {primary_entity}ListPage.jsx
│   │   │   ├── {primary_entity}DetailPage.jsx
│   │   │   └── NotFoundPage.jsx
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── useFetch.js
│   │   │   ├── useForm.js
│   │   │   └── useAuth.js
│   │   ├── services/            # API calls
│   │   │   ├── api.js           # Axios instance
│   │   │   ├── authService.js
│   │   │   └── {primary_entity.lower()}Service.js
│   │   ├── store/               # State management (Zustand/Redux)
│   │   │   ├── authStore.js
│   │   │   └── {primary_entity.lower()}Store.js
│   │   ├── styles/              # CSS global
│   │   │   ├── index.css
│   │   │   └── variables.css
│   │   ├── utils/               # Funções auxiliares
│   │   │   ├── validation.js
│   │   │   ├── formatters.js
│   │   │   └── constants.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   │   └── assets/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── .env.example
│   ├── .eslintrc.json
│   └── README.md
│
├── backend/                       # Express + Node.js
│   ├── src/
│   │   ├── config/              # Configurações
│   │   │   ├── database.js      # SQL Pool connection
│   │   │   ├── redis.js         # Cache
│   │   │   └── jwt.js           # JWT config
│   │   ├── models/              # Database models/schema
│   │   │   ├── User.js
│   │   │   └── {primary_entity}.js
│   │   ├── controllers/         # Lógica de requisição
│   │   │   ├── authController.js
│   │   │   └── {primary_entity.lower()}Controller.js
│   │   ├── routes/              # Express routes
│   │   │   ├── auth.js
│   │   │   ├── {primary_entity.lower()}.js
│   │   │   └── index.js
│   │   ├── middleware/          # Express middleware
│   │   │   ├── authenticate.js  # JWT verification
│   │   │   ├── errorHandler.js
│   │   │   └── validators.js    # Input validation
│   │   ├── services/            # Business logic
│   │   │   ├── authService.js
│   │   │   └── {primary_entity.lower()}Service.js
│   │   ├── utils/               # Helpers
│   │   │   ├── logger.js
│   │   │   ├── email.js
│   │   │   └── response.js
│   │   ├── jobs/                # Background jobs (Bull)
│   │   │   └── emailQueue.js
│   │   └── server.js            # Express app entry
│   ├── migrations/              # Database migrations (Postgres)
│   ├── seeds/                   # Database seed data
│   ├── tests/                   # test files
│   │   ├── unit/
│   │   └── integration/
│   ├── package.json
│   ├── .env.example
│   ├── .eslintrc.json
│   └── README.md
│
├── docs/                         # Documentação
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEV_SETUP.md
│   └── DEPLOYMENT.md
│
├── docker-compose.yml            # Serviços locais
└── .github/
    └── workflows/
        └── ci.yml               # Testes automáticos
```

---

## 🗄️ MODELOS DE DADOS (Database Schema)

### Tabela: users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'banned'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP, -- Soft delete
    
    INDEX idx_email (email),
    INDEX idx_created_at (created_at)
);
```

### Tabela: {primary_entity.lower()}s
```sql
CREATE TABLE {primary_entity.lower()}s (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'archived'
    priority VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high'
    due_date DATE,
    tags VARCHAR(255)[],
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);
```

### Tabela: comments (se aplicável)
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    {primary_entity.lower()}_id UUID NOT NULL REFERENCES {primary_entity.lower()}s(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_item_id ({primary_entity.lower()}_id),
    INDEX idx_user_id (user_id)
);
```

---

## 🔌 API ENDPOINTS (RESTful)

### Authentication
```
POST   /api/v1/auth/register
  Body: {{ email, password, name, avatar_url }}
  Response: {{ user, token, refreshToken }}

POST   /api/v1/auth/login
  Body: {{ email, password }}
  Response: {{ user, token, refreshToken }}

POST   /api/v1/auth/refresh
  Body: {{ refreshToken }}
  Response: {{ token }}

POST   /api/v1/auth/logout
  Headers: Authorization: Bearer <token>
  Response: {{ success }}

POST   /api/v1/auth/password-reset
  Body: {{ email }}
  Response: {{ message }}

POST   /api/v1/auth/password-reset/confirm
  Body: {{ token, newPassword }}
  Response: {{ success }}
```

### {primary_entity}s (CRUD)
```
GET    /api/v1/{primary_entity.lower()}s?page=1&limit=20&sort=created_at
  Response: {{ data: [], total, page, limit }}

GET    /api/v1/{primary_entity.lower()}s/:id
  Response: {{ id, title, description, status, ... }}

POST   /api/v1/{primary_entity.lower()}s
  Body: {{ title, description, priority, due_date, tags }}
  Response: {{ id, title, ... }} (201 Created)

PUT    /api/v1/{primary_entity.lower()}s/:id
  Body: {{ title, description, status, priority }}
  Response: {{ id, title, ... }}

DELETE /api/v1/{primary_entity.lower()}s/:id
  Response: {{ success }} (soft-delete)

PATCH  /api/v1/{primary_entity.lower()}s/:id/status
  Body: {{ status }}
  Response: {{ id, status }}
```

### Search & Filter
```
GET    /api/v1/{primary_entity.lower()}s/search?q=<query>
  Response: {{ data: [] }}

GET    /api/v1/{primary_entity.lower()}s?filter[status]=active&sort=-created_at
  Response: {{ data: [], filters_applied }}
```

### Comments
```
GET    /api/v1/{primary_entity.lower()}s/:id/comments
  Response: {{ data: [] }}

POST   /api/v1/{primary_entity.lower()}s/:id/comments
  Body: {{ content }}
  Response: {{ id, content, user, created_at }}

DELETE /api/v1/{primary_entity.lower()}s/:id/comments/:commentId
  Response: {{ success }}
```

### User Profile
```
GET    /api/v1/users/me
  Response: {{ id, email, name, avatar_url, role }}

PUT    /api/v1/users/me
  Body: {{ name, avatar_url, timezone }}
  Response: {{ id, name, avatar_url }}

GET    /api/v1/users/:id
  Response: {{ id, name, avatar_url, created_at }}
```

---

## 💻 EXEMPLOS DE CÓDIGO

### Backend: Express Server (server.js)
```javascript
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import {primary_entity_lower}Routes from './routes/{primary_entity_lower}s.js'
import errorHandler from './middleware/errorHandler.js'
import logger from './utils/logger.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Security & Middleware
app.use(helmet())
app.use(cors({{
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}}))
app.use(express.json())
app.use(express.urlencoded({{ extended: true }}))

// Logging
app.use((req, res, next) => {{
  logger.info(`${{req.method}} ${{req.path}}`)
  next()
}})

// Health check
app.get('/api/v1/health', (req, res) => {{
  res.json({{ status: 'OK', timestamp: new Date() }})
}})

// Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/{primary_entity_lower}s', {primary_entity_lower}Routes)

// Error handling
app.use(errorHandler)

// 404 handler
app.use((req, res) => {{
  res.status(404).json({{ error: 'Not found' }})
}})

app.listen(PORT, () => {{
  logger.info(`✅ Server running on http://localhost:${{PORT}}`)
}})

export default app
```

### Backend: Controller Example ({primary_entity}Controller.js)
```javascript
import db from '../config/database.js'
import {{ {primary_entity}Service }} from '../services/{primary_entity.lower()}Service.js'
import {{ successResponse, errorResponse }} from '../utils/response.js'
import logger from '../utils/logger.js'

export const get{primary_entity}s = async (req, res) => {{
  try {{
    const {{ page = 1, limit = 20, sort = '-created_at' }} = req.query
    const userId = req.user.id

    const {primary_entity_lower_plural} = await {primary_entity}Service.getAll(userId, {{
      page: parseInt(page),
      limit: parseInt(limit),
      sort
    }})

    return successResponse(res, {primary_entity_lower_plural}, 200)
  }} catch (error) {{
    logger.error('Error fetching {primary_entity_lower}s:', error)
    return errorResponse(res, error.message, 500)
  }}
}}

export const get{primary_entity}ById = async (req, res) => {{
  try {{
    const {{ id }} = req.params
    const userId = req.user.id

    const {primary_entity_lower} = await {primary_entity}Service.getById(id, userId)
    
    if (!{primary_entity_lower}) {{
      return errorResponse(res, '{primary_entity} not found', 404)
    }}

    return successResponse(res, {primary_entity_lower}, 200)
  }} catch (error) {{
    return errorResponse(res, error.message, 500)
  }}
}}

export const create{primary_entity} = async (req, res) => {{
  try {{
    const {{ title, description, priority, due_date, tags }} = req.body
    const userId = req.user.id

    // Validação
    if (!title || title.trim() === '') {{
      return errorResponse(res, 'Title is required', 400)
    }}

    const {primary_entity_lower} = await {primary_entity}Service.create({{
      userId,
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || 'medium',
      due_date: due_date || null,
      tags: tags || []
    }})

    return successResponse(res, {primary_entity_lower}, 201)
  }} catch (error) {{
    return errorResponse(res, error.message, 500)
  }}
}}

export const update{primary_entity} = async (req, res) => {{
  try {{
    const {{ id }} = req.params
    const {{ title, description, status, priority }} = req.body
    const userId = req.user.id

    // Verificar propriedade
    const existing = await {primary_entity}Service.getById(id, userId)
    if (!existing) {{
      return errorResponse(res, '{primary_entity} not found', 404)
    }}

    const updated = await {primary_entity}Service.update(id, {{
      title: title?.trim(),
      description: description?.trim(),
      status,
      priority
    }})

    return successResponse(res, updated, 200)
  }} catch (error) {{
    return errorResponse(res, error.message, 500)
  }}
}}

export const delete{primary_entity} = async (req, res) => {{
  try {{
    const {{ id }} = req.params
    const userId = req.user.id

    const existing = await {primary_entity}Service.getById(id, userId)
    if (!existing) {{
      return errorResponse(res, '{primary_entity} not found', 404)
    }}

    await {primary_entity}Service.delete(id)

    return successResponse(res, {{ success: true }}, 200)
  }} catch (error) {{
    return errorResponse(res, error.message, 500)
  }}
}}
```

### Frontend: Custom Hook (useFetch.js)
```javascript
import {{ useState, useEffect }} from 'react'
import axios from 'axios'

export const useFetch = (url, options = {{}}) => {{
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {{
    const fetchData = async () => {{
      try {{
        setLoading(true)
        const token = localStorage.getItem('token')
        const config = {{
          ...options,
          headers: {{
            Authorization: `Bearer ${{token}}`,
            ...options.headers
          }}
        }}
        
        const response = await axios.get(url, config)
        setData(response.data)
        setError(null)
      }} catch (err) {{
        setError(err.response?.data?.error || err.message)
        setData(null)
      }} finally {{
        setLoading(false)
      }}
    }}

    fetchData()
  }}, [url])

  return {{ data, loading, error }}
}}
```

### Frontend: {primary_entity} List Component
```jsx
import {{ useEffect, useState }} from 'react'
import {{ useFetch }} from '../hooks/useFetch'
import {primary_entity}Form from './forms/{primary_entity}Form'
import {primary_entity}Item from './{primary_entity}Item'

export default function {primary_entity}List() {{
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const {{ data, loading, error }} = useFetch(
    `/api/v1/{primary_entity.lower()}s?page=${{page}}&limit=20`
  )

  useEffect(() => {{
    if (data?.data) setItems(data.data)
  }}, [data])

  const handleCreate = async (formData) => {{
    // POST to create
    const response = await fetch('/api/v1/{primary_entity.lower()}s', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify(formData)
    }})
    const newItem = await response.json()
    setItems([newItem, ...items])
  }}

  if (loading) return <div>Carregando...</div>
  if (error) return <div>Erro: {{error}}</div>

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">{primary_entity}s</h1>
      
      <{primary_entity}Form onSubmit={{handleCreate}} />

      <div className="mt-6 space-y-4">
        {{items.map(item => (
          <{primary_entity}Item key={{item.id}} item={{item}} />
        ))}}
      </div>

      <div className="mt-6 flex gap-4">
        <button 
          onClick={{() => setPage(Math.max(1, page - 1))}}
          disabled={{page === 1}}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Anterior
        </button>
        <span>Página {{page}}</span>
        <button 
          onClick={{() => setPage(page + 1)}}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Próximo
        </button>
      </div>
    </div>
  )
}}
```

---

## 🧪 TESTES UNITÁRIOS (Jest)

### Backend: authService.test.js
```javascript
import {{ describe, it, expect, beforeEach }} from '@jest/globals'
import {{ authService }} from '../services/authService'

describe('AuthService', () => {{
  describe('hashPassword', () => {{
    it('deve hashear a senha corretamente', async () => {{
      const password = 'MyPassword123!'
      const hashed = await authService.hashPassword(password)
      
      expect(hashed).not.toBe(password)
      expect(await authService.comparePassword(password, hashed)).toBe(true)
    }})

    it('não deve comparar senhas diferentes', async () => {{
      const password = 'MyPassword123!'
      const wrongPassword = 'WrongPassword123!'
      const hashed = await authService.hashPassword(password)
      
      expect(await authService.comparePassword(wrongPassword, hashed)).toBe(false)
    }})
  }})

  describe('generateToken', () => {{
    it('deve gerar JWT válido', () => {{
      const token = authService.generateToken({{ id: '123', email: 'test@test.com' }})
      const decoded = authService.verifyToken(token)
      
      expect(decoded.id).toBe('123')
      expect(decoded.email).toBe('test@test.com')
    }})

    it('deve rejeitar token inválido', () => {{
      expect(() => {{
        authService.verifyToken('invalid-token')
      }}).toThrow()
    }})
  }})
}})
```

---

## 📦 DEPENDÊNCIAS PRINCIPAIS

### Frontend (package.json)
```json
{{
  "dependencies": {{
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "axios": "^1.3.0",
    "zustand": "^4.3.0",
    "tailwindcss": "^3.3.0"
  }},
  "devDependencies": {{
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vitest": "^0.34.0"
  }}
}}
```

### Backend (package.json)
```json
{{
  "dependencies": {{
    "express": "^4.18.0",
    "pg": "^8.9.0",
    "helmet": "^7.0.0",
    "cors": "^2.8.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "dotenv": "^16.0.3",
    "bull": "^4.10.0",
    "redis": "^4.6.0",
    "joi": "^17.9.0",
    "winston": "^3.8.0"
  }},
  "devDependencies": {{
    "jest": "^29.5.0",
    "nodemon": "^2.0.20",
    "supertest": "^6.3.0"
  }}
}}
```

---

## 🔒 Implementação de Segurança

### Validação de Input (Middleware)
```javascript
import Joi from 'joi'

export const validate{primary_entity}Create = (req, res, next) => {{
  const schema = Joi.object({{
    title: Joi.string().max(255).required(),
    description: Joi.string().max(5000),
    priority: Joi.string().valid('low', 'medium', 'high'),
    due_date: Joi.date().iso(),
    tags: Joi.array().items(Joi.string()).max(10)
  }})

  const {{ error, value }} = schema.validate(req.body)
  
  if (error) {{
    return res.status(400).json({{ error: error.details[0].message }})
  }}

  req.validatedBody = value
  next()
}}
```

### Rate Limiting
```javascript
import rateLimit from 'express-rate-limit'

const loginLimiter = rateLimit({{
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 tentativas
  message: 'Muitas tentativas de login, tente novamente mais tarde',
  standardHeaders: true,
  legacyHeaders: false
}})

app.post('/api/v1/auth/login', loginLimiter, authController.login)
```

---

## 📝 COMO EXECUTAR

### Setup Inicial
```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run migrations
npm start

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
```

### Testes
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

---

*Estrutura gerada automaticamente pela IA Software Factory*
*Entities detectadas: {entity_list}*
"""
        return code

    def process(self, idea, architecture):
        """Processa e retorna estrutura de código funcional"""
        code = self.generate_code_structure(idea, architecture)
        entities = self.extract_domain_entities(idea)
        primary_entity = entities[0] if entities else 'Item'
        return {'code': code, 'primary_entity': primary_entity}
