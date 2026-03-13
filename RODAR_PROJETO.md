# 🚀 Como Rodar Seu Projeto Gerado

## 📋 Requisitos
- Node.js 18+
- npm ou yarn

## 🔧 Setup Rápido (5 minutos)

### 1️⃣ Instalar Dependências

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd ../frontend
npm install
```

### 2️⃣ Configurar Variáveis de Ambiente

**Backend (.env):**
```bash
cd backend
cp .env.example .env
```

### 3️⃣ Rodar em Desenvolvimento

Abra **2 terminais**:

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```
Vai rodar em: http://localhost:3001

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Vai rodar em: http://localhost:5173

---

## 👤 Teste Agora

### Criar Conta
1. Acesse http://localhost:5173
2. Clique em "Registre-se"
3. Preencha:
   - Nome: `João Silva`
   - Email: `joao@example.com`
   - Senha: `Senha123!`
4. Clique em "Registrar"

### Usar o Sistema
1. Você será redirecionado para o dashboard
2. Crie uma nova tarefa:
   - Título: `Aprender React`
   - Descrição: `Estudar hooks e components`
   - Prioridade: `Alta`
3. Clique em "Criar Tarefa"

### Gerenciar Tarefas
- ✅ **Completar**: Clique no botão "Completar"
- ✏️ **Editar**: (Feature em desenvolvimento)
- 🗑️ **Deletar**: Clique em "Deletar"

---

## 📚 API Backend

### Autenticação
```bash
# Registrar
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Senha123!",
  "name": "User Name"
}

# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "Senha123!"
}

# Response
{
  "user": { "id": "abc123", "email": "user@example.com", "name": "User Name" },
  "token": "eyJhbGc..."
}
```

### Tarefas (Autenticado)
```bash
# Listar tarefas
GET /api/tasks
Authorization: Bearer <token>

# Criar tarefa
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Minha Tarefa",
  "description": "Descrição opcional",
  "priority": "high"
}

# Atualizar tarefa
PUT /api/tasks/<id>
{
  "title": "Novo título",
  "status": "completed",
  "priority": "medium"
}

# Deletar tarefa
DELETE /api/tasks/<id>
```

---

## 🗄️ Banco de Dados

O projeto usa **SQLite** (arquivo `data.db`).

### Tabelas Criadas
1. **users** - Autenticação e perfil
2. **tasks** - Tarefas

### Resetar Banco
```bash
rm backend/data.db
npm start  # vai recriar
```

---

## 🐛 Troubleshooting

### Erro: "EADDRINUSE" (porta 3001 já em uso)
```bash
# Mudar variável de ambiente
PORT=3002 npm start
```

### Erro: "Cannot find module"
```bash
# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

### CORS Error no Frontend
- Certifique-se que backend está rodando em http://localhost:3001
- Verifique se `API_URL` está correto nos componentes

---

## 📝 Próximos Passos

- [ ] Adicionar edição de tarefas
- [ ] Adicionar filtros (por status, prioridade)
- [ ] Adicionar busca
- [ ] Adicionar paginação
- [ ] Adicionar comentários em tarefas
- [ ] Adicionar autenticação com Google/GitHub
- [ ] Deploy em produção

---

## 🚢 Deploy

### Heroku / Vercel

**Backend:**
```bash
npm install -g heroku
heroku create seu-app-backend
git push heroku main
```

**Frontend (.vercel.json):**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

---

## 📞 Suporte

Dúvidas? Confira:
- [Express Docs](https://expressjs.com)
- [React Docs](https://react.dev)
- [SQLite Docs](https://www.sqlite.org/docs.html)

**Aproveite seu projeto! 🎉**
