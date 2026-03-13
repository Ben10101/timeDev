# 🎯 Como Encontrar Seus Projetos Gerados

## 🔍 Caminho Rápido

**Abra o Explorador de Arquivos e vá para:**

```
C:\Users\bleao\ai-software-factory\outputs\projects
```

Copie e cole esse endereço na barra de endereço do Explorador.

---

## 📋 3 Formas de Encontrar

### ✅ FORMA 1: Explorador (Mais Fácil)

1. **Abra o Explorador de Arquivos** (Windows + E)
2. **Clique na barra de endereço** (no topo)
3. **Cole este caminho:**
   ```
   C:\Users\bleao\ai-software-factory\outputs\projects
   ```
4. **Pressione Enter**
5. ✅ Você verá as pastas dos seus projetos!

---

### ✅ FORMA 2: Botão Find Projects (RECOMENDADO)

Na raiz do projeto AI Software Factory, há um arquivo:
```
find_projects.bat
```

**Duplo clique nele!** 

Ele te mostra:
- ✅ Lista de todos os projetos
- ✅ Opções para abrir no Explorador
- ✅ Opções para abrir Terminal
- ✅ Tudo automatizado!

---

### ✅ FORMA 3: Terminal/PowerShell

Abra CMD ou PowerShell e execute:

```bash
# Ir até a pasta
cd c:\Users\bleao\ai-software-factory\outputs\projects

# Listar todos os projetos
dir

# Ver mais detalhes
dir /s
```

---

## 📂 O Que Você Verá

Dentro de `outputs\projects\` você encontrará pastas assim:

```
seu-projeto-a1b2c3d4
seu-projeto-e5f6g7h8
seu-projeto-i9j0k1l2
```

Cada pasta contém:
- **frontend/** - App React
- **backend/** - Servidor Express
- **docs/** - Documentação

---

## 🎯 Passo a Passo Visual

```
[Explorador de Arquivos]
        ↓
[Barra de Endereço]
        ↓
Colar: C:\Users\bleao\ai-software-factory\outputs\projects
        ↓
[Enter]
        ↓
[Vê suas pastas de projeto]
        ↓
[Double-click em uma pasta]
        ↓
[frontend, backend, docs aparecem]
        ↓
[Pronto! Você encontrou!]
```

---

## ⚠️ Ainda Não Aparece Nada?

Se a pasta está vazia, significa que **você ainda não gerou nenhum projeto**.

### Como Gerar:

1. Abra http://localhost:5173 no navegador
2. Na caixa de texto, escreva uma ideia (ex: "Sistema de tarefas")
3. Clique em "Gerar Projeto"
4. Aguarde 30-60 segundos
5. Tecnicamente as pastas vão aparecer em `outputs\projects\`

---

## 📝 Exemplo de Estrutura Completa

Quando você tiver um projeto, verá:

```
outputs/
└── projects/
    └── seu-projeto-abc123def456/
        ├── frontend/
        │   ├── src/
        │   │   ├── App.jsx
        │   │   ├── main.jsx
        │   │   └── index.css
        │   ├── index.html
        │   ├── package.json
        │   ├── vite.config.js
        │   ├── node_modules/
        │   └── .gitignore
        │
        ├── backend/
        │   ├── src/
        │   │   ├── server.js
        │   │   ├── routes/
        │   │   └── controllers/
        │   ├── package.json
        │   ├── node_modules/
        │   └── .env.example
        │
        └── docs/
            ├── BACKLOG.md
            ├── REQUIREMENTS.md
            └── ARCHITECTURE.md
```

---

## 🚀 Assim que Encontrar

1. **Abra 2 terminais**

2. **Terminal 1 (Backend):**
   ```bash
   cd seu-projeto-abc123def456\backend
   npm install
   npm start
   ```

3. **Terminal 2 (Frontend):**
   ```bash
   cd seu-projeto-abc123def456\frontend
   npm install
   npm run dev
   ```

4. **Pronto!** Seu projeto está rodando em http://localhost:5173

---

## 💡 Pro Tips

- Copie/Cole o caminho completo da pasta para abrir facilitado
- Use a seta "Voltar" do Explorador para voltar
- Crie um atalho na Área de Trabalho para acesso rápido
- Use `find_projects.bat` para automação

---

**Agora você sabe como encontrar seus projetos! 🎉**
