# API Documentation - AI Software Factory

## 📘 Base URL

```
http://localhost:3001/api
```

Em produção, substitua pelo seu domínio.

---

## 🔌 Endpoints

### 1. Health Check

Verifica se o servidor está funcionando.

```http
GET /health
```

**Response (200):**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T10:00:00Z"
}
```

---

### 2. Gerar Novo Projeto

Inicia o pipeline de geração de artefatos.

```http
POST /api/generate-project
Content-Type: application/json
```

**Request Body:**
```json
{
  "idea": "Descrição do projeto..."
}
```

**Response (200):**
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-01T10:00:00Z",
  "backlog": "# Backlog do Projeto\n...",
  "requirements": "# Requisitos\n...",
  "architecture": "# Arquitetura\n...",
  "code": "# Estrutura de Código\n...",
  "tests": "# Plano de Testes\n..."
}
```

**Response (400 - Bad Request):**
```json
{
  "message": "Ideia do projeto é obrigatória"
}
```

**Response (500 - Server Error):**
```json
{
  "message": "Erro ao gerar projeto",
  "error": "Mensagem detalhada do erro"
}
```

---

## 🔄 Fluxo de Requisição

### 1. Fazer Requisição
```javascript
const response = await fetch('http://localhost:3001/api/generate-project', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    idea: 'Uma plataforma de e-commerce com carrinho de compras'
  })
})
```

### 2. Processar Resposta
```javascript
const data = await response.json()
console.log(data.projectId)    // ID do projeto
console.log(data.backlog)      // Backlog gerado
console.log(data.requirements) // Requisitos gerados
console.log(data.architecture) // Arquitetura definida
console.log(data.code)         // Estrutura de código
console.log(data.tests)        // Plano de testes
```

---

## 📊 Formatos de Resposta

### Artefato: Backlog
```markdown
# Backlog do Projeto
Projeto ID: xxx

## Épicos
- Epic 1: Funcionalidades Principais
- Epic 2: Interface de Usuário
- Epic 3: Integração e Deploy

## Histórias de Usuários
### US001: Autenticação
### US002: Dashboard
...

## Tarefas Técnicas
- [ ] Setup do ambiente
- [ ] Configurar banco de dados
...

## Timeline
- Sprint 1: ...
- Sprint 2: ...
```

### Artefato: Requisitos
```markdown
# Requisitos do Projeto

## Requisitos Funcionais
### RF001: Autenticação
- Sistemas deve permitir login
- Critério de Aceite: ...

## Requisitos Não-Funcionais
### RNF001: Performance
- Página deve carregar em < 3s
- API deve responder em < 500ms

## Casos de Uso
### UC001: Fazer Login
1. Usuário acessa página
2. Insere credenciais
3. ...
```

### Artefato: Arquitetura
```markdown
# Arquitetura do Projeto

## Visão Geral
Arquitetura de três camadas:
- Frontend: React + Vite
- Backend: Node.js + Express
- Banco: PostgreSQL

## Stack Tecnológico
### Frontend
- React 18.2
- Vite 5.0
- TailwindCSS 3.3
...

## Estrutura de Diretórios
```
ai-software-factory/
├── frontend/
├── backend/
├── agents/
...
```

## Fluxo de Dados
User → Frontend → Backend → Agentes → Database
```

### Artefato: Código
```markdown
# Estrutura de Código

## Arquivos Gerados

### Frontend - package.json
```json
{
  "name": "projeto",
  "version": "1.0.0",
  ...
}
```

### Backend - server.js
```javascript
import express from 'express'
const app = express()
...
```

## Modelos de Dados
### User
- id (UUID)
- email (String)
- password (String)
...
```

### Artefato: Testes
```markdown
# Plano de Testes

## Estratégia de Testes
- Unit Tests: 80%+
- Integration Tests: 60%+
- E2E Tests: 40%+

## Testes Unitários
```javascript
describe('Button Component', () => {
  test('renders button', () => {
    // ...
  })
})
```

## Cenários de Teste
- [ ] Login com credenciais válidas
- [ ] Criar novo registro
- [ ] Validação de campos
...
```

---

## 🔐 Autenticação (Futuro)

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

---

## ⚠️ Códigos de Erro

| Código | Significado | Solução |
|--------|-------------|---------|
| 200 | OK | Sucesso |
| 400 | Bad Request | Verifique os parâmetros |
| 401 | Unauthorized | Faça login novamente |
| 403 | Forbidden | Sem permissão |
| 404 | Not Found | Recurso não existe |
| 500 | Server Error | Erro no servidor |
| 503 | Service Unavailable | Servidor offline |

---

## 🔗 Limites de Taxa (Future Implementation)

```
Rate Limiting: 100 requisições por minuto
Por IP: 1000 requisições por hora
```

---

## 📝 Exemplos de Uso

### JavaScript/Fetch

```javascript
// Gerar projeto
async function generateProject(idea) {
  const response = await fetch('http://localhost:3001/api/generate-project', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ idea })
  })
  
  if (!response.ok) {
    throw new Error(`Erro ${response.status}`)
  }
  
  return await response.json()
}

// Usar
const result = await generateProject('Meu novo projeto')
console.log(result.projectId)
```

### Python/Requests

```python
import requests

url = 'http://localhost:3001/api/generate-project'
data = {'idea': 'Meu novo projeto'}

response = requests.post(url, json=data)
result = response.json()

print(result['projectId'])
print(result['backlog'])
```

### cURL

```bash
curl -X POST http://localhost:3001/api/generate-project \
  -H "Content-Type: application/json" \
  -d '{"idea":"Meu novo projeto"}'
```

---

## 📚 Recursos Adicionais

- [Frontend API Service](../frontend/src/services/api.js)
- [Backend Controller](../backend/src/controllers/projectController.js)
- [Documentação de Arquitetura](ARCHITECTURE.md)

---

**Última atualização**: Janeiro 2024  
**Versão da API**: 1.0.0
