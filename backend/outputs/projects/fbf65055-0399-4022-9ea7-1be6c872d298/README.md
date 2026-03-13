# Fbf65055 0399 4022 9Ea7 1Be6C872D298

## Descrição
Um sistema de gerenciamento de tarefas (TODO app) com:
- Criar, editar e deletar tarefas
- Categorias e prioridades
- Histórico de tarefas concluídas
- Dashboard com estatísticas

## Como Rodar

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Backend
```bash
cd backend
npm install
npm run dev
```

O backend rodará em: http://localhost:3001

### Frontend
```bash
cd frontend
npm install
npm run dev
```

O frontend rodará em: http://localhost:5173

## Endpoints da API

- **GET** `/api/health` - Verificar status do servidor
- **GET** `/api/info` - Informações do projeto

## Estrutura de Pastas

```
projeto/
├── frontend/          # Aplicação React
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
├── backend/           # Servidor Node.js
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   └── models/
│   └── package.json
└── docs/              # Documentação
```

## Stack Tecnológico

- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: Node.js + Express
- **HTTP Client**: Axios

## Próximas Passos

1. Instalar dependências: `npm install`
2. Configurar variáveis de ambiente
3. Implementar rotas adicionais
4. Adicionar banco de dados
5. Testes automatizados

---

Gerado por [AI Software Factory](https://github.com/seu-usuario/ai-software-factory)
