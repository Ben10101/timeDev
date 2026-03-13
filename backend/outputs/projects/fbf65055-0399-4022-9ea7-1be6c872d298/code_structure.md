
# CÓDIGO E ESTRUTURA DO PROJETO
Projeto ID: fbf65055-0399-4022-9ea7-1be6c872d298

## ESTRUTURA DE ARQUIVOS GERADA

### Frontend - package.json
```json
{
  "name": "projeto-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.0.0",
    "axios": "^1.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^3.0.0"
  }
}
```

### Backend - server.js
```javascript
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

### Frontend - App.jsx
```jsx
import React from 'react'
import Router from './Router'

function App() {
  return <Router />
}

export default App
```

### Backend - userController.js
```javascript
export const getUsers = async (req, res) => {
  // Implementar lógica
}

export const createUser = async (req, res) => {
  // Implementar lógica
}

export const updateUser = async (req, res) => {
  // Implementar lógica
}

export const deleteUser = async (req, res) => {
  // Implementar lógica
}
```

## MODELOS DE DADOS

### User
```
- id (UUID)
- email (String, Unique)
- password (String, Hashed)
- name (String)
- role (Enum: admin, user)
- createdAt (Timestamp)
- updatedAt (Timestamp)
```

### Project
```
- id (UUID)
- title (String)
- description (Text)
- userId (FK)
- status (Enum: draft, active, archived)
- artifacts (JSON)
- createdAt (Timestamp)
- updatedAt (Timestamp)
```

## ENDPOINTS DA API

### Autenticação
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh

### Usuários
- GET /api/users
- GET /api/users/:id
- POST /api/users
- PUT /api/users/:id
- DELETE /api/users/:id

### Projetos
- GET /api/projects
- GET /api/projects/:id
- POST /api/projects (gerar novo)
- PUT /api/projects/:id
- DELETE /api/projects/:id

## MIDDLEWARE

```javascript
// authMiddleware.js
export const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// errorHandler.js
export const errorHandler = (err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
```

## CONFIGURAÇÕES

### .env
```
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
JWT_SECRET=your-secret-key
PORT=3001
NODE_ENV=development
```

### Docker Compose
```yaml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://...
  db:
    image: postgres:14
    environment:
      - POSTGRES_PASSWORD=postgres
    ports:
      - "5432:5432"
```

## PRÓXIMOS PASSOS

1. Instalar dependências: npm install
2. Configurar variáveis de ambiente
3. Setup do banco de dados
4. Implementar autenticação
5. Desenvolver componentes React
6. Implementar serviços backend
7. Testes unitários
8. Testes de integração
9. Deploy em staging
10. Feedback dos usuários
