# 📂 Acessando Seus Projetos Gerados

## 📍 Onde Ficam os Arquivos

Todos os projetos gerados ficam em:
```
c:\Users\bleao\ai-software-factory\outputs\generated_projects\[project-id]
```

## 🎯 Como Encontrar Seu Projeto

### Opção 1: Pelo Terminal
```bash
# Windows PowerShell
cd c:\Users\bleao\ai-software-factory\outputs\projects

# Listar todos os projetos
dir

# Entrar em um projeto
cd seu-projeto-[id]
```

### Opção 2: Pelo Explorer (Windows)
1. Abra: `C:\Users\bleao\ai-software-factory\outputs\projects`
2. Procure pela pasta com o ID do seu projeto
3. Veja os arquivos:
   - `frontend/` - App React
   - `backend/` - Servidor Express
   - `docs/` - Documentação completa

### Opção 3: Copiar o Caminho
Ao gerar um projeto, anote o **Project ID** mostrado na página.

## 🚀 Como Rodar Seu Projeto

### Estrutura de Pastas
```
seu-projeto-abc123/
├── frontend/
│   ├── src/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   └── server.js
│   └── package.json
└── docs/
    ├── BACKLOG.md
    ├── REQUIREMENTS.md
    └── ARCHITECTURE.md
```

### Passo 1: Instalar Dependências

**Backend (Terminal 1):**
```bash
cd outputs\projects\seu-projeto-abc123\backend
npm install
npm start
```

**Frontend (Terminal 2):**
```bash
cd outputs\generated_projects\seu-projeto-abc123\frontend
npm install
npm run dev
```

## ✅ Verificar se Está OK

### Backend Rodando?
- [ ] Terminal mostra: `🚀 Servidor rodando em http://localhost:3001`
- [ ] Abra http://localhost:3001/api/health
- [ ] Retorna: `{ "status": "OK" }`

### Frontend Rodando?
- [ ] Terminal mostra: `➜ Local: http://localhost:5173`
- [ ] Abre automaticamente ou acesse manualmente

### Conectados?
- [ ] No frontend, clique em "Testar Backend"
- [ ] Mensagem de sucesso aparece

## 📁 Estrutura de Arquivos Gerados

### Frontend
```
frontend/
├── src/
│   ├── App.jsx              Componente principal
│   ├── main.jsx             Entry point
│   └── index.css            Estilos TailwindCSS
├── index.html               HTML base
├── package.json             Dependências
├── vite.config.js           Config Vite
├── .gitignore
└── node_modules/            (após npm install)
```

### Backend
```
backend/
├── src/
│   ├── server.js            Express app
│   ├── routes/              Rotas da API
│   ├── controllers/         Controllers
│   ├── middleware/          Middleware
│   └── utils/               Utilitários
├── package.json             Dependências
├── .env.example             Variáveis de ambiente
├── .gitignore
└── node_modules/            (após npm install)
```

### Documentação
```
docs/
├── BACKLOG.md               Histórias de usuário
├── REQUIREMENTS.md          Requisitos detalhados
└── ARCHITECTURE.md          Design da arquitetura
```

## 💡 Próximas Etapas

1. **Explore o código** - Leia os arquivos gerados
2. **Edite conforme precisar** - Adicione suas features
3. **Execute testes** - Rode `npm test` (quando adicionar)
4. **Adicione banco de dados** - Configure PostgreSQL ou outro
5. **Deploy** - Coloque em produção

## 🔄 Regenerar o Projeto

Se quiser gerar novamente com a mesma ideia:

1. Volte para http://localhost:5173
2. Cole a mesma descrição novamente
3. Clique em "Gerar Projeto"
4. Um **novo** projeto será criado com ID diferente
5. Você terá 2 projetos em `outputs/generated_projects/`

## 🗑️ Deletar um Projeto

Se quiser apagar um projeto que não precisa mais:

```bash
# Windows PowerShell
rmdir -r "outputs\generated_projects\seu-projeto-abc123"

# Command Prompt
rmdir /s outputs\generated_projects\seu-projeto-abc123
```

## 🐛 Troubleshooting

### Erro: "Cannot find module"
```bash
# Na pasta do projeto
rm -rf node_modules
npm install
```

### Porta já em uso
```bash
# Encontrar processo na porta
netstat -ano | findstr :3001

# Matar processo
taskkill /PID [PID] /F
```

### Arquivo não encontrado
- Verifique o caminho completo
- Use `cd` corretamente
- Confira o Project ID

---

## 📊 Resumo Rápido

| O Que | Onde |
|-------|------|
| Projetos gerados | `outputs/generated_projects/` |
| Application ID | Mostrado na página após geração |
| Frontend | `project-id/frontend/` |
| Backend | `project-id/backend/` |
| Documentação | `project-id/docs/` |
| Frontend URL | http://localhost:5173 |
| Backend URL | http://localhost:3001 |
| Health Check | http://localhost:3001/api/health |

---

**Pronto! Você sabe onde estão seus projetos!** 🎉
