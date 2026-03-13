# 🎯 Guia Passo a Passo para Gerar Seu Primeiro Projeto

## ✅ Pré-Requisito

Verifique se o backend está rodando:
```
🚀 Servidor rodando em http://localhost:3001
```

E o frontend:
```
➜  Local: http://localhost:5173
```

## 📋 Passo 1: Abra a Aplicação

1. Abra o navegador
2. Acesse: **http://localhost:5173**

Você verá uma página com:
- Titulo: "AI Software Factory"
- Um grande campo de texto
- Um botão "Gerar Projeto"

## ✍️ Passo 2: Descreva Sua Ideia

No campo de texto, escreva uma ideia de projeto. 

**Exemplos:**

### Exemplo 1 (Simples):
```
Sistema para gerenciar tarefas.
Deve ter:
- Criar novas tarefas
- Marcar como completa
- Deletar tarefas
- Listar todas as tarefas
```

### Exemplo 2 (Intermediário):
```
App de catálogo de produtos com:
- Listar produtos com imagens
- Buscar por nome
- Filtrar por categoria
- Adicionar ao carrinho
- Remover do carrinho
```

### Exemplo 3 (Mais Completo):
```
Sistema de controle de clientes para loja.
Inclui:
- Cadastro de clientes
- Histórico de compras
- Dashboard com gráficos de vendas
- Relatório de faturamento
- Sistema de backup
```

## 🚀 Passo 3: Gere o Projeto

1. Digite uma descrição na caixa de texto
2. **Clique no botão "Gerar Projeto"**

Você verá uma tela de carregamento mostrando:
- 💡 Processando Ideia
- 📋 Gerando Backlog
- ✅ Analisando Requisitos
- 🏗️ Definindo Arquitetura
- 💻 Gerando Código
- 🧪 Criando Testes

Aguarde **30 a 60 segundos**.

## 📊 Passo 4: Veja os Resultados

Após terminar, você verá:

**Uma página com:**
- ✨ Título: "Projeto Gerado com Sucesso!"
- 📌 ID do projeto (ex: `a1b2c3d4-e5f6-g7h8`)
- 📈 Cards com estatísticas:
  - Backlog: 2000+ caracteres
  - Requisitos: 1500+ caracteres
  - Arquitetura: 2000+ caracteres
  - Código: 1500+ caracteres
  - Testes: 1500+ caracteres

**5 abas:**
1. **Backlog** - Seu projeto estruturado
2. **Requisitos** - Detalhes técnicos
3. **Arquitetura** - Design do sistema
4. **Código** - Estrutura inicial
5. **Testes** - Plano de testes

## 📂 Passo 5: Encontre Seus Arquivos

Seus arquivos foram criados em:
### Windows (Copie e Cole no Explorador):
```
C:\Users\bleao\ai-software-factory\outputs\projects\seu-projeto-[id]
```

### ou use o Terminal:
```bash
cd c:\Users\bleao\ai-software-factory\outputs\projects
dir
```

Você verá uma pasta com nome como:
```
seu-projeto-abc123def456
```

## 📁 Estrutura do Projeto Gerado

```
seu-projeto-[id]/
├── 📂 frontend/
│   ├── 📂 src/
│   │   ├── App.jsx           (Componente React)
│   │   ├── main.jsx          (Entry point)
│   │   └── index.css         (Estilos)
│   ├── 📄 index.html         (Página HTML)
│   ├── 📄 package.json       (Dependências)
│   ├── 📄 vite.config.js     (Configuração)
│   └── .gitignore
│
├── 📂 backend/
│   ├── 📂 src/
│   │   ├── server.js         (Express server)
│   │   ├── 📂 routes/        (API routes)
│   │   └── 📂 controllers/   (Lógica)
│   ├── 📄 package.json       (Dependências)
│   └── 📄 .env.example       (Variáveis)
│
└── 📂 docs/
    ├── BACKLOG.md            (Sua documentação)
    ├── REQUIREMENTS.md
    └── ARCHITECTURE.md
```

## 🎯 Passo 6: Rode o Projeto

Abra **2 terminais** (CMD ou PowerShell):

### Terminal 1 - Backend:
```bash
cd c:\Users\bleao\ai-software-factory\outputs\projects\seu-projeto-[id]\backend
npm install
npm start
```

Você verá:
```
🚀 Servidor rodando em http://localhost:3001
```

### Terminal 2 - Frontend:
```bash
cd c:\Users\bleao\ai-software-factory\outputs\projects\seu-projeto-[id]\frontend
npm install
npm run dev
```

Você verá:
```
➜  Local:   http://localhost:5173/
```

## ✅ Seu Projeto Está Rodando!

Pronto! Agora você tem:
- ✅ React app rodando em http://localhost:5173
- ✅ Express server em http://localhost:3001
- ✅ Frontend + Backend conectados
- ✅ Sua documentação completa

## 🧪 Teste a Conexão

Na página do seu projeto gerado, clique em **"Testar Backend"**.

Se aparecer "Backend OK!" em verde, tudo está funcionando corretamente!

## 💡 Próximos Passos

1. Explore o código gerado
2. Leia a documentação em `docs/`
3. Adicione novas features
4. Conecte um banco de dados
5. Deploy para a nuvem

---

## 🆘 Se Não Conseguir Encontrar

### Opção 1: Pelo Explorador (Windows)

1. Abra o **Explorador de Arquivos**
2. Na barra de endereço, cole:
```
C:\Users\bleao\ai-software-factory\outputs\projects
```
3. Pressione **Enter**
4. Você verá a pasta com seu projeto

### Opção 2: Pelo Terminal

```bash
# Abra PowerShell ou CMD
cd c:\Users\bleao\ai-software-factory\outputs\projects
dir
```

Você verá todas as pastas de projetos gerados.

### Opção 3: Procurar por Todos os Projetos

```bash
# PowerShell
Get-ChildItem -Path "c:\Users\bleao\ai-software-factory\outputs\projects" -Recurse

# CMD
dir c:\Users\bleao\ai-software-factory\outputs\projects /s
```

---

## 🎬 Vídeo/Resumo Rápido

```
1. http://localhost:5173 (Frontend)
              ↓
2. Cole sua ideia no campo
              ↓
3. Clique em "Gerar Projeto"
              ↓
4. Aguarde 30-60 segundos
              ↓
5. Veja a página de resultados
              ↓
6. Arquivos em: C:\Users\bleao\ai-software-factory\outputs\projects\[seu-projeto-id]
              ↓
7. Abra 2 terminais e rode backend e frontend
              ↓
8. 🎉 Seu projeto está rodando!
```

---

**Tudo pronto! Vá em frente e gere seu primeiro projeto! 🚀**
