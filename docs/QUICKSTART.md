# 🚀 QUICK START - AI Software Factory

## ⚡ Comece em 5 minutos!

### Pré-requisitos (verificar primeiro)
```bash
node --version      # Deve ser v18+
npm --version       # Deve ser v9+
python --version    # Deve ser v3.8+
```

### 1️⃣ Instalar Dependências (2 min)

```bash
# Frontend
cd frontend && npm install && cd ..

# Backend
cd backend && npm install && cd ..

# Python (opcional, se quiser executar agentes direto)
pip install -r requirements.txt
```

### 2️⃣ Iniciar Serviços (1 min cada)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Deve exibir: 🚀 Backend rodando em http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Deve exibir: ➜  Local:   http://localhost:5173/
```

### 3️⃣ Acessar a Aplicação (no navegador)
```
http://localhost:5173
```

### 4️⃣ Usar a Aplicação
1. Digite a ideia do projeto no formulário
2. Clique em "Gerar Projeto"
3. Aguarde 10-30 segundos
4. Veja os resultados nas abas

---

## 📁 Estrutura Básica

```
ai-software-factory/
├── frontend/          → React UI
├── backend/           → Node.js Server
├── agents/            → Python Agents
├── orchestrator/      → Python Orchestrator
├── prompts/           → Agent Instructions
├── outputs/           → Generated Files
└── docs/              → Documentation
```

---

## 🎯 Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check |
| POST | `/api/generate-project` | Gerar novo projeto |

---

## 📝 Exemplo de Requisição

```bash
curl -X POST http://localhost:3001/api/generate-project \
  -H "Content-Type: application/json" \
  -d '{"idea":"Uma plataforma de e-commerce"}'
```

---

## 🐛 Problemas Comuns

| Problema | Solução |
|----------|---------|
| Port 3001 em uso | `PORT=3002 npm run dev` no backend |
| Port 5173 em uso | Vite usa próxima porta automaticamente |
| "python: not found" | Use `python3` ao invés de `python` |
| "npm: not found" | Reinstale Node.js |

---

## 📚 Próximas Leituras

- [📖 README Completo](../README.md)
- [🏗️ Arquitetura Técnica](ARCHITECTURE.md)
- [📋 API Documentation](API.md)
- [💻 Exemplos de Uso](EXAMPLES.md)

---

## 🎓 Entender o Fluxo

```
User writes idea in Frontend
    ↓
Frontend sends POST to Backend
    ↓
Backend calls Python Orchestrator
    ↓
5 Python Agents process the idea
    ↓
Backend receives artifacts from Orchestrator
    ↓
Backend returns JSON to Frontend
    ↓
Frontend displays results in tabs
```

---

## ✅ Checklist

- [ ] Node.js v18+ instalado
- [ ] Python 3.8+ instalado
- [ ] Dependências instaladas (npm install)
- [ ] Backend rodando (port 3001)
- [ ] Frontend rodando (port 5173)
- [ ] Navegador aberto em localhost:5173
- [ ] Descrição digitada e projeto gerado

---

## 💡 Dicas

1. **Descrição detalhada**: Quanto mais específico, melhor o resultado
2. **Primeiro teste**: Tente "Um TODO app simples" para teste rápido
3. **Ver output**: Verifique a pasta `outputs/projects/` para arquivos salvos
4. **Debug**: Abra DevTools (F12) para ver requisições e erros
5. **Logs**: Verifique terminal do backend para logs de execução

---

## 🔗 Links Úteis

- [React Documentation](https://react.dev)
- [Express Documentation](https://expressjs.com)
- [Vite Documentation](https://vitejs.dev)
- [TailwindCSS Documentation](https://tailwindcss.com)

---

## 🆘 Suporte Rápido

### Frontend não carrega
```bash
# Limpar cache e reinstalar
rm -rf frontend/node_modules package-lock.json
npm install
npm run dev
```

### Backend não fica online
```bash
# Verificar porta
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Tentar porta diferente
PORT=3002 npm run dev
```

### Agentes não rodando
```bash
# Verificar Python
python --version

# Instalar dependências Python
pip install -r requirements.txt

# Testar diretamente
python scripts/run_factory.py
```

---

## 🎉 Parabéns!

Você tem o **AI Software Factory** rodando localmente!

Próximos passos:
1. Explore a documentação
2. Crie projetos de teste
3. Customize os agentes
4. Integre com LLMs (OpenAI, Claude, etc)

---

**Versão**: 1.0.0  
**Data**: Janeiro 2024  
**Status**: ✅ MVP Pronto
