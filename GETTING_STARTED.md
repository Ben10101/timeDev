# 🚀 Como Rodar Seu Projeto Gerado

## O que você recebeu

Seu projeto foi gerado com:
- ✅ **Frontend React** completo com Vite
- ✅ **Backend Node.js/Express** funcional  
- ✅ **Documentação** (Backlog, Requisitos, Arquitetura)
- ✅ **Estrutura pronta** para começar o desenvolvimento

---

## Pré-Requisitos

Você precisa ter instalado:
- **Node.js 18+** ([download](https://nodejs.org))
- **npm** (vem com Node.js)
- **Git** (opcional, mas recomendado)

Verifique a instalação:
```bash
node --version
npm --version
```

---

## 📁 Estrutura do Projeto

```
seu-projeto/
├── frontend/           # 💻 Aplicação React
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/            # 🔧 Servidor Node.js
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/
│   │   ├── controllers/
│   │   └── models/
│   ├── package.json
│   └── .env.example
└── docs/               # 📚 Documentação
    ├── BACKLOG.md
    ├── REQUIREMENTS.md
    └── ARCHITECTURE.md
```

---

## 🎯 Começando

### 1️⃣ Preparar o Ambiente

Abre 2 terminais (um para cada parte):

**Terminal 1 - Backend:**
```bash
cd seu-projeto/backend
npm install
npm run dev
```

Você verá:
```
🚀 Servidor rodando em http://localhost:3001
📡 Health check: http://localhost:3001/api/health
```

**Terminal 2 - Frontend:**
```bash
cd seu-projeto/frontend
npm install
npm run dev
```

Você verá:
```
  VITE v5.0.0  ready in 500 ms

  ➜  Local:   http://localhost:5173/
```

### 2️⃣ Testar

Abre [http://localhost:5173](http://localhost:5173) no navegador.

Você verá um botão **"Testar Backend"** - clique nele para verificar se tudo está conectado!

---

## 📝 Próximas Etapas de Desenvolvimento

### Backend (Node.js)

1. **Adicione rotas** em `backend/src/routes/`
```javascript
// backend/src/routes/index.js
router.get('/api/items', (req, res) => {
  res.json({ items: [] })
})
```

2. **Crie controllers** em `backend/src/controllers/`
3. **Implemente modelos** em `backend/src/models/`
4. **Conecte a um banco de dados** (PostgreSQL recomendado)

### Frontend (React)

1. **Crie componentes** em `frontend/src/components/`
```jsx
// frontend/src/components/ItemList.jsx
export default function ItemList() {
  return <div>Meus itens</div>
}
```

2. **Adicione páginas** em `frontend/src/pages/`
3. **Implemente serviços HTTP** em `frontend/src/services/`
4. **Configure roteamento** com React Router

---

## 🔌 Conectando Frontend com Backend

Exemplo usando Axios:

```javascript
// frontend/src/services/api.js
import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:3001/api'
})

// Usar em componentes
const response = await api.get('/items')
```

---

## 📦 Build para Produção

### Frontend
```bash
cd frontend
npm run build
# Gera arquivo em frontend/dist/
```

### Backend
```bash
cd backend
npm start
# Roda na porta 3001
```

---

## 🐛 Troubleshooting

### Porta 3001 já está em uso
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3001
kill -9 <PID>
```

### npm install com erro
```bash
rm -rf node_modules package-lock.json
npm install
```

### Frontend não conecta com backend
- Verifique se backend está rodando em http://localhost:3001
- Verifique CORS em `backend/src/server.js`
- Abra Developer Tools (F12) para ver mensagens de erro

---

## 📚 Documentação Incluída

Leia para entender melhor o projeto:
- `docs/BACKLOG.md` - Histórias de usuário
- `docs/REQUIREMENTS.md` - Requisitos funcionais
- `docs/ARCHITECTURE.md` - Design técnico

---

## 🚀 Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | React | 18.2 |
| Build | Vite | 5.0 |
| Styling | TailwindCSS | 3.3 |
| HTTP | Axios | 1.6 |
| Backend | Node.js | 18+ |
| Framework | Express | 4.18 |
| Runtime | npm | latest |

---

## 💡 Dicas

1. **Commit regularmente** no Git
2. **Use variáveis de ambiente** (arquivo `.env`)
3. **Escreva testes** para suas features
4. **Documente seu código** enquanto desenvolve
5. **Use branches** para novas features

---

## 📞 Suporte

Se tiver dúvidas:
1. Leia a documentação em `docs/`
2. Verifique os logs do terminal
3. Abra as DevTools do navegador (F12)
4. Procure por mensagens de erro específicas

---

**Boa sorte com seu projeto! 🎉**

