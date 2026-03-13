# Guia de Instalação - AI Software Factory

## 📋 Pré-requisitos

### Sistema Operacional
- Windows 10+ / macOS 10.14+ / Linux (Ubuntu 18.04+)

### Software Necessário
1. **Node.js 18.x LTS ou superior**
   - Download: https://nodejs.org/
   - Verificação: `node --version`

2. **npm 9.x ou superior**
   - Geralmente incluído com Node.js
   - Verificação: `npm --version`

3. **Python 3.8 ou superior**
   - Download: https://www.python.org/
   - Verificação: `python --version`

4. **Git (opcional, mas recomendado)**
   - Download: https://git-scm.com/

## 🛠️ Instalação Passo a Passo

### Passo 1: Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/ai-software-factory.git
cd ai-software-factory
```

Ou baixe como ZIP e extraia a pasta.

### Passo 2: Instalar Dependências do Frontend

```bash
cd frontend
npm install
cd ..
```

### Passo 3: Instalar Dependências do Backend

```bash
cd backend
npm install
cd ..
```

### Passo 4: Instalar Dependências do Python

```bash
# Windows
pip install -r requirements.txt

# macOS/Linux
pip3 install -r requirements.txt
```

### Passo 5: Criar Variáveis de Ambiente

#### Frontend (.env.local)
```bash
cd frontend
touch .env.local
echo "VITE_API_URL=http://localhost:3001/api" > .env.local
cd ..
```

#### Backend (.env)
```bash
cd backend
touch .env
echo "NODE_ENV=development" > .env
echo "PORT=3001" >> .env
cd ..
```

## 🚀 Executar a Aplicação

### Opção 1: Terminais Separados (Recomendado)

#### Terminal 1: Backend Node.js
```bash
cd backend
npm run dev
```
Você deve ver:
```
🚀 Backend rodando em http://localhost:3001
```

#### Terminal 2: Frontend React
```bash
cd frontend
npm run dev
```
Você deve ver:
```
  VITE v5.0.0 ready in 123 ms
  ➜  Local:   http://localhost:5173/
```

### Opção 2: Com Docker Compose

```bash
docker-compose up
```

Acesse:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- PostgreSQL: localhost:5432

### Opção 3: Scripts Python

Para testar apenas os agentes:

```bash
python scripts/run_factory.py
```

## ✅ Verificação de Instalação

### 1. Verificar Frontend
```bash
# Deve abrir a página em http://localhost:5173
curl http://localhost:5173
```

### 2. Verificar Backend
```bash
# Deve retornar {"status":"OK"}
curl http://localhost:3001/health
```

### 3. Verificar Agentes Python
```bash
python -c "from agents.project_manager.agent import ProjectManager; print('✅ PM OK')"
python -c "from agents.requirements_analyst.agent import RequirementsAnalyst; print('✅ RA OK')"
python -c "from agents.architect.agent import Architect; print('✅ Architect OK')"
python -c "from agents.developer.agent import Developer; print('✅ Developer OK')"
python -c "from agents.qa_engineer.agent import QAEngineer; print('✅ QA OK')"
```

## 🐛 Troubleshooting

### Problema: "npm: command not found"
**Solução:**
- Instale Node.js novamente
- Reinicie o terminal
- Adicione Node.js ao PATH do sistema

### Problema: "python: command not found"
**Solução:**
- Open cmd e tente `python3` ao invés de `python`
- Ou adicione Python ao PATH

### Problema: "Port 3001 already in use"
**Solução:**
```bash
# Mude a porta no backend .env
PORT=3002

# Ou mate o processo que está usando a porta
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3001 | xargs kill -9
```

### Problema: "Port 5173 already in use"
**Solução:**
- Vite usará a próxima porta disponível automaticamente
- Ou mude manualmente na config do Vite

### Problema: "ModuleNotFoundError: No module named 'agents'"
**Solução:**
```bash
# Execute os scripts do diretório raiz
cd /caminho/para/ai-software-factory
python scripts/run_factory.py
```

### Problema: CORS Error
**Solução:**
- Certifique-se de que o backend está rodando em http://localhost:3001
- Verifique se o CORS está habilitado no backend
- Verifique a URL da API no frontend

## 📦 Instalação em Produção

### 1. Variáveis de Ambiente (Produção)

Backend (.env):
```
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/db
JWT_SECRET=seu-secret-aqui
```

Frontend (.env.production):
```
VITE_API_URL=https://seu-dominio.com/api
```

### 2. Build do Frontend

```bash
cd frontend
npm run build
# Gera pasta dist/ pronta para deploy
```

### 3. Deploy

#### AWS
```bash
npm install -g aws-cli
aws s3 sync frontend/dist s3://seu-bucket
```

#### Azure
```bash
npm install -g @azure/static-web-apps-cli
swa deploy
```

#### Heroku
```bash
npm install -g heroku
heroku create seu-app
git push heroku main
```

## 🔧 Configuração Avançada

### Custom Port (Frontend)
```bash
# Editar frontend/vite.config.js
export default defineConfig({
  server: {
    port: 3000  // Mude aqui
  }
})
```

### Custom Port (Backend)
```bash
# Editar backend/.env
PORT=4000
```

### PostgreSQL Connection
```bash
# Editar backend/src/database.js
DATABASE_URL=postgresql://user:password@localhost:5432/database
```

## 📚 Próximos Passos

1. Leia a [documentação arquitetura](ARCHITECTURE.md)
2. Explore o [guia de API](API.md)
3. Verifique o [guia de contribuição](CONTRIBUTING.md)

---

**Versão**: 1.0.0  
**Data de atualização**: Janeiro 2024
